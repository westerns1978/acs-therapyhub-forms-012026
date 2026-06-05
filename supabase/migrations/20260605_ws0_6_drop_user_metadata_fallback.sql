-- WS0 RLS enforcement (6/7) — make role authority app_metadata-only
-- Removes the user_metadata fallback so an authenticated user cannot self-escalate
-- via auth.updateUser({data:{role}}). Requires app_metadata.role on staff tokens
-- (set in 2/7). Applied + verified live 2026-06-05.

create or replace function private.is_staff()
returns boolean language sql stable set search_path = '' as $$
  select (auth.jwt() -> 'app_metadata' ->> 'role') in ('Director','Therapist','Admin');
$$;

create or replace function private.is_clinician()
returns boolean language sql stable set search_path = '' as $$
  select (auth.jwt() -> 'app_metadata' ->> 'role') in ('Director','Therapist');
$$;
