// ACS TherapyHub — Recurring 1:1 scheduling: PURE deterministic helpers.
//
// VERIFIED-LANE CODE. No AI/LLM, no Supabase, no network, no Date.now() — every output is a
// pure function of its inputs so it is trivially testable and reviewable. The booking path
// (api.ts) calls these; this module knows nothing about persistence.
//
// Two jobs:
//   1) generateWeeklyOccurrences — turn a first date + count into N weekly dates.
//   2) detectOverlaps           — find time collisions between candidate and existing
//                                  appointments (the therapist double-booking check).

import { parseTimeToMinutes } from '../config/time';

/** A time window on a specific calendar day, in canonical "HH:MM" 24-hour strings. */
export interface OccurrenceWindow {
  date: Date;       // local calendar day (time-of-day components ignored for the day key)
  startTime: string;
  endTime: string;
}

/**
 * N weekly occurrences from a first date (inclusive). Occurrence i = firstDate + 7·i days.
 * The weekday is implicit in firstDate (David's "pick Wed 9:00, ×6" → 6 Wednesdays).
 *
 * Pure: clones the input, mutates only the clone. count<=0 → []. Caller validates count.
 * Uses setDate(+7) which correctly rolls across month/year and DST boundaries (date-only).
 */
export function generateWeeklyOccurrences(firstDate: Date, count: number): Date[] {
  if (!(firstDate instanceof Date) || Number.isNaN(firstDate.getTime())) return [];
  if (!Number.isFinite(count) || count <= 0) return [];
  const out: Date[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(firstDate.getTime());
    d.setDate(firstDate.getDate() + i * 7);
    out.push(d);
  }
  return out;
}

/** Same-calendar-day test (local). */
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/**
 * Half-open interval intersection in minutes-from-midnight: [aStart,aEnd) ∩ [bStart,bEnd).
 * Half-open so back-to-back sessions (10:00–11:00 then 11:00–12:00) do NOT collide.
 * Unparseable times → no overlap claimed (honest: never fabricate a conflict).
 * Exported so the grid's live conflict badge reuses the EXACT same rule as the booking check.
 */
export function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = parseTimeToMinutes(aStart), ae = parseTimeToMinutes(aEnd);
  const bs = parseTimeToMinutes(bStart), be = parseTimeToMinutes(bEnd);
  if ([as, ae, bs, be].some(Number.isNaN)) return false;
  return as < be && bs < ae;
}

export interface OverlapHit<C, E> {
  candidate: C;
  conflictsWith: E;
}

/**
 * For each candidate window, find existing windows it collides with (same day + time overlap).
 * Generic over the carried payloads so callers keep their own row types. O(c·e) — fine at
 * single-clinic scale (a therapist's day has a handful of rows). Pure: no I/O, no sorting
 * side effects on inputs.
 *
 * The CALLER is responsible for scoping `existing` to the right therapist and excluding
 * Canceled rows and the series's own occurrences — this function only does the time math.
 */
export function detectOverlaps<C extends OccurrenceWindow, E extends OccurrenceWindow>(
  candidates: C[],
  existing: E[],
): OverlapHit<C, E>[] {
  const hits: OverlapHit<C, E>[] = [];
  for (const cand of candidates) {
    for (const ex of existing) {
      if (!sameDay(cand.date, ex.date)) continue;
      if (timeRangesOverlap(cand.startTime, cand.endTime, ex.startTime, ex.endTime)) {
        hits.push({ candidate: cand, conflictsWith: ex });
      }
    }
  }
  return hits;
}
