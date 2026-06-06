/**
 * ACS TherapyHub — Audit-ready PDF documents (client-side, jsPDF).
 *
 * Two DMH-submittable documents:
 *   1. Completion Certificate — generated ONLY when the deterministic compliance
 *      engine confirms the program's completion-gating rules are MET. The guard is
 *      enforced here too (throws if not eligible), so a "complete" certificate can
 *      never be fabricated — the engine's verdict is the sole authority.
 *   2. Status / Progress Report — generatable anytime; shows real hours/days,
 *      engine flags with CSR citations, and not-yet-verifiable items.
 *
 * No server, no AI. Pulls from existing client fields + engine verdicts.
 */
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import type { CompletionAssessment, RuleVerdict } from './complianceEngine';
import type { DocumentFile } from '../types';

// Shared jsPDF "kit" — brand palette + letter geometry. Exported so a separate
// renderer (e.g. services/paymentReceipt.ts) can reuse the SAME plumbing instead
// of forking it; nothing here is cert-specific.
export const MAROON: [number, number, number] = [139, 30, 36]; // #8B1E24 (ACS brand)
export const SLATE: [number, number, number] = [71, 85, 105];
export const GREY: [number, number, number] = [148, 163, 184];

export const MARGIN = 56;        // pt
export const PAGE_W = 612;       // letter width (pt)
export const PAGE_H = 792;       // letter height (pt)
export const CONTENT_W = PAGE_W - MARGIN * 2;

export function fmtDate(d?: string | null): string {
  if (!d) return '—';
  // Parse date-only strings (YYYY-MM-DD, e.g. DOB / program_end_date columns) as
  // LOCAL midnight. `new Date('YYYY-MM-DD')` parses as UTC midnight, which renders
  // a day early in any behind-UTC timezone (e.g. Central) — so DOB and Completion
  // Date would drift back one day on the certificate. Full timestamps parse as-is.
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00') : new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
function clientIdOf(c: any): string {
  return c.case_number || c.caseNumber || c.id || '—';
}
function safeName(c: any): string {
  return String(c.name || 'client').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'client';
}
function num(v: any): number | null {
  return v == null || v === '' || isNaN(Number(v)) ? null : Number(v);
}

/** Branded letterhead. Returns the y-cursor below it. */
export function letterhead(doc: jsPDF): number {
  doc.setFillColor(...MAROON);
  doc.rect(0, 0, PAGE_W, 6, 'F'); // top accent bar
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...MAROON);
  doc.text('Assessment & Counseling Solutions', MARGIN, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SLATE);
  doc.text('Missouri DMH-aligned substance use disorder treatment · ACS TherapyHub', MARGIN, 65);
  doc.setDrawColor(...GREY);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, 78, PAGE_W - MARGIN, 78);
  return 104;
}

export function footer(doc: jsPDF, note: string): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GREY);
  const lines = doc.splitTextToSize(note, CONTENT_W);
  doc.text(lines, MARGIN, 760);
}

/**
 * Diagonal SAMPLE watermark — stamped on demo/sample documents (client.is_demo)
 * so a generated PDF can never be mistaken for an issued state instrument if it
 * gets emailed around. The ONLY legitimate use of the demo flag here is this
 * presentation stamp; it never affects the completion gate. Drawn last so it
 * overlays all content; light opacity keeps the document readable underneath.
 */
export function sampleWatermark(doc: jsPDF): void {
  doc.saveGraphicsState();
  const GS = (doc as any).GState;
  if (typeof GS === 'function') doc.setGState(new GS({ opacity: 0.12 }));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  doc.setTextColor(...MAROON);
  doc.text('SAMPLE — NOT VALID FOR SUBMISSION', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 35 });
  doc.restoreGraphicsState();
}

/** True when the record is a demo/sample client (drives the SAMPLE watermark). */
function isDemoClient(c: any): boolean {
  return c?.is_demo === true || c?.isDemo === true;
}

