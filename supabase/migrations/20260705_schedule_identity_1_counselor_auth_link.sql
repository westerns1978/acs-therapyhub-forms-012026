-- WS1 STEP A — counselor↔auth identity link (INERT: adds columns + backfill + one helper).
--
-- This migration ONLY establishes identity plumbing for a LATER step B (DB-enforced
-- per-counselor calendar visibility). It changes NO policy and NO app behavior — the
-- new columns are read by nothing yet, and is_schedule_admin() is referenced by nothing
-- yet. staff_all_appointments stays exactly as-is (blanket private.is_staff()).
--
-- Idempotent / re-runnable: columns use `if not exists`; FKs are added only if absent;
-- both backfills only touch rows still NULL. Safe to apply more than once.
--
-- Backfill policy (locked with David's call, 2026-07-05):
--   • appointments.counselor_id ← counselors, matched by therapist_name = c.name
--     OR therapist_name LIKE c.name || ', %'  (credential-suffix strip, anchored on the
--     ", " delimiter — e.g. "Karen Ventimiglia, LPC" → Karen Ventimiglia). Exact + prefix
--     only. The unmatched set is LEFT NULL by design: "Dr. Anya Sharma" (14, phantom/demo,
--     no counselor), 7 NULL-therapist rows, and "Karen (Demo Therapist)" (1, no fuzzy
--     first-name links). Expected result: ~195 non-null / ~22 null.
--   • counselors.auth_user_id ← auth.users by EXACT full_name (David Yoder → demo.director,
--     Karen Ventimiglia → demo.therapist), restricted to staff-role accounts. Bill / Debra
--     / John / Rick have no accounts and stay NULL. Expected: 2 linked / 4 NULL.
--
-- FKs: nullable, ON DELETE SET NULL — removing a counselor or an auth user must NEVER delete
-- appointment seats (they hold accrual/history). Real FK to auth.users is precedented here
-- (treatment_plans.created_by → auth.users(id), migration 20260522).
--
-- No CONCURRENTLY (no index here); runs inside the migration runner's transaction.

-- 1) Columns (nullable, additive) -------------------------------------------------------------
alter table public.counselors  add column if not exists auth_user_id uuid;
alter table public.appointments add column if not exists counselor_id uuid;

-- 2) Foreign keys (nullable; on delete set null) ----------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_counselor_id_fkey'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_counselor_id_fkey
      foreign key (counselor_id) references public.counselors(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'counselors_auth_user_id_fkey'
      and conrelid = 'public.counselors'::regclass
  ) then
    alter table public.counselors
      add constraint counselors_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;
end $$;

-- 3) Backfill appointments.counselor_id (exact + credential-suffix prefix; NULL-only) ----------
update public.appointments a
set counselor_id = c.id
from public.counselors c
where a.counselor_id is null
  and (
        a.therapist_name = c.name
     or a.therapist_name like c.name || ', %'
  );

-- 4) Backfill counselors.auth_user_id by EXACT full_name, staff accounts only (NULL-only) ------
update public.counselors c
set auth_user_id = u.id
from auth.users u
where c.auth_user_id is null
  and (u.raw_user_meta_data ->> 'full_name') = c.name
  and (u.raw_app_meta_data ->> 'role') in ('Director','Therapist','Admin');

-- 5) Helper: is_schedule_admin() — Director/Admin see the full schedule (step B will use it) ---
--    NEW distinct helper (NOT is_financial_staff) so the schedule intent is self-documenting.
--    Mirrors is_staff()'s definition/style exactly. Referenced by NOTHING in this migration.
create or replace function private.is_schedule_admin()
returns boolean language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('Director','Admin'), false);
$$;

revoke all on function private.is_schedule_admin() from public;
grant execute on function private.is_schedule_admin() to authenticated;
