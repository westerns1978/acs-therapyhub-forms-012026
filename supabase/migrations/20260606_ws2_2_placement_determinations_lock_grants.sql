-- WS2 (2/2) — lock the GRANT layer to match the approved append-only design.
--
-- WITNESS FINDING (Phase 1 verify, not assumed): this Supabase project carries broad
-- default privileges — every new public table is auto-granted ALL privileges to BOTH
-- anon and authenticated (confirmed: assessment_inputs, which issued no grant
-- statements at all, shows the identical grant set). So the additive
-- `grant select, insert to authenticated` in ws2_1 did NOT make the grant layer
-- exclusive: authenticated still held UPDATE/DELETE/TRUNCATE, and anon held the full
-- set. RLS (enabled; no anon policy; no UPDATE/DELETE policy) still blocked every bit
-- of it — but the approved "two-layer append-only" guarantee (no update/delete at the
-- GRANT layer, not only the policy layer) was not actually in force.
--
-- This migration makes the grant layer match the approved intent for this
-- highest-stakes, append-only table (other tables keep the project-norm RLS-only
-- posture — out of scope here):
--   • anon          → NOTHING (revoke all; it has no policy anyway — pure hardening)
--   • authenticated → SELECT + INSERT ONLY (revoke update/delete/truncate/references/trigger;
--                     the select+insert granted in ws2_1 remain)
--   • service_role  → unchanged (full; backend/admin, never in the client bundle)
-- Net: a signed determination has NO update/delete path at EITHER layer. Append-only,
-- doubly enforced, exactly as approved.

revoke all on table public.placement_determinations from anon;
revoke update, delete, truncate, references, trigger
  on table public.placement_determinations from authenticated;
-- authenticated retains exactly SELECT + INSERT (granted in ws2_1).
