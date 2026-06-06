/**
 * WS2.5 — Compliance Clock truth-table witness (colocated, like placementEngine.truthTable).
 *
 * Asserts every status at the BOUNDARIES against an independent, hand-computed oracle:
 *   • screening at +6mo (valid/due_soon) vs +6mo+1d (expired), and the
 *     SCREENING_DUE_SOON_DAYS threshold ±1;
 *   • certificate at the window day (daysRemaining 0, due_soon) vs +1 (window_elapsed),
 *     and off-by-one before the deadline; DOR is static informational (never at-risk);
 *   • the fees-paid gate (null / settled / outstanding);
 *   • the at-risk roll-up count.
 *
 * Thresholds come from the SAME exported constants the engine uses (no drift). There
 * is no test runner in the repo — run this in the real bundle via the dev server:
 *   (await import('/services/complianceClock.truthTable.ts')).runClockTruthTable().text
 */
import {
  computeComplianceClock,
  SCREENING_DUE_SOON_DAYS,
  CERT_WINDOW_DAYS,
  type ClockItemKey,
  type ClockStatus,
  type ClockInput,
} from './complianceClock';
import { screeningValidity } from './placementEngine';

interface Expect { status: ClockStatus; atRisk: boolean; daysRemaining?: number; }
interface Case { name: string; input: ClockInput; asOf: Date; expect: Partial<Record<ClockItemKey, Expect>>; }

const D = (y: number, m: number, d: number) => new Date(y, m - 1, d); // 1-based month
const shift = (ymd: string, days: number): Date => {
  const [y, m, dd] = ymd.split('-').map(Number);
  const x = new Date(y, m - 1, dd);
  x.setDate(x.getDate() + days);
  return x;
};

const SCREEN = '2026-01-01';
// validUntil from the REAL rule (screeningValidity), so screening boundaries can't drift.
const VALID_UNTIL = screeningValidity(SCREEN, D(2026, 1, 1))!.validUntil; // '2026-07-01'
const COMPLETION = '2026-06-01';

const cases: Case[] = [
  // ── Screening window (reuses WS1 screeningValidity) ──
  { name: 'screening: far inside → ok', input: { screeningDate: SCREEN }, asOf: D(2026, 2, 1),
    expect: { screening_window: { status: 'ok', atRisk: false } } },
  { name: `screening: ${SCREENING_DUE_SOON_DAYS + 1}d left → ok (just above threshold)`, input: { screeningDate: SCREEN }, asOf: shift(VALID_UNTIL, -(SCREENING_DUE_SOON_DAYS + 1)),
    expect: { screening_window: { status: 'ok', atRisk: false, daysRemaining: SCREENING_DUE_SOON_DAYS + 1 } } },
  { name: `screening: ${SCREENING_DUE_SOON_DAYS}d left → due_soon (threshold)`, input: { screeningDate: SCREEN }, asOf: shift(VALID_UNTIL, -SCREENING_DUE_SOON_DAYS),
    expect: { screening_window: { status: 'due_soon', atRisk: true, daysRemaining: SCREENING_DUE_SOON_DAYS } } },
  { name: 'screening: +6mo exactly (= validUntil) → still valid (due_soon, days 0)', input: { screeningDate: SCREEN }, asOf: shift(VALID_UNTIL, 0),
    expect: { screening_window: { status: 'due_soon', atRisk: true, daysRemaining: 0 } } },
  { name: 'screening: +6mo +1d → expired', input: { screeningDate: SCREEN }, asOf: shift(VALID_UNTIL, 1),
    expect: { screening_window: { status: 'expired', atRisk: true, daysRemaining: -1 } } },
  { name: 'screening: none on file → not_applicable', input: { screeningDate: null }, asOf: D(2026, 6, 1),
    expect: { screening_window: { status: 'not_applicable', atRisk: false } } },

  // ── Fees-paid gate (reuses isBalanceSettled) ──
  { name: 'fees: null balance → not_applicable', input: { balance: null }, asOf: D(2026, 6, 1),
    expect: { fees_paid: { status: 'not_applicable', atRisk: false } } },
  { name: 'fees: balance 0 → ok', input: { balance: 0 }, asOf: D(2026, 6, 1),
    expect: { fees_paid: { status: 'ok', atRisk: false } } },
  { name: 'fees: credit (-50) → ok', input: { balance: -50 }, asOf: D(2026, 6, 1),
    expect: { fees_paid: { status: 'ok', atRisk: false } } },
  { name: 'fees: outstanding 150 → blocked', input: { balance: 150 }, asOf: D(2026, 6, 1),
    expect: { fees_paid: { status: 'blocked', atRisk: true } } },

  // ── Certificate within CERT_WINDOW_DAYS of completion ──
  { name: 'cert: not completed → not_applicable', input: { completionDate: null }, asOf: D(2026, 6, 1),
    expect: { certificate_7day: { status: 'not_applicable', atRisk: false } } },
  { name: 'cert: completion day → due_soon (full window left)', input: { completionDate: COMPLETION }, asOf: shift(COMPLETION, 0),
    expect: { certificate_7day: { status: 'due_soon', atRisk: true, daysRemaining: CERT_WINDOW_DAYS } } },
  { name: `cert: +${CERT_WINDOW_DAYS - 1}d → due_soon (off-by-one before deadline)`, input: { completionDate: COMPLETION }, asOf: shift(COMPLETION, CERT_WINDOW_DAYS - 1),
    expect: { certificate_7day: { status: 'due_soon', atRisk: true, daysRemaining: 1 } } },
  { name: `cert: +${CERT_WINDOW_DAYS}d (deadline day) → due_soon, days 0`, input: { completionDate: COMPLETION }, asOf: shift(COMPLETION, CERT_WINDOW_DAYS),
    expect: { certificate_7day: { status: 'due_soon', atRisk: true, daysRemaining: 0 } } },
  { name: `cert: +${CERT_WINDOW_DAYS + 1}d → window_elapsed`, input: { completionDate: COMPLETION }, asOf: shift(COMPLETION, CERT_WINDOW_DAYS + 1),
    expect: { certificate_7day: { status: 'window_elapsed', atRisk: true, daysRemaining: -1 } } },

  // ── DOR notification — STATIC informational (auto-notified by DMH per 3.206(14)(A); never at-risk) ──
  { name: 'dor: not completed → informational (never at-risk)', input: { completionDate: null }, asOf: D(2026, 6, 1),
    expect: { dor_notification: { status: 'informational', atRisk: false } } },
  { name: 'dor: just completed → still informational (never due_soon)', input: { completionDate: COMPLETION }, asOf: shift(COMPLETION, 0),
    expect: { dor_notification: { status: 'informational', atRisk: false } } },
  { name: 'dor: long after completion → still informational (never window_elapsed)', input: { completionDate: COMPLETION }, asOf: shift(COMPLETION, 60),
    expect: { dor_notification: { status: 'informational', atRisk: false } } },
];

