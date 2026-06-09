-- ACS PHI moved into the PRIVATE `therapyhub-patient-files` storage bucket (read via signed URLs).
-- Storage RLS on storage.objects, scoped to this bucket only — mirrors the WS0 table-RLS model
-- (private.is_staff() / private.my_client_ids()). anon gets no policy -> 0 access.
-- Path convention: clients/<clientId>/<file>  => (storage.foldername(name))[2] = clientId.
-- Applied present-then-apply 2026-06-08 via MCP; committed here for 1->N replay.

create policy "tpf_staff_all" on storage.objects for all to authenticated
  using (bucket_id = 'therapyhub-patient-files' and private.is_staff())
  with check (bucket_id = 'therapyhub-patient-files' and private.is_staff());

create policy "tpf_client_read_own" on storage.objects for select to authenticated
  using (bucket_id = 'therapyhub-patient-files'
         and (storage.foldername(name))[2] in (select cid::text from private.my_client_ids() as t(cid)));

create policy "tpf_client_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'therapyhub-patient-files'
              and (storage.foldername(name))[2] in (select cid::text from private.my_client_ids() as t(cid)));
