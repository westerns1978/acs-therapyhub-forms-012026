-- ACS TherapyHub — Demo-week schedule seed + #10a static-column drop (2026-06-08)
--
-- PURPOSE
--   1) Populate THIS week's schedule so the dashboard "Today's Schedule" + the calendar
--      fill for David / Karen / Jessica (all roles read the same unfiltered getAppointments).
--   2) Fold in the approved #10a drop of the now-unread static columns
--      clients.srop_hours_completed / clients.total_sessions_required (zero readers; the
--      completion gate + displayProgress + my_progress() read accrual + the signed
--      determination via REQUIRED_HOURS_BY_LEVEL). compliance_score is INTENTIONALLY kept
--      (it still backs the Director "Compliance Rate" — separate follow-up).
--
-- DESIGN
--   • Relative-to-now(), Central-pinned: every start_time = (this week's Monday in
--     America/Chicago) + the slot's local time. Re-running reschedules to the then-current
--     week (it does NOT auto-follow the calendar — re-run the seed block to refresh).
--   • Deterministic ids in the dee0… namespace ⇒ idempotent (ON CONFLICT) + revertible.
--     (Note: appointments.id is uuid, so the text VALUES are cast ::uuid in the SELECT —
--      a literal "dewe…" marker is impossible, "w" is not valid hex. We use "dee0…".)
--   • Marcus = scheduled (upcoming) ONLY — never a completed counseling row. His
--     16/75 · 16/35 · 47/90 · $175 derive from accrual + determination + created_at +
--     balance, none of which this seed touches.
--   • Past-completed history rows (non-protected clients) use service_type='other' ⇒
--     client_accrued_hours filters them out: ZERO accrual movement for anyone.
--   • Group rows inherit the GROUP's real counselor (David/Karen) + permanent Zoom room +
--     group_id + service_type — NOT the modal's hardcoded "Bill Sunderman".
--   • Lowercase status ('scheduled'/'completed') to match the accrual view + portal queries.
--
-- IDEMPOTENT: ON CONFLICT (id) DO UPDATE (appointments) / DO NOTHING (group_enrollments).
-- REVERTIBLE (no append-only triggers on these tables — verified via pg_trigger):
--     delete from public.group_enrollments where id::text like 'dee0e000-%';
--     delete from public.appointments     where id::text like 'dee00000-%';
--   (The #10a column drop is permanent and is NOT undone by the revert — intended.)
-- NEVER touches clients.created_at / balance / compliance_score / determinations or any
-- existing completed row's service_type.

-- ── PART A — #10a: drop the now-unread static progress columns ───────────────────────────
alter table public.clients drop column if exists srop_hours_completed;
alter table public.clients drop column if exists total_sessions_required;

-- ── PART B — demo-week appointments (per-client rows; group rows share group_id+start) ───
with wk as (
  select date_trunc('week', (now() at time zone 'America/Chicago'))::date as monday
)
insert into public.appointments
  (id, client_id, client_name, title, appointment_type, status, service_type,
   start_time, end_time, duration_minutes, modality, therapist_name,
   zoom_link, zoom_meeting_id, group_id, capacity, is_recurring)
select
  v.id::uuid, v.client_id, v.client_name, v.title, v.appt_type, v.status, v.service_type,
  ((wk.monday + v.day_off) + v.start_local) at time zone 'America/Chicago',
  ((wk.monday + v.day_off) + v.end_local)   at time zone 'America/Chicago',
  (extract(epoch from (v.end_local - v.start_local)) / 60)::int,
  v.modality, v.therapist_name, v.zoom_link, v.zoom_meeting_id,
  v.group_id::uuid, v.capacity, false
from wk
cross join (values
  -- TODAY (Mon, day_off 0) — David SATOP group 09:00–12:00 (Marcus + Emma share group_id+start)
  ('dee00000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Marcus Reyes','SATOP Group - CIP/SROP/OP/DOT','SATOP Group','scheduled','counseling',0, time '09:00', time '12:00','Virtual (Zoom)','David Yoder','https://zoom.us/j/4920165222','4920165222','8987f295-44af-43fc-b994-75a907d1da49',15),
  ('dee00000-0000-4000-8000-000000000002','ffffffff-ffff-ffff-ffff-ffffffffffff','Emma Reeves','SATOP Group - CIP/SROP/OP/DOT','SATOP Group','scheduled','counseling',0, time '09:00', time '12:00','Virtual (Zoom)','David Yoder','https://zoom.us/j/4920165222','4920165222','8987f295-44af-43fc-b994-75a907d1da49',15),
  -- TODAY (Mon) — Karen individual 14:00–14:50 (so Karen's view + the calendar fill today)
  ('dee00000-0000-4000-8000-000000000004','dddddddd-dddd-dddd-dddd-dddddddddddd','Margaret Sullivan','Individual Counseling','Individual Counseling','scheduled','counseling',0, time '14:00', time '14:50','Virtual (Zoom)','Karen Ventimiglia, LPC','https://zoom.us/j/6544815003','6544815003','07ffce4b-e29b-4abb-a608-3fecd6cfa847',null),
  -- THU (day_off 3) — David SATOP group 09:00–12:00
  ('dee00000-0000-4000-8000-000000000005','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Marcus Reyes','SATOP Group - CIP/SROP/OP/DOT','SATOP Group','scheduled','counseling',3, time '09:00', time '12:00','Virtual (Zoom)','David Yoder','https://zoom.us/j/4920165222','4920165222','9079219c-40ca-485f-844b-54d245bafd63',15),
  ('dee00000-0000-4000-8000-000000000006','ffffffff-ffff-ffff-ffff-ffffffffffff','Emma Reeves','SATOP Group - CIP/SROP/OP/DOT','SATOP Group','scheduled','counseling',3, time '09:00', time '12:00','Virtual (Zoom)','David Yoder','https://zoom.us/j/4920165222','4920165222','9079219c-40ca-485f-844b-54d245bafd63',15),
  -- TUE (1) + WED (2) — Karen individuals across the week
  ('dee00000-0000-4000-8000-000000000007','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Pat Novak','Individual Counseling','Individual Counseling','scheduled','counseling',1, time '14:00', time '14:50','Virtual (Zoom)','Karen Ventimiglia, LPC','https://zoom.us/j/6544815003','6544815003','07ffce4b-e29b-4abb-a608-3fecd6cfa847',null),
  ('dee00000-0000-4000-8000-000000000008','536a79db-6a4f-4d29-aab3-29ef96c1ebf0','Peg leg','Individual Counseling','Individual Counseling','scheduled','counseling',2, time '10:00', time '10:50','Virtual (Zoom)','Karen Ventimiglia, LPC','https://zoom.us/j/6544815003','6544815003','07ffce4b-e29b-4abb-a608-3fecd6cfa847',null),
  -- LAST WEEK — completed history, service_type='other' (ZERO accrual), ad-hoc, NON-protected only
  ('dee00000-0000-4000-8000-000000000009','ffffffff-ffff-ffff-ffff-ffffffffffff','Emma Reeves','SATOP Session','Individual Counseling','completed','other',-4, time '09:00', time '10:00','In-Person','David Yoder',null,null,null,null),
  ('dee00000-0000-4000-8000-00000000000a','dddddddd-dddd-dddd-dddd-dddddddddddd','Margaret Sullivan','Individual Counseling','Individual Counseling','completed','other',-6, time '14:00', time '14:50','In-Person','Karen Ventimiglia, LPC',null,null,null,null),
  ('dee00000-0000-4000-8000-00000000000b','536a79db-6a4f-4d29-aab3-29ef96c1ebf0','Peg leg','SATOP Session','Individual Counseling','completed','other',-7, time '10:00', time '10:50','In-Person','David Yoder',null,null,null,null)
) as v(id, client_id, client_name, title, appt_type, status, service_type, day_off, start_local, end_local, modality, therapist_name, zoom_link, zoom_meeting_id, group_id, capacity)
on conflict (id) do update set
  client_id=excluded.client_id, client_name=excluded.client_name, title=excluded.title,
  appointment_type=excluded.appointment_type, status=excluded.status, service_type=excluded.service_type,
  start_time=excluded.start_time, end_time=excluded.end_time, duration_minutes=excluded.duration_minutes,
  modality=excluded.modality, therapist_name=excluded.therapist_name, zoom_link=excluded.zoom_link,
  zoom_meeting_id=excluded.zoom_meeting_id, group_id=excluded.group_id, capacity=excluded.capacity,
  updated_at=now();

-- ── PART C — group_enrollments (model coherence; SATOP clients → David's groups) ─────────
insert into public.group_enrollments (id, group_id, client_id, enrolled_at, active)
values
  ('dee0e000-0000-4000-8000-0000000000e1','8987f295-44af-43fc-b994-75a907d1da49','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date, true),
  ('dee0e000-0000-4000-8000-0000000000e2','8987f295-44af-43fc-b994-75a907d1da49','ffffffff-ffff-ffff-ffff-ffffffffffff', current_date, true),
  ('dee0e000-0000-4000-8000-0000000000e4','9079219c-40ca-485f-844b-54d245bafd63','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date, true),
  ('dee0e000-0000-4000-8000-0000000000e5','9079219c-40ca-485f-844b-54d245bafd63','ffffffff-ffff-ffff-ffff-ffffffffffff', current_date, true)
on conflict (id) do nothing;
