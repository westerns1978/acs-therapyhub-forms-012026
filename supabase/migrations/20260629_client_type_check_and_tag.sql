-- ACS TherapyHub — client-type v1: tighten client_type to a CHECK + tag ACS test clients (2026-06-29)
--
-- PURPOSE
--   Phase-2 follow-up to 20260624_client_type_column.sql. David confirmed a 6-token
--   operational/scheduling vocabulary, so we (1) backfill client_type for the existing ACS
--   test clients by deriving it from their clinical program_type, and (2) tighten the column
--   to a CHECK on exactly those 6 tokens (mirrors the program_vocab pattern, 20260616).
--
--   client_type is the OPERATIONAL / scheduling-funnel axis David asked for; program_type is
--   CLINICAL placement (the determination gate's level source). They stay distinct — the
--   derivation below is a one-time convenience backfill, NOT a permanent coupling.
--
-- THE 6 TOKENS ARE A STRAW MAN — they WILL be revised after David's call. Revising is a
-- clean ONE-migration change:
--   1) drop + recreate the single constraint `clients_client_type_check` with the new token set;
--   2) update the matching label map in config/clientType.ts (the badge's display source).
-- Nothing else references the token set, so that is the whole edit.
--
-- DESIGN
--   • CHECK is NULL-tolerant: untagged clients (and any non-ACS row in the shared DB) stay
--     NULL and pass. Only the 6 tokens are otherwise allowed.
--   • Backfill is scoped to ACS rows ONLY: it touches rows whose program_type is one of the
--     ACS clinical values (the WHEN arms below). A row with NULL/foreign program_type is never
--     written — prospects (program_type NULL) stay NULL by design.
--   • DOT has no program_type to derive from (DOT is a service, not a program), so no client is
--     auto-tagged DOT this pass — the token exists for when DOT clients are categorized by hand.
--
-- IDEMPOTENT: backfill only writes rows where client_type IS NULL; constraint uses DROP IF EXISTS.
-- REVERTIBLE:
--   alter table public.clients drop constraint if exists clients_client_type_check;
--   update public.clients set client_type = null
--     where client_type in ('SATOP','DOT','RELAPSE_PREVENTION','ANGER_MANAGEMENT','GAMBLING_RECOVERY','INDIVIDUAL');

-- ── (1) Backfill: derive client_type from program_type (ACS rows only; untagged stay NULL) ──
update public.clients
set client_type = case
    when program_type in ('SATOP','OEP','WIP','CIP','SROP') then 'SATOP'   -- SATOP family (incl. SROP/CIP level names)
    when program_type = 'OPIOID_RECOVERY'    then 'RELAPSE_PREVENTION'      -- opioid / relapse / outpatient continuing care
    when program_type = 'ANGER_MANAGEMENT'   then 'ANGER_MANAGEMENT'
    when program_type = 'GAMBLING_RECOVERY'  then 'GAMBLING_RECOVERY'
    when program_type = 'INDIVIDUAL_COUNSELING' then 'INDIVIDUAL'
    else client_type                                                        -- unknown/NULL program_type → leave as-is (NULL)
  end
where client_type is null
  and program_type in ('SATOP','OEP','WIP','CIP','SROP','OPIOID_RECOVERY','ANGER_MANAGEMENT','GAMBLING_RECOVERY','INDIVIDUAL_COUNSELING');

-- ── (2) Tighten to a CHECK on exactly the 6 confirmed tokens (NULL-tolerant) ────────────────
alter table public.clients drop constraint if exists clients_client_type_check;
alter table public.clients
  add constraint clients_client_type_check
  check (client_type is null or client_type in
    ('SATOP','DOT','RELAPSE_PREVENTION','ANGER_MANAGEMENT','GAMBLING_RECOVERY','INDIVIDUAL'));

comment on column public.clients.client_type is
  'Operational scheduling-funnel category (6-token straw man, CHECK-enforced 2026-06-29): '
  'SATOP / DOT / RELAPSE_PREVENTION / ANGER_MANAGEMENT / GAMBLING_RECOVERY / INDIVIDUAL. '
  'Distinct from clinical program_type. Token set WILL be revised post-David — drop+recreate '
  'clients_client_type_check and update config/clientType.ts together.';
