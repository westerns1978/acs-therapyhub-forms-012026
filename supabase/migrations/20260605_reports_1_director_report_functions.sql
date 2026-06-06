-- ACS Director Reports — read-only aggregations over the real ledger.
-- security invoker: runs as the caller, who (as staff) can already read payments/charges via RLS.
-- Pass-through rule lives HERE, once. Money is succeeded-only. Daily buckets use Central time.
--
-- Blast radius: adds 3 read-only functions only; no table/policy/data change; security-invoker
-- so they respect existing RLS (staff already read these rows via private.is_staff()).
-- `untied` surfaces any succeeded payment with no charge_id — collected money not linked to a
-- charge (pre-itemization / legacy), NOT a bug. The page self-audits:
--   revenue_excl_passthrough + supplemental_remittance + untied = total_collected.

create or replace function public.acs_report_payments_by_method(p_from date, p_to date)
returns table(method text, payment_count bigint, total numeric)
language sql stable security invoker as $$
  select p.payment_method, count(*), coalesce(sum(p.amount),0)
  from public.payments p
  where p.status = 'succeeded'
    and (p.payment_date at time zone 'America/Chicago')::date between p_from and p_to
  group by p.payment_method
  order by p.payment_method;
$$;

create or replace function public.acs_report_outstanding_by_client()
returns table(client_id uuid, client_name text, outstanding numeric)
language sql stable security invoker as $$
  select s.client_id, s.client_name, s.outstanding from (
    select c.id as client_id, c.name as client_name,
        coalesce((select sum(ch.amount) from public.charges ch
                  where ch.client_id = c.id and ch.status not in ('waived','void')),0)
      - coalesce((select sum(pm.amount) from public.payments pm
                  where pm.client_id = c.id and pm.status='succeeded'),0) as outstanding
    from public.clients c
  ) s
  where s.outstanding > 0
  order by s.outstanding desc;
$$;

create or replace function public.acs_report_money(p_from date, p_to date)
returns table(revenue_excl_passthrough numeric, supplemental_remittance numeric,
              untied numeric, total_collected numeric)
language sql stable security invoker as $$
  select
    coalesce(sum(p.amount) filter (where ch.is_pass_through is not true and p.charge_id is not null),0),
    coalesce(sum(p.amount) filter (where ch.is_pass_through is true),0),
    coalesce(sum(p.amount) filter (where p.charge_id is null),0),
    coalesce(sum(p.amount),0)
  from public.payments p
  left join public.charges ch on ch.id = p.charge_id
  where p.status='succeeded'
    and (p.payment_date at time zone 'America/Chicago')::date between p_from and p_to;
$$;
