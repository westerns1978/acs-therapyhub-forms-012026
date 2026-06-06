-- WS-RecordPayment 1 — tighten payments writes to financial staff (Director/Admin),
-- aligning with charges (wsbilling_1). payments was is_staff() from the WS0 sweep (ws0_3).
drop policy if exists staff_all_payments on public.payments;
create policy financial_staff_all_payments on public.payments
  for all to authenticated
  using (private.is_financial_staff())
  with check (private.is_financial_staff() and recorded_by = auth.uid());
-- client_self_read_payments unchanged.

-- kill the stale default that silently breaks the balance trigger
-- (client_balance counts status='succeeded'; column defaulted to 'paid').
alter table public.payments alter column status set default 'succeeded';
