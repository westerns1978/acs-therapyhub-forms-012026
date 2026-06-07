-- WS-DisplayTruth (Phase 2 / closes SECURITY_BACKLOG #10b) — public.my_progress():
-- the portal CLIENT's OWN derived SATOP level, WITHOUT exposing the staff-only
-- placement_determinations row.
--
-- WHY. WS2 made placement_determinations staff-only by design (pd_select_staff =
-- private.is_staff(); NO client self-read — a signed determination is clinical work
-- product). So a portal client's fetchClientProgress reads their COMPLETED hours fine
-- (client_accrued_hours is a security_invoker view → client-self-readable) but
-- fetchClientDetermination returns null under RLS → established=false → the portal could
-- only show completed hours + a placeholder. This RPC gives the client their
-- authoritative required/level WITHOUT widening that staff-only boundary.
--
-- SINGLE SOURCE. It returns ONLY the level scalar (+ an established flag). It does NOT
-- compute required hours in SQL — the app applies REQUIRED_HOURS_BY_LEVEL to this level
-- for the client path EXACTLY as it already does for the staff path (config/satopFees.ts;
-- the SROP ≥35 counseling floor is likewise derived in-app from level === 'IV'). Re-
-- deriving the level→hours map here would be a SECOND source of truth and the exact
-- divergence WS-DisplayTruth exists to prevent.
--
-- SECURITY DEFINER bypasses RLS BY DESIGN (that is how it reads the staff-only table) →
-- it MUST self-scope to the caller's own client and fail closed. It does both:
--   • SCOPE — pd.client_id in (select private.my_client_ids()): the SAME WS0 helper
--     (auth.uid()→own-client by email) every other client-self-read uses. NOT a new
--     helper. auth.jwt() inside it still resolves to the CALLER (definer does not change
--     the request JWT), so a definer context cannot widen who "I" am. A caller who is not
--     a client → empty set → no rows.
--   • CURRENT LEVEL — mirrors the gate's currentLevelFromRows EXACTLY: the signed row
--     that NO OTHER signed row supersedes, latest determined_at wins
--     (services/complianceEngine.ts). The NOT EXISTS filters s.status='signed' to match
--     the app, which computes supersededIds only from signed rows.
--   • FAIL-CLOSED SHAPE — left-join a singleton so the function ALWAYS returns exactly
--     one row; no client / no signed determination → (established=false, level=null),
--     never another client's data, never an error the UI must special-case.
--
-- It exposes the LEVEL only — never the determination row, its basis_snapshot, deviation
-- reason, signer, or dates. WS2's staff-only boundary stays provable: a client SELECT on
-- placement_determinations still returns 0 rows.
--
-- TYPES. placement_determinations.client_id confirmed uuid (live, 2026-06-06) → matches
-- private.my_client_ids()'s setof uuid; no cast (the text-client_id gotcha is the legacy
-- appointments table, not this one).
--
-- GRANTS. Project-wide default privileges would grant EXECUTE to PUBLIC (MAP §7) →
-- REVOKE from public+anon, GRANT to authenticated only. search_path pinned to ''
-- (every object reference schema-qualified).

create or replace function public.my_progress()
returns table (established boolean, level text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (sel.determined_level is not null) as established,
    sel.determined_level               as level
  from (select 1) one
  left join lateral (
    select pd.determined_level, pd.determined_at
    from public.placement_determinations pd
    where pd.status = 'signed'
      and pd.client_id in (select private.my_client_ids())
      and not exists (
        select 1
        from public.placement_determinations s
        where s.supersedes_id = pd.id
          and s.status = 'signed'
      )
    order by pd.determined_at desc
    limit 1
  ) sel on true;
$$;

revoke all     on function public.my_progress() from public, anon;
grant  execute on function public.my_progress() to authenticated;
