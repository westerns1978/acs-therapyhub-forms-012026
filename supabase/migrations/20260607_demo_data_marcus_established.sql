-- ACS TherapyHub — Durable established-client seed: Marcus = signed SROP (Level IV) (2026-06-07)
--
-- Makes Marcus Reyes a PERMANENT established demo client in committed seed data,
-- ending the re-fixture churn (every WS-DisplayTruth established-path witness had to
-- synthesize his determination + categorized hours and revert). This AUGMENTS the
-- existing demo seed (20260518_demo_data_marcus_pat.sql); it does not replace it.
--
-- Goal state, produced by THIS seed alone (no transient fixture):
--   • assessment_inputs row → the FK basis for the determination
--   • SIGNED, confirm-disposition Level IV (SROP) placement_determination
--   • his 12 completed appointments categorized service_type='counseling' (16h)
--   ⇒ DisplayTruth surfaces show the AUTHORITATIVE 16/75 total + 16/35 counseling,
--     Level IV — both SROP floors honestly UNMET (a realistic mid-program SROP client),
--     never the legacy static columns (srop_hours_completed=42 / total=75, now unread).
--
-- WHY Level IV (SROP), not III: Marcus is already framed IV everywhere (legacy static
-- total=75 + intake JSON "SATOP Level IV"), so IV is the internally-consistent demo and
-- the base seed's created_at = now()-45d was written specifically to keep the SROP
-- 90-day duration gate PENDING. IV also surfaces the SROP TWO-PART floor (75 total AND
-- the ≥35 counseling sub-floor per 9 CSR 30-3.206(7)(C)(D)(E)) — the only per-category
-- floor in the reg, and the richest thing to demo to a SATOP director.
--
-- HONEST, not hand-set: the inputs in §1 genuinely make the deterministic engine
-- (services/placementEngine.ts computePlacement) RECOMMEND Level IV via the SROP hard
-- floor (all three conditions: bac≥0.15, dui_arrest_count≥2, sud_diagnosis), so the
-- determination in §2 is a clean CONFIRM (determined = recommended), not an escalation.
-- basis_snapshot mirrors that engine output verbatim.
--
-- determined_by = 0859d1d9-… : Karen's REAL auth.users uid (demo.therapist@acs-therapyhub.com,
-- app_metadata.role=Therapist ⇒ private.is_clinician()=true) — the row the in-app sign
-- flow would write. NOT the 44444444-… placeholder used elsewhere for display-only
-- therapist attribution (it is not a real auth user; see SECURITY_BACKLOG #3).
--
-- IDEMPOTENT (load-bearing — placement_determinations is APPEND-ONLY, no UPDATE/DELETE):
--   • §1 deterministic id + ON CONFLICT (id) DO NOTHING
--   • §2 INSERT…SELECT…WHERE NOT EXISTS a signed determination for Marcus ⇒ a re-apply
--        NEVER creates a second determination (he must always have exactly ONE signed row)
--   • §3 service_type IS DISTINCT FROM 'counseling' guard ⇒ a re-apply touches 0 rows
-- Re-running the whole migration after the demo is safe and a no-op.
--
-- Pat Novak is INTENTIONALLY untouched (no determination) — the no-phantom demo half.

-- =================================================================
-- 1) assessment_inputs — the FK basis (honest SROP-firing inputs)
-- =================================================================

