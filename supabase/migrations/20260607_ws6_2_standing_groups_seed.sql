-- WS6 Phase 2 (ws6_2) — STANDING-GROUPS SEED. Populates `counselors` + `groups` from the
-- authoritative ACS Zoom sheet ("Zoom Meeting ID Numbers", updated 7/31/24) so the
-- ScheduleSessionModal group-picker lists real recurring slots. DATA-ONLY (no DDL); rides
-- on ws6_1's schema. Source of truth lives in git; applied to live after review.
--
-- IDEMPOTENT: every INSERT is `… SELECT … WHERE NOT EXISTS (…)`, so re-running is a no-op.
-- REVERSIBLE: counselors/groups carry NO append-only trigger or rule (verified via
-- pg_trigger/pg_rewrite — both empty), so a bad seed is service_role-deletable. To undo:
--   delete from public.groups;      -- FK child first
--   delete from public.counselors;  -- then parents
--
-- session_kind → service_type MAP (applied HERE — the DB does NOT enforce the pairing; the
-- only CHECK is groups_service_type_valid's 4-value domain on service_type):
--   therapy   → counseling      individual → counseling
--   education → education
--   intake    → other           dwi_court  → other      mrt → other
--   anger     → other           adep       → other
-- 'other' deliberately does NOT accrue — WS3's client_accrued_hours view filters it out.
--
-- Zoom: meeting-id digits stored bare; zoom_link mirrors the app's own format
-- (pages/Resources.tsx → https://zoom.us/j/<id>). Personal-room ids per the 7/31/24 sheet.

-- ── (1) counselors — one row each; permanent personal Zoom room ────────────────────────
insert into public.counselors (name, zoom_meeting_id, zoom_link)
select v.name, v.mid, 'https://zoom.us/j/' || v.mid
from (values
  ('David Yoder',       '4920165222'),
  ('Bill Sunderman',    '5627181964'),
  ('John',              '8648767994'),
  ('Karen Ventimiglia', '6544815003'),
  ('Debra',             '5787701581'),
  ('Rick',              '4429543182')
) as v(name, mid)
where not exists (select 1 from public.counselors c where c.name = v.name);

-- ── (2) groups — one row per recurring TYPED slot, transcribed from the 7/31/24 sheet ──
-- weekday: 0=Sun .. 6=Sat ; null = by-appointment. service_type derived per the map above.
insert into public.groups (counselor_id, program, weekday, start_local, end_local, session_kind, service_type)
select c.id, v.program, v.weekday, v.start_local, v.end_local, v.session_kind, v.service_type
from (values
  -- David — "Mon & Thurs 9am–12pm  CIP/SROP/OP/DOT Group & DWI Court". One combined room/block;
  -- modeled as the treatment group ('therapy' → counseling). DWI Court is bundled into the same
  -- block on the sheet — split out a separate dwi_court row only if you track the court portion apart.
  ('David Yoder',       'CIP/SROP/OP/DOT & DWI Court', 1::smallint,    time '09:00', time '12:00', 'therapy',    'counseling'),
  ('David Yoder',       'CIP/SROP/OP/DOT & DWI Court', 4::smallint,    time '09:00', time '12:00', 'therapy',    'counseling'),
  -- John — "*R/P Mon 6–9pm" and "*O/P-*CIP-*SROP Tues/Thurs 6–9pm".
  ('John',              'R/P (Relapse Prevention)',    1::smallint,    time '18:00', time '21:00', 'therapy',    'counseling'),
  ('John',              'O/P/CIP/SROP',                2::smallint,    time '18:00', time '21:00', 'therapy',    'counseling'),
  ('John',              'O/P/CIP/SROP',                4::smallint,    time '18:00', time '21:00', 'therapy',    'counseling'),
  -- Rick — "*O/P-*CIP-*SROP Tues/Thurs 6–9pm".
  ('Rick',              'O/P/CIP/SROP',                2::smallint,    time '18:00', time '21:00', 'therapy',    'counseling'),
  ('Rick',              'O/P/CIP/SROP',                4::smallint,    time '18:00', time '21:00', 'therapy',    'counseling'),
  -- Bill — "Individual Sessions" (by appointment; no fixed weekday/time on the sheet).
  ('Bill Sunderman',    'Individual Sessions',         null::smallint, null::time,   null::time,   'individual', 'counseling'),
  -- Karen — "*O/P-*R/P-*CIP-*SROP Individuals and Intakes" → split into the two typed activities.
  ('Karen Ventimiglia', 'O/P/R/P/CIP/SROP',            null::smallint, null::time,   null::time,   'individual', 'counseling'),
  ('Karen Ventimiglia', 'Intakes',                     null::smallint, null::time,   null::time,   'intake',     'other'),
  -- Debra — "DWI Court, MRT Group".
  ('Debra',             'DWI Court',                   null::smallint, null::time,   null::time,   'dwi_court',  'other'),
  ('Debra',             'MRT Group',                   null::smallint, null::time,   null::time,   'mrt',        'other')
) as v(counselor_name, program, weekday, start_local, end_local, session_kind, service_type)
join public.counselors c on c.name = v.counselor_name
where not exists (
  select 1 from public.groups g
  where g.counselor_id = c.id
    and g.weekday      is not distinct from v.weekday
    and g.start_local  is not distinct from v.start_local
    and g.session_kind = v.session_kind
);

-- ── (3) John's MONTHLY block — NOT seeded (needs your call) ────────────────────────────
-- The sheet lists, under John: "*OEP-*WIP-*ADEP & 10 Hour Anger Class - Monthly". Cadence is
-- MONTHLY (the schema's `weekday` is a WEEKLY slot) and two mappings are judgment calls, so
-- these are left out of the active seed. Uncomment once you confirm session_kind/service_type:
--     OEP   (SATOP Lvl I  — Offender Education)      → 'education' / 'education'
--     WIP   (SATOP Lvl II — Weekend Intervention)    → UNCERTAIN (weekend intensive): 'education' or 'therapy'?
--     ADEP  (Alcohol/Drug Education Program)         → 'adep' / 'other'  (education-NAMED but mapped 'other' per your map — confirm)
--     Anger (10-Hour Anger Class)                    → 'anger' / 'other'
-- insert into public.groups (counselor_id, program, weekday, start_local, end_local, session_kind, service_type)
-- select c.id, v.program, null::smallint, null::time, null::time, v.session_kind, v.service_type
-- from (values
--   ('John', 'OEP (Offender Education) — Monthly',      'education', 'education'),
--   ('John', 'WIP (Weekend Intervention) — Monthly',    'education', 'education'),
--   ('John', 'ADEP (Alcohol/Drug Education) — Monthly', 'adep',      'other'),
--   ('John', '10-Hour Anger Class — Monthly',           'anger',     'other')
-- ) as v(counselor_name, program, session_kind, service_type)
-- join public.counselors c on c.name = v.counselor_name
-- where not exists (select 1 from public.groups g where g.counselor_id = c.id and g.session_kind = v.session_kind);
