-- ACS TherapyHub — Demo-week schedule seed v2: FULL WEEK, multi-counselor, colored (2026-07-14)
--
-- PURPOSE
--   Supersede the v1 demo seed (20260608_demo_week_seed_and_10a_drop.sql), which placed all
--   this-week rows on Mon–Thu with only two counselors and no session_type. This v2 lights up
--   the by-counselor Week board on EVERY column Mon–Sun, across five counselors, with the full
--   service-color palette visible — so the calendar reads like a real practice, not a skeleton.
--
--   Pairs with the by-counselor Week fix (COUNSELOR_WEEK_DAYS 5 -> 7): with a 7-day board and
--   this 7-day seed, the by-counselor view finally matches Merged + Day.
--
-- DESIGN (unchanged from v1 where noted)
--   • Relative-to-now(), Central-pinned: every start_time = (this week's Monday in
--     America/Chicago) + the slot's local time, converted back at America/Chicago. Re-running
--     reschedules to the then-current week (it does NOT auto-follow the calendar — re-run to refresh).
--   • Attribution is by therapist_name only (NOT counselor_id) — the by-counselor board buckets
--     FK-first then falls back to normalizeCounselorName(therapist_name). Every therapist_name
--     below matches counselors.name after that normalization ('Karen Ventimiglia, LPC' -> the
--     comma-split drops ', LPC' -> matches 'Karen Ventimiglia'). counselor_id is left NULL.
--   • Card COLOR comes from session_type (config/sessionTaxonomy.ts), NOT service_type. v1 never
--     set session_type, so v1 cards fell back to status color. Here each 1:1 carries its taxonomy
--     token so yellow (OP/DOT) / blue (Eval/EAP/Series) / green (CIP) / pink (SROP) / grey
--     (DWI/MRT) / neutral (SATOP Group, null color) all render.
--   • accrual axis service_type stays 'counseling' for scheduled rows; past-completed history
--     uses 'other' => client_accrued_hours filters them out (ZERO accrual movement for anyone).
--   • Shared-group SATOP rows keep ONE group_id + ONE slot with multiple enrolled clients
--     (Mon uses David's Mon group 8987f295…, Thu uses David's Thu group 9079219c… — both real
--     rows in `groups`, David Yoder). group_id has an FK to groups(id); every non-group row is NULL.
--   • client_id is TEXT with no FK (SECURITY_BACKLOG #7); all ids below are real active clients.
--   • Lowercase status ('scheduled'/'completed') to match the accrual view + portal queries.
--
-- IDEMPOTENT: deletes the whole dee0… demo-appointment family first (v1 AND any prior v2 run),
--   then inserts the current week. ON CONFLICT (id) DO UPDATE is kept as belt-and-suspenders.
-- REVERTIBLE (no append-only triggers on appointments — verified in v1 via pg_trigger):
--     delete from public.appointments where id::text like 'dee0%';
--   (This also removes v1's rows — intended; v2 supersedes v1. group_enrollments are untouched.)
-- NEVER touches clients / determinations / balances / any existing completed row's service_type.

-- Refresh: clear the prior demo-appointment family so a re-run reschedules cleanly to THIS week.
delete from public.appointments where id::text like 'dee0%';

with wk as (
  select date_trunc('week', (now() at time zone 'America/Chicago'))::date as monday
)
insert into public.appointments
  (id, client_id, client_name, title, appointment_type, status, service_type, session_type,
   start_time, end_time, duration_minutes, modality, therapist_name,
   zoom_link, zoom_meeting_id, group_id, capacity, is_recurring)
select
  v.id::uuid, v.client_id, v.client_name, v.title, v.appt_type, v.status, v.service_type, v.session_type,
  ((wk.monday + v.day_off) + v.start_local) at time zone 'America/Chicago',
  ((wk.monday + v.day_off) + v.end_local)   at time zone 'America/Chicago',
  (extract(epoch from (v.end_local - v.start_local)) / 60)::int,
  v.modality, v.therapist_name, v.zoom_link, v.zoom_meeting_id,
  v.group_id::uuid, v.capacity, false
from wk
cross join (values
  -- ── MON (day_off 0) ──────────────────────────────────────────────────────────────────────
  -- David SATOP group 09:00–12:00 — two enrolled clients share group_id 8987f295… + the slot.
  ('dee00001-0000-4000-8000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Marcus Reyes','SATOP Group','SATOP Group','scheduled','counseling','satop_group',0, time '09:00', time '12:00','Virtual (Zoom)','David Yoder','https://zoom.us/j/4920165222','4920165222','8987f295-44af-43fc-b994-75a907d1da49',15),
  ('dee00001-0000-4000-8000-000000000002','ffffffff-ffff-ffff-ffff-ffffffffffff','Emma Reeves','SATOP Group','SATOP Group','scheduled','counseling','satop_group',0, time '09:00', time '12:00','Virtual (Zoom)','David Yoder','https://zoom.us/j/4920165222','4920165222','8987f295-44af-43fc-b994-75a907d1da49',15),
  ('dee00001-0000-4000-8000-000000000003','dddddddd-dddd-dddd-dddd-dddddddddddd','Margaret Sullivan','CIP 1:1','CIP 1:1','scheduled','counseling','cip_1on1',0, time '13:00', time '14:00','Virtual (Zoom)','Karen Ventimiglia, LPC','https://zoom.us/j/6544815003','6544815003',null,null),
  ('dee00001-0000-4000-8000-000000000004','f1c5000b-0000-4000-8000-00000000000b','Curtis Lane','EAP 1:1','EAP 1:1','scheduled','counseling','eap_1on1',0, time '15:00', time '16:00','In-Person','Bill Sunderman',null,null,null,null),
  -- ── TUE (day_off 1) ──────────────────────────────────────────────────────────────────────
  ('dee00001-0000-4000-8000-000000000005','10059f7c-b27a-4cfb-83f9-48be9d2cc061','James West','SROP 1:1','SROP 1:1','scheduled','counseling','srop_1on1',1, time '10:00', time '11:00','In-Person','John Burns',null,null,null,null),
  ('dee00001-0000-4000-8000-000000000006','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Pat Novak','OP 1:1','OP 1:1','scheduled','counseling','op_1on1',1, time '14:00', time '15:00','Virtual (Zoom)','Karen Ventimiglia, LPC','https://zoom.us/j/6544815003','6544815003',null,null),
  ('dee00001-0000-4000-8000-000000000007','536a79db-6a4f-4d29-aab3-29ef96c1ebf0','Travis Becker','DWI Court 1:1','DWI Court 1:1','scheduled','counseling','dwi_court_1on1',1, time '16:00', time '17:00','In-Person','Debra',null,null,null,null),
  -- ── WED (day_off 2) ──────────────────────────────────────────────────────────────────────
  ('dee00001-0000-4000-8000-000000000008','f1c50001-0000-4000-8000-000000000001','Renee Park','SROP 1:1','SROP 1:1','scheduled','counseling','srop_1on1',2, time '09:00', time '10:00','Virtual (Zoom)','David Yoder','https://zoom.us/j/4920165222','4920165222',null,null),
  ('dee00001-0000-4000-8000-000000000009','f1c50004-0000-4000-8000-000000000004','Anthony Cole','CD Evaluation','CD Evaluation','scheduled','counseling','eval_cd',2, time '11:00', time '12:00','In-Person','Bill Sunderman',null,null,null,null),
  ('dee00001-0000-4000-8000-00000000000a','f1c50007-0000-4000-8000-000000000007','Sofia Mendez','CIP 1:1','CIP 1:1','scheduled','counseling','cip_1on1',2, time '14:00', time '15:00','Virtual (Zoom)','Karen Ventimiglia, LPC','https://zoom.us/j/6544815003','6544815003',null,null),
  -- ── THU (day_off 3) ──────────────────────────────────────────────────────────────────────
  -- David SATOP group 09:00–12:00 — David's Thu group 9079219c…, two enrolled clients share the slot.
  ('dee00001-0000-4000-8000-00000000000b','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Marcus Reyes','SATOP Group','SATOP Group','scheduled','counseling','satop_group',3, time '09:00', time '12:00','Virtual (Zoom)','David Yoder','https://zoom.us/j/4920165222','4920165222','9079219c-40ca-485f-844b-54d245bafd63',15),
  ('dee00001-0000-4000-8000-00000000000c','ffffffff-ffff-ffff-ffff-ffffffffffff','Emma Reeves','SATOP Group','SATOP Group','scheduled','counseling','satop_group',3, time '09:00', time '12:00','Virtual (Zoom)','David Yoder','https://zoom.us/j/4920165222','4920165222','9079219c-40ca-485f-844b-54d245bafd63',15),
  ('dee00001-0000-4000-8000-00000000000d','7286f2a2-38c3-4006-a01b-023611f1bdbd','Derek Flower','SROP 1:1','SROP 1:1','scheduled','counseling','srop_1on1',3, time '13:00', time '14:00','In-Person','John Burns',null,null,null,null),
  ('dee00001-0000-4000-8000-00000000000e','f1c50008-0000-4000-8000-000000000008','Brandon Hale','MRT 1:1','MRT 1:1','scheduled','counseling','mrt_1on1',3, time '15:00', time '15:15','In-Person','Debra',null,null,null,null),
  -- ── FRI (day_off 4) ──────────────────────────────────────────────────────────────────────
  ('dee00001-0000-4000-8000-00000000000f','f1c50006-0000-4000-8000-000000000006','Wade Foster','DOT 1:1','DOT 1:1','scheduled','counseling','dot_1on1',4, time '10:00', time '11:00','Virtual (Zoom)','David Yoder','https://zoom.us/j/4920165222','4920165222',null,null),
  ('dee00001-0000-4000-8000-000000000010','f1c50009-0000-4000-8000-000000000009','Denise Park','OP 1:1','OP 1:1','scheduled','counseling','op_1on1',4, time '13:00', time '14:00','Virtual (Zoom)','Karen Ventimiglia, LPC','https://zoom.us/j/6544815003','6544815003',null,null),
  ('dee00001-0000-4000-8000-000000000011','f1c50005-0000-4000-8000-000000000005','Lydia Brooks','Series 1:1','Series 1:1','scheduled','counseling','series_1on1',4, time '15:00', time '16:00','In-Person','Bill Sunderman',null,null,null,null),
  -- ── SAT (day_off 5) ──────────────────────────────────────────────────────────────────────
  ('dee00001-0000-4000-8000-000000000012','f1c50002-0000-4000-8000-000000000002','Derek Stone','CIP 1:1','CIP 1:1','scheduled','counseling','cip_1on1',5, time '09:00', time '10:00','Virtual (Zoom)','David Yoder','https://zoom.us/j/4920165222','4920165222',null,null),
  ('dee00001-0000-4000-8000-000000000013','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Marcus Reyes','DWI Court 1:1','DWI Court 1:1','scheduled','counseling','dwi_court_1on1',5, time '11:00', time '12:00','In-Person','Debra',null,null,null,null),
  -- ── SUN (day_off 6) ──────────────────────────────────────────────────────────────────────
  ('dee00001-0000-4000-8000-000000000014','ffffffff-ffff-ffff-ffff-ffffffffffff','Emma Reeves','SROP 1:1','SROP 1:1','scheduled','counseling','srop_1on1',6, time '10:00', time '11:00','Virtual (Zoom)','Karen Ventimiglia, LPC','https://zoom.us/j/6544815003','6544815003',null,null),
  -- ── LAST WEEK — completed history, service_type='other' (ZERO accrual), In-Person, no color ──
  ('dee00001-0000-4000-8000-000000000015','ffffffff-ffff-ffff-ffff-ffffffffffff','Emma Reeves','SATOP Session','SATOP Session','completed','other',null,-3, time '09:00', time '10:00','In-Person','David Yoder',null,null,null,null),
  ('dee00001-0000-4000-8000-000000000016','dddddddd-dddd-dddd-dddd-dddddddddddd','Margaret Sullivan','Individual Counseling','Individual Counseling','completed','other',null,-5, time '14:00', time '14:50','In-Person','Karen Ventimiglia, LPC',null,null,null,null),
  ('dee00001-0000-4000-8000-000000000017','10059f7c-b27a-4cfb-83f9-48be9d2cc061','James West','SROP Session','SROP Session','completed','other',null,-6, time '10:00', time '11:00','In-Person','John Burns',null,null,null,null)
) as v(id, client_id, client_name, title, appt_type, status, service_type, session_type, day_off, start_local, end_local, modality, therapist_name, zoom_link, zoom_meeting_id, group_id, capacity)
on conflict (id) do update set
  client_id=excluded.client_id, client_name=excluded.client_name, title=excluded.title,
  appointment_type=excluded.appointment_type, status=excluded.status, service_type=excluded.service_type,
  session_type=excluded.session_type, start_time=excluded.start_time, end_time=excluded.end_time,
  duration_minutes=excluded.duration_minutes, modality=excluded.modality, therapist_name=excluded.therapist_name,
  zoom_link=excluded.zoom_link, zoom_meeting_id=excluded.zoom_meeting_id, group_id=excluded.group_id,
  capacity=excluded.capacity, updated_at=now();
