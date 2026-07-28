-- ============================================================================
-- ACS TherapyHub — DEMO RESEED (2026-07-28)
--
-- ONE COMMAND wipes the entire demo namespace and rebuilds it. Re-run any time
-- the demo goes stale: every date is relative to now(), so a re-run moves the
-- whole practice week to the CURRENT week.
--
-- SCOPE / SAFETY  (read before editing any DELETE below)
--   • Appointments are swept by OWNERSHIP only — is_demo = true, or the row's
--     client is a demo client. Deliberately NOT by id prefix: the 2026-07-14
--     demo-week seed put `dee0…`-namespaced rows on a REAL client's chart, so a
--     prefix delete reaches real data. That mistake was made and corrected here
--     (2 real rows deleted, restored from 20260714_demo_week_seed_v2_full_week).
--   • Prefix matching survives only where the namespace is exclusively ours and
--     was created by THIS file (d10e/d20e/d30e/d40e/d50e).
--   • Appointments with client_id IS NULL are is_demo = FALSE real/legacy rows.
--     No clause here matches them; never add "client_id is null".
--   • audit_logs is deliberately UNTOUCHED (append-only by design).
--   • Old demo rows are SWEPT, never un-flagged.
--   • PART 7 asserts the non-demo invariant and ABORTS the transaction if any
--     is_demo=false row (or audit_logs) moved.
--
-- ID NAMESPACES (all hex, uuid-shaped)
--   clients            dc10….      appointments        dee0….
--   clinical_notes     d10e….      group_enrollments   d20e….
--   group_sessions     d30e….      attendees           d40e….
--   reschedules        d50e….
--
-- NAMES are fictional and were collision-checked against the live client table
-- (exact / surname / first-name vs. is_demo=false, and vs. counselors): 0 hits.
-- Avatars are initials-only (avatar_url left NULL → the app's initials
-- fallback). No photographs, no public/images/clients/ references.
-- ============================================================================

-- Run the whole file as ONE transaction so the guard at the bottom can abort it.
begin;

-- Baseline for the non-demo invariant checked in PART 7.
drop table if exists _demo_reseed_guard;
create temp table _demo_reseed_guard as
select (select count(*) from public.clients      where not is_demo) as real_clients,
       (select count(*) from public.appointments where not is_demo) as real_appts,
       (select count(*) from public.audit_logs)                     as audit_rows;

-- ─────────────────────────── PART 0 — SWEEP ────────────────────────────────
-- Dependents first, then the clients themselves.

delete from public.group_session_attendees
 where client_id in (select id from public.clients where is_demo)
    or group_session_id in (select id from public.group_sessions where id::text like 'd30e%');
delete from public.group_sessions where id::text like 'd30e%';

delete from public.appointment_reschedules
 where id::text like 'd50e%'
    or appointment_id in (
      select id from public.appointments
       where is_demo or client_id in (select id::text from public.clients where is_demo));

delete from public.clinical_notes
 where client_id in (select id from public.clients where is_demo)
    or id::text like 'd10e%';

delete from public.group_enrollments
 where client_id in (select id from public.clients where is_demo)
    or id::text like 'd20e%';

-- DO NOT reintroduce an `id like 'dee0%'` clause here. The 2026-07-14 demo-week
-- seed put dee0…-namespaced rows on a REAL (is_demo=false) client's chart, so a
-- prefix-only delete reaches real data. This bit once — 2 real rows were deleted
-- and had to be restored from that migration. Flag-and-owner scoped only:
delete from public.appointments
 where is_demo
    or client_id in (select id::text from public.clients where is_demo);

delete from public.appointment_series    where client_id in (select id from public.clients where is_demo);
-- ORDER MATTERS: placement_determinations.assessment_input_id FKs into
-- assessment_inputs, so determinations must be deleted FIRST.
delete from public.placement_determinations where client_id in (select id from public.clients where is_demo);
delete from public.assessment_inputs     where client_id in (select id from public.clients where is_demo);
delete from public.client_risk_profiles  where client_id in (select id from public.clients where is_demo);
delete from public.acs_upload_tokens     where client_id in (select id from public.clients where is_demo);
delete from public.client_communications where client_id in (select id from public.clients where is_demo);
delete from public.treatment_plans       where client_id in (select id from public.clients where is_demo);
delete from public.payments              where client_id in (select id from public.clients where is_demo);
delete from public.charges               where client_id in (select id from public.clients where is_demo);
delete from public.form_submissions      where client_id in (select id from public.clients where is_demo);
-- uploaded_files: hire_id is TEXT holding the client uuid.
delete from public.uploaded_files
 where hire_id::text in (select id::text from public.clients where is_demo);

