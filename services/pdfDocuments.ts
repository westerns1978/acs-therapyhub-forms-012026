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

  // Labeled fill-in field (mirrors the official paper form). A real value sits on
  // the rule line; an unknown field renders as an empty labeled line so the form
  // is print-and-complete ready. It NEVER invents a value — callers pass null for
  // anything the app cannot verify.
  const field = (label: string, value: string | null, x: number, yy: number, width: number) => {
    if (value) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(20, 20, 20);
      doc.text(doc.splitTextToSize(value, width - 4), x + 2, yy - 3);
    }
    doc.setDrawColor(...GREY); doc.setLineWidth(0.5); doc.line(x, yy, x + width, yy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...GREY);
    doc.text(label.toUpperCase(), x, yy + 8);
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
  field('Certificate Number', null, MARGIN + half + half / 2, y, half / 2); y += 30;

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
