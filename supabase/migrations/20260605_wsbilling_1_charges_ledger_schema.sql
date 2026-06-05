-- WS-Billing Migration 1 — ledger schema + security (applied + verified live 2026-06-05).
-- Folds the charges table, payments ledger columns, balance derivation, and RLS into one
-- migration so `charges` is NEVER created without RLS (no exposure window — the WS0 lesson).
-- Role-scoped, Director+Admin for financials (Therapist excluded). No Allow all.

-- (1) Financial-staff helper: Director + Admin only (Therapist gets paid-status via
--     clients.balance, not raw financials). app_metadata-only + fail-closed (matches WS0).
create or replace function private.is_financial_staff()
returns boolean language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('Director','Admin'), false);
$$;
revoke all on function private.is_financial_staff() from public;
grant execute on function private.is_financial_staff() to authenticated;

-- (2) charges — the debit side of the ledger
create table if not exists public.charges (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id),
  charge_type text not null,                       -- assessment_fee|level_fee|supplemental_fee|other
  satop_level text,                                -- 'I'|'II'|'III'|'IV' when applicable
  description text,
  amount numeric not null check (amount >= 0),
  is_pass_through boolean not null default false,  -- TRUE for the $249 state supplemental
  status text not null default 'pending' check (status in ('pending','paid','waived','void')),
  created_by uuid,
  created_at timestamptz default now()
);
create index if not exists charges_client_id_idx on public.charges(client_id);

-- (3) RLS — financial staff full access + client self-read. No Allow all.
alter table public.charges enable row level security;
grant select, insert, update, delete on public.charges to authenticated;
grant all on public.charges to service_role;
create policy staff_all_charges on public.charges for all to authenticated
  using (private.is_financial_staff()) with check (private.is_financial_staff());
create policy client_self_read_charges on public.charges for select to authenticated
  using (client_id in (select private.my_client_ids()));

-- (4) payments ledger columns + Stripe idempotency lock (NULL-friendly → manual payments
--     never collide; the webhook insert-first guard keys on this unique index).
alter table public.payments add column if not exists charge_id uuid references public.charges(id);
alter table public.payments add column if not exists recorded_by uuid;
alter table public.payments add column if not exists stripe_event_id text;
create unique index if not exists payments_stripe_event_id_key
  on public.payments(stripe_event_id) where stripe_event_id is not null;

-- (5) Balance DERIVES — single formula; counts only canonical status='succeeded' payments
--     (Migration 2 normalizes legacy 'paid' → 'succeeded').
create or replace function public.client_balance(p_client uuid)
returns numeric language sql stable set search_path = '' as $$
  select coalesce((select sum(amount) from public.charges
                   where client_id = p_client and status not in ('waived','void')), 0)
       - coalesce((select sum(amount) from public.payments
                   where client_id = p_client and status = 'succeeded'), 0);
$$;

-- (6) Trigger maintains clients.balance as a real cache so the WS7 cert gate reads it
--     unchanged. SECURITY DEFINER so it can write clients.balance regardless of writer.
create or replace function public.refresh_client_balance()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  new_cid uuid := case when tg_op <> 'DELETE' then new.client_id end;
  old_cid uuid := case when tg_op <> 'INSERT' then old.client_id end;
begin
  if new_cid is not null then
    update public.clients set balance = public.client_balance(new_cid) where id = new_cid;
  end if;
  if old_cid is not null and old_cid is distinct from new_cid then
    update public.clients set balance = public.client_balance(old_cid) where id = old_cid;
  end if;
  return null;
end; $$;

drop trigger if exists trg_refresh_balance_charges on public.charges;
create trigger trg_refresh_balance_charges
  after insert or update or delete on public.charges
  for each row execute function public.refresh_client_balance();

drop trigger if exists trg_refresh_balance_payments on public.payments;
create trigger trg_refresh_balance_payments
  after insert or update or delete on public.payments
  for each row execute function public.refresh_client_balance();
