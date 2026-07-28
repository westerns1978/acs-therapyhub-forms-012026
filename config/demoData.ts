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
 * Demo rows stay VISIBLE on demand for walkthroughs: append ?demo=1 to the URL
 * (works with the hash router: /?demo=1#/dashboard) or set
 * localStorage['acs-show-demo-rows']='1'. Off by default.
 *
 * Flagging policy (the migration this pairs with): STRUCTURAL predicates only —
 * vendor-domain email or hand-crafted fixture uuid. Rows identifiable only by a
 * suspicious NAME are never auto-flagged: wrongly hiding a real client from a
 * compliance queue is worse than a test name on screen.
 */

export const showDemoRows = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    if (new URLSearchParams(window.location.search).get('demo') === '1') return true;
    return window.localStorage.getItem('acs-show-demo-rows') === '1';
  } catch {
    return false;
  }
};

/** Conditionally add `.eq('is_demo', false)` to a supabase builder over a table
 *  that carries the column (clients today). Pass-through when demo rows are on.
 *  Loosely typed on purpose: constraining against supabase's recursive builder
 *  generics trips TS2589 (excessively deep instantiation) at the call sites. */
export const applyDemoFilter = <T>(query: T): T =>
  showDemoRows() ? query : ((query as any).eq('is_demo', false) as T);
