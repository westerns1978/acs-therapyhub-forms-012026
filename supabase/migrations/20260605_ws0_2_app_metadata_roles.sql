-- WS0 RLS enforcement (2/7) — server-controlled role hardening
-- Copies each demo account's user_metadata.role into app_metadata.role so role
-- authority is NOT self-editable via auth.updateUser({data:{role}}). Takes effect
-- on the account's next token (re-login). Applied + verified live 2026-06-05.

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', raw_user_meta_data ->> 'role')
where email in (
  'demo.director@acs-therapyhub.com',
  'demo.therapist@acs-therapyhub.com',
  'demo.admin@acs-therapyhub.com',
  'marcus.reyes.demo@gemyndflow.com',
  'pat.novak.demo@gemyndflow.com'
)
and raw_user_meta_data ? 'role';
