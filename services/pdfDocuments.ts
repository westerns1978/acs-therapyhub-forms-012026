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
import type { CompletionAssessment, RuleVerdict } from './complianceEngine';

const MAROON: [number, number, number] = [139, 30, 36]; // #8B1E24 (ACS brand)
const SLATE: [number, number, number] = [71, 85, 105];
const GREY: [number, number, number] = [148, 163, 184];

const MARGIN = 56;        // pt
const PAGE_W = 612;       // letter width (pt)
const CONTENT_W = PAGE_W - MARGIN * 2;

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
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
function letterhead(doc: jsPDF): number {
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

function footer(doc: jsPDF, note: string): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GREY);
  const lines = doc.splitTextToSize(note, CONTENT_W);
  doc.text(lines, MARGIN, 760);
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
export function downloadCompletionCertificate(client: any, completion: CompletionAssessment): void {
  // Hard guard — never fabricate a completion. The button is also disabled when
  // ineligible; this is defense-in-depth around the engine's verdict.
  if (!completion.eligible) {
    throw new Error(`Completion certificate blocked — criteria not met: ${completion.unmetReasons.join('; ')}`);
  }

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  let y = letterhead(doc);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...MAROON);
  doc.text('CERTIFICATE OF COMPLETION', PAGE_W / 2, y + 18, { align: 'center' });
  y += 54;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  const intro = `This certifies that the client named below has satisfied the deterministic completion requirements of the program indicated, as verified by the ACS TherapyHub compliance engine against the client's recorded treatment data.`;
  doc.text(doc.splitTextToSize(intro, CONTENT_W), MARGIN, y);
  y += 52;

  const hours = num(client.srop_hours_completed ?? client.sropHoursCompleted);
  const required = num(client.total_sessions_required ?? client.totalSessionsRequired);
  const enrolled = client.created_at ?? client.createdAt ?? null;
  const completed = client.program_end_date ?? client.programEndDate ?? new Date().toISOString();
  const csr = completion.gatingVerdicts[0]?.citation || '9 CSR 30-3.201';

  y = kv(doc, 'Client', String(client.name || '—'), y);
  y = kv(doc, 'Client ID', clientIdOf(client), y);
  y = kv(doc, 'Program', completion.programLabel, y);
  y = kv(doc, 'Clinical hours completed', hours == null ? '—' : `${hours}${required != null ? ` (minimum ${required} required)` : ''}`, y);
  y = kv(doc, 'Program duration', `${fmtDate(enrolled)} → ${fmtDate(completed)}`, y);
  y = kv(doc, 'Regulatory reference', csr, y);
  y = kv(doc, 'Date issued', fmtDate(new Date().toISOString()), y);

  // Signature block
  y += 48;
  doc.setDrawColor(...SLATE);
  doc.setLineWidth(0.7);
  doc.line(MARGIN, y, MARGIN + 240, y);
  doc.line(PAGE_W - MARGIN - 160, y, PAGE_W - MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SLATE);
  doc.text('Authorized ACS Clinician (signature)', MARGIN, y + 14);
  doc.text('Date', PAGE_W - MARGIN - 160, y + 14);

  footer(
    doc,
    'Generated by ACS TherapyHub. Completion is determined deterministically by the compliance engine from recorded treatment data; ' +
    'this certificate is issued only when all completion-gating rules are met. Verify against current 9 CSR text before submission to the Missouri Department of Mental Health.'
  );

  doc.save(`SATOP_Completion_Certificate_${safeName(client)}.pdf`);
}

// ── 2. Status / Progress Report ──────────────────────────────────────────────
export function downloadStatusReport(client: any, verdicts: RuleVerdict[], completion: CompletionAssessment): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
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
    `Generated ${fmtDate(new Date().toISOString())} by ACS TherapyHub. All counts and statuses are computed deterministically by the compliance engine from recorded data — no AI produces any verdict. Advisory; verify against current 9 CSR text before submission.`
  );

  doc.save(`Compliance_Status_${safeName(client)}.pdf`);
}
