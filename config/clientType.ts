/**
 * Client-type vocabulary — the OPERATIONAL / scheduling-funnel axis David asked for.
 * DISTINCT from clinical `program_type` (config/programVocab.ts), which drives the
 * determination/completion gate. client_type only categorizes how a client is scheduled.
 *
 * 2026-07-08 (sched step 11): David's 7/7 9-token list (SERIES..EVAL) was ADDED to the
 * original 6-token straw man (SATOP..INDIVIDUAL, migration 20260629) — NON-DESTRUCTIVELY.
 * No existing client row's client_type value was changed; see migration
 * 20260708_sched11_client_type_extend.sql for the live before/after count witness. To
 * revise further, keep this in lock-step with the DB CHECK:
 *   1) this file — edit CLIENT_TYPES + CLIENT_TYPE_LABELS (+ NEEDS_REVIEW_TOKENS below);
 *   2) the DB CHECK — drop+recreate `clients_client_type_check`.
 *
 * The CHECK constraint is the DB source of truth; this is the display source of truth.
 * Keep the two token sets identical.
 */
export type ClientType =
  // Original straw man (migration 20260629) — kept valid, unchanged.
  | 'SATOP'
  | 'DOT'
  | 'RELAPSE_PREVENTION'
  | 'ANGER_MANAGEMENT'
  | 'GAMBLING_RECOVERY'
  | 'INDIVIDUAL'
  // David's 7/7 additions.
  | 'SERIES'
  | 'EAP'
  | 'CIP'
  | 'SROP'
  | 'DWI_COURT'
  | 'OP'
  | 'RP'
  | 'REACT'
  | 'EVAL';

export const CLIENT_TYPES: ClientType[] = [
  'SATOP', 'DOT', 'RELAPSE_PREVENTION', 'ANGER_MANAGEMENT', 'GAMBLING_RECOVERY', 'INDIVIDUAL',
  'SERIES', 'EAP', 'CIP', 'SROP', 'DWI_COURT', 'OP', 'RP', 'REACT', 'EVAL',
];

/** Display labels, keyed by token. The single source for the client-type badge text.
 *  RELAPSE_PREVENTION's label calls out "(RP)" so it visually reads as the same concept
 *  as the new RP token — "RP maps clean" (Dan, 7/8) — WITHOUT remapping the stored value. */
export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  SATOP: 'SATOP / DUI Offender',
  DOT: 'DOT / SAP',
  RELAPSE_PREVENTION: 'Relapse Prevention (RP) / Outpatient',
  ANGER_MANAGEMENT: 'Anger Management',
  GAMBLING_RECOVERY: 'Gambling Recovery',
  INDIVIDUAL: 'Individual Counseling',
  SERIES: 'Series',
  EAP: 'EAP',
  CIP: 'CIP',
  SROP: 'SROP',
  DWI_COURT: 'DWI Court',
  OP: 'OP',
  RP: 'RP',
  REACT: 'REACT',
  EVAL: 'Eval',
};

/** Label for any raw client_type value (unknown/legacy → shown as-is; null/empty → ''). */
export const clientTypeLabel = (raw: string | null | undefined): string =>
  CLIENT_TYPE_LABELS[(raw ?? '') as ClientType] ?? String(raw ?? '');

/**
 * Straw-man tokens with NO confident 1:1 mapping onto David's 9-token list. Untagged (null)
 * clients are the other flagged case. "No row is remapped by guess" (Dan, 7/8) — these stay
 * exactly as stored; this is a pure UI surfacing so David/staff can re-tag deliberately,
 * in-app, rather than the ambiguity being invisible. RELAPSE_PREVENTION is deliberately
 * EXCLUDED — "RP maps clean," so it does not need review.
 */
const NEEDS_REVIEW_LEGACY_TOKENS: readonly string[] = ['ANGER_MANAGEMENT', 'GAMBLING_RECOVERY'];

export const needsClientTypeReview = (raw: string | null | undefined): boolean =>
  !raw || NEEDS_REVIEW_LEGACY_TOKENS.includes(raw);