export interface ClockTruthTableResult { total: number; passed: number; failed: number; failures: string[]; text: string; }

export function runClockTruthTable(): ClockTruthTableResult {
  const failures: string[] = [];
  let total = 0, passed = 0;

  for (const c of cases) {
    const clock = computeComplianceClock(c.input, c.asOf);
    for (const key of Object.keys(c.expect) as ClockItemKey[]) {
      const exp = c.expect[key]!;
      const item = clock.items.find((i) => i.key === key)!;
      total++;
      const okStatus = item.status === exp.status;
      const okRisk = item.atRisk === exp.atRisk;
      const okDays = exp.daysRemaining === undefined || item.daysRemaining === exp.daysRemaining;
      if (okStatus && okRisk && okDays) passed++;
      else failures.push(
        `✗ ${c.name} [${key}]: got {status:${item.status}, atRisk:${item.atRisk}, days:${item.daysRemaining}} ` +
        `expected {status:${exp.status}, atRisk:${exp.atRisk}${exp.daysRemaining !== undefined ? `, days:${exp.daysRemaining}` : ''}}`,
      );
    }
  }

  // At-risk roll-up: a fully exposed client (expired screening + outstanding fees + cert window
  // elapsed) → 3. DOR is informational (auto-notified by DMH per 3.206(14)(A)), never counted.
  total++;
  const allRisk = computeComplianceClock({ screeningDate: SCREEN, balance: 150, completionDate: COMPLETION }, shift(VALID_UNTIL, 1));
  if (allRisk.atRiskCount === 3) passed++; else failures.push(`✗ at-risk roll-up (all exposed): got ${allRisk.atRiskCount} expected 3 (DOR is informational, never at-risk)`);

  // A clean active client (screening ok, fees clear, not completed) → 0.
  total++;
  const noRisk = computeComplianceClock({ screeningDate: SCREEN, balance: 0, completionDate: null }, D(2026, 2, 1));
  if (noRisk.atRiskCount === 0) passed++; else failures.push(`✗ at-risk roll-up (clean): got ${noRisk.atRiskCount} expected 0`);

  const text =
    `Compliance Clock truth table: ${passed}/${total} ${passed === total ? '✓ all green' : '✗ FAILURES'}` +
    `\nConstants asserted: SCREENING_DUE_SOON_DAYS=${SCREENING_DUE_SOON_DAYS}, CERT_WINDOW_DAYS=${CERT_WINDOW_DAYS} (DOR = static informational, no window)` +
    (failures.length ? '\n' + failures.join('\n') : '');

  return { total, passed, failed: total - passed, failures, text };
}
