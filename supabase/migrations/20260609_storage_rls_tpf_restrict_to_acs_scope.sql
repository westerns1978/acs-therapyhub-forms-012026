-- ACS PHI client↔client isolation on the private bucket.
-- A pre-existing PROJECT-WIDE permissive policy `allow_all_authenticated` (ALL / authenticated / USING true)
-- grants every authenticated user access to every object in every bucket, overriding tpf_client_read_own.
-- This RESTRICTIVE policy ANDs with the permissive set, so it only TIGHTENS access on
-- therapyhub-patient-files; the `bucket_id <> ...` escape hatch makes it a no-op for every OTHER bucket
-- (shared policy + other apps unaffected). On the ACS bucket: access requires staff OR own-client folder.
-- Applied present-then-apply 2026-06-09 via MCP; committed for 1->N replay. Witnessed: staff resolve all;
-- portal client Pat resolves her own but is DENIED on Marcus's file; anon 0.
create policy "tpf_restrict_to_acs_scope" on storage.objects
  as restrictive for all to authenticated
  using (
    bucket_id <> 'therapyhub-patient-files'
    or private.is_staff()
    or (storage.foldername(name))[2] in (select cid::text from private.my_client_ids() as t(cid))
  );
