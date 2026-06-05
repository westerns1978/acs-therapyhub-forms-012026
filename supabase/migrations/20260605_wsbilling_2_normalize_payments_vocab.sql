-- WS-Billing Migration 2 — normalize payments vocab (applied + verified live 2026-06-05).
-- Canonical methods (stripe/cash/check/money_order/insurance) + status 'succeeded'.
-- Explicit per-value map, idempotent, reversible (backup in API-private schema),
-- self-asserting (aborts on row-count drift or any surviving non-canonical value).

-- (1) Reversibility: snapshot original method+status BEFORE changing anything. Lives in
--     `private` (not exposed via PostgREST → no anon exposure, no RLS needed).
create table if not exists private.payments_vocab_backup_20260605 (
  id uuid primary key,
  old_payment_method text,
  old_status text,
  backed_up_at timestamptz default now()
);
insert into private.payments_vocab_backup_20260605 (id, old_payment_method, old_status)
  select id, payment_method, status from public.payments
  on conflict (id) do nothing;

-- (2) Explicit old -> new method map (no-op on already-canonical values → idempotent).
update public.payments set payment_method = case payment_method
  when 'Stripe'                then 'stripe'
  when 'stripe'                then 'stripe'
  when 'card'                  then 'stripe'
  when 'credit_card'           then 'stripe'
  when 'cash'                  then 'cash'
  when 'check'                 then 'check'
  when 'money_order'           then 'money_order'
  when 'medicare_supplemental' then 'insurance'   -- preserve self-pay vs third-party
  else payment_method
end
where payment_method is not null;

-- (3) Status: 'paid' -> 'succeeded' (idempotent).
update public.payments set status = 'succeeded' where status = 'paid';

-- (4) In==out proof INSIDE the migration: aborts (rolls back) on count drift or any
--     surviving non-canonical value. Canonical method set includes 'insurance'.
do $$
declare total_after int; total_backed_up int; noncanonical int;
begin
  select count(*) into total_after     from public.payments;
  select count(*) into total_backed_up from private.payments_vocab_backup_20260605;
  if total_after <> total_backed_up then
    raise exception 'row-count mismatch: payments=% backup=%', total_after, total_backed_up;
  end if;
  select count(*) into noncanonical from public.payments
   where (payment_method is not null and payment_method not in ('stripe','cash','check','money_order','insurance'))
      or (status        is not null and status        not in ('succeeded','failed','refunded','void'));
  if noncanonical > 0 then
    raise exception 'normalization incomplete: % non-canonical payment row(s) remain', noncanonical;
  end if;
  raise notice 'payments normalized: % rows, 0 non-canonical', total_after;
end $$;

-- REVERSE (documented, not run):
--   update public.payments p set payment_method = b.old_payment_method, status = b.old_status
--     from private.payments_vocab_backup_20260605 b where p.id = b.id;
--   drop table private.payments_vocab_backup_20260605;