delete from public.clients where is_demo;

-- ────────────────────────── PART 1 — CLIENTS (10) ──────────────────────────
insert into public.clients
  (id, name, email, primary_phone, program_type, client_type, status, case_number, county, is_demo)
-- CAST (Dan 7/28): the familiar demo names the team already recognizes, recovered
-- from git history — the 20260714 demo-week seed, RECON-ux-2026-07-28.md, and
-- scripts/fixtures. 'Joe Blow' and 'Flower Tester' never lived in a seed file at
-- all (they came in through PublicIntake as live rows — see RECON-ux:194).
-- 'James West' appears in that old roster and is DELIBERATELY EXCLUDED: it is the
-- REAL client's name. Re-collision-checked before use — 0 hits on exact/surname/
-- first-name vs is_demo=false, and vs the counselor roster.
values
  ('dc100001-0000-4000-8000-000000000001','Marcus Reyes','marcus.reyes@example.com','314-555-0101','SATOP','SROP','active','DEMO-2026-0101','St. Louis',true),
  ('dc100002-0000-4000-8000-000000000002','Emma Reeves','emma.reeves@example.com','314-555-0102','SATOP','CIP','active','DEMO-2026-0102','St. Louis',true),
  ('dc100003-0000-4000-8000-000000000003','Curtis Lane','curtis.lane@example.com','636-555-0103','SATOP','OP','active','DEMO-2026-0103','Jefferson',true),
  ('dc100004-0000-4000-8000-000000000004','Denise Park','denise.park@example.com','314-555-0104','SATOP','EAP','active','DEMO-2026-0104','St. Louis',true),
  ('dc100005-0000-4000-8000-000000000005','Derek Stone','derek.stone@example.com','636-555-0105','SATOP','DWI_COURT','active','DEMO-2026-0105','Jefferson',true),
  ('dc100006-0000-4000-8000-000000000006','Flower Tester','flower.tester@example.com','314-555-0106','SATOP','SROP','active','DEMO-2026-0106','St. Louis',true),
  ('dc100007-0000-4000-8000-000000000007','Fred Garvin','fred.garvin@example.com','314-555-0107','SATOP','DOT','active','DEMO-2026-0107','St. Louis',true),
  ('dc100008-0000-4000-8000-000000000008','Margaret Sullivan','margaret.sullivan@example.com','636-555-0108','SATOP','RELAPSE_PREVENTION','active','DEMO-2026-0108','Jefferson',true),
  ('dc100009-0000-4000-8000-000000000009','Joe Blow','joe.blow@example.com','314-555-0109','ANGER_MANAGEMENT','ANGER_MANAGEMENT','active','DEMO-2026-0109','St. Louis',true),
  ('dc100010-0000-4000-8000-000000000010','Reggie Vance','reggie.vance@example.com','314-555-0110','GAMBLING_RECOVERY','GAMBLING_RECOVERY','active','DEMO-2026-0110','St. Louis',true);

-- ───────────────────── PART 2 — INDIVIDUAL APPOINTMENTS ────────────────────
-- Day offsets are from THIS week's Monday (America/Chicago). Counselor 1:1s are
-- placed OUTSIDE their standing group blocks so no false double-book ring fires.
with wk as (select date_trunc('week', (now() at time zone 'America/Chicago'))::date as monday)
insert into public.appointments
  (id, client_id, client_name, therapist_name, title, appointment_type, session_type,
   start_time, end_time, duration_minutes, status, service_type, billable_units, modality, is_demo)
select
  v.id::uuid, v.client_id, v.client_name, v.therapist, v.label, v.label, v.session_type,
  ((wk.monday + v.day_off) + v.t) at time zone 'America/Chicago',
  ((wk.monday + v.day_off) + v.t + make_interval(mins => v.mins)) at time zone 'America/Chicago',
  v.mins, v.status, v.service_type, v.units, v.modality, true
