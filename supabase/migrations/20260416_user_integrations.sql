-- user_integrations: stores OAuth tokens per app user per provider.
-- Keyed by app-level user id (from AuthContext sessionStorage), not Supabase Auth.
-- Tokens are sensitive: service-role access only via edge functions.
create table if not exists public.user_integrations (
    id uuid primary key default gen_random_uuid(),
    user_id text not null,
    provider text not null,
    access_token text,
    refresh_token text,
    expires_at timestamptz,
    scopes text,
    account_email text,
    calendar_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, provider)
);

-- Row Level Security: block all client (anon/authenticated) access.
-- Only service_role (used by edge functions) can read/write tokens.
alter table public.user_integrations enable row level security;

drop policy if exists "user_integrations_no_client_access" on public.user_integrations;
create policy "user_integrations_no_client_access"
    on public.user_integrations
    for all
    to anon, authenticated
    using (false)
    with check (false);

create index if not exists idx_user_integrations_user_provider
    on public.user_integrations (user_id, provider);
