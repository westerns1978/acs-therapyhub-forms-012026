-- ACS TherapyHub — extend `payments` for Stripe-style receipts
--
-- The existing `payments` table (id/client_id/amount/payment_date/payment_method)
-- couldn't carry the description, status, and external processor id the client
-- detail view needs to surface a receipt. Adding those three text columns plus
-- a couple of helpful indexes. Backfills are unnecessary — existing rows can
-- leave the new columns null and the UI handles that gracefully.

alter table public.payments
  add column if not exists description text,
  add column if not exists status text default 'paid',
  add column if not exists external_payment_id text;

create index if not exists payments_client_id_idx on public.payments (client_id);
create index if not exists payments_payment_date_idx on public.payments (payment_date);
