-- ============================================================================
-- P0 · D3 — a completed client could not be returned to Active through the UI.
--
-- Two independent causes, both fixed in this commit:
--
--   1. EditClientModal drove its Status <Select> by the DISPLAY LABEL
--      (CLIENT_STATUS_LABELS[status]). 'completed' maps to "Successful Dx",
--      which was not one of the options, so a completed client silently rendered
--      as "Active"; re-picking "Active" fired no change event and nothing was
--      ever written. (Fixed client-side — the Select is now driven by the stored
--      value with value/label pairs.)
--
--   2. services/api.ts:updateClient coerced 'active' back to 'completed' for any
--      client carrying a completed_at. Even a correctly-wired Select could not
--      have reactivated one. (Deleted client-side in this commit.)
--
-- But the deeper point is that reversing a completion is not a field edit. A
-- court-facing record recorded a client as having finished a state-mandated
-- programme; undoing that is an event with an actor and a reason. Hence this RPC
-- rather than a wider status dropdown.
--
-- completed_at is PRESERVED on the row and its prior value is carried into the
-- append-only audit entry. It is a historical fact — the completion WAS recorded,
-- on a date, on a document a court may already hold. Clearing it would destroy
-- that. The consequence, stated so nobody trips over it later: `completed_at IS
-- NOT NULL` no longer means "is completed". Every existing reader was checked —
-- isArchiveEligible (ClientSelectionGrid.tsx) tests status='completed' AND
-- completed_at, so it stays correct; nothing else reads completed_at as a
-- lifecycle predicate.
--
-- APPLIED to ldzzlndsspkyohvzfiiu 2026-08-02 on Dan's explicit go (PITR add-on is NOT
-- enabled: daily physical backups only, 7-day retention, ~14h granularity). The
-- clinical_notes policy split was gated on a committed verbatim pg_policies
-- snapshot + a self-verifying rollback migration, both landed BEFORE this ran.
-- ============================================================================

begin;

create or replace function public.reopen_client(
  p_client_id uuid,
  p_reason    text
)
returns table (client_id uuid, status text, prior_completed_at timestamptz)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor  uuid := auth.uid();
  v_role   text := auth.jwt() -> 'app_metadata' ->> 'role';
  v_client public.clients%rowtype;
begin
  if v_actor is null then
    raise exception 'You must be signed in to reopen a client.' using errcode = '42501';
  end if;
  -- Same bar as attesting to the completion. An office Admin can edit contact and
  -- billing details; un-completing a court-facing clinical record is not that.
  if not private.is_clinician() then
    raise exception
      'Only a clinician (Director or Therapist) may reopen a completed client. Your role is %.',
      coalesce(v_role, 'unknown')
      using errcode = '42501';
  end if;

  if p_reason is null or length(btrim(p_reason)) < 10 then
    raise exception
      'A reason is required to reopen a completed client. It is recorded permanently against your name and is the only explanation the record will carry.'
      using errcode = '22023';
  end if;

  select * into v_client from public.clients where id = p_client_id;
  if not found then
    raise exception 'Client not found.' using errcode = 'P0002';
  end if;
  if v_client.status is distinct from 'completed' then
    raise exception 'This client is not recorded as completed (status: %). There is nothing to reopen.',
      v_client.status using errcode = '22023';
  end if;

  -- Transaction-local, read by clients_guard_completion()'s exit gate. Without it
  -- the UPDATE below is refused — which is the point: an ordinary status edit
  -- cannot reverse a completion, only this RPC can, and only after recording why.
  perform set_config('acs.reopen_gate', p_client_id::text, true);

  -- completed_at deliberately untouched; archived_at cleared because an active
  -- client is not archived. The completion_signoff attestation is NOT retracted —
  -- it is immutable, and it remains true that it was made.
  update public.clients
     set status      = 'active',
         archived_at = null
   where id = p_client_id;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
  values (v_actor, 'client.reopened', 'clients', p_client_id,
          jsonb_build_object(
            'client_id',               p_client_id,
            'reason',                  btrim(p_reason),
            'actor_role',              v_role,
            'prior_status',            'completed',
            'prior_completed_at',      v_client.completed_at,
            'prior_program_end_date',  v_client.program_end_date,
            'completed_at_preserved',  true));

  return query select p_client_id, 'active'::text, v_client.completed_at;
end;
$function$;

comment on function public.reopen_client(uuid, text) is
  'Return a completed client to active. Clinician-only, requires a reason, and '
  'writes an append-only audit_logs row naming the actor, the reason and the prior '
  'completed_at. Reversing a completion is an audited event, not a field edit. '
  'completed_at is preserved on the row; the completion_signoff attestation is '
  'immutable and is never retracted.';

revoke all on function public.reopen_client(uuid, text) from public;
grant execute on function public.reopen_client(uuid, text) to authenticated;

commit;
