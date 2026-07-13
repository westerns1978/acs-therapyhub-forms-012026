// Session taxonomy — single source of truth for the three-level booking cascade
// (Service Type -> Session Type -> qualified Counselors), service colors, and
// default durations. Ground truth: David's July 7 follow-up docs.
//
// Counselor entries are display names and must match counselors.name in the DB
// (post 20260708_sched1_roster_truth): John Burns, Karen Ventimiglia,
// David Yoder, Bill Sunderman, Dave L, Debra.
//
// OPEN items (do NOT resolve without David):
//   * OMU / Shelf-Life OMU / 2nd Opinion OMU color is UNCONFIRMED -> color: null
//     (render neutral, never guess).
//   * OP Group / SATOP Group have no roster given -> counselors: 'OPEN'
//     (render unfiltered). SATOP Group also has no single service subtype,
//     so its color is null; OP Group keys Yellow off the OP/RP/DOT rule.
//
// NOTE: appointments.service_type (accrual axis, 'counseling'/'other') is a
// DIFFERENT concept from ServiceType below — do not write these tokens there.

export type ServiceType = 'OP' | 'SATOP' | 'Evaluation';

export const SERVICE_TYPES: readonly ServiceType[] = ['OP', 'SATOP', 'Evaluation'];

// Color map keys off the SERVICE subtype, not the counselor:
// Yellow = OP/RP/DOT | Blue = Evaluations + EAP + Series | Green = CIP
// Pink = SROP | Grey = DWI Court + MRT | null = unconfirmed (OMU family).
export type ServiceColor = 'yellow' | 'blue' | 'green' | 'pink' | 'grey';

export const DEFAULT_SESSION_MINUTES = 60;

export interface SessionTypeDef {
  /** Stable token persisted on the appointment (session_type column). */
  id: string;
  /** Display label shown in the picker and on calendar cards. */
  label: string;
  service: ServiceType;
  /** Qualified counselor display names; 'OPEN' = no roster given (unfiltered). */
  counselors: readonly string[] | 'OPEN';
  /** null = color unconfirmed (OMU family, SATOP Group) — render neutral. */
  color: ServiceColor | null;
  durationMinutes: number;
}

const JKDB = ['John Burns', 'Karen Ventimiglia', 'David Yoder', 'Bill Sunderman'] as const;
const JK = ['John Burns', 'Karen Ventimiglia'] as const;
const JKD_DAVEL = ['John Burns', 'Karen Ventimiglia', 'David Yoder', 'Dave L'] as const;
const JKD_DEB = ['John Burns', 'Karen Ventimiglia', 'David Yoder', 'Debra'] as const;
const DB = ['David Yoder', 'Bill Sunderman'] as const;
const KDB = ['Karen Ventimiglia', 'David Yoder', 'Bill Sunderman'] as const;

export const SESSION_TYPES: readonly SessionTypeDef[] = [
  // ---- OP service (all 60m) ----
  { id: 'op_intake',        label: 'OP Intake',         service: 'OP', counselors: JKDB, color: 'yellow', durationMinutes: 60 },
  { id: 'rp_intake',        label: 'RP Intake',         service: 'OP', counselors: JKDB, color: 'yellow', durationMinutes: 60 },
  { id: 'op_1on1',          label: 'OP 1:1',            service: 'OP', counselors: JKDB, color: 'yellow', durationMinutes: 60 },
  { id: 'rp_1on1',          label: 'RP 1:1',            service: 'OP', counselors: JKDB, color: 'yellow', durationMinutes: 60 },
  { id: 'dot_1on1',         label: 'DOT 1:1',           service: 'OP', counselors: JKDB, color: 'yellow', durationMinutes: 60 },
  { id: 'series_1on1',      label: 'Series 1:1',        service: 'OP', counselors: DB,   color: 'blue',   durationMinutes: 60 },
  { id: 'eap_1on1',         label: 'EAP 1:1',           service: 'OP', counselors: ['Bill Sunderman'], color: 'blue', durationMinutes: 60 },
  { id: 'op_group',         label: 'Group',             service: 'OP', counselors: 'OPEN', color: 'yellow', durationMinutes: 60 },
  // ---- SATOP service (60m default, MRT = 15m) ----
  { id: 'omu',              label: 'OMU',               service: 'SATOP', counselors: JKDB, color: null, durationMinutes: 60 },
  { id: 'shelf_life_omu',   label: 'Shelf-Life OMU',    service: 'SATOP', counselors: JKDB, color: null, durationMinutes: 60 },
  { id: 'second_opinion_omu', label: '2nd Opinion OMU', service: 'SATOP', counselors: JKDB, color: null, durationMinutes: 60 },
  { id: 'cip_intake',       label: 'CIP Intake',        service: 'SATOP', counselors: JK,   color: 'green', durationMinutes: 60 },
  { id: 'srop_intake',      label: 'SROP Intake',       service: 'SATOP', counselors: JK,   color: 'pink',  durationMinutes: 60 },
  { id: 'dwi_court_intake', label: 'DWI Court Intake',  service: 'SATOP', counselors: ['Debra'], color: 'grey', durationMinutes: 60 },
  { id: 'cip_1on1',         label: 'CIP 1:1',           service: 'SATOP', counselors: JKD_DAVEL, color: 'green', durationMinutes: 60 },
  { id: 'srop_1on1',        label: 'SROP 1:1',          service: 'SATOP', counselors: JKD_DAVEL, color: 'pink',  durationMinutes: 60 },
  { id: 'dwi_court_1on1',   label: 'DWI Court 1:1',     service: 'SATOP', counselors: JKD_DEB,   color: 'grey',  durationMinutes: 60 },
  { id: 'mrt_1on1',         label: 'MRT 1:1',           service: 'SATOP', counselors: ['Debra'], color: 'grey',  durationMinutes: 15 },
  { id: 'satop_group',      label: 'Group',             service: 'SATOP', counselors: 'OPEN', color: null, durationMinutes: 60 },
  // ---- Evaluation service (all 60m, all Blue) ----
  { id: 'eval_cd',          label: 'CD Evaluation',     service: 'Evaluation', counselors: KDB, color: 'blue', durationMinutes: 60 },
  { id: 'eval_mh',          label: 'MH Evaluation',     service: 'Evaluation', counselors: KDB, color: 'blue', durationMinutes: 60 },
  { id: 'eval_anger',       label: 'Anger Evaluation',  service: 'Evaluation', counselors: DB,  color: 'blue', durationMinutes: 60 },
  { id: 'eval_dual',        label: 'Dual Evaluation',   service: 'Evaluation', counselors: DB,  color: 'blue', durationMinutes: 60 },
  { id: 'eval_react',       label: 'REACT Evaluation',  service: 'Evaluation', counselors: ['John Burns', 'David Yoder', 'Bill Sunderman'], color: 'blue', durationMinutes: 60 },
  { id: 'eval_oos_dui',     label: 'Out of State DUI Evaluation', service: 'Evaluation', counselors: ['David Yoder', 'Bill Sunderman', 'Karen Ventimiglia'], color: 'blue', durationMinutes: 60 },
];