from wk, (values
  -- ── this week: completed, WITH signed notes (drive the calendar note star) ──
  ('dee0aa01-0000-4000-8000-000000000001','dc100001-0000-4000-8000-000000000001','Marcus Reyes','David Yoder','SROP 1:1','srop_1on1',0,time '13:00',60,'Completed','counseling',4,'In-Person'),
  ('dee0aa02-0000-4000-8000-000000000002','dc100002-0000-4000-8000-000000000002','Emma Reeves','Karen Ventimiglia','CIP 1:1','cip_1on1',0,time '14:30',60,'Completed','counseling',4,'Virtual (Zoom)'),
  ('dee0aa03-0000-4000-8000-000000000003','dc100003-0000-4000-8000-000000000003','Curtis Lane','Karen Ventimiglia','OP Intake','op_intake',1,time '09:00',60,'Completed','counseling',4,'In-Person'),
  -- ── this week: completed, NO note (so the difference is visible) ──
  ('dee0aa04-0000-4000-8000-000000000004','dc100004-0000-4000-8000-000000000004','Denise Park','Bill Sunderman','EAP 1:1','eap_1on1',0,time '10:00',60,'Completed','counseling',4,'Virtual (Zoom)'),
  ('dee0aa05-0000-4000-8000-000000000005','dc100005-0000-4000-8000-000000000005','Derek Stone','Debra','MRT 1:1','mrt_1on1',1,time '15:00',15,'Completed','other',null,'In-Person'),
  -- ── this week: the missed pair ──
  ('dee0aa06-0000-4000-8000-000000000006','dc100007-0000-4000-8000-000000000007','Fred Garvin','Bill Sunderman','Series 1:1','series_1on1',1,time '11:00',60,'No Show',null,null,'Virtual (Zoom)'),
  ('dee0aa07-0000-4000-8000-000000000007','dc100008-0000-4000-8000-000000000008','Margaret Sullivan','David Yoder','DOT 1:1','dot_1on1',1,time '13:00',60,'No Call No Show',null,null,'In-Person'),
  -- ── this week: upcoming ──
  ('dee0aa08-0000-4000-8000-000000000008','dc100010-0000-4000-8000-000000000010','Reggie Vance','Karen Ventimiglia','CD Evaluation','eval_cd',2,time '09:00',60,'Scheduled','counseling',null,'Virtual (Zoom)'),
  ('dee0aa09-0000-4000-8000-000000000009','dc100002-0000-4000-8000-000000000002','Emma Reeves','David Yoder','CIP 1:1','cip_1on1',2,time '13:00',60,'Scheduled','counseling',null,'In-Person'),
  ('dee0aa10-0000-4000-8000-000000000010','dc100003-0000-4000-8000-000000000003','Curtis Lane','Bill Sunderman','OP 1:1','op_1on1',2,time '15:00',60,'Scheduled','counseling',null,'Virtual (Zoom)'),
  ('dee0aa11-0000-4000-8000-000000000011','dc100008-0000-4000-8000-000000000008','Margaret Sullivan','Karen Ventimiglia','RP 1:1','rp_1on1',3,time '10:00',60,'Scheduled','counseling',null,'In-Person'),
  -- the twice-moved session (reschedule trail + recount marker) — now Thu 13:00
  ('dee0aa12-0000-4000-8000-000000000012','dc100006-0000-4000-8000-000000000006','Flower Tester','David Yoder','SROP 1:1','srop_1on1',3,time '13:00',60,'Scheduled','counseling',null,'Virtual (Zoom)'),
  ('dee0aa13-0000-4000-8000-000000000013','dc100001-0000-4000-8000-000000000001','Marcus Reyes','John Burns','OP 1:1','op_1on1',4,time '09:00',60,'Scheduled','counseling',null,'Virtual (Zoom)'),
  ('dee0aa14-0000-4000-8000-000000000014','dc100004-0000-4000-8000-000000000004','Denise Park','Dave L','CIP 1:1','cip_1on1',4,time '11:00',60,'Scheduled','counseling',null,'In-Person'),
  ('dee0aa15-0000-4000-8000-000000000015','dc100005-0000-4000-8000-000000000005','Derek Stone','Debra','DWI Court 1:1','dwi_court_1on1',4,time '14:00',60,'Scheduled','counseling',null,'Virtual (Zoom)'),
  -- ── next week ──
  ('dee0aa16-0000-4000-8000-000000000016','dc100001-0000-4000-8000-000000000001','Marcus Reyes','David Yoder','SROP 1:1','srop_1on1',7,time '13:00',60,'Scheduled','counseling',null,'In-Person'),
  ('dee0aa17-0000-4000-8000-000000000017','dc100003-0000-4000-8000-000000000003','Curtis Lane','Karen Ventimiglia','OP 1:1','op_1on1',8,time '10:00',60,'Scheduled','counseling',null,'Virtual (Zoom)'),
  ('dee0aa18-0000-4000-8000-000000000018','dc100004-0000-4000-8000-000000000004','Denise Park','Bill Sunderman','EAP 1:1','eap_1on1',9,time '14:00',60,'Scheduled','counseling',null,'In-Person'),
  ('dee0aa19-0000-4000-8000-000000000019','dc100002-0000-4000-8000-000000000002','Emma Reeves','Dave L','CIP 1:1','cip_1on1',10,time '13:00',60,'Scheduled','counseling',null,'Virtual (Zoom)'),
  ('dee0aa20-0000-4000-8000-000000000020','dc100008-0000-4000-8000-000000000008','Margaret Sullivan','John Burns','RP 1:1','rp_1on1',11,time '09:00',60,'Scheduled','counseling',null,'In-Person'),
  ('dee0aa21-0000-4000-8000-000000000021','dc100005-0000-4000-8000-000000000005','Derek Stone','Debra','MRT 1:1','mrt_1on1',11,time '15:00',15,'Scheduled','other',null,'Virtual (Zoom)')
) as v(id, client_id, client_name, therapist, label, session_type, day_off, t, mins, status, service_type, units, modality);

