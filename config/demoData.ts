/**
 * Demo-row visibility — the ONE shared filter (2026-07-28).
 *
 * clients.is_demo existed since migration 20260605 but was read by ZERO list
 * queries — it only watermarked PDFs. So structurally-flagged test rows walked
 * straight into the intake queue, the guardrail feed, the forms queue, and the
 * Director's counts. Every clients-reading surface now routes its builder
 * through applyDemoFilter(); do NOT hand-roll `.eq('is_demo', false)` per page
 * (eight copies is how vocabularies drift).
 *
 * HOW IT IS CONTROLLED (changed 2026-07-28 — Dan): a persisted PER-USER
 * setting, surfaced as the "Show demo data" toggle in Settings. Default OFF.
 * There is exactly ONE url for the app; the old `?demo=1` query parameter is
 * GONE. It was removable state in a shareable string: a link pasted into chat
 * silently turned sample clients on for whoever opened it, and the mode was
 * invisible once the param scrolled out of the address bar. When the setting is
 * ON, GlobalHeader renders a persistent "Demo data" badge on every screen.
 *
 * WHY A MODULE CACHE: applyDemoFilter is called from plain service functions
 * (services/api.ts, alertsService, complianceEngine) that have no React context.
 * AuthProvider primes this store the moment the user resolves — before any page
 * issues a query — and re-primes on every sign-in/sign-out, so the value is
 * always the CURRENT user's. Never read localStorage directly at a call site.
 *
 * Flagging policy (the migration this pairs with): STRUCTURAL predicates only —
 * vendor-domain email or hand-crafted fixture uuid. Rows identifiable only by a
 * suspicious NAME are never auto-flagged: wrongly hiding a real client from a
 * compliance queue is worse than a test name on screen.
 */

const KEY_PREFIX = 'acs-show-demo-rows:';
/** Pre-2026-07-28 global key — cleared on init so a stale ON can't be inherited. */
const LEGACY_GLOBAL_KEY = 'acs-show-demo-rows';

let currentUserId: string | null = null;
let cached = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach(l => l());

const readFor = (userId: string): boolean => {
  try {
    return window.localStorage.getItem(KEY_PREFIX + userId) === '1';
  } catch {
    return false;
  }
};

/**
 * Prime the store for the signed-in user (null = signed out → always OFF).
 * Called by AuthProvider wherever it sets the user, so services see the right
 * value before the first query. Idempotent.
 */
export const initDemoVisibility = (userId: string | null): void => {
  try { window.localStorage.removeItem(LEGACY_GLOBAL_KEY); } catch { /* ignore */ }
  currentUserId = userId;
  const next = userId ? readFor(userId) : false;
  if (next !== cached) { cached = next; notify(); }
};

/** Synchronous read for the query layer. */
export const showDemoRows = (): boolean => cached;

/** Write the per-user setting. No-op when signed out (nothing to key it to). */
export const setShowDemoRows = (on: boolean): void => {
  if (!currentUserId) return;
  try { window.localStorage.setItem(KEY_PREFIX + currentUserId, on ? '1' : '0'); } catch { /* ignore */ }
  if (on !== cached) { cached = on; notify(); }
};

export const subscribeDemoVisibility = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

/** Conditionally add `.eq('is_demo', false)` to a supabase builder over a table
 *  that carries the column (clients today). Pass-through when demo rows are on.
 *  Loosely typed on purpose: constraining against supabase's recursive builder
 *  generics trips TS2589 (excessively deep instantiation) at the call sites. */
export const applyDemoFilter = <T>(query: T): T =>
  showDemoRows() ? query : ((query as any).eq('is_demo', false) as T);