insert into public.assessment_inputs (
  id, client_id, screening_date,
  offense_count, dui_arrest_count, bac, sud_diagnosis,
  dri2_result, dri2_date, prior_treatment, other_arrests, life_issues,
  notes, created_by, created_at
) values (
  'a55e5500-0000-4000-8000-0000000a0001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '2026-03-14',                              -- screening valid 6mo (until 2026-09-14; not expired)
  3,                                         -- offense_count: 3rd offense ⇒ engine base CIP (Level III)
  2,                                         -- dui_arrest_count ≥ 2   (SROP condition)
  0.17,                                      -- bac ≥ 0.15             (SROP condition)
  true,                                      -- sud_diagnosis = true   (SROP condition) ⇒ SROP floor APPLIES ⇒ IV
  null,                                      -- dri2_result: proprietary, not entered
  null,                                      -- dri2_date
  false,                                     -- prior_treatment
  0,                                         -- other_arrests
  false,                                     -- life_issues
  'Durable demo seed (Marcus Reyes). SROP hard floor applies: BAC 0.17, 2 DUI arrests w/ DOR administrative action, SUD diagnosis. Engine base CIP (3rd offense) overridden to SROP (Level IV) by the 3-condition floor.',
  '0859d1d9-bfc6-4b32-b9c5-b1e94e519490',    -- Karen (demo.therapist) — attribution only
  '2026-03-14 15:00:00+00'
)
on conflict (id) do nothing;

-- =================================================================
-- 2) placement_determinations — SIGNED, confirm-disposition Level IV
--    Append-only: WHERE NOT EXISTS guard ⇒ exactly one signed row, ever.
-- =================================================================

insert into public.placement_determinations (
  id, client_id, assessment_input_id,
  engine_recommended_level, determined_level, basis_snapshot,
  disposition, deviation_reason, exception_ref,
  determined_by, determined_at, status, supersedes_id
)
select
  'de7e0000-0000-4000-8000-0000000a0001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'a55e5500-0000-4000-8000-0000000a0001',    -- the §1 assessment_inputs row
  'IV',                                      -- engine_recommended_level (SROP floor fired)
  'IV',                                      -- determined_level (clinician CONFIRMED — no escalation)
  jsonb_build_object(
    'offense_count', 3,
    'dui_arrest_count', 2,
    'bac', 0.17,
    'sud_diagnosis', true,
    'baseLevel', 'III',
    'sropFloorApplies', true,
    'sropConditions', jsonb_build_object('highBac', true, 'repeatDuiArrests', true, 'sudDiagnosis', true),
    'recommendedFloor', 'IV',
    'upgradeFactorsPresent', jsonb_build_array('high_bac'),
    'rationale', jsonb_build_array(
      'offense_count=3 ⇒ base CIP (Level III)',
      'SROP conditions: bac≥0.15=true (bac=0.17), dui_arrest_count≥2=true (count=2), sud_diagnosis=true ⇒ SROP floor APPLIES',
      'recommendedFloor=SROP (Level IV)'
    )
  ),                                         -- basis_snapshot mirrors computePlacement() verbatim
  'confirmed',                               -- disposition: determined = recommended
  null,                                      -- deviation_reason: NULL for confirmed (CHECK pd_disposition_matches_levels)
  null,                                      -- exception_ref: always NULL outside §3(E)
  '0859d1d9-bfc6-4b32-b9c5-b1e94e519490',    -- determined_by: Karen's REAL auth.uid (is_clinician)
  '2026-03-16 16:00:00+00',                  -- signed at intake, before his first session (2026-03-18)
  'signed',
  null                                       -- supersedes_id: first determination
where not exists (
  select 1 from public.placement_determinations
  where client_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    and status = 'signed'
);

-- =================================================================
-- 3) Categorize Marcus's 12 completed appointments as 'counseling'
--    Recon-confirmed: 12 completed rows, 960 min = 16.00h, all service_type
--    NULL today. ⇒ client_accrued_hours: total 16h, counseling 16h.
--    At Level IV the gate reads 16/75 total + 16/35 counseling (both unmet).
--    Naturally idempotent via the IS DISTINCT FROM guard (re-apply ⇒ 0 rows).
-- =================================================================

update public.appointments
set service_type = 'counseling'
where client_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  and lower(status) = 'completed'
  and service_type is distinct from 'counseling';

-- Pat Novak: intentionally NO determination, NO assessment_inputs, NO accrual —
-- stays "determination pending" (no-phantom). The no-phantom demo half.