-- ───────────── PART 3 — SIGNED NOTES on three completed sessions ───────────
-- Full L3 required-field set; narrative carries real line breaks (the formatting
-- fix stores it verbatim). These also light the calendar note star.
with wk as (select date_trunc('week', (now() at time zone 'America/Chicago'))::date as monday)
insert into public.clinical_notes
  (id, client_id, appointment_id, note_type, subjective, narrative,
   service_date, time_started, time_ended, units, problems_addressed,
   staff_name, staff_credentials, is_signed, signed_at, signed_by_name, created_at)
select v.id::uuid, v.client_id::uuid, v.appt_id::uuid, 'Session', v.narrative, v.narrative,
       (wk.monday + v.day_off), v.t0, v.t1, v.units, v.problems,
       v.staff, v.creds, true,
       ((wk.monday + v.day_off) + v.t1) at time zone 'America/Chicago', v.staff,
       ((wk.monday + v.day_off) + v.t1) at time zone 'America/Chicago'
from wk, (values
  ('d10ebb01-0000-4000-8000-000000000001','dc100001-0000-4000-8000-000000000001','dee0aa01-0000-4000-8000-000000000001',
   0, time '13:00', time '14:00', 4, 'Problem 1 — sustained abstinence; Problem 3 — high-risk situations',
   'David Yoder','LPC, CRADC',
   E'Individual counseling session.\n\nClient arrived on time and engaged readily. Reviewed the craving log kept since the last session; identified two recurring high-risk situations, both involving unstructured weekend evenings.\n\nRehearsed refusal skills through role-play. Client was able to articulate a concrete plan for the coming weekend, including one alternative activity and one support contact.\n\nPlan: continue weekly individual sessions. Client to bring an updated craving log next week.'),
  ('d10ebb02-0000-4000-8000-000000000002','dc100002-0000-4000-8000-000000000002','dee0aa02-0000-4000-8000-000000000002',
   0, time '14:30', time '15:30', 4, 'Problem 2 — relapse prevention planning',
   'Karen Ventimiglia','LPC',
   E'Individual counseling session, conducted via secure video.\n\nClient reported a difficult week at work and one episode of strong craving that did not result in use. Processed the episode in detail, reinforcing the coping response the client chose.\n\nDiscussed the difference between a lapse and a relapse, and reviewed the written relapse-prevention plan. Client updated two items independently.\n\nPlan: continue weekly sessions; client to attend the Monday counseling group.'),
  ('d10ebb03-0000-4000-8000-000000000003','dc100003-0000-4000-8000-000000000003','dee0aa03-0000-4000-8000-000000000003',
   1, time '09:00', time '10:00', 4, 'Intake — initial problem list established',
   'Karen Ventimiglia','LPC',
   E'Outpatient intake session.\n\nCompleted psychosocial history and reviewed program expectations, attendance policy, and confidentiality. Client asked clarifying questions about the completion requirements and appeared to understand the answers.\n\nInitial problem list established collaboratively and documented in the treatment plan.\n\nPlan: schedule weekly individual sessions and enroll in the Monday counseling group.')
) as v(id, client_id, appt_id, day_off, t0, t1, units, problems, staff, creds, narrative);

