/**
 * SERVICE-TYPE VOCABULARY — the state-billing accrual axis (2026-07-28).
 *
 * David's words (7/28 call): CNS = Counseling, ED = Education — "these drive
 * state billing." This module tokenizes what was previously hardcoded in one
 * <select> (AppointmentStatusModal) and raw-rendered elsewhere
 * (ScheduleSessionModal printed the literal `rehabilitative_support`).
 *
 * The token set is DB-CHECK-enforced in TWO places — keep all three in
 * lock-step (same protocol as config/clientType.ts):
 *   1. appointments_service_type_valid  (20260606_ws3_1_session_hours_accrual.sql)
 *   2. groups_service_type_valid        (20260606_ws6_1_standing_groups.sql)
 *   3. the ServiceType union in types.ts (:439) and this file.
 *
 * NAME COLLISION WARNING: config/sessionTaxonomy.ts exports a DIFFERENT
 * `ServiceType` ('OP' | 'SATOP' | 'Evaluation' — a scheduling funnel). Do not
 * write those tokens into appointments.service_type. This module is the
 * accrual/state-billing axis only.
 */
import type { ServiceType } from '../types';

/** Full display label per token — what a staff-facing surface renders. */
export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
    counseling: 'Counseling',
    education: 'Education',
    rehabilitative_support: 'Group Rehabilitative Support',
    other: 'Other (non-program)',
};

/** State-billing abbreviation, where one exists. CNS/ED are David's tokens;
 *  the other two have no DMH shorthand and render their full label. */
export const SERVICE_TYPE_ABBREV: Partial<Record<ServiceType, string>> = {
    counseling: 'CNS',
    education: 'ED',
};

/** Human label for a service_type token; falls back to the raw token so an
 *  unexpected DB value still renders something rather than nothing. */
export const serviceTypeLabel = (t: string | null | undefined): string =>
    t ? (SERVICE_TYPE_LABELS as Record<string, string>)[t] ?? t : '';

/** "Counseling (CNS)" style label for surfaces that teach the state axis. */
export const serviceTypeLabelWithAbbrev = (t: string | null | undefined): string => {
    if (!t) return '';
    const label = serviceTypeLabel(t);
    const ab = (SERVICE_TYPE_ABBREV as Record<string, string>)[t];
    return ab ? `${label} (${ab})` : label;
};
