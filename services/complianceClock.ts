/**
 * ACS TherapyHub — WS2.5 Compliance Deadline Clock (deterministic, date-only, ZERO AI).
 *
 * THE single clock: per-client regulated-deadline items + status, computed purely
 * from existing facts against an INJECTED `asOf` (date-free/testable, exactly like
 * computePlacement). No model anywhere; no table — fully derived from
 * assessment_inputs (screening), placement_determinations (placed?), and clients
 * (completion date + balance).
 *
 * REUSE, DON'T REINVENT:
 *   • Screening 6-month window → WS1 `screeningValidity` (placementEngine) — imported,
 *     never re-derived.
 *   • Fees-paid gate → `isBalanceSettled` (complianceEngine) — the SAME rule the
 *     completion certificate gate uses; imported, never re-implemented.
 *
 * ADVISORY ONLY — windows & reminders, never an unresolvable alarm. There is no
 * cert-issued / DOR-sent record in the system today, so the clock can compute the
 * deterministic WINDOWS (pending / due-soon / window-elapsed) but NEVER asserts a
 * "done" state it cannot verify. A future `compliance_milestones` table would record
 * issuance/notification and enable a real closed state (logged as the follow-on).
 *
 * Thresholds are EXPORTED NAMED CONSTANTS (not inline literals) so the truth-table
 * witness asserts against the same source and Karen/David can tune them later.
 */
import { screeningValidity } from './placementEngine';
import { isBalanceSettled } from './complianceEngine';

// ── Tunable thresholds (single source; the witness asserts against these) ─────
/** Screening is flagged "re-screen soon" when this many days or fewer remain. */
export const SCREENING_DUE_SOON_DAYS = 30;
/** Certificate must issue within this many days of completion (9 CSR). */
export const CERT_WINDOW_DAYS = 7;
// DOR notification is AUTOMATIC via DMH's system on certificate issuance
// (9 CSR 30-3.206(14)(A)) — not a manual ACS deadline. The dor_notification item is a
// static informational note (never a window, never at-risk); there is no DOR constant.

export type ClockItemKey = 'screening_window' | 'fees_paid' | 'certificate_7day' | 'dor_notification';

// Advisory statuses. Note: 'window_elapsed' is deliberately NOT "overdue" — with no
// issuance/notification record we cannot prove the obligation is unmet, only that the
// advisory window has passed and should be confirmed.
export type ClockStatus =
  | 'ok'              // satisfied / not at risk
  | 'due_soon'        // inside its reminder window
  | 'window_elapsed'  // advisory window passed — confirm closure (no record to verify)
  | 'expired'         // screening only — re-screen required (resolvable)
  | 'blocked'         // fees outstanding — blocks completion
  | 'informational'   // static note — never at-risk (e.g. DOR auto-notified by DMH)
  | 'not_applicable'; // not yet relevant (e.g. cert/DOR before completion; no screening on file)

export interface DeadlineItem {
  key: ClockItemKey;
  label: string;
  status: ClockStatus;
  dueDate: string | null;        // YYYY-MM-DD, or null when not date-anchored / N/A
  daysRemaining: number | null;  // signed; negative once the window has elapsed
  atRisk: boolean;
  detail: string;                // facts only — advisory, no clinical/legal verdict
}

export interface ComplianceClock {
  asOf: string;            // YYYY-MM-DD (the injected reference date)
  items: DeadlineItem[];
  atRiskCount: number;
}

export interface ClockInput {
  screeningDate?: string | null;  // assessment_inputs.screening_date (latest)
  completionDate?: string | null; // clients.program_end_date (completion anchor)
  balance?: number | null;        // clients.balance (ledger-derived; the fees gate input)
}

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseLocalDate = (s: string): Date | null => {
  // Date-only strings parse as LOCAL midnight (no UTC day-shift); full timestamps as-is.
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
};
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
};
/** Whole-day signed difference (to − from), both normalized to local midnight. */
const daysBetween = (from: Date, to: Date) => Math.round((midnight(to).getTime() - midnight(from).getTime()) / DAY_MS);
const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;

const atRiskStatuses: ReadonlySet<ClockStatus> = new Set(['due_soon', 'window_elapsed', 'expired', 'blocked']);

// ── Item computations (each pure, date-only) ──────────────────────────────────

