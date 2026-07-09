-- ACS TherapyHub — Demo calendar seed (throwaway, run-on-demand)
--
-- THIS IS A SEED SCRIPT, NOT A MIGRATION. Do not move it into supabase/migrations/ and do
-- not run it as part of the deploy pipeline — it exists purely to make the scheduling board
-- look alive for a live demo. Run it directly against the DB (e.g. via the Supabase SQL editor
-- or an execute_sql call), any time before a call.
--
-- WHAT THIS SEEDS
--   ~15 appointments spread across THIS week (Mon–Fri, relative to now() like the precedent
--   20260608_demo_week_seed_and_10a_drop.sql demo-week seed), covering:
--     • all 6 active counselors (Bill Sunderman, Dave L, David Yoder, Debra, John Burns,
--       Karen Ventimiglia) — each with 2+ appointments, matched to who's actually QUALIFIED
--       per config/sessionTaxonomy.ts (never a session type a counselor doesn't hold).
--     • every service color at least once: green (CIP), pink (SROP), grey (DWI Court + a
--       15-minute MRT block), yellow (OP/RP/DOT), blue (Evaluation/EAP/Series).
--     • one same-counselor overlapping pair (Karen, Tuesday 10:00–11:00 vs 10:30–11:30) so
--       the red double-book ring renders (SessionManagement's conflictIds: same therapist
--       name + same day + overlapping time).
--     • mixed statuses: 3 completed, 1 no-show, 11 scheduled.
--
-- FAKE CLIENTS ONLY — client_name is always "Demo — <Name>" and client_id is a stable
-- non-uuid string ('demo-…'). appointments.client_id has no FK (confirmed: it's plain TEXT,
-- SECURITY_BACKLOG #7), so this never touches the clients table at all — zero risk to real
-- client data, nothing that looks like real PII on a shared screen.
--
-- service_type is the ACCRUAL axis ('counseling'/'other'), a different concept from the
-- taxonomy ServiceType (OP/SATOP/Evaluation) used for color. Every row here uses 'other' so
-- this seed can NEVER move any client's accrued-hours counter, matching the safe pattern the
-- 20260608 seed established for non-tracked history rows.
--
-- Does NOT fire logAudit: this runs as raw SQL directly against the table, bypassing the app
-- layer entirely. Even the app's own addAppointment/deleteAppointment (services/api.ts) have
-- no logAudit call today — appointment CRUD isn't an audited event type yet (see the audit
-- write-side work elsewhere on this branch), so there is no audit_logs noise from this seed
-- via either path.
--
-- IDEMPOTENT: ON CONFLICT (id) DO UPDATE — safe to re-run any time to refresh to the
-- then-current week (it does not auto-follow the calendar; re-run to move it).
--
-- CLEANUP (one command, deletes exactly this seed and nothing else):
--   delete from public.appointments where id::text like 'deed0000-%';
--
-- Deterministic id namespace 'deed0000-…' (distinct from the 'dee0…' namespace already used
-- by 20260608's demo-week seed) makes the delete exact — no other appointment can collide.

with wk as (
  select date_trunc('week', (now() at time zone 'America/Chicago'))::date as monday
)
insert into public.appointments
  (id, client_id, client_name, title, appointment_type, status, service_type, session_type,
   start_time, end_time, duration_minutes, modality, therapist_name, counselor_id,
   zoom_link, zoom_meeting_id, notes, is_recurring)
select
  v.id::uuid, v.client_id, v.client_name, v.title, v.title, v.status, 'other', v.session_type,
  ((wk.monday + v.day_off) + v.start_local) at time zone 'America/Chicago',
  ((wk.monday + v.day_off) + v.end_local)   at time zone 'America/Chicago',
  (extract(epoch from (v.end_local - v.start_local)) / 60)::int,
  v.modality, v.therapist_name, v.counselor_id::uuid,
  v.zoom_link, v.zoom_meeting_id,
  '[DEMO SEED — safe to delete; see scripts/seed_demo_appointments.sql]',
  false
from wk
cross join (values
  -- Mon
  ('deed0000-0000-4000-8000-000000000001','demo-alex-r','Demo — Alex R.','CIP Intake','completed','cip_intake', 0, time '09:00', time '10:00','In-Person','John Burns','e2019536-4edc-4f0e-88d4-2d6c189ab0de',null,null),
  ('deed0000-0000-4000-8000-000000000006','demo-taylor-s','Demo — Taylor S.','CIP 1:1','scheduled','cip_1on1', 0, time '14:00', time '15:00','In-Person','David Yoder','0b6510ce-a1d4-4b0a-bbad-9944e46b5b20',null,null),
  ('deed0000-0000-4000-8000-00000000000b','demo-morgan-k','Demo — Morgan K.','CIP 1:1','scheduled','cip_1on1', 0, time '11:00', time '12:00','In-Person','Dave L','dcfa93d3-c6d8-44a9-8537-19865431f329',null,null),
  -- Tue — Karen double-booked 10:00-11:00 vs 10:30-11:30
  ('deed0000-0000-4000-8000-000000000003','demo-morgan-k','Demo — Morgan K.','OP 1:1','scheduled','op_1on1', 1, time '10:00', time '11:00','In-Person','Karen Ventimiglia','46e13c9c-0cbd-4afe-b24a-9163d15fb20c',null,null),
  ('deed0000-0000-4000-8000-000000000004','demo-casey-b','Demo — Casey B.','RP 1:1','scheduled','rp_1on1', 1, time '10:30', time '11:30','In-Person','Karen Ventimiglia','46e13c9c-0cbd-4afe-b24a-9163d15fb20c',null,null),
  ('deed0000-0000-4000-8000-000000000008','demo-drew-h','Demo — Drew H.','EAP 1:1','scheduled','eap_1on1', 1, time '15:00', time '16:00','In-Person','Bill Sunderman','93156aa6-dd53-41ec-bb4a-5fe5e8ed9d8f',null,null),
  -- Wed
  ('deed0000-0000-4000-8000-000000000002','demo-jamie-t','Demo — Jamie T.','SROP 1:1','scheduled','srop_1on1', 2, time '11:00', time '12:00','Virtual (Zoom)','John Burns','e2019536-4edc-4f0e-88d4-2d6c189ab0de','https://zoom.us/j/8648767994','8648767994'),
  ('deed0000-0000-4000-8000-000000000007','demo-jordan-m','Demo — Jordan M.','Series 1:1','completed','series_1on1', 2, time '09:00', time '10:00','Virtual (Zoom)','David Yoder','0b6510ce-a1d4-4b0a-bbad-9944e46b5b20','https://zoom.us/j/4920165222','4920165222'),
  ('deed0000-0000-4000-8000-00000000000c','demo-casey-b','Demo — Casey B.','DWI Court Intake','scheduled','dwi_court_intake', 2, time '14:00', time '15:00','In-Person','Debra','c6633f76-9302-486d-af68-2c2be5ed7825',null,null),
  -- Thu
  ('deed0000-0000-4000-8000-000000000009','demo-alex-r','Demo — Alex R.','DOT 1:1','no_show','dot_1on1', 3, time '09:00', time '10:00','In-Person','Bill Sunderman','93156aa6-dd53-41ec-bb4a-5fe5e8ed9d8f',null,null),
  ('deed0000-0000-4000-8000-00000000000d','demo-riley-p','Demo — Riley P.','MRT 1:1','scheduled','mrt_1on1', 3, time '11:00', time '11:15','In-Person','Debra','c6633f76-9302-486d-af68-2c2be5ed7825',null,null),
  ('deed0000-0000-4000-8000-000000000005','demo-riley-p','Demo — Riley P.','CD Evaluation','scheduled','eval_cd', 3, time '13:00', time '14:00','Virtual (Zoom)','Karen Ventimiglia','46e13c9c-0cbd-4afe-b24a-9163d15fb20c','https://zoom.us/j/6544815003','6544815003'),
  -- Fri
  ('deed0000-0000-4000-8000-00000000000a','demo-jamie-t','Demo — Jamie T.','SROP 1:1','scheduled','srop_1on1', 4, time '10:00', time '11:00','In-Person','Dave L','dcfa93d3-c6d8-44a9-8537-19865431f329',null,null),
  ('deed0000-0000-4000-8000-00000000000e','demo-taylor-s','Demo — Taylor S.','DWI Court 1:1','scheduled','dwi_court_1on1', 4, time '13:00', time '14:00','Virtual (Zoom)','John Burns','e2019536-4edc-4f0e-88d4-2d6c189ab0de','https://zoom.us/j/8648767994','8648767994'),
  ('deed0000-0000-4000-8000-00000000000f','demo-jordan-m','Demo — Jordan M.','CIP Intake','completed','cip_intake', 4, time '09:00', time '10:00','In-Person','Karen Ventimiglia','46e13c9c-0cbd-4afe-b24a-9163d15fb20c',null,null)
) as v(id, client_id, client_name, title, status, session_type, day_off, start_local, end_local, modality, therapist_name, counselor_id, zoom_link, zoom_meeting_id)
on conflict (id) do update set
  client_id=excluded.client_id, client_name=excluded.client_name, title=excluded.title,
  appointment_type=excluded.appointment_type, status=excluded.status, service_type=excluded.service_type,
  session_type=excluded.session_type, start_time=excluded.start_time, end_time=excluded.end_time,
  duration_minutes=excluded.duration_minutes, modality=excluded.modality,
  therapist_name=excluded.therapist_name, counselor_id=excluded.counselor_id,
  zoom_link=excluded.zoom_link, zoom_meeting_id=excluded.zoom_meeting_id, notes=excluded.notes,
  updated_at=now();