-- ───────────────── PART 4 — GROUP ENROLLMENTS (open, no end date) ──────────
-- Deb's Tue MRT and David's Mon Grp Cns get real rosters. Deb's SATURDAY MRT is
-- deliberately left EMPTY so the honest empty-roster state is demonstrable.
with wk as (select date_trunc('week', (now() at time zone 'America/Chicago'))::date as monday)
insert into public.group_enrollments (id, group_id, client_id, enrolled_at, active)
select v.id::uuid, v.group_id::uuid, v.client_id::uuid, (wk.monday - v.days_ago), true
from wk, (values
  -- David Yoder · Mon 09:00–12:00 · Grp Cns  → 9 enrolled
  ('d20ec001-0000-4000-8000-000000000001','8987f295-44af-43fc-b994-75a907d1da49','dc100001-0000-4000-8000-000000000001',56),
  ('d20ec002-0000-4000-8000-000000000002','8987f295-44af-43fc-b994-75a907d1da49','dc100002-0000-4000-8000-000000000002',49),
  ('d20ec003-0000-4000-8000-000000000003','8987f295-44af-43fc-b994-75a907d1da49','dc100003-0000-4000-8000-000000000003',42),
  ('d20ec004-0000-4000-8000-000000000004','8987f295-44af-43fc-b994-75a907d1da49','dc100004-0000-4000-8000-000000000004',35),
  ('d20ec005-0000-4000-8000-000000000005','8987f295-44af-43fc-b994-75a907d1da49','dc100005-0000-4000-8000-000000000005',28),
  ('d20ec006-0000-4000-8000-000000000006','8987f295-44af-43fc-b994-75a907d1da49','dc100006-0000-4000-8000-000000000006',21),
  ('d20ec007-0000-4000-8000-000000000007','8987f295-44af-43fc-b994-75a907d1da49','dc100007-0000-4000-8000-000000000007',14),
  ('d20ec008-0000-4000-8000-000000000008','8987f295-44af-43fc-b994-75a907d1da49','dc100008-0000-4000-8000-000000000008',7),
  ('d20ec009-0000-4000-8000-000000000009','8987f295-44af-43fc-b994-75a907d1da49','dc100009-0000-4000-8000-000000000009',7),
  -- Debra · Tue 18:00–20:00 · MRT  → 8 enrolled (overlaps above: 1–4 groups/week)
  ('d20ec010-0000-4000-8000-000000000010','1a61bdec-8e69-495e-84cc-601028e5824f','dc100002-0000-4000-8000-000000000002',49),
  ('d20ec011-0000-4000-8000-000000000011','1a61bdec-8e69-495e-84cc-601028e5824f','dc100003-0000-4000-8000-000000000003',42),
  ('d20ec012-0000-4000-8000-000000000012','1a61bdec-8e69-495e-84cc-601028e5824f','dc100004-0000-4000-8000-000000000004',35),
  ('d20ec013-0000-4000-8000-000000000013','1a61bdec-8e69-495e-84cc-601028e5824f','dc100005-0000-4000-8000-000000000005',28),
  ('d20ec014-0000-4000-8000-000000000014','1a61bdec-8e69-495e-84cc-601028e5824f','dc100006-0000-4000-8000-000000000006',21),
  ('d20ec015-0000-4000-8000-000000000015','1a61bdec-8e69-495e-84cc-601028e5824f','dc100007-0000-4000-8000-000000000007',14),
  ('d20ec016-0000-4000-8000-000000000016','1a61bdec-8e69-495e-84cc-601028e5824f','dc100008-0000-4000-8000-000000000008',14),
  ('d20ec017-0000-4000-8000-000000000017','1a61bdec-8e69-495e-84cc-601028e5824f','dc100010-0000-4000-8000-000000000010',7),
  -- John Burns · Tue 18:00–21:00 · Grp Ed  → 4
  ('d20ec018-0000-4000-8000-000000000018','b2edfa85-7a71-46c6-b9ae-d4dc37297846','dc100001-0000-4000-8000-000000000001',35),
  ('d20ec019-0000-4000-8000-000000000019','b2edfa85-7a71-46c6-b9ae-d4dc37297846','dc100003-0000-4000-8000-000000000003',28),
  ('d20ec020-0000-4000-8000-000000000020','b2edfa85-7a71-46c6-b9ae-d4dc37297846','dc100006-0000-4000-8000-000000000006',21),
  ('d20ec021-0000-4000-8000-000000000021','b2edfa85-7a71-46c6-b9ae-d4dc37297846','dc100009-0000-4000-8000-000000000009',14),
  -- Dave L · Thu 18:00–21:00 · Grp Cns  → 3
  ('d20ec022-0000-4000-8000-000000000022','64cabbae-b4aa-4ac8-aa87-55fb9dfb54ec','dc100002-0000-4000-8000-000000000002',28),
  ('d20ec023-0000-4000-8000-000000000023','64cabbae-b4aa-4ac8-aa87-55fb9dfb54ec','dc100007-0000-4000-8000-000000000007',21),
  ('d20ec024-0000-4000-8000-000000000024','64cabbae-b4aa-4ac8-aa87-55fb9dfb54ec','dc100010-0000-4000-8000-000000000010',14),
  -- Debra · Mon 18:00–20:00 · Group (alternating)  → 2
  ('d20ec025-0000-4000-8000-000000000025','7af96e74-a5ec-4b26-897d-a5eddd898f04','dc100005-0000-4000-8000-000000000005',21),
  ('d20ec026-0000-4000-8000-000000000026','7af96e74-a5ec-4b26-897d-a5eddd898f04','dc100009-0000-4000-8000-000000000009',14)
  -- Debra · Sat 08:00–10:00 · MRT (3e42dd19…) → intentionally NO rows
) as v(id, group_id, client_id, days_ago);

