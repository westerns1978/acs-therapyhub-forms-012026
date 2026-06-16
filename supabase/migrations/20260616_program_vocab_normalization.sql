-- ─────────────────────────────────────────────────────────────────────────────
-- Program vocabulary normalization (2026-06-16) — PRESENT-THEN-APPLY
-- clients.program_type becomes a CANONICAL, CHECK-enforced set. Mirrors the status
-- lifecycle normalization (20260611): the same free-text-drift disease, the same
-- cure — one canonical vocabulary + one enforcement point.
--
-- WHY: SATOP-level programs were stored under inconsistent free-text spellings
-- ('SROP' vs 'SATOP Level IV'; 'Anger Management' vs 'ANGER MANAGEMENT'), and the
-- compliance engine hard-cases program === 'SATOP'. A client stored as 'SROP' was
-- therefore not 'SATOP', never reached the SATOP level rules, and fell to the
-- "No Missouri rule pack mapped" dead-end (James West). The app now routes every
-- value through ONE boundary (config/programVocab.ts → normalizeProgram); this
-- migration makes the STORED data match that canonical set and forbids drift.
--
-- CANONICAL SET (9): SATOP · OEP · WIP · CIP · SROP ·
--   OPIOID_RECOVERY · GAMBLING_RECOVERY · ANGER_MANAGEMENT · INDIVIDUAL_COUNSELING
-- SATOP-family stored as the LEVEL NAMES ACS uses (SROP/CIP/…); generic 'SATOP'
-- stays valid (its level comes from the signed placement determination, not here).
--
-- DELIBERATELY OUT (fully-wired-or-out): REACT and DOT are NOT in the CHECK. They
-- have zero clients and no PROGRAM_TO_PACK routing — a CHECK value with no routing
-- would re-create the exact no_pack trap this migration removes. Wiring REACT
-- end-to-end (CHECK + PROGRAM_TO_PACK + normalizer passthrough, together) is a
-- tracked backlog item for when a real REACT client exists.
--
-- Verified before writing (2026-06-16, read-only) — distinct program_type:
--   SATOP(13), OPIOID_RECOVERY(3), GAMBLING_RECOVERY(2), Anger Management(2),
--   SROP(1), Individual Counseling(1), SATOP Level IV(1). All map to the canonical
--   set below; no REACT/DOT/NULL rows exist → step 2's CHECK cannot reject a row.
--   clients is ACS-owned (it already carries clients_status_lifecycle_check).
--
-- Reversible: drop the CHECK constraint. The UPDATE is lossless re-spelling (no
-- rows lost; the inverse mapping is unambiguous per value).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Canonicalize spellings (UPPER+trim keyed, mirrors programVocab PROGRAM_ALIASES).
--    Idempotent: re-running maps already-canonical values to themselves.
update public.clients
set program_type = case upper(btrim(program_type))
    when 'SATOP LEVEL I'        then 'OEP'
    when 'SATOP LEVEL II'       then 'WIP'
    when 'SATOP LEVEL III'      then 'CIP'
    when 'SATOP LEVEL IV'       then 'SROP'
    when 'ANGER MANAGEMENT'     then 'ANGER_MANAGEMENT'
    when 'INDIVIDUAL COUNSELING' then 'INDIVIDUAL_COUNSELING'
    when 'COMPULSIVE GAMBLING'  then 'GAMBLING_RECOVERY'
    -- already-canonical (also normalizes any stray casing of these):
    when 'SATOP'                then 'SATOP'
    when 'OEP'                  then 'OEP'
    when 'WIP'                  then 'WIP'
    when 'CIP'                  then 'CIP'
    when 'SROP'                 then 'SROP'
    when 'OPIOID_RECOVERY'      then 'OPIOID_RECOVERY'
    when 'GAMBLING_RECOVERY'    then 'GAMBLING_RECOVERY'
    when 'ANGER_MANAGEMENT'     then 'ANGER_MANAGEMENT'
    when 'INDIVIDUAL_COUNSELING' then 'INDIVIDUAL_COUNSELING'
    else program_type  -- unmapped value: left as-is so the CHECK below surfaces it loudly
  end
where program_type is not null;

-- 2) Single vocabulary, enforced — a free-text variant can never appear again.
--    (NULL passes a CHECK; the engine already treats a null/blank program as
--    "no pack", so we do not force NOT NULL here — no client row is null today.)
alter table public.clients drop constraint if exists clients_program_vocab_check;
alter table public.clients
  add constraint clients_program_vocab_check
  check (program_type in (
    'SATOP','OEP','WIP','CIP','SROP',
    'OPIOID_RECOVERY','GAMBLING_RECOVERY','ANGER_MANAGEMENT','INDIVIDUAL_COUNSELING'
  ));

comment on column public.clients.program_type is
  'Canonical program vocabulary (CHECK-enforced clients_program_vocab_check): '
  'SATOP|OEP|WIP|CIP|SROP|OPIOID_RECOVERY|GAMBLING_RECOVERY|ANGER_MANAGEMENT|INDIVIDUAL_COUNSELING. '
  'SATOP-family (SROP/CIP/…) routes to the SATOP level model via config/programVocab.ts; '
  'the completion gate level comes from the SIGNED placement determination, never the program name. '
  'REACT/DOT are intentionally excluded until wired end-to-end (no routing yet).';
