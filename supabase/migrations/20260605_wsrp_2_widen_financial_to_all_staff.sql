-- WS-RecordPayment 2 — widen financial operations to all staff (Director/Therapist/Admin).
-- 3-person clinic, everyone covers the desk. Operational = all staff; clinical authorship
-- (clinical_notes, treatment_plans) stays is_clinician() and is intentionally untouched here.

-- payments: was financial_staff_all_payments (is_financial_staff); widen to is_staff,
-- KEEP the recorded_by = auth.uid() provenance guard (now applies to all staff).
drop policy if exists financial_staff_all_payments on public.payments;
create policy staff_all_payments on public.payments
  for all to authenticated
  using (private.is_staff())
  with check (private.is_staff() and recorded_by = auth.uid());
-- client_self_read_payments unchanged.

-- charges: was staff_all_charges (is_financial_staff); widen to is_staff.
drop policy if exists staff_all_charges on public.charges;
create policy staff_all_charges on public.charges
  for all to authenticated
  using (private.is_staff())
  with check (private.is_staff());
-- client_self_read_charges unchanged.

-- clients: NO CHANGE NEEDED. Recon confirms staff_all_clients is already FOR ALL on
-- private.is_staff() (INSERT/UPDATE/SELECT all-staff) + client_self_read_clients intact,
-- so creating a new client already works for Director/Therapist/Admin.