-- ──────── PART 5 — ONE SUBMITTED GROUP NOTE on LAST week's Mon Grp Cns ─────
-- 8 of the 9 standing members present (one absent) + 1 makeup = 9 attendees.
-- Each attendee gets a Completed seat appointment (units → Services tab, hours →
-- client_accrued_hours) and a signed note correlated by group_session_id.
with wk as (select date_trunc('week', (now() at time zone 'America/Chicago'))::date as monday)
insert into public.group_sessions
  (id, group_id, counselor_id, session_date, started_at, ended_at, declared_type,
   units, narrative, staff_name, staff_credentials, signed_at, signed_by_name)
select 'd30edd01-0000-4000-8000-000000000001', '8987f295-44af-43fc-b994-75a907d1da49',
       (select id from public.counselors where name = 'David Yoder'),
       (wk.monday - 7), time '09:00', time '12:00', 'group_counseling', 12,
       E'Group counseling session.\n\nCheck-in around the week''s high-risk situations. Six members reported at least one craving episode; all six described the coping response used.\n\nTopic: building a support network that does not depend on a single person. Members mapped their current supports and identified one gap each.\n\nClosed with commitments for the coming week. Group cohesion good; no safety concerns raised.',
       'David Yoder', 'LPC, CRADC',
       ((wk.monday - 7) + time '12:00') at time zone 'America/Chicago', 'David Yoder'
from wk;

-- Seat appointments (one per attendee)
with wk as (select date_trunc('week', (now() at time zone 'America/Chicago'))::date as monday)
insert into public.appointments
  (id, client_id, client_name, therapist_name, counselor_id, group_id, title, appointment_type,
   session_type, start_time, end_time, duration_minutes, status, service_type, billable_units,
   modality, notes_complete, is_demo)
select v.appt_id::uuid, v.client_id, v.client_name, 'David Yoder',
       (select id from public.counselors where name = 'David Yoder'),
       '8987f295-44af-43fc-b994-75a907d1da49', 'Group Counseling', 'Group Counseling',
       'satop_group',
       ((wk.monday - 7) + time '09:00') at time zone 'America/Chicago',
       ((wk.monday - 7) + time '12:00') at time zone 'America/Chicago',
       180, 'Completed', 'counseling', 12, 'In-Person', true, true
