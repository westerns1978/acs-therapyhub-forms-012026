-- WS0 RLS enforcement (1/7) — helpers
-- Applied + verified live on project ldzzlndsspkyohvzfiiu (2026-06-05); checked in
-- as source-of-truth. Role-scoped (no org_id on ACS tables; single clinic).
-- is_staff()/is_clinician() use coalesce(app_metadata, user_metadata) here; the
-- user_metadata fallback is removed in migration 6/7 once app_metadata is set (2/7).

create schema if not exists private;

create or replace function private.is_staff()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(auth.jwt()->'app_metadata'->>'role', auth.jwt()->'user_metadata'->>'role')
         in ('Director','Therapist','Admin');
$$;

create or replace function private.is_clinician()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(auth.jwt()->'app_metadata'->>'role', auth.jwt()->'user_metadata'->>'role')
         in ('Director','Therapist');
$$;

create or replace function private.my_client_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select id from public.clients
  where email is not null and lower(email) = lower(auth.jwt()->>'email');
$$;

revoke all on function private.is_staff()      from public;
revoke all on function private.is_clinician()  from public;
revoke all on function private.my_client_ids() from public;
grant usage   on schema private to authenticated;
grant execute on function private.is_staff()      to authenticated;
grant execute on function private.is_clinician()  to authenticated;
grant execute on function private.my_client_ids() to authenticated;