/** Key/value detail row. Returns the next y. */
function kv(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.text(label, MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 20);
  const lines = doc.splitTextToSize(value, CONTENT_W - 170);
  doc.text(lines, MARGIN + 170, y);
  return y + 16 + (lines.length - 1) * 12;
}

// ── 1. Completion Certificate ────────────────────────────────────────────────
// Builds the certificate jsPDF. The completion GATE lives here, so every path
// (direct download AND the record packet) reuses the engine's verdict and can
// never fabricate a completion.
export function buildCompletionCertificateDoc(client: any, completion: CompletionAssessment): jsPDF {
  if (!completion.eligible) {
    throw new Error(`Completion certificate blocked — criteria not met: ${completion.unmetReasons.join('; ')}`);
  }

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const isDemo = isDemoClient(client);

  // Labeled fill-in field (mirrors the official paper form). A real value sits on
  // the rule line; an unknown field renders as an empty labeled line so the form
  // is print-and-complete ready. It NEVER invents a value — callers pass null for
  // anything the app cannot verify.
  // Each field renders as: LABEL (small, on top) / value (just above the rule) /
  // the rule line. The label MUST sit above its own value+line so each value
  // groups with the correct box. (Bug fix: the label was previously drawn BELOW
  // the line while the value sat above it, so a value visually paired with the row
  // label ABOVE it — DOB landed under "City", phone under "Zip" on MO 650-7743.)
  const field = (label: string, value: string | null, x: number, yy: number, width: number) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...GREY);
    doc.text(label.toUpperCase(), x, yy - 14);
    if (value) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(20, 20, 20);
      doc.text(doc.splitTextToSize(value, width - 4), x + 2, yy - 3);
    }
    doc.setDrawColor(...GREY); doc.setLineWidth(0.5); doc.line(x, yy, x + width, yy);
  };
  const section = (text: string, yy: number): number => {
    doc.setFillColor(...MAROON); doc.rect(MARGIN, yy - 9, CONTENT_W, 14, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255);
    doc.text(text.toUpperCase(), MARGIN + 4, yy + 1);
    return yy + 24;
  };

  // ── Official title block ──
  doc.setFillColor(...MAROON); doc.rect(0, 0, PAGE_W, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...MAROON);
  let y = 40;
  for (const line of ['STATE OF MISSOURI', 'DEPARTMENT OF MENTAL HEALTH', 'DIVISION OF ALCOHOL AND DRUG ABUSE']) {
    doc.text(line, PAGE_W / 2, y, { align: 'center' }); y += 15;
  }
  doc.setFontSize(14);
  doc.text('SATOP COMPLETION CERTIFICATE', PAGE_W / 2, y + 4, { align: 'center' });
  y += 22;
  if (isDemo) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...MAROON);
    doc.text('DEMONSTRATION SAMPLE — NOT A VALID STATE CERTIFICATE', PAGE_W / 2, y, { align: 'center' });
    y += 14;
  }
  doc.setDrawColor(...SLATE); doc.setLineWidth(1); doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 22;

  // Real values only — anything not genuinely in the record stays null (blank).
  const provider = 'Assessment & Counseling Solutions';
  const dob: string | null = client.dob ?? null;
  const phone: string | null = client.primary_phone ?? client.phone ?? null;
  const completionDate = client.program_end_date ?? client.programEndDate ?? new Date().toISOString();
  const half = CONTENT_W / 2;
  const third = CONTENT_W / 3;

  // I. OFFENDER INFORMATION
  y = section('I.  Offender Information', y);
  field('Name (Last, First, MI)', client.name || null, MARGIN, y, CONTENT_W); y += 28;
  field('Street Address', null, MARGIN, y, CONTENT_W); y += 28;
  field('City', null, MARGIN, y, third - 8);
  field('State', null, MARGIN + third, y, third - 8);
  field('Zip', null, MARGIN + 2 * third, y, third); y += 28;
  field('Date of Birth', dob ? fmtDate(dob) : null, MARGIN, y, third - 8);
  field('Sex', null, MARGIN + third, y, third - 8);
  field('Phone', phone, MARGIN + 2 * third, y, third); y += 28;
  field("Driver's License No. & State", null, MARGIN, y, half - 8);
  field('Social Security Number', null, MARGIN + half, y, half); y += 30;

  // II. OFFENDER MANAGEMENT UNIT CERTIFYING COMPLETION
  y = section('II.  Offender Management Unit Certifying Completion', y);
  field('Corporate Name', provider, MARGIN, y, CONTENT_W); y += 28;
  field('Address', null, MARGIN, y, CONTENT_W); y += 28;
  field('Qualified Professional', null, MARGIN, y, half - 8);
  field('Phone', null, MARGIN + half, y, half / 2 - 8);
  // A real certificate number is assigned by the certifying OMU, never by this app.
  // For a demo record we stamp a clearly non-real value so it can't be confused
  // with an issued certificate; for a real record the field stays blank to fill in.
  field('Certificate Number', isDemo ? 'SAMPLE-DEMO-0001' : null, MARGIN + half + half / 2, y, half / 2); y += 30;

  // III. OFFENDER STATUS
  y = section('III.  Offender Status', y);
  field('Program Was Required Due To (e.g., Administrative DWI)', null, MARGIN, y, CONTENT_W); y += 30;

  // IV. SATOP COMPLETION INFORMATION
  y = section('IV.  SATOP Completion Information', y);
  field('Program Completed', completion.programLabel, MARGIN, y, CONTENT_W); y += 28;
  field('Provider Site', provider, MARGIN, y, half - 8);
  field('Completion Date', fmtDate(completionDate), MARGIN + half, y, half); y += 28;
  field('Other Approved Program (Non-SATOP)', null, MARGIN, y, CONTENT_W); y += 30;

  // V. COURT INFORMATION (IF APPLICABLE)
  y = section('V.  Court Information (If Applicable)', y);
  field('Court / Circuit Name', null, MARGIN, y, CONTENT_W); y += 28;
  field('Case Number', null, MARGIN, y, half - 8);
  field('Date of Conviction / Disposition', null, MARGIN + half, y, half); y += 26;

  // Provenance note + official form identifiers.
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(...GREY);
  doc.text(
    doc.splitTextToSize('Populated fields reflect ACS TherapyHub records verified by the deterministic compliance engine. Blank fields are not captured by the system and must be completed by the certifying Offender Management Unit. No identity or court data is system-generated.', CONTENT_W),
    MARGIN, 738
  );
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...SLATE);
  doc.text('MO 650-7743 (8-98)', MARGIN, 775);
  doc.text('DMH 9409', PAGE_W - MARGIN, 775, { align: 'right' });

  // Stamp the SAMPLE watermark last so it overlays the whole certificate.
  if (isDemo) sampleWatermark(doc);

  return doc;
}