export const sessionTypesForService = (service: ServiceType): SessionTypeDef[] =>
  SESSION_TYPES.filter(t => t.service === service);

export const sessionTypeById = (id: string | null | undefined): SessionTypeDef | undefined =>
  SESSION_TYPES.find(t => t.id === id);

/** Qualified counselor names for a session type; null = unfiltered (OPEN row). */
export const counselorsForSessionType = (id: string): readonly string[] | null => {
  const def = sessionTypeById(id);
  if (!def || def.counselors === 'OPEN') return null;
  return def.counselors;
};

// ── CERT-GATING SEAM (David's cert-gated therapist selector) ───────────────────────────────
// THE SINGLE place that decides which counselors may take a given session type. The booking
// modal and any future edit/reschedule counselor picker must call THIS — do not re-derive
// qualification inline, so there is exactly one plug-in point when the cert data lands.
//
// TODAY: gates on the static config matrix (counselorsForSessionType). OPEN rows and unknown
// ids fall through to the full active roster. This is NOT a real certification source —
// David's per-counselor cert/qualification list is NOT delivered yet. Do NOT fabricate cert
// data; until it exists, "qualified" == "in the matrix (or matrix is OPEN)".
//
// WHEN THE CERT LIST ARRIVES: change ONLY this function body to intersect the active roster
// with the counselors certified for `sessionTypeId` (likely keyed on the session's service).
// See DEFERRED.md §5.
export const qualifiedCounselorsFor = <C extends { name: string }>(
  sessionTypeId: string,
  activeRoster: readonly C[],
): C[] => {
  const names = counselorsForSessionType(sessionTypeId);   // null = OPEN (no roster given)
  return names === null ? [...activeRoster] : activeRoster.filter(c => names.includes(c.name));
};

export const durationForSessionType = (id: string): number =>
  sessionTypeById(id)?.durationMinutes ?? DEFAULT_SESSION_MINUTES;

/** Service color token; null = unconfirmed or unknown id — render neutral. */
export const colorForSessionType = (id: string | null | undefined): ServiceColor | null =>
  sessionTypeById(id)?.color ?? null;

// Service-color card treatment for calendar events. Mirrors the status-card idiom in
// AppointmentStatusModal (status itself is demoted to the left bar + badge). null
// (OMU family, legacy rows without a session_type) → caller falls back to the status
// card, so an unconfirmed color is never guessed.
export const SERVICE_COLOR_CARD_CLASSES: Record<ServiceColor, string> = {
  yellow: 'bg-yellow-50/90 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700 text-yellow-900 dark:text-yellow-100',
  blue:   'bg-blue-50/90 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100',
  green:  'bg-green-50/90 dark:bg-green-900/40 border-green-300 dark:border-green-700 text-green-900 dark:text-green-100',
  pink:   'bg-pink-50/90 dark:bg-pink-900/40 border-pink-300 dark:border-pink-700 text-pink-900 dark:text-pink-100',
  grey:   'bg-slate-100/90 dark:bg-slate-800/60 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300',
};

export const serviceCardClass = (sessionTypeId: string | null | undefined): string | null => {
  const color = colorForSessionType(sessionTypeId);
  return color ? SERVICE_COLOR_CARD_CLASSES[color] : null;
};
