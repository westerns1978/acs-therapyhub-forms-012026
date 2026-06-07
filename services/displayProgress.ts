/**
 * WS-DisplayTruth — the single source for DISPLAYING a client's program progress.
 *
 * Every display surface (portal dashboard, portal "My Progress", client overview, the
 * selection grid, alerts) must read from HERE so what's shown can never contradict the
 * completion gate's verdict. It composes the EXACT sources the gate uses:
 *   • completed hours  → fetchClientAccrual  (client_accrued_hours view; WS3)
 *   • level + required → fetchClientDetermination + REQUIRED_HOURS_BY_LEVEL (WS4)
 *   • SROP counseling floor → 35 (the only per-category floor; WS3)
 *
 * It does NOT touch complianceEngine — it only calls its public read fetchers, so display
 * and gate are guaranteed to agree. NEVER reads the static clients.srop_hours_completed /
 * total_sessions_required columns. No-phantom: no signed determination ⇒ established=false
 * (requiredTotal/progressPct null) — the display shows "pending", never a seeded number.
 */
import { fetchClientAccrual, fetchClientDetermination } from './complianceEngine';
import { REQUIRED_HOURS_BY_LEVEL, type SatopLevel } from '../config/satopFees';

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

/** Authoritative display progress for one client — the same data the gate computes from. */
export async function fetchClientProgress(clientId: string): Promise<ClientProgress> {
  const [level, accrual] = await Promise.all([
    fetchClientDetermination(clientId), // current signed, non-superseded level (or null)
    fetchClientAccrual(clientId),       // { total, counseling, ... } (zeros if none)
  ]);
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

/** Batch (lists/alerts). N public-fetcher calls — fine at pilot scale; batch later if needed. */
export async function fetchAllClientProgress(clientIds: string[]): Promise<Map<string, ClientProgress>> {
  const entries = await Promise.all(
    clientIds.map(async (id) => [id, await fetchClientProgress(id)] as const),
  );
  return new Map(entries);
}