from wk, (values
  ('dee0bb01-0000-4000-8000-000000000001','dc100001-0000-4000-8000-000000000001','Marcus Reyes'),
  ('dee0bb02-0000-4000-8000-000000000002','dc100002-0000-4000-8000-000000000002','Emma Reeves'),
  ('dee0bb03-0000-4000-8000-000000000003','dc100003-0000-4000-8000-000000000003','Curtis Lane'),
  ('dee0bb04-0000-4000-8000-000000000004','dc100004-0000-4000-8000-000000000004','Denise Park'),
  ('dee0bb05-0000-4000-8000-000000000005','dc100005-0000-4000-8000-000000000005','Derek Stone'),
  ('dee0bb06-0000-4000-8000-000000000006','dc100006-0000-4000-8000-000000000006','Flower Tester'),
  ('dee0bb07-0000-4000-8000-000000000007','dc100007-0000-4000-8000-000000000007','Fred Garvin'),
  ('dee0bb08-0000-4000-8000-000000000008','dc100008-0000-4000-8000-000000000008','Margaret Sullivan'),
  -- makeup: not a standing member of this group
  ('dee0bb09-0000-4000-8000-000000000009','dc100010-0000-4000-8000-000000000010','Reggie Vance')
) as v(appt_id, client_id, client_name);

insert into public.group_session_attendees (id, group_session_id, client_id, appointment_id, source)
values
  ('d40ee001-0000-4000-8000-000000000001','d30edd01-0000-4000-8000-000000000001','dc100001-0000-4000-8000-000000000001','dee0bb01-0000-4000-8000-000000000001','standing'),
  ('d40ee002-0000-4000-8000-000000000002','d30edd01-0000-4000-8000-000000000001','dc100002-0000-4000-8000-000000000002','dee0bb02-0000-4000-8000-000000000002','standing'),
  ('d40ee003-0000-4000-8000-000000000003','d30edd01-0000-4000-8000-000000000001','dc100003-0000-4000-8000-000000000003','dee0bb03-0000-4000-8000-000000000003','standing'),
  ('d40ee004-0000-4000-8000-000000000004','d30edd01-0000-4000-8000-000000000001','dc100004-0000-4000-8000-000000000004','dee0bb04-0000-4000-8000-000000000004','standing'),
  ('d40ee005-0000-4000-8000-000000000005','d30edd01-0000-4000-8000-000000000001','dc100005-0000-4000-8000-000000000005','dee0bb05-0000-4000-8000-000000000005','standing'),
  ('d40ee006-0000-4000-8000-000000000006','d30edd01-0000-4000-8000-000000000001','dc100006-0000-4000-8000-000000000006','dee0bb06-0000-4000-8000-000000000006','standing'),
  ('d40ee007-0000-4000-8000-000000000007','d30edd01-0000-4000-8000-000000000001','dc100007-0000-4000-8000-000000000007','dee0bb07-0000-4000-8000-000000000007','standing'),
  ('d40ee008-0000-4000-8000-000000000008','d30edd01-0000-4000-8000-000000000001','dc100008-0000-4000-8000-000000000008','dee0bb08-0000-4000-8000-000000000008','standing'),
  ('d40ee009-0000-4000-8000-000000000009','d30edd01-0000-4000-8000-000000000001','dc100010-0000-4000-8000-000000000010','dee0bb09-0000-4000-8000-000000000009','makeup');

-- One signed note per attendee, correlated to the single clinical event.
with wk as (select date_trunc('week', (now() at time zone 'America/Chicago'))::date as monday),
     gs as (select narrative, units, staff_name, staff_credentials from public.group_sessions
            where id = 'd30edd01-0000-4000-8000-000000000001')
insert into public.clinical_notes
  (id, client_id, appointment_id, group_session_id, note_type, subjective, narrative,
   service_date, time_started, time_ended, units, staff_name, staff_credentials,
   is_signed, signed_at, signed_by_name, created_at)
