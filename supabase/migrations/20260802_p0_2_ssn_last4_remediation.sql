-- ============================================================================
-- P0 · D2 — remediate any over-length SSN already stored.
--
-- `authorization-release` declares { id:'ssn', label:'SSN (last 4 digits)',
-- type:'text', min:4, max:4 } and stored a full nine-digit SSN: the renderer's
-- min/max attributes are inert on a text input, there is no <form> element so
-- native constraint validation never ran, and the form's own rule was a floor
-- (`length < 4`). Over-collection of an identifier on a 42 CFR Part 2 record, in
-- a field whose own label promises last-four only.
-- (docs/qa/e2e-smoke-2026-08.md, D-5.)
--
-- The code fix is in the same commit: config/formValidation.ts lengthFieldErrors
-- now enforces the declared min/max at submit, and the renderer emits maxLength
-- for the text family. THIS migration cleans up anything the defect already let
-- through.
--
-- EXPECTED IMPACT AT THE TIME OF WRITING: **0 rows.** Verified by aggregate,
-- without selecting a single value:
--
--   select count(*) filter (where data ? 'ssn')             as has_ssn_key,  -- 0
--          count(*) filter (where length(data->>'ssn') > 4) as over_length,  -- 0
--          count(*)                                         as total         -- 8
--     from public.form_submissions;
--
-- The live table holds 8 rows, all form_id='emergency-contact'; no row carries an
-- `ssn` key at all. The smoke run's nine-character row was torn down with the
-- rest of that fixture (form_submissions returned to its baseline of 8).
--
-- It is still written and still safe to apply: if a row appears between now and
-- approval, this repairs it, and it is re-runnable — the predicate stops matching
-- once the value is four digits.
--
-- WHAT IT DOES NOT TOUCH: scripts/fixtures/form-submissions-ground-truth.json.
-- That is a repo file, not a database row; it is scrubbed in the same commit.
--
-- PRESENT-THEN-APPLY: written and committed for Dan's review. NOT APPLIED.
-- ============================================================================

begin;

-- Audit first, from the SAME predicate, so the ledger cannot disagree with the
-- repair. `details` records the prior LENGTH and digit count — never the value.
-- user_id is null by design: the actor is this migration, not a signed-in staff
-- member, and inventing an actor uuid would be worse than recording none.
insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
select
  null,
  'form_submission.ssn_truncated',
  'form_submissions',
  fs.id,
  jsonb_build_object(
    'form_id',            fs.form_id,
    'client_id',          fs.client_id,
    'field',              'ssn',
    'prior_length',       length(fs.data->>'ssn'),
    'prior_digit_count',  length(regexp_replace(fs.data->>'ssn', '\D', '', 'g')),
    'new_length',         4,
    'reason',             'P0/D2 — the SSN field promised last-4 and enforced nothing; over-length values truncated in place.',
    'migration',          '20260802_p0_2_ssn_last4_remediation'
  )
from public.form_submissions fs
where fs.data ? 'ssn'
  and length(fs.data->>'ssn') > 4
  and length(regexp_replace(fs.data->>'ssn', '\D', '', 'g')) >= 4;

-- Truncate in place. Digits are extracted first so a formatted value
-- ('444-56-4444') yields the real last four rather than the last four
-- characters, and the result always satisfies the new ^\d{4}$ rule.
update public.form_submissions fs
   set data = jsonb_set(fs.data, '{ssn}',
                to_jsonb(right(regexp_replace(fs.data->>'ssn', '\D', '', 'g'), 4)))
 where fs.data ? 'ssn'
   and length(fs.data->>'ssn') > 4
   -- A value with fewer than four digits is NOT repaired: right('',4) would blank
   -- it, destroying whatever the client actually entered. Those are left alone and
   -- remain visible to the same aggregate query above.
   and length(regexp_replace(fs.data->>'ssn', '\D', '', 'g')) >= 4;

-- Idempotence witness. After the update no row can still be over-length with
-- four or more digits; a second run inserts nothing and updates nothing.
do $$
declare v_left integer;
begin
  select count(*) into v_left
    from public.form_submissions
   where data ? 'ssn'
     and length(data->>'ssn') > 4
     and length(regexp_replace(data->>'ssn', '\D', '', 'g')) >= 4;
  if v_left <> 0 then
    raise exception 'ssn remediation left % repairable row(s) — refusing to commit.', v_left;
  end if;
  raise notice 'ssn remediation complete: 0 repairable rows remain.';
end $$;

commit;
