/**
 * Billable-unit GRAIN per WS3 service_type — the whole design of the units feature.
 *
 * Unit-based behavioral-health billing does NOT use one universal grain: individual
 * counseling bills per 15-minute unit (HCPCS H0004 pattern), group counseling per
 * 45-minute unit (H0005 pattern), and each carries a max-units-per-session cap. So the
 * grain and the cap depend on the service type — this is not a flat 1–12 picker.
 *
 * ACS's real procedure-code table has NOT been delivered by David (blocked on the DMH
 * contract). This module is the MECHANISM with a conservative default and a named gap:
 *   • the individual-counseling category gets a 15-minute grain;
 *   • every GROUP category leaves `unitMinutes` UNSET (null) — nothing guesses 15 vs 45;
 *   • `procedureCode` is null everywhere until the real table lands.
 * See DEFERRED.md "PROCEDURE CODE TABLE". This records a COUNT only — no dollars live
 * anywhere in this feature.
 */
import type { ServiceType } from '../types';

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
 * Keyed off the SAME service_type vocabulary the completion gate already requires
 * (the "Session category" select in AppointmentStatusModal). A service_type absent from
 * this map, OR one whose `unitMinutes` is null, has NO configured grain: the units
 * control does not render and nothing falls back to 15.
 */
export const UNIT_GRAIN_BY_SERVICE_TYPE: Record<ServiceType, UnitGrain> = {
  // Individual counseling — 15-min grain (H0004 pattern), the conservative default.
  // CAVEAT: this app's `counseling` category bundles BOTH individual and group
  // counseling (its label reads "Counseling (individual + group)"). Group counseling
  // bills on a different grain (H0005 ≈ 45 min); the service_type vocabulary cannot
  // separate the two, so this 15-min default is the individual case and any group
  // counseling logged under it rides that grain UNRECONCILED until David's table splits
  // it. Logged in DEFERRED.md "PROCEDURE CODE TABLE".
  counseling:             { unitMinutes: 15,   maxUnits: 12, procedureCode: null },
  // Group education (OEP + group education) — GROUP grain deliberately UNSET. No guess.
  education:              { unitMinutes: null, maxUnits: 12, procedureCode: null },
  // Group rehabilitative support (CIP group) — GROUP grain deliberately UNSET. No guess.
  rehabilitative_support: { unitMinutes: null, maxUnits: 12, procedureCode: null },
  // Non-program — never billed as a unit.
  other:                  { unitMinutes: null, maxUnits: 12, procedureCode: null },
};

/**
 * The configured grain for a service type, or null when unconfigured — meaning either
 * no entry OR `unitMinutes` is null. A null return is the single gate the UI reads to
 * decide whether the units control renders. It never guesses a grain.
 */
export function unitGrainFor(serviceType: ServiceType | '' | undefined | null): UnitGrain | null {
  if (!serviceType) return null;
  const g = UNIT_GRAIN_BY_SERVICE_TYPE[serviceType];
  if (!g || g.unitMinutes == null) return null;
  return g;
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

/** Display string for a set unit count, e.g. "3 units (45 min)". Returns null when
 *  units are unset or the service type has no configured grain (nothing to show). */
export function formatUnits(
  units: number | null | undefined,
  serviceType: ServiceType | '' | undefined | null,
): string | null {
  if (units == null) return null;
  const grain = unitGrainFor(serviceType);
  if (!grain) return `${units} unit${units === 1 ? '' : 's'}`;
  const mins = units * (grain.unitMinutes as number);
  return `${units} unit${units === 1 ? '' : 's'} (${mins} min)`;
}
