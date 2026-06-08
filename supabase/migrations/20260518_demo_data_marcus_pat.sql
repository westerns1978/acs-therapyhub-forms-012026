-- ACS TherapyHub — David Yoder demo seed (2026-05-18)
--
-- Repurposes the two existing demo clients in place (preserves their UUIDs so the
-- portal quick-login flow keeps working, and so any existing sessionStorage stays
-- valid through the demo):
--
--   aaaaaaaa-…   Alice Johnson  →  Marcus Reyes  (SATOP Level IV, 42/75 hrs, mid-program)
--   bbbbbbbb-…   Bob Smith      →  Pat Novak     (GAMBLING_RECOVERY, self-pay, just started)
--
-- Also archives the other 6 demo rows so the staff client list shows just Marcus
-- and Pat for the demo, and seeds the forms / clinical note / payment / sessions
-- that the demo story depends on.
--
-- Idempotent: every insert uses an explicit UUID with ON CONFLICT DO NOTHING /
-- DO UPDATE so re-running the migration after the demo won't double-seed.

-- =================================================================
-- 1) Clients: update in place
-- =================================================================

update public.clients set
  name = 'Marcus Reyes',
  email = 'marcus.reyes.demo@gemyndflow.com',
  primary_phone = '314-555-0142',
  program_type = 'SATOP',
  status = 'active',
  compliance_score = 92,
  case_number = '2024-MUN-04812',
  assigned_therapist_id = '44444444-4444-4444-4444-444444444444',
  created_at = now() - interval '45 days',  -- ~45/90 days: keeps the SROP minimum-duration gate PENDING for the demo (a fixed past date drifted to >90 days and the chip went green)
  employment_status = 'Full-time',
  support_system_strength = 'Moderate',
  primary_substance = 'Alcohol',
  prior_warrants = 0,
  prior_treatment_dropouts = 0,
  program_end_date = null,  -- mid-program: no completion date yet. (A future date here is read as the completion anchor by the SROP minimum-duration gate, turning the chip green.)
  avatar_url = 'https://api.dicebear.com/7.x/personas/svg?seed=marcus-reyes&backgroundColor=d4e5ff,b8d4ff,a8c9ff&radius=50'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

update public.clients set
  name = 'Pat Novak',
  email = 'pat.novak.demo@gemyndflow.com',
  primary_phone = '314-555-0188',
  program_type = 'GAMBLING_RECOVERY',
  status = 'active',
  compliance_score = 100,
  case_number = 'SELF-PAY-2026-001',
  assigned_therapist_id = '22222222-2222-2222-2222-222222222222',
  created_at = '2026-05-11 09:00:00+00',
  employment_status = 'Full-time',
  support_system_strength = 'Strong',
  primary_substance = null,
  prior_warrants = 0,
  prior_treatment_dropouts = 0,
  program_end_date = null,
  avatar_url = 'https://api.dicebear.com/7.x/personas/svg?seed=pat-novak&backgroundColor=fef3c7,fde68a,fcd34d&radius=50'
where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- Archive the other 6 demo clients so the staff roster shows only Marcus and Pat
update public.clients set status = 'archived'
where id in (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'cccccccc-cccc-cccc-cccc-cccccccccccc'
);

-- =================================================================
-- 2) Cleanup conflicting pre-seeded rows
-- =================================================================

delete from public.appointments where id in (
  'd1000000-0000-0000-0000-000000000008',
  '70ba1629-df73-45b5-ba8e-d7b102a1e9e7',
  '7b7a50f6-c06a-4e93-b629-846f69409289'
);

delete from public.form_submissions where id in (
  'a2000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000002',
  'a2000000-0000-0000-0000-000000000003',
  'a2000000-0000-0000-0000-000000000004',
  'a2000000-0000-0000-0000-000000000005',
  'a2000000-0000-0000-0000-000000000006',
  '8ee7e041-eb1b-46fa-a826-6ae8f985e9d6'
);

delete from public.clinical_notes where id = 'f1000000-0000-0000-0000-000000000001';

