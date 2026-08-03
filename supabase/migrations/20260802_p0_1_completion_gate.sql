-- ============================================================================
-- P0 · D1 — the completion gate fails open.
--
-- Before this migration `clients.status='completed'` could be written by any
-- authenticated staff session (RLS policy `staff_all_clients` is FOR ALL), with
-- zero reference to the completion gate. The gate existed only in TypeScript,
-- and only on the path that BUILDS a PDF (services/pdfDocuments.ts) — never on
-- the path that WRITES the record. A client was recorded as having completed a
-- state-mandated programme at 9/10 hours with a required document unsigned and
-- no clinician sign-off (docs/qa/e2e-smoke-2026-08.md, D-1).
--
-- This migration moves the gate into Postgres:
--
--   1. Reference tables for the two constants that lived ONLY in TypeScript
--      (required hours per level; the required-forms set). They were already
--      duplicated twice inside TS — config/satopFees.ts AND the compliance
--      pack JSON. Seeding them here makes the DATABASE the single source and
--      `npm run check:gate` fail loudly when TypeScript drifts from it.
--
--   2. `private.current_determined_level()` — ONE SQL derivation of "the
--      current signed determination", shared by `my_progress()` (which had its
--      own inline copy) and by the new gate. The gate REUSES a derivation
--      rather than adding a fourth.
--
--   3. `public.complete_client(p_client_id, p_attestation)` — SECURITY DEFINER,
--      clinician-only, re-derives every gate in SQL and RAISES on failure. The
--      clinician must supply an affirmative attestation; the RPC records it as
--      an immutable `completion_signoff` clinical note. The attestation is NOT
--      a side effect of passing the gate — no attestation, no completion.
--
--   4. A BEFORE INSERT OR UPDATE trigger on `clients` that refuses any
--      transition into `completed` (or any stamp of `completed_at`) that did
--      not come through that RPC. Unlike RLS, a trigger also fires for
--      `service_role` — this is the line between a check and a guarantee.
--
--   5. `completion_signoff` notes are made immutable to the application: the
--      single FOR ALL policy on `clinical_notes` is split so INSERT, UPDATE and
--      DELETE all exclude that note_type. Same append-only discipline as
--      `placement_determinations`.
--
-- SAFETY: at the time of writing every one of the 13 rows in `clients` is
-- `status='active'` with `completed_at IS NULL` — verified by aggregate. There
-- is nothing to backfill and no existing completed client to break.
--
-- APPLIED to ldzzlndsspkyohvzfiiu 2026-08-02 on Dan's explicit go (PITR add-on is NOT
-- enabled: daily physical backups only, 7-day retention, ~14h granularity). The
-- clinical_notes policy split was gated on a committed verbatim pg_policies
-- snapshot + a self-verifying rollback migration, both landed BEFORE this ran.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Gate constants — the single source, previously TypeScript-only
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.satop_level_requirements (
  level                text primary key check (level in ('I','II','III','IV')),
  required_hours       numeric  not null check (required_hours > 0),
  counseling_min_hours numeric  not null default 0 check (counseling_min_hours >= 0),
  min_duration_days    integer  not null default 0 check (min_duration_days >= 0),
  citation             text     not null
);

comment on table public.satop_level_requirements is
  'Missouri SATOP completion thresholds by determined level. PUBLIC REGULATORY '
  'REFERENCE DATA — no PHI. The single source: config/satopFees.ts and '
  'compliance/missouri-compliance-pack.json must agree with this table, enforced '
  'by `npm run check:gate`. Changing an hours figure here changes what a court-'
  'mandated client owes — change it here first, then let the check fail the app.';

insert into public.satop_level_requirements (level, required_hours, counseling_min_hours, min_duration_days, citation) values
  ('I',   10,  0,  0, '9 CSR 30-3.206(4)(B)'),
  ('II',  20,  0,  0, '9 CSR 30-3.206(5)'),
  ('III', 50,  0,  0, '9 CSR 30-3.206(6)'),
  ('IV',  75, 35, 90, '9 CSR 30-3.206(7)(D)')
