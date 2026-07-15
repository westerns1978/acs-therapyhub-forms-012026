-- Billable units (15-minute-grain groundwork) — additive, nullable column on the
-- session row. David 7/14: clinicians assert a billable unit count (per the service
-- type's grain) so ACS can bill the State of Missouri. Aug 1 is the TESTING PHASE, not
-- production — this records a COUNT only. No dollars, no CIMOR/DMH submission.
--
-- NULLABLE IS DELIBERATE: every existing Completed row has no asserted value. A NULL
-- means "not asserted," NOT zero. Do NOT backfill or default. The clinician asserts the
-- value at Mark-Complete time (AppointmentStatusModal); booking never sets it.
--
-- CHECK bounds the raw stored integer at 1..12 — a session-level sanity range on the
-- primitive. The GRAIN (minutes per unit) and the real max-units-per-session cap are
-- service-type-dependent and configured app-side (config/billableUnits.ts); the DB only
-- guards the primitive range, so the column stays honest even if the config table changes.
--
-- RLS: UNCHANGED. appointments_insert_staff / appointments_update_staff are row-level
-- (private.is_staff()) with NO column lists, so a new nullable column is already covered
-- by the existing policies — there is nothing to touch. Verified against the live
-- pg_policy set during recon at 47c0535. No policy is altered here.
--
-- To reverse:
--   alter table public.appointments drop constraint if exists appointments_billable_units_range;
--   alter table public.appointments drop column if exists billable_units;

alter table public.appointments
  add column if not exists billable_units integer;

alter table public.appointments
  drop constraint if exists appointments_billable_units_range;

alter table public.appointments
  add constraint appointments_billable_units_range
  check (billable_units is null or (billable_units >= 1 and billable_units <= 12));
