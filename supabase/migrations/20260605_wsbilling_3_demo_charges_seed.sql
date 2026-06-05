-- WS-Billing Migration 3 — demo charges seed + clients.balance backfill.
-- Source of truth for the billing demo state. Idempotent + reproducible: a fresh
-- replay yields the same internally-consistent ledger (no floating payments, no
-- fictional charges). Applied + verified live 2026-06-05.

-- Jordan Ellis — $200 OEP level fee, fully covered by his $200 payment → balance $0.
insert into public.charges (id, client_id, charge_type, satop_level, description, amount, is_pass_through, status)
values ('e0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001',
        'level_fee','I','SATOP OEP (Level I) program fee', 200, false, 'paid')
on conflict (id) do update set amount=excluded.amount, status=excluded.status, charge_type=excluded.charge_type,
  satop_level=excluded.satop_level, description=excluded.description, is_pass_through=excluded.is_pass_through, client_id=excluded.client_id;
update public.payments set charge_id='e0000000-0000-4000-8000-000000000001'
  where id='d0000000-0000-4000-8000-000000000002';

-- Marcus Reyes — SROP (means-tested) level fee + $249 state supplemental (pass-through).
insert into public.charges (id, client_id, charge_type, satop_level, description, amount, is_pass_through, status)
values
 ('e0000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'level_fee','IV','SATOP SROP (Level IV) program fee — means-tested', 500, false, 'pending'),
 ('e0000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'supplemental_fee', null,'State supplemental fee — DMH Mental Health Earnings Fund (pass-through)', 249, true, 'pending')
on conflict (id) do update set amount=excluded.amount, status=excluded.status, charge_type=excluded.charge_type,
  satop_level=excluded.satop_level, description=excluded.description, is_pass_through=excluded.is_pass_through, client_id=excluded.client_id;

-- Marcus's two $125 court-mandate cash payments are PARTIAL payments against his SROP
-- charge ($250 of $500 → $250 remaining). Two reproducible paths:
--   • LIVE: those rows already exist untethered → link them (the UPDATE).
--   • FRESH: they don't exist → seed the canonical pair already linked (the INSERT).
-- Either way: SROP $250 applied, no floating payments, balance $499.
update public.payments set charge_id='e0000000-0000-4000-8000-000000000002'
  where client_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    and charge_id is null and status='succeeded'
    and description='SATOP Level IV — Court mandate';
insert into public.payments (id, client_id, charge_id, amount, payment_method, status, description, payment_date)
select v.id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'e0000000-0000-4000-8000-000000000002',
       125, 'cash', 'succeeded', 'SATOP Level IV — Court mandate', v.pd
from (values
  ('c0000000-0000-4000-8000-000000000001'::uuid, timestamptz '2026-04-01 14:00:00+00'),
  ('c0000000-0000-4000-8000-000000000002'::uuid, timestamptz '2026-05-01 14:00:00+00')
) as v(id, pd)
where not exists (
  select 1 from public.payments
  where client_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    and description='SATOP Level IV — Court mandate'
);

-- Pat Novak — $450 program fee covered by his payments → balance $0.
insert into public.charges (id, client_id, charge_type, satop_level, description, amount, is_pass_through, status)
values ('e0000000-0000-4000-8000-000000000004','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'other', null,'Gambling Recovery program fees', 450, false, 'paid')
on conflict (id) do update set amount=excluded.amount, status=excluded.status, charge_type=excluded.charge_type,
  description=excluded.description, is_pass_through=excluded.is_pass_through, client_id=excluded.client_id;

-- Authoritative backfill: every client's cached balance = derived ledger value.
update public.clients set balance = public.client_balance(id);

-- REVERSE (documented, not run):
--   delete from public.charges where id in
--     ('e0000000-0000-4000-8000-000000000001','...002','...003','...004');
--   update public.payments set charge_id=null
--     where client_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and charge_id='e0000000-0000-4000-8000-000000000002';
--   update public.clients set balance = public.client_balance(id);