on conflict (level) do update set
  required_hours       = excluded.required_hours,
  counseling_min_hours = excluded.counseling_min_hours,
  min_duration_days    = excluded.min_duration_days,
  citation             = excluded.citation;

create table if not exists public.satop_required_forms (
  level   text not null references public.satop_level_requirements(level) on delete cascade,
  form_id text not null,
  primary key (level, form_id)
);

comment on table public.satop_required_forms is
  'The forms 9 CSR 30-3.206(13)(F) requires signed before a completion '
  'certificate may issue, by level. Mirrors CORE_REQUIRED_FORM_IDS / '
  'REQUIRED_FORMS_BY_LEVEL in config/formRegistry.ts; `npm run check:gate` '
  'fails when the two disagree. form_id is the FORM_REGISTRY id, not a title.';

insert into public.satop_required_forms (level, form_id)
select l.level, f.form_id
from (values ('I'),('II'),('III'),('IV')) as l(level)
cross join (values
  ('consent-treatment'), ('hipaa-ack'), ('authorization-release'),
  ('telehealth-consent'), ('satop-checklist'), ('emergency-contact')
) as f(form_id)
on conflict (level, form_id) do nothing;

alter table public.satop_level_requirements enable row level security;
alter table public.satop_required_forms      enable row level security;

-- Readable by anyone. These are published Missouri regulatory constants, not
-- client data — and `npm run check:gate` must be runnable with no credentials.
drop policy if exists satop_level_requirements_read on public.satop_level_requirements;
create policy satop_level_requirements_read on public.satop_level_requirements for select using (true);
drop policy if exists satop_required_forms_read on public.satop_required_forms;
create policy satop_required_forms_read on public.satop_required_forms for select using (true);

grant select on public.satop_level_requirements to anon, authenticated;
grant select on public.satop_required_forms      to anon, authenticated;
-- No write grants at all: these change by migration, never by the app.
revoke insert, update, delete on public.satop_level_requirements from anon, authenticated;
revoke insert, update, delete on public.satop_required_forms      from anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. ONE SQL derivation of the current determination
-- ────────────────────────────────────────────────────────────────────────────
-- Lives in `private` so PostgREST never exposes it (PostgREST serves `public`
-- only) — a portal client must not be able to read any other client's level.
-- SECURITY DEFINER because `my_progress()` calls it for a caller who has no
-- read access to placement_determinations.

