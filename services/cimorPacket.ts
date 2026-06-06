/**
 * ACS TherapyHub — CIMOR Submission Packet (client-side, jsPDF).
 *
 * A deterministic, audit-grade export of a clinician-SIGNED SATOP placement
 * determination (placement_determinations), formatted for CIMOR/DMH submission.
 * Scope honesty: this is a formatted PDF, NOT a live CIMOR/DMH API integration.
 *
 * Reuses the certificate's jsPDF kit (letterhead/footer/watermark/geometry) from
 * pdfDocuments.ts — the SAME plumbing, a separate layout. Same-instance preview→
 * save (DocumentPreviewModal) gives zero drift.
 *
 * NARRATE-ONLY (the load-bearing rule):
 *   • buildCimorPacketDoc reads every level / count / verdict ONLY from the signed
 *     determination row + its basis_snapshot. It takes the AI prose as an OPAQUE
 *     STRING (`aiSummary`) and is therefore STRUCTURALLY INCAPABLE of reading a
 *     level or number from the AI. Pass null and the packet renders complete.
 *   • fetchCimorNarrative is the ONE AI touch: a single geminiJSON({summary}) call
 *     for qualitative prose, run through applyProseGuard. If the AI call fails, or
 *     the prose names a level / program / hour count, it returns null → the packet
 *     omits the narrative and renders deterministic-only. The prose is EPHEMERAL —
 *     regenerated per packet, never stored on the determination row.
 */
import { jsPDF } from 'jspdf';
import {
  MAROON,
  SLATE,
  GREY,
  MARGIN,
  PAGE_W,
  CONTENT_W,
  fmtDate,
  letterhead,
  footer,
  sampleWatermark,
} from './pdfDocuments';
import { geminiJSON } from './gemini';
import { SATOP_LEVEL_META } from './placementEngine';
import type { SatopLevel } from '../config/satopFees';

export interface CimorDetermination {
  id: string;
  client_id?: string;
  determined_level: SatopLevel;
  engine_recommended_level: SatopLevel;
  disposition: 'confirmed' | 'escalated' | 'exception_below_floor';
  deviation_reason: string | null;
  determined_at: string;
  basis_snapshot: any;
}

export interface CimorClient {
  id: string;
  name?: string | null;
  dob?: string | null;
  case_number?: string | null;
  caseNumber?: string | null;
  is_demo?: boolean | null;
  isDemo?: boolean | null;
}

export interface CimorPacketInput {
  client: CimorClient;
  determination: CimorDetermination;
  /**
   * Pre-guarded, prose-only summary, or null. Treated as an OPAQUE STRING — the
   * builder never parses a level/number out of it. Pass null for the AI-down or
   * guard-omit path; the packet renders complete without it.
   */
  aiSummary?: string | null;
}

const DISPOSITION_LABEL: Record<string, string> = {
  confirmed: 'Confirmed at the engine-recommended level',
  escalated: 'Clinical escalation above the engine recommendation',
  exception_below_floor: 'Below-floor exception (reserved — not in-app)',
};

const isDemo = (c: CimorClient): boolean => c?.is_demo === true || c?.isDemo === true;
const caseNo = (c: CimorClient): string => c?.case_number || c?.caseNumber || '—';
const safeSeg = (s: string): string =>
  String(s || 'client').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'client';

const fmtDateTime = (s?: string | null): string => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
};

export function cimorPacketFileName(client: CimorClient, det: CimorDetermination): string {
  return `CIMOR_Placement_Packet_${safeSeg(client.name || 'client')}_Level_${det.determined_level}.pdf`;
}

/**
 * Builds the CIMOR packet jsPDF. Returns the instance (NOT a blob) so the caller can
 * preview the EXACT document it later saves — zero drift, the same contract as the
 * certificate/receipt builders. PURE: a function of its inputs only (no AI, no I/O,
 * no `new Date()` of "now" — the only date is the row's determined_at).
 */
