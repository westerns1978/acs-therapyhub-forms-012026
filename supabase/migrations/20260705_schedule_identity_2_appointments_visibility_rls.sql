-- WS1 STEP B — DB-enforced per-counselor calendar visibility (THE high-risk change).
--
-- Replaces the blanket staff_all_appointments (which let EVERY staff SELECT EVERY row)
-- with SPLIT, FAIL-CLOSED policies. Visibility is the only thing that changes:
--   • Schedule admins (Director + Admin) still see the whole practice calendar.
--   • A clinician (Director/Therapist) sees ONLY their own seats.
--   • WRITES are DELIBERATELY LEFT at is_staff() (one risk at a time — visibility is the
--     ask). A clinician can still INSERT/UPDATE/DELETE exactly as before; only READ scope
--     narrows. Writes are split into per-command policies precisely so they do NOT re-grant
--     SELECT (a cmd=ALL write policy would reopen the read scope and defeat the whole split).
--   • client_self_read_appointments is UNTOUCHED.
--
-- Identity ground (from step A, already live): appointments.counselor_id (FK counselors.id),
-- counselors.auth_user_id (FK auth.users.id). auth.uid() = the caller's user id.
--
-- FAIL-CLOSED for orphans: the clinician predicate is an EXISTS join through counselor_id.
-- A NULL counselor_id (the 22 orphan/unlinked rows — phantom "Dr. Anya Sharma", null-name,
-- demo) joins NOTHING → EXISTS is false → orphans are NEVER visible to any clinician. They
-- remain visible only to schedule admins (all rows). No fail-open path.
--
-- The POLICIES add no SECURITY DEFINER; RLS stays enabled. The EXISTS subquery reads
-- public.counselors, which is staff-readable (staff_all_counselors = is_staff), so it resolves
-- for any clinician without elevated rights. (The self-attribution TRIGGER at the bottom IS
-- security definer — intentionally, with a pinned search_path; see its note.)
--
-- Re-runnable: every policy is dropped-if-exists before (re)create. Runs inside the migration
-- runner's transaction; no CONCURRENTLY.

-- Retire the blanket staff-all policy (the fail-open surface).
drop policy if exists staff_all_appointments on public.appointments;

-- ── SELECT (visibility) ──────────────────────────────────────────────────────────────────
-- (1) Schedule admins see the entire calendar.
drop policy if exists appointments_select_schedule_admin on public.appointments;
create policy appointments_select_schedule_admin on public.appointments
  for select to authenticated
  using (private.is_schedule_admin());

-- (2) A clinician sees ONLY rows whose counselor resolves to themselves. NULL counselor_id
--     matches nothing (orphans stay admin-only). is_clinician() keeps this path to
--     Director/Therapist roles.
drop policy if exists appointments_select_clinician_own on public.appointments;
create policy appointments_select_clinician_own on public.appointments
  for select to authenticated
  using (
    private.is_clinician()
    and exists (
      select 1 from public.counselors c
      where c.id = appointments.counselor_id
        and c.auth_user_id = auth.uid()
    )
  );

-- ── WRITES (unchanged posture: is_staff) ─────────────────────────────────────────────────
-- Split per-command so writes never re-grant SELECT. Tightening writes to per-counselor is a
-- SEPARATE, later decision — NOT in this commit.
drop policy if exists appointments_insert_staff on public.appointments;
create policy appointments_insert_staff on public.appointments
  for insert to authenticated
  with check (private.is_staff());

drop policy if exists appointments_update_staff on public.appointments;
create policy appointments_update_staff on public.appointments
  for update to authenticated
  using (private.is_staff())
  with check (private.is_staff());

drop policy if exists appointments_delete_staff on public.appointments;
create policy appointments_delete_staff on public.appointments
  for delete to authenticated
  using (private.is_staff());

-- client_self_read_appointments intentionally NOT recreated here — left exactly as-is.

-- ── Self-attribution trigger (makes clinician self-booking round-trip) ────────────────────
-- The app writes therapist_name only (never counselor_id), so without this a clinician's
-- freshly INSERTed row would have counselor_id = NULL → invisible to its creator under the
-- select_clinician_own policy → the insert's .select() round-trip (return=representation)
-- returns 0 rows (PGRST116) and the booking UI errors. This BEFORE INSERT trigger stamps the
-- acting clinician's own counselor id when the caller left it NULL, so the new row is
-- self-attributed and self-visible immediately — keeping "a clinician can still create" true
-- with NO app change.
--
-- SECURITY DEFINER with a pinned search_path (hardening: prevents search_path hijacking of a
-- definer function). auth.uid() reads the request JWT GUC, which SECURITY DEFINER does NOT
-- alter, so it still returns the CALLER's id — exactly what we want to map to a counselor.
-- Minimal + safe: only fills a NULL counselor_id, NEVER overrides a value the caller set; an
-- unmatched uid (admin, unlinked) leaves it NULL (harmless — admins see all rows anyway).
create or replace function private.set_counselor_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if NEW.counselor_id is null then
    NEW.counselor_id := (
      select c.id from public.counselors c
      where c.auth_user_id = auth.uid()
      limit 1
    );
  end if;
  return NEW;
end;
$$;

-- Not directly callable by clients; the trigger fires it as the definer regardless.
revoke all on function private.set_counselor_from_auth() from public;

drop trigger if exists trg_set_counselor_from_auth on public.appointments;
create trigger trg_set_counselor_from_auth
  before insert on public.appointments
  for each row
  execute function private.set_counselor_from_auth();
