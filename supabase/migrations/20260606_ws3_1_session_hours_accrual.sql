-- WS3 — categorized session-hours accrual: make a completed session become hours
-- that feed the completion gate. Deterministic arithmetic over real `appointments`
-- rows — no AI, no free-floating counter, no parallel sessions table.
--
-- WHY: `clients.srop_hours_completed` is static seed data with NO writer; the
-- completion gate reads a number nothing updates. This adds the real COMPLETED side —
-- each session carries a reg hour-CATEGORY (`service_type`); accrued hours are
-- DERIVED (recomputable, auditable) from the set of `Completed` appointments, split
-- by category. The categorized total also makes SROP's ≥35-hour counseling floor
-- (9 CSR 30-3.206(7)(D)) ENFORCEABLE — closing the §7 root blocker (`hourComponents`
-- was null everywhere).
--
-- SCOPE HONESTY: SROP ≥35 counseling is the ONLY per-category floor in 3.206. CIP
-- (50), WIP (20), OEP (10) are TOTAL-only (the unsourced CIP 10/20/20 split was
-- removed in the reg-corrections sprint). Categorized accrual enforces exactly that
-- one new floor and sums to the totals for the rest — nothing more is claimed.

-- ── (1) reg hour-category on appointments ────────────────────────────────────
-- Nullable: existing rows can't be honestly classified (NO backfill). null = the
-- app/gate treat it as UNCATEGORIZED — never miscategorized, never counted as a
-- category. The app REQUIRES a value before an appointment can be marked Completed
-- (Phase 2). 'other' = a real non-program session (intake/assessment/admin) that
-- deliberately does NOT accrue program hours.
alter table public.appointments
  add column if not exists service_type text;

alter table public.appointments
  drop constraint if exists appointments_service_type_valid;
alter table public.appointments
  add constraint appointments_service_type_valid
  check (service_type is null or service_type in ('counseling','education','rehabilitative_support','other'));
-- Reg map: counseling = individual+group counseling (SROP ≥35; part of CIP/WIP) ·
--          education = OEP + group education · rehabilitative_support = CIP group
--          rehabilitative support · other = non-program (never accrues).
--          Individual-vs-group is deferred to the group-caps work; the ≥35 floor
--          counts both individual and group counseling as `counseling`.

-- ── (2) DERIVED accrual — per-client, per-category Completed hours ────────────
-- Recomputed from the rows on every read (cannot silently drift from a stored
-- counter). Hours = duration_minutes / 60 (contact hours; kept `numeric`, no
-- rounding). Only `Completed` rows in an accruing category count; null/'other' are
-- excluded (uncategorized ≠ a category).
--
-- security_invoker = true → the view runs with the QUERIER's RLS on clients +
-- appointments (verified scoped: each has staff_all + client_self_read), so:
--   • staff (the completion gate) see every client's accrual;
--   • a portal client sees ONLY their own (client_self_read via private.my_client_ids()).
-- `appointments.client_id` is `text` (SECURITY_BACKLOG: should be uuid) → cast
-- clients.id→text for the join; legacy short-id appointments simply never match a
-- real client row (harmless — they drop out of the clients-driven aggregate).
create or replace view public.client_accrued_hours
  with (security_invoker = true) as
select
  c.id as client_id,
  coalesce(sum(a.duration_minutes) filter (where a.service_type in ('counseling','education','rehabilitative_support')), 0)::numeric / 60.0 as total_hours,
  coalesce(sum(a.duration_minutes) filter (where a.service_type = 'counseling'), 0)::numeric / 60.0              as counseling_hours,
  coalesce(sum(a.duration_minutes) filter (where a.service_type = 'education'), 0)::numeric / 60.0               as education_hours,
  coalesce(sum(a.duration_minutes) filter (where a.service_type = 'rehabilitative_support'), 0)::numeric / 60.0 as rehabilitative_support_hours
from public.clients c
left join public.appointments a
  on a.client_id = c.id::text
  and lower(a.status) = 'completed'
group by c.id;

-- Read-only derived object: SELECT to authenticated (RLS on the base tables gates
-- the rows via security_invoker); no write grants exist on a view; anon shut out.
revoke all on public.client_accrued_hours from anon;
grant select on public.client_accrued_hours to authenticated;