export function downloadCompletionCertificate(client: any, completion: CompletionAssessment): void {
  buildCompletionCertificateDoc(client, completion).save(`SATOP_Completion_Certificate_${safeName(client)}.pdf`);
}

// ── 2. Status / Progress Report ──────────────────────────────────────────────
export function buildStatusReportDoc(client: any, verdicts: RuleVerdict[], completion: CompletionAssessment): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const isDemo = isDemoClient(client);
  let y = letterhead(doc);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...MAROON);
  doc.text('Compliance Status Report', MARGIN, y);
  y += 26;

  const hours = num(client.srop_hours_completed ?? client.sropHoursCompleted);
  const required = num(client.total_sessions_required ?? client.totalSessionsRequired);
  const enrolled = client.created_at ?? client.createdAt ?? null;
  const daysIn = enrolled ? Math.max(0, Math.floor((Date.now() - new Date(enrolled).getTime()) / 86400000)) : null;

  y = kv(doc, 'Client', String(client.name || '—'), y);
  y = kv(doc, 'Client ID', clientIdOf(client), y);
  y = kv(doc, 'Program', completion.programLabel, y);
  y = kv(doc, 'Enrolled', fmtDate(enrolled), y);
  y = kv(doc, 'Clinical hours', hours == null ? '—' : `${hours}${required != null ? ` / ${required} required` : ''}`, y);
  y = kv(doc, 'Days in program', daysIn == null ? '—' : String(daysIn), y);
  y = kv(doc, 'Completion status', completion.eligible
    ? 'All completion criteria MET — eligible for completion certificate.'
    : (completion.hasCriteria ? `Not yet met — ${completion.unmetReasons.join('; ')}` : completion.unmetReasons[0]), y);

  // Active flags (warning/violation) with citations.
  y += 14;
  const flags = verdicts.filter((v) => v.status === 'warning' || v.status === 'violation');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...MAROON);
  doc.text('Compliance Flags', MARGIN, y);
  y += 18;
  doc.setFontSize(9.5);
  if (flags.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...SLATE);
    doc.text('No active warnings or violations from the enforceable rules.', MARGIN, y);
    y += 18;
  } else {
    for (const f of flags) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(f.status === 'violation' ? 185 : 180, f.status === 'violation' ? 28 : 83, 28);
      doc.text(`• [${f.status.toUpperCase()}] ${f.label}`, MARGIN, y);
      y += 13;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      const detail = doc.splitTextToSize(`${f.detail}  (${f.citation})`, CONTENT_W - 14);
      doc.text(detail, MARGIN + 14, y);
      y += detail.length * 12 + 6;
    }
  }

  // Not-yet-verifiable (honesty / what needs data).
  y += 8;
  const ne = verdicts.filter((v) => v.status === 'not_enforceable');
  if (ne.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...SLATE);
    doc.text('Not Yet Verifiable (needs data)', MARGIN, y);
    y += 18;
    doc.setFontSize(9);
    for (const v of ne) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...SLATE);
      const line = doc.splitTextToSize(`• ${v.label} — ${v.detail} (${v.citation})`, CONTENT_W);
      doc.text(line, MARGIN, y);
      y += line.length * 11 + 4;
    }
  }

  footer(
    doc,
    `${isDemo ? 'DEMONSTRATION SAMPLE — sample data, not for submission. ' : ''}Generated ${fmtDate(new Date().toISOString())} by ACS TherapyHub. All counts and statuses are computed deterministically by the compliance engine from recorded data — no AI produces any verdict. Advisory; verify against current 9 CSR text before submission.`
  );

  return doc;
}