delete from public.payments where id in (
  'e1000000-0000-0000-0000-000000000001',
  'e1000000-0000-0000-0000-000000000003',
  'e1000000-0000-0000-0000-000000000006',
  '6b209ecb-2e18-40e1-86b9-dd1e85a51394',
  'f1da54ea-a4b5-4a98-a8c5-1207740e1570'
);

-- =================================================================
-- 3) Marcus's session timeline (re-shape existing rows + add new ones)
--    All times stored UTC; status lowercase to match portal queries.
-- =================================================================

update public.appointments set
  client_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  client_name = 'Marcus Reyes',
  title = 'Individual Counseling',
  appointment_type = 'Individual Counseling',
  start_time = '2026-04-13 16:00:00+00',
  end_time = '2026-04-13 16:50:00+00',
  duration_minutes = 50,
  modality = 'Virtual (Zoom)',
  therapist_name = 'Karen Ventimiglia, LPC',
  zoom_link = 'https://zoom.us/j/9871234560',
  zoom_meeting_id = '9871234560',
  status = 'completed'
where id = 'd1000000-0000-0000-0000-000000000001';

update public.appointments set
  client_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  client_name = 'Marcus Reyes',
  title = 'Individual Counseling',
  appointment_type = 'Individual Counseling',
  start_time = '2026-05-21 16:00:00+00',
  end_time = '2026-05-21 16:50:00+00',
  duration_minutes = 50,
  modality = 'Virtual (Zoom)',
  therapist_name = 'Karen Ventimiglia, LPC',
  zoom_link = 'https://zoom.us/j/9871234561',
  zoom_meeting_id = '9871234561',
  status = 'scheduled'
where id = 'd1000000-0000-0000-0000-000000000010';

insert into public.appointments (id, client_id, client_name, title, appointment_type, start_time, end_time, duration_minutes, modality, therapist_name, zoom_link, zoom_meeting_id, status, is_recurring, updated_at)
values (
  'd1000000-0000-0000-0000-0000000a5004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Marcus Reyes', 'Individual Counseling', 'Individual Counseling',
  '2026-05-04 16:00:00+00', '2026-05-04 16:50:00+00', 50, 'Virtual (Zoom)', 'Karen Ventimiglia, LPC',
  'https://zoom.us/j/9871234562', '9871234562', 'completed', false, now()
)
on conflict (id) do nothing;

-- =================================================================
-- 4) Pat's session timeline
-- =================================================================

update public.appointments set
  client_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  client_name = 'Pat Novak',
  title = 'Intake Assessment',
  appointment_type = 'Intake Assessment',
  start_time = '2026-05-11 15:00:00+00',
  end_time = '2026-05-11 16:30:00+00',
  duration_minutes = 90,
  modality = 'Virtual (Zoom)',
  therapist_name = 'Dr. Anya Sharma',
  zoom_link = 'https://zoom.us/j/8765432100',
  zoom_meeting_id = '8765432100',
  status = 'completed'
where id = 'd1000000-0000-0000-0000-000000000002';

insert into public.appointments (id, client_id, client_name, title, appointment_type, start_time, end_time, duration_minutes, modality, therapist_name, zoom_link, zoom_meeting_id, status, is_recurring, updated_at)
values (
  'd1000000-0000-0000-0000-0000000b5022', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Pat Novak', 'Individual Counseling', 'Individual Counseling',
  '2026-05-22 17:00:00+00', '2026-05-22 17:50:00+00', 50, 'Virtual (Zoom)', 'Dr. Anya Sharma',
  'https://zoom.us/j/8765432101', '8765432101', 'scheduled', false, now()
)
on conflict (id) do nothing;

-- Ensure status is lowercase even on rows we just touched (portal queries match
-- `status = 'scheduled'` exactly)
update public.appointments set status = lower(status)
where lower(status) <> status
  and client_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- =================================================================
-- 5) Karen's DAP note on Marcus's most recent completed session
-- =================================================================

