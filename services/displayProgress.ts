/**
 * WS-DisplayTruth — the single source for DISPLAYING a client's program progress.
 *
 * Every display surface (portal dashboard, portal "My Progress", client overview, the
 * selection grid, alerts) must read from HERE so what's shown can never contradict the
 * completion gate's verdict. It composes the EXACT sources the gate uses:
 *   • completed hours  → fetchClientAccrual  (client_accrued_hours view; WS3)
 *   • level + required → the signed determination + REQUIRED_HOURS_BY_LEVEL (WS4)
 *   • SROP counseling floor → 35 (the only per-category floor; WS3)
 *
 * Two read paths land the level, ONE composition (composeProgress) applies the
 * level→hours map + SROP floor — so staff and client can never diverge:
 *   • STAFF  (fetchClientProgress)  reads placement_determinations DIRECTLY (allowed by
 *     WS2 pd_select_staff).
 *   • CLIENT (fetchOwnProgress)     gets the level via the SECURITY DEFINER my_progress()
 *     RPC — the determination is staff-only, so the RPC is a scoped keyhole that returns
 *     the LEVEL scalar only (never the determination row). Closes SECURITY_BACKLOG #10b.
 *
 * It does NOT touch complianceEngine's verdict — it only calls its public read fetchers,
 * so display and gate are guaranteed to agree. NEVER reads the static
 * clients.srop_hours_completed / total_sessions_required columns. No-phantom: no signed
 * determination ⇒ established=false (requiredTotal/progressPct null) — the display shows
 * the honest no-number state, never a seeded number.
 */
import { fetchClientAccrual, fetchClientDetermination, type AccruedHours } from './complianceEngine';
import { REQUIRED_HOURS_BY_LEVEL, type SatopLevel } from '../config/satopFees';
import { supabase } from './supabase';

export interface ClientProgress {
  established: boolean;                 // a current signed determination exists
  determinedLevel: SatopLevel | null;   // the determined level (NOT the court-mandate free text)
  requiredTotal: number | null;         // REQUIRED_HOURS_BY_LEVEL[level]; null until established
  completedTotal: number;               // authoritative accrued hours (0 if none)
  isSrop: boolean;                       // Level IV → the two-part (total + counseling) view
  counselingRequired: number | null;    // 35 for SROP, else null
  counselingCompleted: number;          // authoritative counseling hours
  progressPct: number | null;           // completed/required %, only when established
}

/**
 * The ONE place the level→hours map (REQUIRED_HOURS_BY_LEVEL) and the SROP counseling
 * floor are applied. Both read paths (staff direct-read, client RPC) funnel through here
 * so the displayed required/level can never diverge between surfaces — single source.
 */
function composeProgress(level: SatopLevel | null, accrual: AccruedHours): ClientProgress {
  const requiredTotal = level ? REQUIRED_HOURS_BY_LEVEL[level] : null;
  const isSrop = level === 'IV';
  return {
    established: !!level,
    determinedLevel: level,
    requiredTotal,
    completedTotal: accrual.total,
    isSrop,
    counselingRequired: isSrop ? 35 : null,
    counselingCompleted: accrual.counseling,
    progressPct: level && requiredTotal ? Math.min(100, Math.round((accrual.total / requiredTotal) * 100)) : null,
  };
}

/** STAFF surfaces — reads the signed determination DIRECTLY (WS2 pd_select_staff allows staff). */
export async function fetchClientProgress(clientId: string): Promise<ClientProgress> {
  const [level, accrual] = await Promise.all([
    fetchClientDetermination(clientId), // current signed, non-superseded level (or null)
    fetchClientAccrual(clientId),       // { total, counseling, ... } (zeros if none)
  ]);
  return composeProgress(level, accrual);
}

/**
 * Portal CLIENT — own progress. The determination is staff-only, so the level comes via
 * the my_progress() RPC (returns the level scalar only, self-scoped to auth.uid()'s own
 * client). Accrual is client-self-readable (security_invoker view), unchanged. `clientId`
 * is the caller's OWN id and is used ONLY for accrual; the level is keyed by the caller's
 * JWT inside the RPC. (1:1 in the demo; multi-client nuance flagged in SECURITY_BACKLOG #10b.)
 */
export async function fetchOwnProgress(clientId: string): Promise<ClientProgress> {
  const [level, accrual] = await Promise.all([
    fetchMyDeterminedLevel(),     // own current level via the scoped RPC (or null)
    fetchClientAccrual(clientId), // own accrual (RLS client-self-read)
  ]);
  return composeProgress(level, accrual);
}

/**
 * The caller's OWN current determined level via the my_progress() RPC — an RLS-safe
 * keyhole into the staff-only placement_determinations. Returns null when there is no
 * signed determination (⇒ established=false). Never exposes the determination row.
 */
async function fetchMyDeterminedLevel(): Promise<SatopLevel | null> {
  const { data, error } = await supabase.rpc('my_progress');
  if (error) {
    console.warn('[displayProgress] my_progress RPC failed:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data; // returns table(...) ⇒ single-row array
  if (!row || !row.established) return null;
  return (row.level as SatopLevel) ?? null;
}

/** Batch (lists/alerts) — STAFF. N public-fetcher calls — fine at pilot scale; batch later if needed. */
export async function fetchAllClientProgress(clientIds: string[]): Promise<Map<string, ClientProgress>> {
  const entries = await Promise.all(
    clientIds.map(async (id) => [id, await fetchClientProgress(id)] as const),
  );
  return new Map(entries);
}
