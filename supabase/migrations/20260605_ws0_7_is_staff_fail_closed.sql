-- WS0 RLS enforcement (7/7) — fail-closed predicates
-- coalesce(..., false) so the helpers return false (not NULL) when app_metadata.role
-- is absent. RLS already treats NULL as deny; this makes the intent explicit and
-- avoids NULL propagation in any future boolean composition. Applied + verified
-- live 2026-06-05 (forged user_metadata role -> is_staff() = false).

create or replace function private.is_staff()
returns boolean language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('Director','Therapist','Admin'), false);
$$;

create or replace function private.is_clinician()
returns boolean language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('Director','Therapist'), false);
$$;
