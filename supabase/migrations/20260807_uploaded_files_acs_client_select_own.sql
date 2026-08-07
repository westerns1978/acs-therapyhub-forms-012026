-- Completes the portal-client upload path. The INSERT policy alone was NOT enough:
-- storageService.ingestDocument does `.insert(row).select().single()`, which emits
-- INSERT ... RETURNING. Postgres applies SELECT policies to RETURNING rows, and a
-- portal client had no SELECT policy on uploaded_files (uploaded_files_legacy_
-- authenticated requires private.is_staff()). The refusal surfaces with the SAME
-- 42501 "new row violates row-level security policy" text as a with-check failure,
-- which is why it read as an INSERT problem.
--
-- Witnessed under `set local role authenticated` with Marcus's JWT claims: the
-- identical INSERT SUCCEEDS with no RETURNING clause and FAILS with one, while both
-- with-check conjuncts (bucket, hire_id in my_client_ids()) evaluate true.
--
-- Scoped to the client's OWN rows in the ACS bucket only -- strictly narrower than
-- the staff SELECT branch, and the exact mirror of storage's tpf_client_read_own
-- (which already lets these clients read their own file BYTES; this only lets them
-- read the metadata row for those same files). Permissive SELECT: it ORs with the
-- existing policy and cannot widen anyone else's access. No UPDATE/DELETE.
--
-- Applied present-then-apply 2026-08-07 via MCP; committed for 1->N replay.

create policy "uploaded_files_acs_client_select_own" on public.uploaded_files
  as permissive for select to authenticated
  using (
    bucket_id = 'therapyhub-patient-files'
    and hire_id in (select cid from private.my_client_ids() as t(cid))
  );
