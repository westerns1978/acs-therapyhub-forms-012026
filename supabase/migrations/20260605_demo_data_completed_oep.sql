-- ACS TherapyHub — WS7 completed-certificate demo persona (2026-06-05)
--
-- Adds ONE terminal-state client (SATOP OEP, Level I, 10/10 hrs) whose completion
-- certificate issues because the REAL gate evaluates true — not a bypass flag.
-- The gate (services/complianceEngine.ts → evaluateProgramCompletion) is:
--     hours_completed >= required_hours
--     AND balance == 0
--     AND a SIGNED clinical_notes row with note_type='completion_signoff' exists.
-- This seed satisfies all three so opening the client and clicking "Completion
-- Certificate" produces a real, gated, end-to-end cert — the first integration
-- test of the cert path:
--   • srop_hours_completed = 10, total_sessions_required = 10  → hours gate
--   • balance = 0                                              → payment gate
--   • signed completion_signoff note (below)                   → sign-off gate
--
-- is_demo = true → the cert carries the "SAMPLE — NOT VALID FOR SUBMISSION"
-- watermark and a non-real certificate number, so a demo PDF can never be mistaken
-- for an issued state instrument. Marcus & Pat are also flagged so any document
-- they generate is stamped.
--
-- Idempotent: fixed UUIDs + ON CONFLICT. Re-running is safe.
-- Karen Ventimiglia, LPC = 44444444-4444-4444-4444-444444444444 (per the
-- 20260518_demo_data_marcus_pat seed) — she is the certifying professional.

-- =================================================================
-- 1) The completed client (OEP Level I, terminal state)
-- =================================================================

insert into public.clients (
  id, name, email, primary_phone, program_type, status,
  compliance_score, case_number, assigned_therapist_id,
  srop_hours_completed, total_sessions_required, balance, is_demo,
  created_at, program_end_date, dob, county, billing_type, avatar_url
) values (
  'd0000000-0000-4000-8000-000000000001',
  'Jordan Ellis',
  'jordan.ellis.demo@gemyndflow.com',
  '314-555-0170',
  'SATOP',
  'completed',
  100,
  'DEMO-OEP-0001',
  '44444444-4444-4444-4444-444444444444',
  10,
  10,
  0,
  true,
  '2026-04-20 14:00:00+00',
  '2026-05-28',
  '1992-03-14',
  'St. Louis',
  'Court Mandate',
  'https://api.dicebear.com/7.x/personas/svg?seed=jordan-ellis&backgroundColor=d1fae5,a7f3d0,6ee7b7&radius=50'
)
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  program_type = excluded.program_type,
  status = excluded.status,
  srop_hours_completed = excluded.srop_hours_completed,
  total_sessions_required = excluded.total_sessions_required,
  balance = excluded.balance,
  is_demo = excluded.is_demo,
  program_end_date = excluded.program_end_date,
  case_number = excluded.case_number,
  assigned_therapist_id = excluded.assigned_therapist_id;

-- =================================================================
-- 2) Payment bringing the balance to zero for the OEP Level I fee
--    (~$200 per the kickoff brief's table; VERIFY against the current
--     ACS/DMH fee schedule before any real use.)
-- =================================================================

insert into public.payments (
  id, client_id, amount, payment_date, payment_method, description, status, external_payment_id
) values (
  'd0000000-0000-4000-8000-000000000002',
  'd0000000-0000-4000-8000-000000000001',
  200.00,
  '2026-05-28 15:00:00+00',
  'card',
  'SATOP OEP (Level I) program fee',
  'paid',
  'pi_demo_oep_jordan_ellis'
)
on conflict (id) do update set
  amount = excluded.amount,
  status = excluded.status,
  payment_method = excluded.payment_method,
  description = excluded.description,
  external_payment_id = excluded.external_payment_id;

-- =================================================================
-- 3) Completion sign-off — the distinct completion event (NOT the
--    placement sign-off). The gate reads exactly this row.
-- =================================================================

insert into public.clinical_notes (
  id, client_id, therapist_id, note_type, assessment, plan, is_signed, created_at
) values (
  'd0000000-0000-4000-8000-000000000003',
  'd0000000-0000-4000-8000-000000000001',
  '44444444-4444-4444-4444-444444444444',
  'completion_signoff',
  'All SATOP OEP (Level I) requirements met: 10 of 10 education hours completed; balance paid in full.',
  'Issue the SATOP completion certificate.',
  true,
  '2026-05-28 16:00:00+00'
)
on conflict (id) do update set
  note_type = excluded.note_type,
  assessment = excluded.assessment,
  plan = excluded.plan,
  is_signed = excluded.is_signed;

-- =================================================================
-- 4) Flag the existing demo clients so their documents are stamped too
-- =================================================================

update public.clients set is_demo = true
where id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',  -- Marcus Reyes
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'   -- Pat Novak
);