export function downloadStatusReport(client: any, verdicts: RuleVerdict[], completion: CompletionAssessment): void {
  buildStatusReportDoc(client, verdicts, completion).save(`Compliance_Status_${safeName(client)}.pdf`);
}

// ── 3. End-of-program Client Record Packet (ZIP) ─────────────────────────────
// One downloadable bundle: a generated Record Summary PDF (status-report content
// + engine verdicts), the Completion Certificate ONLY when the engine confirms
// eligibility (gate reused via buildCompletionCertificateDoc — not duplicated),
// a truthful MANIFEST, and the client's ACTUAL stored documents fetched from
// their public Storage URLs, foldered by real category. Completion is never
// implied unless the engine confirms it. Client-side only (JSZip) — no server.

const sanitizeSeg = (s: string): string =>
  (s || '').replace(/[<>:"/\\|?* -]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'file';

function friendlyMime(d: DocumentFile): string {
  const m = (d.mimeType || '').toLowerCase();
  if (m.includes('pdf')) return 'PDF';
  if (m.startsWith('image/')) return (m.split('/')[1] || 'image').toUpperCase();
  if (m.includes('word')) return 'DOC';
  if (m.includes('sheet')) return 'XLS';
  return (d.filename.split('.').pop() || 'file').toUpperCase();
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadClientRecordPacket(
  client: any,
  verdicts: RuleVerdict[],
  completion: CompletionAssessment,
  documents: DocumentFile[] = [],
): Promise<{ embedded: number; listed: number; complete: boolean }> {
  const zip = new JSZip();
  const complete = completion.eligible;

  // 1. Record Summary PDF (the cover/summary — status-report content).
  zip.file('Record_Summary.pdf', buildStatusReportDoc(client, verdicts, completion).output('blob'));

  // 2. Completion Certificate — ONLY when the engine confirms eligibility.
  if (complete) {
    zip.file('SATOP_Completion_Certificate.pdf', buildCompletionCertificateDoc(client, completion).output('blob'));
  }

  // 3. Stored documents → fetch from public URLs, folder by real category.
  const docsFolder = zip.folder('documents');
  const byCat: Record<string, DocumentFile[]> = {};
  for (const d of documents) {
    const cat = d.category || 'Uncategorized';
    (byCat[cat] = byCat[cat] || []).push(d);
  }
  let embedded = 0;
  const docLines: string[] = [];
  for (const cat of Object.keys(byCat).sort()) {
    docLines.push('', `${cat} (${byCat[cat].length}):`);
    const catFolder = docsFolder?.folder(sanitizeSeg(cat));
    for (const d of byCat[cat]) {
      const sizeKb = Math.max(1, Math.round((d.fileSize || 0) / 1024));
      const dateStr = fmtDate(d.uploadDate instanceof Date ? d.uploadDate.toISOString() : (d.uploadDate as any));
      let status = 'listed (not embedded)';
      if (d.url) {
        try {
          const res = await fetch(d.url);
          if (res.ok) {
            catFolder?.file(sanitizeSeg(d.filename), await res.blob());
            embedded++;
            status = 'embedded';
          }
        } catch {
          // CORS / network — leave listed-only; the URL is recorded below.
        }
      }
      docLines.push(`  - ${d.filename} [${friendlyMime(d)}, ${dateStr}, ~${sizeKb} KB] — ${status}${status !== 'embedded' && d.url ? ` (${d.url})` : ''}`);
    }
  }

  // 4. MANIFEST.txt — truthful packet header (no implied completion).
  const manifest = [
    'ACS THERAPYHUB — CLIENT RECORD PACKET',
    '======================================',
    `Client:    ${client.name || '—'}`,
    `Client ID: ${client.case_number || client.caseNumber || client.id || '—'}`,
    `Program:   ${completion.programLabel}`,
    `Generated: ${fmtDate(new Date().toISOString())}`,
    '',
    complete
      ? 'PACKET TYPE: COMPLETION RECORD — the compliance engine confirms all completion criteria are met; the SATOP Completion Certificate is included.'
      : `PACKET TYPE: CURRENT RECORD / STATUS — program is NOT yet complete, so no completion certificate is included.${completion.unmetReasons.length ? ' Outstanding: ' + completion.unmetReasons.join('; ') : ''}`,
    '',
    'CONTENTS:',
    '  - Record_Summary.pdf  (compliance status + engine verdicts with CSR citations)',
    ...(complete ? ['  - SATOP_Completion_Certificate.pdf'] : []),
    `  - documents/  (${embedded} of ${documents.length} stored file(s) embedded)`,
    '',
    'STORED DOCUMENTS:',
    ...(documents.length ? docLines : ['  (none on file)']),
    '',
    'All counts and statuses are computed deterministically by the compliance engine — no AI produces any verdict. Verify against current 9 CSR text before submission to the Missouri DMH.',
  ].join('\n');
  zip.file('MANIFEST.txt', manifest);

  // 5. Generate + download.
  const blob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(blob, `Client_Record_Packet_${complete ? 'Completion' : 'Status'}_${safeName(client)}.zip`);
  return { embedded, listed: documents.length, complete };
}