create or replace function private.current_determined_level(p_client uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select pd.determined_level
  from public.placement_determinations pd
  where pd.client_id = p_client
    and pd.status = 'signed'
    and not exists (
      select 1 from public.placement_determinations s
      where s.supersedes_id = pd.id and s.status = 'signed'
    )
  order by pd.determined_at desc
  limit 1;
$function$;

comment on function private.current_determined_level(uuid) is
  'The CURRENT signed, non-superseded, latest determination level for one client '
  '(null when none). The single SQL derivation — my_progress() and '
  'complete_client() both call it instead of carrying their own copy.';

-- `my_progress()` had this predicate inlined. Repoint it at the shared function
-- so the portal display and the completion gate can never disagree about which
-- determination is current. Behaviour is unchanged, including the always-one-row
-- shape (established=false when the caller has no client row / no determination).
create or replace function public.my_progress()
returns table(established boolean, level text)
language sql
stable
security definer
set search_path to ''
as $function$
  select (sel.level is not null) as established, sel.level
  from (select 1) one
  left join lateral (
    select private.current_determined_level(t.cid) as level
    from private.my_client_ids() as t(cid)
    where private.current_determined_level(t.cid) is not null
    limit 1
  ) sel on true;
$function$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Number formatting for the refusal message
-- ────────────────────────────────────────────────────────────────────────────
-- Hours come off client_accrued_hours as numeric /60.0, so 9 reads
-- 9.0000000000000000. The refusal message a clinician sees must say "9/10",
-- not "9.0000000000000000/10.00".
create or replace function private.fmt_num(n numeric)
returns text
language sql
immutable
set search_path to ''
as $function$
  select rtrim(rtrim(to_char(round(coalesce(n,0), 2), 'FM999999999.00'), '0'), '.');
$function$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. The attestation: role at time of signing
-- ────────────────────────────────────────────────────────────────────────────
-- clinical_notes already carries therapist_id (actor), signed_by_name, narrative
-- (attestation text) and signed_at (signing-event timestamp). What it could not
-- record is the actor's ROLE AT THE MOMENT OF SIGNING — roles can change, and a
-- court-facing attestation must say what the signer was when they signed.
-- This is the first real instance of the Qualified Professional in the product;
-- it is the "Qualified Professional" line of MO 650-7743 Section II.
alter table public.clinical_notes add column if not exists signed_by_role text;

comment on column public.clinical_notes.signed_by_role is
  'The signer''s application role AT THE MOMENT OF SIGNING, captured from the JWT '
  'by complete_client(). NOT a clinical credential — ACS holds no credential store '
  'yet, so the MO 650-7743 "Qualified Professional" line still needs a real '
  'credential (QP/LPC/…) before it can be printed. Never inferred at render time.';

-- ────────────────────────────────────────────────────────────────────────────
-- 5. completion_signoff notes are immutable to the application
-- ────────────────────────────────────────────────────────────────────────────
-- `staff_all_clinical_notes` was ONE policy: PERMISSIVE, FOR ALL, TO authenticated,
-- USING private.is_clinician(), WITH CHECK private.is_clinician(). Verbatim
-- snapshot: 20260802_p0_0_preflight_clinical_notes_policy_snapshot.sql.
-- Executable restore:  20260802_p0_1_rollback_clinical_notes_policy.sql.
--
-- Split into the four commands so INSERT/UPDATE/DELETE can exclude the
-- attestation. Every other note_type behaves EXACTLY as before: FOR ALL with one
-- predicate is equivalent to per-command policies carrying that same predicate,
-- and `note_type is distinct from 'completion_signoff'` is true for every note
-- type the application writes (Session, Group Session, Outreach, Task, soap).
--
-- `to authenticated` is explicit on all four. Omitting it defaults a policy to
-- PUBLIC, which is broader than the policy being replaced — the predicate would
-- still refuse anon, but silently widening the role a policy applies to is not a
-- thing to do to a 42 CFR Part 2 table.
drop policy if exists staff_all_clinical_notes on public.clinical_notes;

create policy clinical_notes_select_staff on public.clinical_notes
  as permissive for select to authenticated
  using (private.is_clinician());

create policy clinical_notes_insert_staff on public.clinical_notes
  as permissive for insert to authenticated
  with check (
    private.is_clinician()
    -- The attestation may ONLY be created by complete_client(). A clinician
    -- hand-inserting a completion_signoff would forge the gate's own evidence.
    and note_type is distinct from 'completion_signoff'
  );

create policy clinical_notes_update_staff on public.clinical_notes
  as permissive for update to authenticated
  using       (private.is_clinician() and note_type is distinct from 'completion_signoff')
  with check  (private.is_clinician() and note_type is distinct from 'completion_signoff');

create policy clinical_notes_delete_staff on public.clinical_notes
  as permissive for delete to authenticated
  using (private.is_clinician() and note_type is distinct from 'completion_signoff');

-- ────────────────────────────────────────────────────────────────────────────
-- 6. The gate itself
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.complete_client(
  p_client_id   uuid,
  p_attestation text
)
returns table (client_id uuid, completed_at timestamptz, signoff_note_id uuid)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor    uuid := auth.uid();
  v_role     text := auth.jwt() -> 'app_metadata' ->> 'role';
  v_email    text := auth.jwt() ->> 'email';
  v_name     text := coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name', auth.jwt() ->> 'email');
  v_client   public.clients%rowtype;
  v_is_satop boolean;
  v_level    text;
  v_req      public.satop_level_requirements%rowtype;
  v_total    numeric;
  v_couns    numeric;
  v_days     integer;
  v_missing  text[];
  v_reqcount integer;
  v_failures text[] := '{}';
  v_gates    jsonb  := '[]'::jsonb;
  v_note     uuid;
  v_now      timestamptz := now();
begin
  ---------------------------------------------------------------- who is asking
  if v_actor is null then
    raise exception 'You must be signed in to complete a client.' using errcode = '42501';
  end if;
  if not private.is_clinician() then
    raise exception
      'Only a clinician (Director or Therapist) may attest to a client''s completion. Your role is %.',
      coalesce(v_role, 'unknown')
      using errcode = '42501';
  end if;

  ------------------------------------------------------------- the attestation
  -- Affirmative and explicit. The clinician supplies it; passing the gate does
  -- NOT produce it. A blank or token string is refused so the attestation can
  -- never become a checkbox the UI ticks on the clinician's behalf.
  if p_attestation is null or length(btrim(p_attestation)) < 40 then
    raise exception
      'A completion attestation is required. The qualified professional must affirm that this client has completed the required programme; the attestation is recorded permanently against their name.'
      using errcode = '22023';
  end if;

  ------------------------------------------------------------------ the client
  select * into v_client from public.clients where id = p_client_id;
  if not found then
    raise exception 'Client not found.' using errcode = 'P0002';
  end if;
  if v_client.status = 'completed' then
    raise exception 'This client is already recorded as completed.' using errcode = '22023';
  end if;
  if v_client.status = 'prospect' then
    raise exception 'A prospect has not been placed into a programme and cannot be completed.' using errcode = '22023';
  end if;

  -- The routing boundary. clients_program_vocab_check already pins program_type
  -- to the nine canonical values, so the SATOP family is a fixed closed set —
  -- this is not a re-implementation of normalizeProgram, it is the same set.
  v_is_satop := v_client.program_type in ('SATOP','OEP','WIP','CIP','SROP');

  ------------------------------------------------------- gate: programme rules
  if v_is_satop then
    v_level := private.current_determined_level(p_client_id);

    if v_level is null then
      -- A SATOP client with no signed determination has no established
      -- requirement. It must NOT fall through to the lighter no-state-gate path.
      v_failures := array_append(v_failures, 'Placement determination: no signed placement determination — completion is not established. A clinician must sign a determination before this client can be completed.');
      v_gates := v_gates || jsonb_build_object('key','determination','passed',false);
    else
      select * into v_req from public.satop_level_requirements where level = v_level;
      if not found then
        raise exception 'No completion thresholds are seeded for level % — refusing to guess.', v_level
          using errcode = '23514';
      end if;

      select coalesce(a.total_hours,0), coalesce(a.counseling_hours,0)
        into v_total, v_couns
        from public.client_accrued_hours a where a.client_id = p_client_id;
      v_total := coalesce(v_total, 0);
      v_couns := coalesce(v_couns, 0);

      if v_total < v_req.required_hours then
        v_failures := array_append(v_failures, format('Hours: %s/%s total (%s remaining).',
          private.fmt_num(v_total), private.fmt_num(v_req.required_hours),
          private.fmt_num(v_req.required_hours - v_total)));
      end if;

      if v_req.counseling_min_hours > 0 and v_couns < v_req.counseling_min_hours then
        v_failures := array_append(v_failures, format('Counselling hours: %s/%s (%s remaining).',
          private.fmt_num(v_couns), private.fmt_num(v_req.counseling_min_hours),
          private.fmt_num(v_req.counseling_min_hours - v_couns)));
      end if;

      v_gates := v_gates || jsonb_build_object(
        'key','hours',
        'passed', (v_total >= v_req.required_hours
                   and (v_req.counseling_min_hours = 0 or v_couns >= v_req.counseling_min_hours)),
        'level', v_level, 'total', v_total, 'required', v_req.required_hours,
        'counseling', v_couns, 'counseling_required', v_req.counseling_min_hours,
        'citation', v_req.citation);

      -- Minimum programme duration (SROP ≥90 days). Anchored on enrollment, the
      -- same anchor evaluateDeadline uses; measured to NOW, because a client
      -- being completed today ends today.
      if v_req.min_duration_days > 0 then
        v_days := (v_now::date - v_client.created_at::date);
        if v_days < v_req.min_duration_days then
          v_failures := array_append(v_failures, format(
            'Minimum duration: %s/%s calendar days — the minimum programme length is not yet met.',
            v_days, v_req.min_duration_days));
        end if;
        v_gates := v_gates || jsonb_build_object('key','duration',
          'passed', v_days >= v_req.min_duration_days,
          'days', v_days, 'required_days', v_req.min_duration_days);
      end if;

      -- Required forms — 9 CSR 30-3.206(13)(F). The required core is INTRINSIC:
      -- a form that was never assigned still blocks. Status is matched
      -- case-insensitively; the live table carries both casings.
      select coalesce(array_agg(rf.form_id order by rf.form_id), '{}'::text[])
        into v_missing
        from public.satop_required_forms rf
       where rf.level = v_level
         and not exists (
           select 1 from public.form_submissions fs
            where fs.client_id = p_client_id
              and fs.form_id   = rf.form_id
              and lower(fs.status) in ('completed','reviewed')
         );
      select count(*) into v_reqcount from public.satop_required_forms where level = v_level;

      if coalesce(array_length(v_missing,1),0) > 0 then
        v_failures := array_append(v_failures, format('Required forms: %s of %s required form(s) unsigned (%s).',
          array_length(v_missing,1), v_reqcount, array_to_string(v_missing, ', ')));
      end if;
      v_gates := v_gates || jsonb_build_object('key','forms',
        'passed', coalesce(array_length(v_missing,1),0) = 0,
        'missing', to_jsonb(v_missing), 'citation','9 CSR 30-3.206(13)(F)');
    end if;
  else
    -- No Missouri completion rule applies to this programme (anger management,
    -- gambling recovery, opioid recovery, individual counselling). The invariant
    -- is "no programme can be completed ungated", not "SATOP is special": the
    -- applicable gate is a settled balance plus the clinician's attestation.
    -- Nothing here invents a regulatory threshold the state does not impose.
    v_gates := v_gates || jsonb_build_object('key','no_state_gate','passed',true,
      'note','No Missouri completion rule for this programme — completion is court-determined.');
  end if;

  ------------------------------------------------------------- gate: the money
  -- A NULL balance never passes: a certificate cannot issue without confirming
  -- the balance is settled.
  if v_client.balance is null then
    v_failures := array_append(v_failures, 'Balance: the outstanding balance is unknown and cannot be confirmed as settled.');
  elsif v_client.balance > 0 then
    v_failures := array_append(v_failures, format('Balance: an outstanding balance of $%s must be cleared.',
      private.fmt_num(v_client.balance)));
  end if;
  v_gates := v_gates || jsonb_build_object('key','payment',
    'passed', (v_client.balance is not null and v_client.balance <= 0),
    'balance', v_client.balance, 'citation','9 CSR 30-3.206(13)');

  ----------------------------------------------------------------- the verdict
  if coalesce(array_length(v_failures,1),0) > 0 then
    raise exception E'Completion refused — % gate(s) not met:\n  • %',
      array_length(v_failures,1),
      array_to_string(v_failures, E'\n  • ')
      using errcode = '23514';
  end if;

  --------------------------------------- record the attestation, then the fact
  -- The attestation is written FIRST and is immutable. If anything below fails
  -- the whole transaction rolls back, so an attestation can never survive
  -- without its completion, nor a completion without its attestation.
  insert into public.clinical_notes
    (client_id, therapist_id, note_type, narrative, is_signed,
     signed_at, signed_by_name, signed_by_role, service_date)
  values
    (p_client_id, v_actor, 'completion_signoff', btrim(p_attestation), true,
     v_now, coalesce(v_name, v_email), v_role, v_now::date)
  returning id into v_note;

  v_gates := v_gates || jsonb_build_object('key','signoff','passed',true,
    'note_id', v_note,
    'source','clinician attestation supplied in this transaction',
    'citation','9 CSR 30-3.206(13)');

  -- Transaction-local. The guard trigger below reads it; PostgREST runs each
  -- request in its own transaction and will not pass an arbitrary acs.* GUC
  -- through, so an authenticated session cannot pre-set it and then raw-update.
  perform set_config('acs.completion_gate', p_client_id::text, true);

  update public.clients
     set status       = 'completed',
         completed_at = v_now
   where id = p_client_id;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
  values (v_actor, 'client.completed', 'clients', p_client_id,
          jsonb_build_object(
            'client_id',        p_client_id,
            'program_type',     v_client.program_type,
            'determined_level', v_level,
            'completed_at',     v_now,
            'signoff_note_id',  v_note,
            'actor_role',       v_role,
            'gates',            v_gates));

  return query select p_client_id, v_now, v_note;
end;
$function$;

comment on function public.complete_client(uuid, text) is
  'The ONLY way a client may be recorded as completed. Clinician-only, re-derives '
  'every applicable gate in SQL from client_accrued_hours / placement_determinations / '
  'form_submissions / clients.balance, and raises naming the specific failing gates. '
  'Requires an affirmative attestation, recorded as an immutable completion_signoff '
  'note. Enforced by the clients_guard_completion() trigger.';

revoke all on function public.complete_client(uuid, text) from public;
grant execute on function public.complete_client(uuid, text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. The guard — what makes it a guarantee rather than a check
-- ────────────────────────────────────────────────────────────────────────────

-- FOUR transitions are guarded, not one. The exit gate and the completed_at
-- erasure gate were added after proof step 6.16 showed a hole: guarding only the
-- ENTRY meant an authenticated Therapist could still raw-update
-- status='active' and un-complete a court-facing record with no reason and no
-- audit row — i.e. reopen_client()'s audit trail was advisory, not enforced.
create or replace function public.clients_guard_completion()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_entering boolean;   -- becoming completed
  v_stamping boolean;   -- completed_at being set or moved
  v_leaving  boolean;   -- ceasing to be completed
  v_erasing  boolean;   -- completed_at being cleared
begin
  if TG_OP = 'INSERT' then
    v_entering := (NEW.status = 'completed');
    v_stamping := (NEW.completed_at is not null);
    v_leaving  := false;
    v_erasing  := false;
  else
    v_entering := (NEW.status = 'completed') and (OLD.status is distinct from 'completed');
    v_stamping := (NEW.completed_at is not null) and (OLD.completed_at is distinct from NEW.completed_at);
    v_leaving  := (OLD.status = 'completed') and (NEW.status is distinct from 'completed');
    v_erasing  := (OLD.completed_at is not null) and (NEW.completed_at is null);
  end if;

  if v_entering or v_stamping then
    if coalesce(current_setting('acs.completion_gate', true), '') <> NEW.id::text then
      raise exception
        'Refused: completion is a gated event, not a field. A client can only be recorded as completed through complete_client(client_id, attestation), which re-derives the hours, balance, required-forms and clinician-attestation gates. Direct writes to clients.status / clients.completed_at are refused for every role.'
        using errcode = '42501';
    end if;
  end if;

  -- The exit is gated too. Un-completing a court-facing record is an audited
  -- event with an actor and a reason; without this, an ordinary status edit
  -- reverses a completion and leaves nothing behind saying who, or why.
  -- (Sets the pairing with reopen_client() in 20260802_p0_3 — the two migrations
  --  are applied together and the exit gate is inert without that RPC.)
  if v_leaving then
    if coalesce(current_setting('acs.reopen_gate', true), '') <> NEW.id::text then
      raise exception
        'Refused: a completed client can only be returned to active through reopen_client(client_id, reason), which records who reopened them and why. Editing the status directly is refused for every role.'
        using errcode = '42501';
    end if;
  end if;

  -- completed_at is a historical fact. Nothing legitimate clears it —
  -- reopen_client() deliberately preserves it — so erasing it is refused outright.
  if v_erasing then
    raise exception
      'Refused: clients.completed_at records that a completion WAS issued, on a date, on a document a court may already hold. It is never cleared. Reopening a client preserves it.'
      using errcode = '42501';
  end if;

  return NEW;
end;
$function$;

comment on function public.clients_guard_completion() is
  'Refuses any transition into completed that did not come through '
  'complete_client(). Fires for EVERY role including service_role — unlike RLS, '
  'which service_role bypasses. Only a superuser disabling the trigger gets past it. '
  'Any future seed or migration that needs a completed client must call '
  'complete_client(), or set the acs.completion_gate GUC in the same transaction.';

drop trigger if exists trg_clients_guard_completion on public.clients;
create trigger trg_clients_guard_completion
  before insert or update on public.clients
  for each row execute function public.clients_guard_completion();

commit;
