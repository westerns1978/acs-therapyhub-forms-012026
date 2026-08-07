-- ACS upload break: uploaded_files had no INSERT policy admitting an ACS row.
-- Storage accepted the bytes (tpf_staff_all); the metadata insert failed 42501,
-- so every upload since 2026-06-09 orphaned a file in the private bucket.
-- Cause: the pre-hardening uploaded_files_legacy_authenticated was an ALL grant
-- keyed on app_id='aiva' (the same policy that exposed OCR'd PHI to anon). It was
-- correctly narrowed to SELECT, but ACS's INSERT was never re-granted.
-- Full recon: RECON-upload-break-2026-08-07.md
--
-- Both policies are PERMISSIVE and INSERT-only, pinned to the ACS bucket. They OR
-- with each other and cannot widen SELECT. Storage RLS is untouched. anon gains
-- nothing. No UPDATE/DELETE is granted -- the app performs neither.
--
-- Applied present-then-apply 2026-08-07 via MCP; committed for 1->N replay.
-- Witnessed on all four entry points (staff upload, drag-drop, scanner, portal
-- client under a client JWT) with each row read back from uploaded_files.

create policy "uploaded_files_acs_staff_insert" on public.uploaded_files
  as permissive for insert to authenticated
  with check (
    bucket_id = 'therapyhub-patient-files'
    and private.is_staff()
  );

-- A portal client may file into their OWN chart only. Mirrors storage's
-- tpf_client_insert_own, but keyed on hire_id rather than the object folder.
-- hire_id is uuid and private.my_client_ids() returns setof uuid -- no cast.
create policy "uploaded_files_acs_client_insert_own" on public.uploaded_files
  as permissive for insert to authenticated
  with check (
    bucket_id = 'therapyhub-patient-files'
    and hire_id in (select cid from private.my_client_ids() as t(cid))
  );
