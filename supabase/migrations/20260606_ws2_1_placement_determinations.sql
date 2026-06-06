-- WS2 — placement_determinations: the clinician-SIGNED SATOP level determination.
-- (The only WS2 migration; Phases 2–3 are app-side. Folds table + RLS into one
-- migration so the table is NEVER created without RLS — the WS0 lesson.)
--
-- This is the layer that turns WS1's deterministic RECOMMENDATION (services/
-- placementEngine.ts → computePlacement) into a SIGNED determination of record. A
-- signed determination is a real clinical act, so the table is audit-grade by
-- construction:
--
--   • SINGLE SOURCE. The level is never re-derived here. engine_recommended_level
--     is an immutable SNAPSHOT of computePlacement().recommendedFloor captured at
--     sign time; basis_snapshot freezes the determining inputs + engine output so a
--     later edit to assessment_inputs can never silently change what was signed.
--
--   • APPEND-ONLY / SUPERSEDE-NOT-EDIT. A signed row is immutable. There are NO
--     UPDATE and NO DELETE policies, and authenticated is granted ONLY select+insert
--     (not update/delete) — so signed rows have no write path at either the GRANT or
--     the policy layer (double fail-closed). A change is a NEW row that points back
--     at the one it replaces via supersedes_id (forward pointer). The "current"
--     determination for a client = the latest `signed` row with NO successor (no
--     other row's supersedes_id references it). "superseded" is therefore DERIVED,
--     never a stored mutation. `voided` is a reserved status value, unused for now.
--
--   • REG-FAITHFUL DEVIATION (9 CSR 30-3.206). A determination ABOVE the engine
--     recommendation is a clinical ESCALATION — allowed WITH a required reason. A
--     determination BELOW the recommendation is a §3(E) department-approval
--     exception — a gated pathway NOT available in-app. pd_disposition_matches_levels
--     gives below-floor determinations NO satisfying clause, so the DB itself (not
--     just the UI) makes them physically un-writable, and likewise rejects an
--     escalation with an empty reason. 'exception_below_floor' is a reserved
--     disposition a future §3(E) workflow can enable by amending that one constraint.
--
--   • NARRATE-ONLY. No AI and no prose is stored here. The Phase-3 CIMOR packet
--     reads level/facts ONLY from this row; any AI narrative is ephemeral and lives
--     nowhere in this schema.
--
--   • SIGN-OFF IS CLINICIAN-ONLY. INSERT is gated to private.is_clinician()
--     (Director/Therapist) AND determined_by = auth.uid(). Admin is is_staff (can
--     READ the audit trail) but NOT is_clinician → can never sign. No client self-read.
--
-- Demo-only until Karen (LPC) signs off the methodology + deviation handling; the
-- UI and the packet state this.

create table public.placement_determinations (
  id                       uuid primary key default gen_random_uuid(),
  client_id                uuid not null references public.clients(id),
  -- The basis: the specific assessment_inputs row signed against (save-then-sign,
  -- so the snapshot below always binds to a persisted row, never unsaved form state).
  assessment_input_id      uuid not null references public.assessment_inputs(id),

  -- Immutable snapshot of the engine output at sign time (THE single source).
  engine_recommended_level text  not null,  -- computePlacement().recommendedFloor: 'I'|'II'|'III'|'IV'
  determined_level         text  not null,  -- what the clinician signed:          'I'|'II'|'III'|'IV'
  -- Self-contained provenance: determining inputs + engine output frozen at sign
  -- time so a later assessment_inputs change can't alter the signed record. Shape:
  -- {offense_count,dui_arrest_count,bac,sud_diagnosis,baseLevel,sropFloorApplies,
  --  sropConditions,recommendedFloor,upgradeFactorsPresent,rationale}
  basis_snapshot           jsonb not null,

  disposition              text  not null,  -- 'confirmed' | 'escalated' | 'exception_below_floor'(reserved)
  deviation_reason         text,            -- REQUIRED (non-empty) when escalated; NULL when confirmed
  exception_ref            text,            -- structured §3(E) approval ref; always NULL in MVP

  determined_by            uuid  not null,  -- auth.uid() of the signing clinician
  determined_at            timestamptz not null default now(),

  status                   text  not null default 'signed',  -- 'signed' | 'voided'(reserved)
  supersedes_id            uuid references public.placement_determinations(id),  -- NEW→prior; NULL for the first

  -- ── Defense-in-depth CHECKs (highest-stakes table; the engine/UI also validate) ──
  constraint pd_levels_valid check (
    engine_recommended_level in ('I','II','III','IV')
    and determined_level     in ('I','II','III','IV')
  ),
  constraint pd_disposition_valid check (
    disposition in ('confirmed','escalated','exception_below_floor')
  ),
  constraint pd_status_valid check (
    status in ('signed','voided')
  ),

  -- The reg-faithful heart of WS2. Level rank: I=1, II=2, III=3, IV=4.
  --   confirmed  ⟺ determined = recommended AND deviation_reason IS NULL
  --   escalated  ⟺ rank(determined) > rank(recommended) AND a non-empty reason
  -- There is deliberately NO clause for rank(determined) < rank(recommended) and NO
  -- clause for 'exception_below_floor' (the `else false`) → below-floor placements
  -- and empty-reason escalations are PHYSICALLY un-writable. A §3(E) workflow would
  -- enable below-floor by amending exactly this constraint, nothing else.
  constraint pd_disposition_matches_levels check (
    case disposition
      when 'confirmed' then
        determined_level = engine_recommended_level
        and deviation_reason is null
      when 'escalated' then
        (case determined_level          when 'I' then 1 when 'II' then 2 when 'III' then 3 when 'IV' then 4 end)
        > (case engine_recommended_level when 'I' then 1 when 'II' then 2 when 'III' then 3 when 'IV' then 4 end)
        and deviation_reason is not null
        and length(btrim(deviation_reason)) > 0
      else false  -- 'exception_below_floor' (reserved): no satisfying clause ⇒ blocked
    end
  ),

  -- exception_ref can only ever accompany the (reserved, un-writable) below-floor
  -- disposition — so in MVP it is forced NULL. When a future §3(E) workflow enables
  -- 'exception_below_floor', this already permits its structured reference.
  constraint pd_exception_ref_only_below_floor check (
    exception_ref is null or disposition = 'exception_below_floor'
  ),

  -- A forward pointer must reference a DIFFERENT row (no self-supersede).
  constraint pd_no_self_supersede check (
    supersedes_id is null or supersedes_id <> id
  )
);

-- Lookups are always by client (load a client's determination history / current).
create index placement_determinations_client_id_idx on public.placement_determinations (client_id);

-- ── RLS (scoped, fail-closed) ────────────────────────────────────────────────
alter table public.placement_determinations enable row level security;

-- Append-only at the GRANT layer too: authenticated gets select+insert ONLY — no
-- update/delete privilege exists to revoke or police. service_role (backend/admin,
-- never in the client bundle) keeps full access for migrations.
grant select, insert on public.placement_determinations to authenticated;
grant all          on public.placement_determinations to service_role;

-- SELECT: any staff (Director/Therapist/Admin) may read the full audit trail.
create policy pd_select_staff on public.placement_determinations
  for select to authenticated
  using (private.is_staff());

-- INSERT: clinician-only (Director/Therapist), and the signer must BE the auth user.
-- Admin is is_staff but not is_clinician → reads, never signs.
create policy pd_insert_clinician on public.placement_determinations
  for insert to authenticated
  with check (private.is_clinician() and determined_by = auth.uid());

-- NO update policy, NO delete policy  → signed rows immutable (supersede via insert).
-- NO client self-read policy           → clients never see determinations.
