// Dev-only forced-failure harness (fail-visibly regression aid, 2026-07-28).
// Run `VITE_FORCE_QUERY_FAIL=1 npm run dev` (or set it in .env.local) and every
// query wired through maybeForceFail() rejects — proving no surface renders a
// reassuring empty/zero state on failure. `import.meta.env.DEV` is compile-time
// false in `vite build`, so this cannot activate in a production bundle.
export const FORCE_QUERY_FAIL: boolean =
  import.meta.env.DEV && import.meta.env.VITE_FORCE_QUERY_FAIL === '1';

export function maybeForceFail(site: string): void {
  if (FORCE_QUERY_FAIL) throw new Error(`[forced-failure] ${site} (dev harness — VITE_FORCE_QUERY_FAIL)`);
}