export function buildCimorPacketDoc(input: CimorPacketInput): jsPDF {
  const { client, determination: det, aiSummary } = input;
  const demo = isDemo(client);
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  let y = letterhead(doc);

  // Title block.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...MAROON);
  doc.text('SATOP Placement Determination', MARGIN, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.text('CIMOR Submission Packet — deterministic record of a clinician-signed placement', MARGIN, y);
  y += 14;
  if (demo) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...MAROON);
    doc.text('DEMONSTRATION SAMPLE — NOT FOR SUBMISSION', MARGIN, y);
    y += 12;
  }
  doc.setDrawColor(...SLATE);
  doc.setLineWidth(1);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 22;

  const section = (t: string): void => {
    doc.setFillColor(...MAROON);
    doc.rect(MARGIN, y - 9, CONTENT_W, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(t.toUpperCase(), MARGIN + 4, y + 1);
    y += 22;
  };
  const kv = (label: string, value: string): void => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text(label.toUpperCase(), MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(value, CONTENT_W - 170);
    doc.text(lines, MARGIN + 170, y);
    y += 14 + (lines.length - 1) * 12;
  };

  const snap = det.basis_snapshot || {};
  const inp = snap.inputs || {};
  const eng = snap.engine || {};
  const detMeta = SATOP_LEVEL_META[det.determined_level];
  const recMeta = SATOP_LEVEL_META[det.engine_recommended_level];

  // I. Client identifiers.
  section('I.  Client Identifiers');
  kv('Name', client.name || '—');
  kv('Date of Birth', client.dob ? fmtDate(client.dob) : '—');
  kv('Case Number', caseNo(client));
  kv('Client ID', client.id || '—');
  y += 8;

  // II. Screening basis (as captured at sign time — from the snapshot).
  section('II.  Screening Basis (as captured)');
  kv('Screening date', snap.screening_date ? fmtDate(snap.screening_date) : '—');
  kv('Prior DUI/DWI offenses', inp.offense_count != null ? String(inp.offense_count) : '—');
  kv('DUI arrests (w/ DOR action)', inp.dui_arrest_count != null ? String(inp.dui_arrest_count) : '—');
  kv('BAC', inp.bac == null ? 'Not recorded' : String(inp.bac));
  kv('SUD diagnosis', inp.sud_diagnosis === true ? 'Yes' : inp.sud_diagnosis === false ? 'No' : '—');
  kv('Prior treatment', inp.prior_treatment ? 'Yes' : 'No');
  kv('Other arrests', inp.other_arrests != null ? String(inp.other_arrests) : '—');
  kv('Life issues', inp.life_issues ? 'Yes' : 'No');
  if (inp.dri2_result) kv('DRI-2 result (captured)', String(inp.dri2_result));
  y += 8;

  // III. Engine recommendation (deterministic).
  section('III.  Engine Recommendation (deterministic · 9 CSR 30-3.206)');
  kv('Recommended floor', `${recMeta.code} — ${recMeta.label}`);
  if (eng.baseLevel && SATOP_LEVEL_META[eng.baseLevel as SatopLevel]) {
    kv('Base (offense count)', `${SATOP_LEVEL_META[eng.baseLevel as SatopLevel].code} (Level ${eng.baseLevel})`);
  }
  kv('SROP hard floor', eng.sropFloorApplies ? 'Applies (all three conditions met)' : 'Not met');
  if (Array.isArray(eng.rationale) && eng.rationale.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text('RATIONALE (FACTS)', MARGIN, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    for (const r of eng.rationale) {
      const lines = doc.splitTextToSize('• ' + String(r), CONTENT_W);
      doc.text(lines, MARGIN, y);
      y += lines.length * 11 + 2;
    }
  }
  y += 8;

  // IV. Signed determination (the headline) — prominent panel.
  section('IV.  Clinical Determination (signed)');
  const boxH = 56;
  doc.setFillColor(248, 240, 241);
  doc.rect(MARGIN, y, CONTENT_W, boxH, 'F');
  doc.setFillColor(...MAROON);
  doc.rect(MARGIN, y, 5, boxH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text('DETERMINED PLACEMENT', MARGIN + 18, y + 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...MAROON);
  doc.text(`${detMeta.code} — Level ${det.determined_level}`, MARGIN + 18, y + 42);
  y += boxH + 18;
  kv('Disposition', DISPOSITION_LABEL[det.disposition] || det.disposition);
  kv('Engine recommended', `${recMeta.code} (Level ${det.engine_recommended_level})`);
  if (det.disposition === 'escalated' && det.deviation_reason) kv('Escalation reason', det.deviation_reason);
  kv('Signed by', (snap.signed_by && snap.signed_by.name) || '—');
  kv('Signed at', fmtDateTime(det.determined_at));
  y += 8;

  // V. Clinical narrative summary (AI prose) — ONLY when present (guarded upstream).
  if (aiSummary && String(aiSummary).trim()) {
    section('V.  Clinical Narrative Summary');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text('AI-generated prose — qualitative only. Not a determination; carries no level, count, or verdict.', MARGIN, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(String(aiSummary).trim(), CONTENT_W);
    doc.text(lines, MARGIN, y);
    y += lines.length * 12 + 6;
  }

  footer(
    doc,
    `${demo ? 'DEMONSTRATION SAMPLE — sample data, not for submission. ' : ''}All identifiers, screening facts, the engine recommendation, and the signed determination above are reproduced verbatim from the clinician-signed placement record. The placement level is produced solely by the deterministic engine and confirmed by a credentialed clinician — no AI produces any level, count, or determination. This workflow requires Karen Ventimiglia, LPC methodology approval before use with any real client. Verify against current 9 CSR 30-3.206 before submission to CIMOR/DMH.`,
  );

  if (demo) sampleWatermark(doc);
  return doc;
}

// ── The one AI touch — qualitative prose, guarded, ephemeral ──────────────────

// If the AI prose names a level / program / Roman-numeral level / hour count, it is
// discarded entirely (the packet renders deterministic-only). This is the witnessable
// proof of narrate-only — not just the structural separation above.
const PROSE_BANS: RegExp[] = [/OEP|WIP|CIP|SROP/i, /level\s+(?:I|II|III|IV)\b/i, /\d+\s*hours?/i];

/** Returns the trimmed prose iff it is non-empty AND names no level/number; else null. */
export function applyProseGuard(summary: string | null | undefined): string | null {
  const s = typeof summary === 'string' ? summary.trim() : '';
  if (!s) return null;
  for (const re of PROSE_BANS) if (re.test(s)) return null;
  return s;
}

export interface NarrativeContext {
  multipleOffenses: boolean;
  repeatDuiArrests: boolean;
  elevatedBac: boolean;
  sudDiagnosis: boolean;
  priorTreatment: boolean;
  lifeIssues: boolean;
}

/**
 * The ONE AI call. Returns guarded prose, or null on ANY failure (AI-down, empty,
 * or a guard trip). NEVER throws — the packet always renders without it. The `model`
 * override exists to let a witness force the AI-down path (e.g. a bogus model).
 */
export async function fetchCimorNarrative(ctx: NarrativeContext, opts?: { model?: string }): Promise<string | null> {
  const model = opts?.model || 'gemini-2.5-flash';
  const facts = [
    ctx.multipleOffenses ? 'multiple prior impaired-driving offenses' : 'a prior impaired-driving offense',
    ctx.repeatDuiArrests ? 'repeat DUI-related arrests' : null,
    ctx.elevatedBac ? 'an elevated blood-alcohol reading on record' : null,
    ctx.sudDiagnosis ? 'a documented substance-use-disorder diagnosis' : 'no documented substance-use-disorder diagnosis',
    ctx.priorTreatment ? 'prior treatment experience' : null,
    ctx.lifeIssues ? 'co-occurring life stressors' : null,
  ]
    .filter(Boolean)
    .join('; ');

  const prompt = `You are writing ONE short qualitative clinical-summary paragraph for a Missouri SATOP placement record.
Context (qualitative only): ${facts}.
Write 2–4 sentences of professional clinical prose about the client's general presentation, history, and likely engagement.
HARD CONSTRAINTS — the paragraph MUST NOT contain, mention, or imply ANY of:
- a program level or program name (OEP, WIP, CIP, SROP);
- a Roman-numeral level (Level I, II, III, IV);
- any number of required hours or sessions;
- any specific placement determination or recommendation.
Return JSON {"summary":"<prose>"} and nothing else.`;

  try {
    const res = await geminiJSON<{ summary?: string }>(model, prompt, {
      type: 'object',
      properties: { summary: { type: 'string' } },
      required: ['summary'],
    });
    return applyProseGuard(res?.summary);
  } catch {
    return null; // AI-down → no prose; the packet renders complete without it.
  }
}
