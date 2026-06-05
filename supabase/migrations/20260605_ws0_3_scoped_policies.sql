-- WS0 RLS enforcement (3/7) — scoped policies (additive; "Allow all" still present)
-- staff-only:        clinical_notes (clinician-only), client_risk_profiles, therapist_availability
-- staff + self-read: clients, form_submissions, appointments, payments,
--                    client_communications, treatment_plans (clinician-only write)
-- NOTE: appointments.client_id is TEXT (every other client_id is uuid), so its
-- self-read casts to text — see SECURITY_BACKLOG.md item #7. Applied + verified
-- live 2026-06-05.

-- Staff-only (clinician-only for clinical_notes)
create policy staff_all_clinical_notes on public.clinical_notes
  for all to authenticated using (private.is_clinician()) with check (private.is_clinician());

create policy staff_all_client_risk_profiles on public.client_risk_profiles
  for all to authenticated using (private.is_staff()) with check (private.is_staff());

create policy staff_all_therapist_availability on public.therapist_availability
  for all to authenticated using (private.is_staff()) with check (private.is_staff());

-- Staff + client self-read
create policy staff_all_clients on public.clients
  for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy client_self_read_clients on public.clients
  for select to authenticated using (id in (select private.my_client_ids()));

create policy staff_all_form_submissions on public.form_submissions
  for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy client_self_read_form_submissions on public.form_submissions
  for select to authenticated using (client_id in (select private.my_client_ids()));

create policy staff_all_appointments on public.appointments
  for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy client_self_read_appointments on public.appointments
  for select to authenticated
  using (client_id in (select cid::text from private.my_client_ids() as t(cid)));

create policy staff_all_payments on public.payments
  for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy client_self_read_payments on public.payments
  for select to authenticated using (client_id in (select private.my_client_ids()));

create policy staff_all_client_communications on public.client_communications
  for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy client_self_read_client_communications on public.client_communications
  for select to authenticated using (client_id in (select private.my_client_ids()));

create policy staff_all_treatment_plans on public.treatment_plans
  for all to authenticated using (private.is_clinician()) with check (private.is_clinician());
create policy client_self_read_treatment_plans on public.treatment_plans
  for select to authenticated using (client_id in (select private.my_client_ids()));