select v.id::uuid, v.client_id::uuid, v.appt_id::uuid, 'd30edd01-0000-4000-8000-000000000001',
       'Group Session', gs.narrative, gs.narrative,
       (wk.monday - 7), time '09:00', time '12:00', gs.units, gs.staff_name, gs.staff_credentials,
       true, ((wk.monday - 7) + time '12:00') at time zone 'America/Chicago', gs.staff_name,
       ((wk.monday - 7) + time '12:00') at time zone 'America/Chicago'
from wk, gs, (values
  ('d10ebe01-0000-4000-8000-000000000001','dc100001-0000-4000-8000-000000000001','dee0bb01-0000-4000-8000-000000000001'),
  ('d10ebe02-0000-4000-8000-000000000002','dc100002-0000-4000-8000-000000000002','dee0bb02-0000-4000-8000-000000000002'),
  ('d10ebe03-0000-4000-8000-000000000003','dc100003-0000-4000-8000-000000000003','dee0bb03-0000-4000-8000-000000000003'),
  ('d10ebe04-0000-4000-8000-000000000004','dc100004-0000-4000-8000-000000000004','dee0bb04-0000-4000-8000-000000000004'),
  ('d10ebe05-0000-4000-8000-000000000005','dc100005-0000-4000-8000-000000000005','dee0bb05-0000-4000-8000-000000000005'),
  ('d10ebe06-0000-4000-8000-000000000006','dc100006-0000-4000-8000-000000000006','dee0bb06-0000-4000-8000-000000000006'),
  ('d10ebe07-0000-4000-8000-000000000007','dc100007-0000-4000-8000-000000000007','dee0bb07-0000-4000-8000-000000000007'),
  ('d10ebe08-0000-4000-8000-000000000008','dc100008-0000-4000-8000-000000000008','dee0bb08-0000-4000-8000-000000000008'),
  ('d10ebe09-0000-4000-8000-000000000009','dc100010-0000-4000-8000-000000000010','dee0bb09-0000-4000-8000-000000000009')
) as v(id, client_id, appt_id);

-- ───────── PART 6 — RESCHEDULE TRAIL: one session moved TWICE ──────────────
-- Tue 10:00 → Wed 14:00 → Thu 13:00 (its current slot, seeded in Part 2).
-- Chain is linked: each row's from_start equals the previous row's to_start.
with wk as (select date_trunc('week', (now() at time zone 'America/Chicago'))::date as monday)
insert into public.appointment_reschedules
  (id, appointment_id, from_start, from_end, to_start, to_end, reason, moved_at)
select v.id::uuid, 'dee0aa12-0000-4000-8000-000000000012',
       ((wk.monday + v.f_day) + v.f_t) at time zone 'America/Chicago',
       ((wk.monday + v.f_day) + v.f_t + interval '60 min') at time zone 'America/Chicago',
       ((wk.monday + v.t_day) + v.t_t) at time zone 'America/Chicago',
       ((wk.monday + v.t_day) + v.t_t + interval '60 min') at time zone 'America/Chicago',
       v.reason, ((wk.monday - v.moved_days_ago) + time '08:30') at time zone 'America/Chicago'
from wk, (values
  ('d50eff01-0000-4000-8000-000000000001', 1, time '10:00', 2, time '14:00', 'Client work conflict', 3),
  ('d50eff02-0000-4000-8000-000000000002', 2, time '14:00', 3, time '13:00', 'Counselor availability', 1)
) as v(id, f_day, f_t, t_day, t_t, reason, moved_days_ago);

-- ────────── PART 7 — INVARIANT: the sweep must not have touched real data ──────────
-- Aborts the whole transaction if any is_demo=false row disappeared, or if
-- audit_logs moved (it must never be written or deleted by a seed).
do $$
declare g record; c_now int; a_now int; l_now int;
begin
  select * into g from _demo_reseed_guard;
  select count(*) into c_now from public.clients      where not is_demo;
  select count(*) into a_now from public.appointments where not is_demo;
  select count(*) into l_now from public.audit_logs;
  if c_now <> g.real_clients or a_now <> g.real_appts or l_now <> g.audit_rows then
    raise exception
      'DEMO RESEED ABORTED — non-demo data changed. clients % -> %, appointments % -> %, audit_logs % -> %',
      g.real_clients, c_now, g.real_appts, a_now, g.audit_rows, l_now;
  end if;
  raise notice 'demo reseed OK — real clients %, real appointments %, audit_logs % (all unchanged)',
    c_now, a_now, l_now;
end $$;

commit;
