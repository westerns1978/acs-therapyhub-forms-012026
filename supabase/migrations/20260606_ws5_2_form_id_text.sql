-- WS5 Phase 1 step 2a — form_submissions.form_id : uuid -> text, + form_name backfill.
--
-- WHY: form_id was `uuid` and NULL in every row, but the app's form registry uses string
-- keys ('consent-treatment', ...). The uuid column TYPE-REJECTED those string ids, so
-- assignForm and the client submit could never persist a usable form_id, and PortalDocuments
-- matched completion on form_id (always null) -> every form showed "pending" forever. The
-- de-facto key was form_name (free text). This relabels form_id to `text` (the registry id)
-- -- mirrors the appointments.client_id uuid->text precedent -- and backfills existing rows
-- from form_name via an EXPLICIT, reviewed mapping.
--
-- FAIL-CLOSED: only form_names that map cleanly to a SATOP registry id are backfilled. Two
-- non-SATOP program intakes ('Opioid Recovery Intake', 'Gambling Recovery Intake') have NO
-- SATOP registry id and are deliberately LEFT NULL (reported, not guessed). form_id stays
-- nullable (the stray rows + any future unmapped submission).

alter table public.form_submissions
  alter column form_id type text using form_id::text;

-- Backfill from the reviewed form_name -> registry-id mapping (clean mappings only).
-- Unmapped names fall through the ELSE and remain NULL.
update public.form_submissions set form_id = case form_name
    when 'Consent for Treatment'                   then 'consent-treatment'
    when 'Continuing Recovery Plan'                then 'recovery-plan'
    when 'SATOP Client Intake Form'                then 'satop-intake'
    when 'Emergency Contact'                       then 'emergency-contact'
    when 'HIPAA Acknowledgement'                   then 'hipaa-ack'
    when 'Telehealth Consent'                      then 'telehealth-consent'
    when 'Individual Comprehensive Treatment Plan' then 'treatment-plan'
    else form_id   -- unmapped (non-SATOP program intakes) -> remain NULL, reported
  end
where form_id is null;
