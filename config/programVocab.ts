/**
 * Program vocabulary — the SINGLE normalization boundary for `clients.program_type`.
 *
 * Same disease, same cure as the status fix (migration 20260611): a free-text
 * column drifted into many spellings of the same program ('SROP' vs 'SATOP Level
 * IV'; 'Anger Management' vs 'ANGER MANAGEMENT'), and the engine hard-cased the
 * canonical spelling — so a SATOP-level client stored as 'SROP' never reached the
 * SATOP rules and fell through to the "no rule pack mapped" dead-end.
 *
 * The cure: ONE canonical value set + ONE conversion function. Every place that
 * decides routing/labels passes the raw column through normalizeProgram() — never
 * a scattered `program === 'SATOP'` literal. The DB CHECK (migration
 * 20260616) enforces the canonical set going forward; the alias map below still
 * resolves any legacy/free-text value defensively at read time.
 *
 * Key design rule (the clinical control): a SATOP-LEVEL program name (SROP/CIP)
 * yields `program:'SATOP'` so the client reaches the level model, and an
 * `impliedLevel` for CONTEXT (forms/label expectations) — but impliedLevel NEVER
 * activates the completion gate. Only the clinician-SIGNED placement determination
 * (facts.determinedLevel) sets the gate. A freshly-enrolled SROP client with no
 * determination therefore reads the honest "Completion not established — sign a
 * determination" state, not a fabricated pass.
 */
import type { SatopLevel } from './satopFees';

/** The nine canonical `program_type` values (CHECK-enforced post 20260616). */
export type CanonicalProgram =
  | 'SATOP'              // generic SATOP — level comes from the signed determination
  | 'OEP' | 'WIP' | 'CIP' | 'SROP'   // SATOP level-named (Levels I–IV)
  | 'OPIOID_RECOVERY' | 'GAMBLING_RECOVERY'
  | 'ANGER_MANAGEMENT' | 'INDIVIDUAL_COUNSELING';

export const CANONICAL_PROGRAMS: CanonicalProgram[] = [
  'SATOP', 'OEP', 'WIP', 'CIP', 'SROP',
  'OPIOID_RECOVERY', 'GAMBLING_RECOVERY', 'ANGER_MANAGEMENT', 'INDIVIDUAL_COUNSELING',
];

/** SATOP-family level-named programs → the SATOP level they imply. CONTEXT ONLY —
 *  the SIGNED determination, not this, drives completion gating. */
const SATOP_FAMILY_LEVEL: Partial<Record<CanonicalProgram, SatopLevel>> = {
  OEP: 'I', WIP: 'II', CIP: 'III', SROP: 'IV',
};

/** Legacy / free-text spellings → canonical. Keyed by UPPER+trim so any casing
 *  resolves (pre-migration rows, stray input). The migration rewrites the stored
 *  values to canonical; this keeps the read path correct in the meantime. */
const PROGRAM_ALIASES: Record<string, CanonicalProgram> = {
  'SATOP LEVEL I': 'OEP',
  'SATOP LEVEL II': 'WIP',
  'SATOP LEVEL III': 'CIP',
  'SATOP LEVEL IV': 'SROP',
  'ANGER MANAGEMENT': 'ANGER_MANAGEMENT',
  'INDIVIDUAL COUNSELING': 'INDIVIDUAL_COUNSELING',
  'COMPULSIVE GAMBLING': 'GAMBLING_RECOVERY',
};

export interface NormalizedProgram {
  /** The program key the engine ROUTES on — 'SATOP' for every SATOP-family value,
   *  the canonical value otherwise. This is what feeds `facts.program`. */
  program: string;
  /** The canonical stored vocabulary value (what display/filter helpers key on). */
  canonical: string;
  /** SATOP level implied by a level-named program (SROP→'IV', CIP→'III'). CONTEXT
   *  ONLY — never sets the gate (the signed determination does). null for generic
   *  SATOP and non-SATOP programs. */
  impliedLevel: SatopLevel | null;
}

/** THE one conversion boundary. Pass any raw `program_type` through this. */
export function normalizeProgram(raw: string | null | undefined): NormalizedProgram {
  const key = String(raw ?? '').trim().toUpperCase();
  const canonical = (PROGRAM_ALIASES[key] ?? key) as CanonicalProgram;
  const impliedLevel = SATOP_FAMILY_LEVEL[canonical] ?? null;
  const isSatopFamily = canonical === 'SATOP' || canonical in SATOP_FAMILY_LEVEL;
  return { program: isSatopFamily ? 'SATOP' : canonical, canonical, impliedLevel };
}

/** Human display labels, keyed by canonical value. The single source for the
 *  client-card / list / attendee labels (no scattered per-component literals). */
export const PROGRAM_LABELS: Record<CanonicalProgram, string> = {
  SATOP: 'SATOP',
  OEP: 'SATOP — OEP (Level I)',
  WIP: 'SATOP — WIP (Level II)',
  CIP: 'SATOP — CIP (Level III)',
  SROP: 'SATOP — SROP (Level IV)',
  OPIOID_RECOVERY: 'Opioid Recovery',
  GAMBLING_RECOVERY: 'Gambling Recovery',
  ANGER_MANAGEMENT: 'Anger Management',
  INDIVIDUAL_COUNSELING: 'Individual Counseling',
};

/** Display label for any raw `program_type` (normalizes first; unknown → as-is). */
export const programLabel = (raw: string | null | undefined): string =>
  PROGRAM_LABELS[normalizeProgram(raw).canonical as CanonicalProgram] ?? String(raw ?? '');

/** True iff the raw program routes as SATOP (generic SATOP or any level name). */
export const isSatopProgram = (raw: string | null | undefined): boolean =>
  normalizeProgram(raw).program === 'SATOP';

/** Inverse of SATOP_FAMILY_LEVEL: a signed determination level → the canonical
 *  SATOP-family program it places into (IV→SROP, III→CIP, II→WIP, I→OEP). Used by
 *  the front-door "Place & Activate" conversion to set program_type from the
 *  clinician-signed determined level — never from the prospect. */
export const programForLevel = (level: SatopLevel): CanonicalProgram => {
  switch (level) {
    case 'I': return 'OEP';
    case 'II': return 'WIP';
    case 'III': return 'CIP';
    case 'IV': return 'SROP';
  }
};
