-- WS-SecRPC 1 — close SECURITY_BACKLOG #12 at the reporting layer.
-- The three Director-Reports RPCs were SECURITY INVOKER with NO role guard, so a
-- Therapist JWT could execute them and read full cross-client financials via direct
-- API even though /financials is Director/Admin-only in the UI (FINANCIAL_ROLES).
-- This gates each to private.is_financial_staff() (Director/Admin) with a fail-closed
-- raise (42501 -> HTTP 403, a legible denial, not silent-empty).
--
-- SECURITY INVOKER is PRESERVED (underlying is_staff() RLS stays as defense-in-depth).
-- SELECT bodies are verbatim from the prior LANGUAGE sql defs — only the wrapper changed
-- (sql -> plpgsql + the guard). Return signatures unchanged (positional mapping intact,
-- incl. payment_method -> method).
--
-- NOT touched: charges/payments table RLS. Per-client billing is intentionally all-staff
-- (wsrp_2) — the Billing tab, RecordPayment, and late-cancel/waive all run under is_staff().
-- The compliance gate is unaffected: it reads clients.balance, never these RPCs/the ledger.
-- Residual (accepted): a Therapist can still direct-SELECT charges/payments and re-derive
-- cross-client totals — intra-staff boundary, no PHI/public leak. Option B (per-client
-- client_ledger SECURITY DEFINER fn + split SELECT/write policies) deferred — see #12.
--
-- Rollback: re-create the three prior LANGUAGE sql defs (one statement each); no data
-- touched, signatures unchanged, so rollback is instant and non-destructive.

create or replace function public.acs_report_money(p_from date, p_to date)
returns table(revenue_excl_passthrough numeric, supplemental_remittance numeric, untied numeric, total_collected numeric)
language plpgsql stable security invoker as $function$
begin
  if not private.is_financial_staff() then
    raise exception 'forbidden: financial reports are Director/Admin only' using errcode = '42501';
  end if;
  return query
    select
      coalesce(sum(p.amount) filter (where ch.is_pass_through is not true and p.charge_id is not null),0),
      coalesce(sum(p.amount) filter (where ch.is_pass_through is true),0),
      coalesce(sum(p.amount) filter (where p.charge_id is null),0),
      coalesce(sum(p.amount),0)
    from public.payments p
    left join public.charges ch on ch.id = p.charge_id
    where p.status='succeeded'
      and (p.payment_date at time zone 'America/Chicago')::date between p_from and p_to;
end; $function$;

create or replace function public.acs_report_payments_by_method(p_from date, p_to date)
returns table(method text, payment_count bigint, total numeric)
language plpgsql stable security invoker as $function$
begin
  if not private.is_financial_staff() then
    raise exception 'forbidden: financial reports are Director/Admin only' using errcode = '42501';
  end if;
  return query
    select p.payment_method, count(*), coalesce(sum(p.amount),0)
    from public.payments p
    where p.status = 'succeeded'
      and (p.payment_date at time zone 'America/Chicago')::date between p_from and p_to
    group by p.payment_method
    order by p.payment_method;
end; $function$;

create or replace function public.acs_report_outstanding_by_client()
returns table(client_id uuid, client_name text, outstanding numeric)
language plpgsql stable security invoker as $function$
begin
  if not private.is_financial_staff() then
    raise exception 'forbidden: financial reports are Director/Admin only' using errcode = '42501';
  end if;
  return query
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
end; $function$;
