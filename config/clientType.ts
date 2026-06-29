/**
 * Client-type vocabulary — the OPERATIONAL / scheduling-funnel axis David asked for.
 * DISTINCT from clinical `program_type` (config/programVocab.ts), which drives the
 * determination/completion gate. client_type only categorizes how a client is scheduled.
 *
 * STRAW MAN (2026-06-29): these 6 tokens will be revised after David's call. To revise,
 * it is a clean two-line change kept in lock-step:
 *   1) this file — edit CLIENT_TYPES + CLIENT_TYPE_LABELS;
 *   2) the DB CHECK — drop+recreate `clients_client_type_check` (see the matching migration).
 * Nothing else hard-codes the token set; the badge reads its label from here.
 *
 * The CHECK constraint (migration 20260629) is the DB source of truth; this is the display
 * source of truth. Keep the two token sets identical.
 */
export type ClientType =
  | 'SATOP'
  | 'DOT'
  | 'RELAPSE_PREVENTION'
  | 'ANGER_MANAGEMENT'
  | 'GAMBLING_RECOVERY'
  | 'INDIVIDUAL';

export const CLIENT_TYPES: ClientType[] = [
  'SATOP', 'DOT', 'RELAPSE_PREVENTION', 'ANGER_MANAGEMENT', 'GAMBLING_RECOVERY', 'INDIVIDUAL',
];

/** Display labels, keyed by token. The single source for the client-type badge text. */
export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  SATOP: 'SATOP / DUI Offender',
  DOT: 'DOT / SAP',
  RELAPSE_PREVENTION: 'Relapse Prevention / Outpatient',
  ANGER_MANAGEMENT: 'Anger Management',
  GAMBLING_RECOVERY: 'Gambling Recovery',
  INDIVIDUAL: 'Individual Counseling',
};

/** Label for any raw client_type value (unknown/legacy → shown as-is; null/empty → ''). */
export const clientTypeLabel = (raw: string | null | undefined): string =>
  CLIENT_TYPE_LABELS[(raw ?? '') as ClientType] ?? String(raw ?? '');
