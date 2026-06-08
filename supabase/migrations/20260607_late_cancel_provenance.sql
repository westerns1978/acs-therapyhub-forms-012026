-- Late-cancellation fee provenance — additive columns on public.charges.
-- Supports the $40 late-cancel fee (charge_type='late_cancellation_fee', free text →
-- no enum change) and the inline emergency waive (status='waived' + who/why/when).
-- All columns NULLABLE, additive, reversible — no backfill, no row changes. The balance
-- formula already excludes status in ('waived','void') (wsbilling_1), so the ledger math
-- is untouched: a 'pending' late-cancel charge raises clients.balance; flipping it to
-- 'waived' drops it back.
--
-- appointment_id is UUID to match public.appointments.id (uuid NOT NULL default
-- gen_random_uuid()) — verified live before writing. NB the legacy text-vs-uuid quirk is
-- on appointments.CLIENT_ID (relaxed uuid→text in 20260417_appointments.sql for the app's
-- short string IDs); appointments.ID stayed uuid. waived_by mirrors created_by (uuid).
-- ON DELETE SET NULL: the charge IS the financial record and must outlive its appointment
-- (a real debt never vanishes because an old cancelled appointment is purged, and staff
-- shouldn't hit an FK-block deleting stale appointments). The charge description preserves
-- the date/time link once appointment_id goes null.

alter table public.charges
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null,
  add column if not exists waived_by      uuid,
  add column if not exists waived_reason  text,
  add column if not exists waived_at      timestamptz;