insert into public.clinical_notes (id, client_id, appointment_id, therapist_id, note_type, subjective, objective, assessment, plan, is_signed, created_at)
values (
  'd2000000-0000-0000-0000-0000000a5004',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'd1000000-0000-0000-0000-0000000a5004',
  '44444444-4444-4444-4444-444444444444',
  'DAP',
  'Client attended group session on time. Engaged in discussion of triggers around social drinking. Reported one near-miss incident involving a work event last week; declined the drink and called sponsor.',
  'Affect was bright. Eye contact good.',
  'Client demonstrating increased awareness of high-risk situations and applying coping strategies from prior sessions. Progress on Continuing Recovery Plan is on track. No indication of relapse.',
  'Continue weekly group attendance. Client to complete Continuing Recovery Plan section 4 before next session. Revisit sponsor relationship in 1:1 next week.',
  true,
  '2026-05-04 17:05:00+00'
)
on conflict (id) do update set
  subjective = excluded.subjective,
  objective = excluded.objective,
  assessment = excluded.assessment,
  plan = excluded.plan,
  is_signed = excluded.is_signed;

-- =================================================================
-- 6) Marcus's forms (intake signed, consent signed, recovery plan in progress)
-- =================================================================

insert into public.form_submissions (id, client_id, form_type, form_name, status, data, created_at, submitted_at)
values
  (
    'e1000000-0000-0000-0000-0000000a1001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Intake',
    'SATOP Client Intake Form',
    'Completed',
    '{"signed": true, "signature_data_url": "demo-signature-marcus", "client_name": "Marcus Reyes", "case_number": "2024-MUN-04812", "offense_date": "2024-12-15", "program_type": "SATOP Level IV", "referral_source": "City of St. Louis Municipal Court"}'::jsonb,
    '2026-04-06 14:30:00+00',
    '2026-04-06 14:30:00+00'
  ),
  (
    'e1000000-0000-0000-0000-0000000a1002',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Treatment',
    'Consent for Treatment',
    'Completed',
    '{"signed": true, "client_signature": "demo-signature-marcus", "staff_signature": "demo-signature-karen", "agrees_to_abstinence": true, "consents_to_testing": true, "agrees_to_fee": true}'::jsonb,
    '2026-04-06 15:00:00+00',
    '2026-04-06 15:00:00+00'
  ),
  (
    'e1000000-0000-0000-0000-0000000a1003',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Recovery Plans',
    'Continuing Recovery Plan',
    'In Progress',
    '{"signed": false, "completion": 60, "client_name": "Marcus Reyes", "primary_goals": "Maintain sobriety, repair work relationships, complete SATOP requirements.", "triggers": "Work happy hours, weekend social events, stress after performance reviews.", "coping_skills": "Call sponsor, leave the situation, attend AA meeting same-day.", "support_groups": "AA - St. Louis North group, Tuesday/Thursday."}'::jsonb,
    '2026-04-20 10:00:00+00',
    null
  )
on conflict (id) do nothing;

-- =================================================================
-- 7) Pat's intake form with the gambling narrative
-- =================================================================

insert into public.form_submissions (id, client_id, form_type, form_name, status, data, created_at, submitted_at)
values (
  'e1000000-0000-0000-0000-0000000b1001',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Intake',
  'Gambling Recovery Intake',
  'Completed',
  '{"signed": true, "client_name": "Pat Novak", "narrative": "Client reports 18-month escalation of online sports betting. Disclosed approximately $42,000 in losses over the past year. Self-referred after spouse discovered hidden accounts. Motivated for treatment. No prior treatment history. Denies substance use.", "self_referred": true, "spouse_language": "Bosnian-speaking", "multilingual_support_requested": true}'::jsonb,
  '2026-05-11 16:00:00+00',
  '2026-05-11 16:00:00+00'
)
on conflict (id) do nothing;

-- =================================================================
-- 8) Pat's $300 Stripe-stub receipt
-- =================================================================

insert into public.payments (id, client_id, amount, payment_date, payment_method, description, status, external_payment_id)
values (
  'f1000000-0000-0000-0000-0000000a3001',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  300.00,
  '2026-05-11 14:30:00+00',
  'Stripe',
  'Gambling Recovery — Intake Assessment',
  'paid',
  'pi_demo_3PNovak2026May18'
)
on conflict (id) do update set
  amount = excluded.amount,
  payment_date = excluded.payment_date,
  payment_method = excluded.payment_method,
  description = excluded.description,
  status = excluded.status,
  external_payment_id = excluded.external_payment_id;
