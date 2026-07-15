/**
 * Billable-unit gate — TWO AXES: program (eligibility) × service_type (grain).
 *
 * ELIGIBILITY is the program. Only the DMH-regulated SATOP family bills the State in
 * units; a non-SATOP program (ANGER_MANAGEMENT, OPIOID_RECOVERY, GAMBLING_RECOVERY,
 * INDIVIDUAL_COUNSELING), a null/blank program, or an unresolved client are NOT eligible
 * and the units control does not render. Eligibility reuses the existing isSatopProgram()
 * (config/programVocab.ts) — there is no parallel SATOP test here.
 *
 * GRAIN is the service_type (the WS3 accrual category). Unit-based behavioral-health
 * billing does NOT use one grain: individual counseling bills per 15-minute unit (HCPCS
 * H0004), group counseling per 45-minute unit (H0005), each with its own max-units cap.
 *
 * TODAY EVERY GRAIN IS UNSET. `counseling` is deliberately null alongside education and
 * rehabilitative_support: live data (a SATOP Group session, 120–180 min, service_type=
 * 'counseling') proves the vocabulary cannot tell individual from group, so no honest
 * grain can be asserted for it. NET EFFECT: the picker renders for NOTHING today — the
 * mechanism, schema, and gate ship, but the grain table stays empty until David supplies
 * the procedure codes (or a real individual/group axis exists). This is intended and
 * correct; do NOT invent a service_type to make something render. `procedureCode` is null
 * everywhere until the DMH contract table lands. See DEFERRED.md #11. Count only — no dollars.
 */
import type { ServiceType } from '../types';
import { isSatopProgram } from './programVocab';

export interface UnitGrain {
  /** Minutes per billable unit. null = grain not yet configured for this service type. */
  unitMinutes: number | null;
  /** Max units billable on a single session (per-session cap). Never exceeds the DB
   *  CHECK ceiling of 12 (see 20260715_billable_units.sql). */
  maxUnits: number;
  /** HCPCS / procedure code for this service type — null until David supplies ACS's
   *  DMH contract table. UI must never present this as a submitted/accepted code. */
  procedureCode: string | null;
}

/**
 * Grain by service_type. EVERY entry's `unitMinutes` is UNSET today (see module header):
 * `counseling` bundles individual AND group, live data proves it, so no grain is asserted
 * for any category until the individual/group split exists. Keyed off the SAME service_type
 * vocabulary the completion gate requires (the "Session category" select).
 */
export const UNIT_GRAIN_BY_SERVICE_TYPE: Record<ServiceType, UnitGrain> = {
  // UNSET: counseling bundles individual and group; live data (SATOP Group, 120–180 min,
  // service_type=counseling) proves the vocabulary cannot split them. No grain is
  // asserted until the individual/group split exists.
  counseling:             { unitMinutes: null, maxUnits: 12, procedureCode: null },
  // Group education (OEP + group education) — group grain unconfirmed, unset. No guess.
  education:              { unitMinutes: null, maxUnits: 12, procedureCode: null },
  // Group rehabilitative support (CIP group) — group grain unconfirmed, unset. No guess.
  rehabilitative_support: { unitMinutes: null, maxUnits: 12, procedureCode: null },
  // Non-program — never billed as a unit.
  other:                  { unitMinutes: null, maxUnits: 12, procedureCode: null },
};

/**
 * Grain for a service_type ONLY — the GRAIN axis in isolation, no eligibility check. The
 * display path (formatUnits) needs the grain to compute minutes without re-deciding
 * eligibility. Returns null when the service type has no entry OR its `unitMinutes` is
 * unset (which, today, is all of them). Never guesses a grain.
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
 *   2) GRAIN — the `service_type` has a configured grain (none do today → always null).
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
 * [1, maxUnits]. A PREFILL suggestion, not an assertion — the clinician can change it.
 * Callers pass a grain whose `unitMinutes` is non-null (from unitGrainFor); the guard is
 * belt-and-suspenders.
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
