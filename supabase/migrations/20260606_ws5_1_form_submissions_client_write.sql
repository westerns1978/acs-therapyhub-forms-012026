-- WS5 Phase 1 — scoped CLIENT-WRITE on public.form_submissions.
--
-- WHY (the load-bearing gap): form_submissions had only two policies —
--   client_self_read (SELECT, client_id IN private.my_client_ids())
--   staff_all        (ALL,    private.is_staff())
-- A real portal Client (role 'Client', NOT staff) therefore could NOT INSERT or
-- UPDATE their own submission: the SELECT policy is read-only and staff_all fails
-- is_staff() for a client. So the "client fills + signs a form" round-trip only ever
-- worked inside a STAFF session; an authenticated Client's submit is RLS-denied
-- (42501). This is why the forms round-trip looked real but wasn't, for clients.
--
-- This adds the missing WRITE — scoped and fail-closed:
--   • a Client may INSERT a row ONLY for themselves (with check my_client_ids());
--   • a Client may UPDATE ONLY their own rows, and may NOT reassign to another client
--     (both USING and WITH CHECK pinned to my_client_ids());
--   • NO client DELETE (clients never delete submissions);
--   • staff retain full control via the existing staff_all policy;
--   • SELECT is unchanged (existing client_self_read).
--
-- Same predicate as the WS0 client_self_read policy (private.my_client_ids()), now for
-- INSERT + UPDATE. No new columns and no new table — Option A: standalone signables
-- (HIPAA ack, Telehealth Consent, Late Cancellation) fold into form_submissions as
-- single-signature forms; signatures persist in form_submissions.data as they already do.
--
-- STATUS GUARD: the cert gate (WS5 Phase 2) trusts status IN ('completed','reviewed').
-- 'completed' is legitimately client-set (the client signing their form IS the 3.206(13)(F)
-- compliance event). 'reviewed' is a STAFF attestation — written only by the staff review
-- panel (ClientSubmissionsPanel). A client must never author or alter it, so the client
-- policies forbid 'reviewed' on both the pre- and post-image:
--   • INSERT  WITH CHECK no 'reviewed'        → client cannot author a reviewed row;
--   • UPDATE  USING      no 'reviewed' (pre)  → client cannot touch a row staff already
--                                               reviewed (post-review tamper lock);
--   • UPDATE  WITH CHECK no 'reviewed' (post) → client cannot flip their row to reviewed.
-- status is free-text and mixed-case in the data ('Completed' vs 'completed'), so the guard
-- is case-insensitive via lower(); NULL status (lower(NULL)=NULL) is "distinct from" and
-- thus allowed. status is `text` (not an enum) — no cast needed.

-- INSERT: a client may create a submission row ONLY for one of their own client_ids,
-- and may not author the staff-only 'reviewed' attestation.
drop policy if exists client_self_insert_form_submissions on public.form_submissions;
create policy client_self_insert_form_submissions on public.form_submissions
  for insert to authenticated
  with check (
    client_id in (select private.my_client_ids())
    and lower(status) is distinct from 'reviewed'
  );

-- UPDATE: a client may update ONLY their own rows (USING), the post-image must still be
-- their own row (WITH CHECK, cannot reassign), and 'reviewed' is locked on BOTH images
-- (cannot modify a staff-reviewed row; cannot set status to reviewed).
drop policy if exists client_self_update_form_submissions on public.form_submissions;
create policy client_self_update_form_submissions on public.form_submissions
  for update to authenticated
  using (
    client_id in (select private.my_client_ids())
    and lower(status) is distinct from 'reviewed'
  )
  with check (
    client_id in (select private.my_client_ids())
    and lower(status) is distinct from 'reviewed'
  );
