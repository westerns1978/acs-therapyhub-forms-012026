-- 20260708 — Scheduling build, step 1: roster truth (David's 7/7 follow-up docs).
--
-- Target dropdown roster: John Burns, Karen Ventimiglia, David Yoder,
-- Bill Sunderman, Dave L, Debra. NO Rick.
--   * Rick: deactivated (not deleted — his 2 ws6_2 standing groups keep their
--     rows for history; both flip inactive so pickers/lanes stop offering them).
--     Recon 2026-07-08: Rick has 0 enrollments and 0 appointments.
--   * "John" -> "John Burns" (display normalization; 0 appointments carry
--     therapist_name='John', so no backfill needed).
--   * "Dave L" inserted as display placeholder (full name pending David).
--   * "Debra" kept as-is (Deb/Debra pending David — display-only).
-- Scope: counselors + groups are ACS-owned tables (created in-repo, ws6_1).
-- Idempotent: every statement no-ops on re-run.
--
-- REVERT:
--   update public.counselors set active = true  where name = 'Rick';
--   update public.groups     set active = true  where counselor_id =
--     (select id from public.counselors where name = 'Rick');   -- both were active pre-migration
--   update public.counselors set name = 'John'  where name = 'John Burns';
--   delete from public.counselors where name = 'Dave L';        -- safe while he has no groups/appointments

update public.groups
   set active = false
 where active
   and counselor_id in (select id from public.counselors where name = 'Rick');

update public.counselors
   set active = false
 where active
   and name = 'Rick';

update public.counselors
   set name = 'John Burns'
 where name = 'John';

insert into public.counselors (name, active)
select 'Dave L', true
 where not exists (select 1 from public.counselors where name = 'Dave L');
