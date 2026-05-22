-- ACS TherapyHub Phase F3: persona coherence seed.
--
-- Backfills group sessions, individual sessions, form submissions, and
-- payments so Marcus / Pat / Emma / Margaret have enough attached data to
-- walk a full SATOP and gambling-recovery journey instead of presenting as
-- "just arrived, no history."
--
-- Lowercase status values on appointments are intentional and match the
-- existing DB convention (the column default is 'scheduled'). Read-side
-- normalization in services/api.ts handles the casing for UI display —
-- see Phase F3 casing fix.

-- ============================================
-- MARCUS REYES (aaaaaaaa-…): 9 SATOP Group sessions backdated weekly
-- ============================================
INSERT INTO public.appointments
  (client_id, client_name, therapist_name, appointment_type, title, modality,
   start_time, end_time, duration_minutes, status, session_rate)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Marcus Reyes', 'Karen Ventimiglia, LPC', 'SATOP Group', 'SATOP Group Session', 'In-Person',
   '2026-03-18 18:00:00+00', '2026-03-18 19:30:00+00', 90, 'completed', 125.00),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Marcus Reyes', 'Karen Ventimiglia, LPC', 'SATOP Group', 'SATOP Group Session', 'In-Person',
   '2026-03-25 18:00:00+00', '2026-03-25 19:30:00+00', 90, 'completed', 125.00),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Marcus Reyes', 'Karen Ventimiglia, LPC', 'SATOP Group', 'SATOP Group Session', 'In-Person',
   '2026-04-01 18:00:00+00', '2026-04-01 19:30:00+00', 90, 'completed', 125.00),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Marcus Reyes', 'Karen Ventimiglia, LPC', 'SATOP Group', 'SATOP Group Session', 'In-Person',
   '2026-04-08 18:00:00+00', '2026-04-08 19:30:00+00', 90, 'completed', 125.00),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Marcus Reyes', 'Karen Ventimiglia, LPC', 'SATOP Group', 'SATOP Group Session', 'In-Person',
   '2026-04-15 18:00:00+00', '2026-04-15 19:30:00+00', 90, 'completed', 125.00),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Marcus Reyes', 'Karen Ventimiglia, LPC', 'SATOP Group', 'SATOP Group Session', 'In-Person',
   '2026-04-22 18:00:00+00', '2026-04-22 19:30:00+00', 90, 'completed', 125.00),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Marcus Reyes', 'Karen Ventimiglia, LPC', 'SATOP Group', 'SATOP Group Session', 'In-Person',
   '2026-04-29 18:00:00+00', '2026-04-29 19:30:00+00', 90, 'completed', 125.00),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Marcus Reyes', 'Karen Ventimiglia, LPC', 'SATOP Group', 'SATOP Group Session', 'In-Person',
   '2026-05-06 18:00:00+00', '2026-05-06 19:30:00+00', 90, 'completed', 125.00),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Marcus Reyes', 'Karen Ventimiglia, LPC', 'SATOP Group', 'SATOP Group Session', 'In-Person',
   '2026-05-13 18:00:00+00', '2026-05-13 19:30:00+00', 90, 'completed', 125.00);

-- ============================================
-- EMMA REEVES (ffffffff-…): 6 SATOP Group sessions backdated weekly
-- ============================================
INSERT INTO public.appointments
  (client_id, client_name, therapist_name, appointment_type, title, modality,
   start_time, end_time, duration_minutes, status, session_rate)
VALUES
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Emma Reeves', 'Karen Ventimiglia, LPC', 'SATOP Group', 'SATOP Group Session', 'In-Person',
   '2026-04-08 18:00:00+00', '2026-04-08 19:30:00+00', 90, 'completed', 125.00),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Emma Reeves', 'Karen Ventimiglia, LPC', 'SATOP Group', 'SATOP Group Session', 'In-Person',
   '2026-04-15 18:00:00+00', '2026-04-15 19:30:00+00', 90, 'completed', 125.00),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Emma Reeves', 'Karen Ventimiglia, LPC', 'SATOP Group', 'SATOP Group Session', 'In-Person',
   '2026-04-22 18:00:00+00', '2026-04-22 19:30:00+00', 90, 'completed', 125.00),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Emma Reeves', 'Karen Ventimiglia, LPC', 'SATOP Group', 'SATOP Group Session', 'In-Person',
   '2026-04-29 18:00:00+00', '2026-04-29 19:30:00+00', 90, 'completed', 125.00),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Emma Reeves', 'Karen Ventimiglia, LPC', 'SATOP Group', 'SATOP Group Session', 'In-Person',
   '2026-05-06 18:00:00+00', '2026-05-06 19:30:00+00', 90, 'completed', 125.00),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Emma Reeves', 'Karen Ventimiglia, LPC', 'SATOP Group', 'SATOP Group Session', 'In-Person',
   '2026-05-13 18:00:00+00', '2026-05-13 19:30:00+00', 90, 'completed', 125.00);

-- ============================================
-- PAT NOVAK (bbbbbbbb-…): 1 follow-up Individual + 2 onboarding forms
-- so his chart isn't "just arrived, nothing happened."
-- ============================================
INSERT INTO public.appointments
  (client_id, client_name, therapist_name, appointment_type, title, modality,
   start_time, end_time, duration_minutes, status, session_rate)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Pat Novak', 'Dr. Anya Sharma', 'Individual Counseling', 'Individual Counseling', 'Virtual (Zoom)',
   '2026-05-18 17:00:00+00', '2026-05-18 17:50:00+00', 50, 'completed', 150.00);

INSERT INTO public.form_submissions
  (client_id, form_name, form_type, status, submitted_at, assigned_at, data)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'Consent for Treatment', 'Treatment', 'Completed',
   '2026-05-11 16:30:00+00', '2026-05-11 16:00:00+00',
   '{"is_paper_upload": false, "consent_given": true}'::jsonb),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'Emergency Contact', 'Intake', 'Completed',
   '2026-05-11 16:45:00+00', '2026-05-11 16:00:00+00',
   '{"contact_name": "Jamie Novak", "relationship": "spouse"}'::jsonb);

-- ============================================
-- PAYMENTS: Marcus (2 court-mandate fees), Emma (1 self-pay),
-- Pat (1 follow-up session co-pay). Margaret already has a payment.
-- ============================================
INSERT INTO public.payments
  (client_id, amount, payment_method, description, status, payment_date)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 125.00, 'cash',
   'SATOP Level IV — Court mandate', 'paid', '2026-04-01 14:00:00+00'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 125.00, 'cash',
   'SATOP Level IV — Court mandate', 'paid', '2026-05-01 14:00:00+00'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 125.00, 'credit_card',
   'SATOP Level III — Self pay', 'paid', '2026-05-01 14:00:00+00'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 150.00, 'Stripe',
   'Gambling Recovery — Individual Counseling', 'paid', '2026-05-18 18:00:00+00');