function screeningItem(screeningDate: string | null | undefined, asOf: Date): DeadlineItem {
  const base: DeadlineItem = {
    key: 'screening_window', label: 'Screening validity (6-month window)',
    status: 'not_applicable', dueDate: null, daysRemaining: null, atRisk: false,
    detail: 'No screening on file yet.',
  };
  if (!screeningDate) return base;
  const sv = screeningValidity(screeningDate, asOf); // REUSE — never re-derive the 6-month rule
  if (!sv) return base;
  const item: DeadlineItem = { ...base, dueDate: sv.validUntil, daysRemaining: sv.daysRemaining };
  if (sv.expired) {
    return { ...item, status: 'expired', atRisk: true,
      detail: `Screening expired — re-screen required (was valid through ${sv.validUntil}).` };
  }
  if (sv.daysRemaining <= SCREENING_DUE_SOON_DAYS) {
    return { ...item, status: 'due_soon', atRisk: true,
      detail: `Screening valid through ${sv.validUntil} — re-screen within ${sv.daysRemaining} day(s).` };
  }
  return { ...item, status: 'ok', atRisk: false,
    detail: `Screening valid through ${sv.validUntil} (${sv.daysRemaining} days remaining).` };
}

function feesItem(balance: number | null | undefined): DeadlineItem {
  const bal = balance == null ? null : Number(balance);
  if (bal == null) {
    return { key: 'fees_paid', label: 'Fees-paid gate', status: 'not_applicable',
      dueDate: null, daysRemaining: null, atRisk: false, detail: 'Balance not yet available.' };
  }
  if (isBalanceSettled(bal)) { // REUSE the completion certificate's payment-gate rule
    return { key: 'fees_paid', label: 'Fees-paid gate', status: 'ok',
      dueDate: null, daysRemaining: null, atRisk: false, detail: 'No outstanding balance.' };
  }
  return { key: 'fees_paid', label: 'Fees-paid gate', status: 'blocked', dueDate: null, daysRemaining: null,
    atRisk: true, detail: `Outstanding balance ${money(bal)} — must be cleared before the completion certificate can issue.` };
}

/** Generic post-completion window item (certificate / DOR) — advisory, never "done". */
function postCompletionItem(
  key: 'certificate_7day' | 'dor_notification',
  label: string,
  windowDays: number,
  completionDate: string | null | undefined,
  asOf: Date,
  notApplicableDetail: string,
  pendingDetail: (dueYMD: string, daysLeft: number) => string,
  elapsedDetail: (dueYMD: string) => string,
): DeadlineItem {
  if (!completionDate) {
    return { key, label, status: 'not_applicable', dueDate: null, daysRemaining: null, atRisk: false, detail: notApplicableDetail };
  }
  const comp = parseLocalDate(completionDate);
  if (!comp) {
    return { key, label, status: 'not_applicable', dueDate: null, daysRemaining: null, atRisk: false, detail: notApplicableDetail };
  }
  const due = addDays(comp, windowDays);
  const dueYMD = toYMD(due);
  const daysRemaining = daysBetween(asOf, due); // due − asOf; 0 on the deadline day, negative after
  if (daysRemaining >= 0) {
    return { key, label, status: 'due_soon', dueDate: dueYMD, daysRemaining, atRisk: true, detail: pendingDetail(dueYMD, daysRemaining) };
  }
  return { key, label, status: 'window_elapsed', dueDate: dueYMD, daysRemaining, atRisk: true, detail: elapsedDetail(dueYMD) };
}

// ── The clock ─────────────────────────────────────────────────────────────────

export function computeComplianceClock(input: ClockInput, asOf: Date): ComplianceClock {
  const items: DeadlineItem[] = [
    screeningItem(input.screeningDate, asOf),
    feesItem(input.balance),
    postCompletionItem(
      'certificate_7day', `Completion certificate (within ${CERT_WINDOW_DAYS} days)`, CERT_WINDOW_DAYS,
      input.completionDate, asOf,
      'Applies once the program is completed.',
      (dueYMD, daysLeft) => `Certificate due within ${CERT_WINDOW_DAYS} days of completion — by ${dueYMD} (${daysLeft} day(s) left).`,
      (dueYMD) => `The ${CERT_WINDOW_DAYS}-day post-completion certificate window passed on ${dueYMD}. No in-app issuance record exists — confirm the certificate was issued.`,
    ),
    // DOR notification — STATIC informational, never a deadline. Per 9 CSR
    // 30-3.206(14)(A), DMH's system notifies DOR automatically on certificate
    // issuance; there is no manual ACS window, so it never contributes to at-risk.
    {
      key: 'dor_notification',
      label: 'DOR notification',
      status: 'informational',
      dueDate: null,
      daysRemaining: null,
      atRisk: false,
      detail: "DOR is notified automatically by DMH's system on certificate issuance — no manual ACS deadline.",
    },
  ];
  // Derive at-risk from status so the rule is defined once.
  for (const it of items) it.atRisk = atRiskStatuses.has(it.status);
  return { asOf: toYMD(asOf), items, atRiskCount: items.filter((i) => i.atRisk).length };
}
