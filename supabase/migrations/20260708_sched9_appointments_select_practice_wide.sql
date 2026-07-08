-- Scheduling build, step 9 — distributed booking model (David 7/7 follow-up + Dan's
-- explicit GO): "open the calendar, not the chart."
--
-- WHY: WS1 step B (20260705_schedule_identity_2) scoped a clinician's appointments SELECT
-- to only their OWN counselor row. That's correct for a single-clinician calendar app, but
-- David's spec is PRACTICE-WIDE scheduling — any clinician books any counselor's lane. The
-- old SELECT scope silently broke that: addAppointment's insert().select() (RETURNING)
-- enforces SELECT against the just-inserted row, so a non-admin booking onto another
-- counselor's calendar got "new row violates row-level security policy" (found + reported
-- in step 4's witness, deliberately left unfixed pending this GO).
--
-- CHANGE: appointments_select_clinician_own (is_clinician() AND own-counselor EXISTS) ->
-- appointments_select_clinician_practice_wide (is_clinician(), unscoped). Together with the
-- unchanged appointments_select_schedule_admin policy, EVERY staff role (Director/Therapist/
-- Admin) can now SELECT every appointment row — matching the writes, which were ALREADY
-- practice-wide via is_staff() on INSERT/UPDATE/DELETE (WS1 step B deliberately left those
-- unscoped; this migration finally brings SELECT in line with them).
--
-- SCOPE: appointments ONLY. clinical_notes/treatment_plans/placement_determinations etc. are
-- UNTOUCHED — "open the calendar, not the chart." (Recon note, not fixed here: clinical_notes'
-- existing policy — staff_all_clinical_notes, FOR ALL using is_clinician() — was ALREADY
-- role-scoped only, with no per-client restriction, before this migration. That is a
-- pre-existing gap this migration does not create or worsen, and does not touch.)
--
-- Re-runnable: drop-if-exists before create. No data change, no new function.

drop policy if exists appointments_select_clinician_own on public.appointments;

create policy appointments_select_clinician_practice_wide on public.appointments
  for select to authenticated
  using (private.is_clinician());

-- REVERT (restores the WS1 step B own-counselor-only scope):
--   drop policy if exists appointments_select_clinician_practice_wide on public.appointments;
--   create policy appointments_select_clinician_own on public.appointments
--     for select to authenticated
--     using (
--       private.is_clinician()
--       and exists (
--         select 1 from public.counselors c
--         where c.id = appointments.counselor_id
--           and c.auth_user_id = auth.uid()
--       )
--     );
