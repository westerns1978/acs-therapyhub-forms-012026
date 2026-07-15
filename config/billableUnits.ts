/**
 * Billable-unit gate — TWO AXES: program (eligibility) × service_type (grain).
 *
 * ELIGIBILITY is the program. Only the DMH-regulated SATOP family bills the State in
 * units; a non-SATOP program (ANGER_MANAGEMENT, OPIOID_RECOVERY, GAMBLING_RECOVERY,
 * INDIVIDUAL_COUNSELING), a null/blank program, or an unresolved client are NOT eligible
 * and the units control does not render. Eligibility reuses the existing isSatopProgram()
 * (config/programVocab.ts) — there is no parallel SATOP test here.
 *
 * GRAIN is the service_type (the WS3 accrual category). The `counseling` grain is ON:
 * David confirmed 15-minute units, 1–12, on group AND session notes alike, dictated by
 * the clinician in each note (ACS Updates call, 2026-07-14, 00:20:44 — "if this view
 * right here had the number of units … from 1 to 12"; Dan: "based on 15 minute time
 * intervals?" David: "Yes."; 00:26:51 "we need … to be able to show the number of
 * units"). One grain for both group and individual — the earlier 45-minute-group
 * (H0005) theory came from an out-of-state regulation, not from ACS, and was wrong.
 *
 * education and rehabilitative_support stay UNSET — the transcript doesn't cover them;
 * no grain is guessed. `procedureCode` stays null: David specified no procedure-code
 * table, no per-code caps, no HCPCS. The 1–12 range is his, mirrored by the DB CHECK
 * (20260715_billable_units.sql). The prefill is a SUGGESTION — the clinician dictates
 * the real number at completion. Count only — no dollars live anywhere in this feature.
 */
import type { ServiceType } from '../types';
import { isSatopProgram } from './programVocab';

export interface UnitGrain {
  /** Minutes per billable unit. null = grain not yet configured for this service type. */
  unitMinutes: number | null;
  /** Max units billable on a single session (per-session cap). Never exceeds the DB
   *  CHECK ceiling of 12 (see 20260715_billable_units.sql). */
  maxUnits: number;
  /** Reserved: no procedure-code table exists — David specified none (7/14). Stays null. */
  procedureCode: string | null;
}

/**
 * Grain by service_type. Keyed off the SAME service_type vocabulary the completion gate
 * requires (the "Session category" select in AppointmentStatusModal).
 */
export const UNIT_GRAIN_BY_SERVICE_TYPE: Record<ServiceType, UnitGrain> = {
  // ON — 15-minute units, 1–12, group and individual alike. David, ACS Updates
  // 2026-07-14 00:20:44: units "from 1 to 12 … dictated in each note", confirmed
  // 15-minute intervals, on "the group and session notes" — one grain for both.
  counseling:             { unitMinutes: 15,   maxUnits: 12, procedureCode: null },
  // Group education (OEP + group education) — not covered by the 7/14 transcript; unset.
  education:              { unitMinutes: null, maxUnits: 12, procedureCode: null },
  // Group rehabilitative support (CIP group) — not covered by the 7/14 transcript; unset.
  rehabilitative_support: { unitMinutes: null, maxUnits: 12, procedureCode: null },
  // Non-program — never billed as a unit.
  other:                  { unitMinutes: null, maxUnits: 12, procedureCode: null },
};

/**
 * Grain for a service_type ONLY — the GRAIN axis in isolation, no eligibility check. The
 * display path needs the grain to compute minutes without re-deciding eligibility.
 * Returns null when the service type has no entry OR its `unitMinutes` is unset.
 * Never guesses a grain.
 */
function grainForServiceType(serviceType: ServiceType | '' | undefined | null): UnitGrain | null {
  if (!serviceType) return null;
  const g = UNIT_GRAIN_BY_SERVICE_TYPE[serviceType];
  if (!g || g.unitMinutes == null) return null;
  return g;
}

/**
 * THE two-axis gate the units picker reads. Returns a grain ONLY when BOTH hold:
 *   1) ELIGIBILITY — `program` is a SATOP-family (DMH-billable) program. isSatopProgram
 *      normalizes internally; non-SATOP, null/'' program, and an unresolved client
 *      (`undefined` — the modal passes client?.program, so a null client fails closed
 *      right here) all return false. This is the single eligibility test — no parallel one.
 *   2) GRAIN — the `service_type` has a configured grain (counseling = 15 min today).
 * A null return means the control does not render. It never guesses on either axis.
 */
export function unitGrainFor(
  program: string | null | undefined,
  serviceType: ServiceType | '' | undefined | null,
): UnitGrain | null {
  if (!isSatopProgram(program)) return null;
  return grainForServiceType(serviceType);
}

/**
 * Suggested unit count from a session's duration: round(duration / grain), clamped to
 * [1, maxUnits]. A PREFILL suggestion, not an assertion — the clinician dictates the
 * real number in the note (David, 7/14). Callers pass a grain whose `unitMinutes` is
 * non-null (from unitGrainFor); the guard is belt-and-suspenders.
 */
export function suggestedUnits(durationMinutes: number, grain: UnitGrain): number {
  if (!grain.unitMinutes) return 1;
  const raw = Math.round(durationMinutes / grain.unitMinutes);
  return Math.min(Math.max(raw, 1), grain.maxUnits);
}

/** Display string for a set unit count, e.g. "3 units (45 min)". Uses the service_type
 *  grain only (display needs no eligibility check). When no grain is configured it shows
 *  the bare count ("3 units"); null when units are unset (nothing to show). */
export function formatUnits(
  units: number | null | undefined,
  serviceType: ServiceType | '' | undefined | null,
): string | null {
  if (units == null) return null;
  const grain = grainForServiceType(serviceType);
  if (!grain) return `${units} unit${units === 1 ? '' : 's'}`;
  const mins = units * (grain.unitMinutes as number);
  return `${units} unit${units === 1 ? '' : 's'} (${mins} min)`;
}
