# Upload break — recon, 2026-08-07

**Read-only. No fix applied.** Proposed SQL is at the bottom, awaiting Dan's approval.

## The break, in one line

`public.uploaded_files` has **no INSERT policy that admits an ACS row**. The file
bytes upload fine; the metadata row is refused; the document vanishes.

## Verbatim reproduction

Signed in as `demo.director@acs-therapyhub.com`, `app_metadata.role = 'Director'`,
through the app's own supabase client (same session the UI uses). Target was a
demo client, not James West's chart.

Step 1 — the metadata insert `storageService.ingestDocument` performs:

```json
{
  "code": "42501",
  "details": null,
  "hint": null,
  "message": "new row violates row-level security policy for table \"uploaded_files\""
}
```

Step 2 — the storage upload that runs *immediately before* it:

```json
{ "storageUpload": "SUCCEEDED — bytes landed" }
```

(probe object removed afterwards; bucket left as found)

So the two halves disagree: **storage accepts, the database refuses.** Every
attempt leaves an orphaned object in the private bucket and shows the user an
error, which is exactly the "I uploaded it and it's gone" report.

## Blast radius, measured

| | |
|---|---|
| objects in `therapyhub-patient-files` | **37** |
| rows in `uploaded_files` for that bucket | **5** |
| last successful metadata row | **2026-06-09 02:50** |
| last storage object written | **2026-08-07 16:31** (today) |

Today's three orphans line up with the call:

| when (UTC) | object | path |
|---|---|---|
| 16:31:06 | `1786120171445_updated_headshot.JPG` | Marcus Reyes |
| 16:30:06 | `1786120111120_updated_headshot.JPG` | Marcus Reyes |
| 16:23:23 | `1786119802493_scan_1786119789527.jpg` | Bela Lugosi |

The 16:23 row is a **scan**, and it orphaned the same way — see "scanner path" below.

## Cause — and yes, it was the hardening

`RECON-acs-2026-07-27.md:173` records the pre-hardening state:

> Policies `uploaded_files_legacy_anon` and `uploaded_files_legacy_authenticated`
> grant **ALL** (select/insert/update/delete) to the `anon` and `authenticated`
> roles for rows where `app_id in ('aiva','acs','attesta','flowvault')`.
> ACS's live client uploads are stored with **`app_id='aiva'`**.

ACS's INSERT was riding on that permissive `app_id='aiva'` legacy policy — the
same one that let **anyone holding the anon key read and alter OCR'd PHI**. It
was correct to kill it. The current set is:

| policy | cmd | admits |
|---|---|---|
| `uploaded_files_aiva_anon` | ALL | anon, `app_id='aiva' AND bucket_id='project-aiva-afridroids'` |
| `uploaded_files_flowview_org_{insert,select,update,delete}` | per-cmd | `app_id='flowview'` + org match |
| `uploaded_files_legacy_authenticated` | **SELECT** | `(bucket_id='therapyhub-patient-files' AND private.is_staff()) OR app_id IN ('attesta','flowvault')` |

The `anon` grant was correctly scoped down to AIVA's own bucket, and the
`authenticated` grant was correctly scoped down to ACS staff — but it was also
narrowed from **ALL to SELECT**, and no INSERT was ever re-granted for ACS. Reads
kept working, which is why nothing looked wrong until someone tried to save.

The **storage** side is fine and needs no change: `tpf_staff_all` grants ALL on
`therapyhub-patient-files` to staff, `tpf_restrict_to_acs_scope` (restrictive)
holds the client↔client isolation, `tpf_client_insert_own` / `tpf_client_read_own`
scope portal clients to their own folder. That layer is doing its job — it is
precisely why the bytes land.

Nothing in `supabase/migrations/` created the `uploaded_files` policies; they were
applied out-of-band against the shared project. The one committed storage
migration (`20260609_storage_rls_tpf_restrict_to_acs_scope.sql`) touches
`storage.objects` only and is **not** the culprit.

## Scanner path — same root cause, not a second one

`components/portal/MobileDocumentUpload.tsx:155` calls the same
`storageService.ingestDocument`. Capture ▸ Upload, the grid drag-drop, Capture ▸
Scan and Capture ▸ Take photo all funnel through that one function
(`services/storageService.ts:214`). One policy gap, four broken entry points.

## Paths that still work — and why they mislead

**Capture ▸ Request from client** (the no-login upload link) is unaffected. The
`acs-request-upload` edge function does its `uploaded_files` insert with the
**service-role key**, which bypasses RLS entirely. So the one path that looks
most fragile is the only one still filing documents — worth knowing before
telling David "uploads are down".

## Also broken, not yet reported

The **client portal** upload (`pages/portal/PortalDocuments.tsx:421` →
`MobileDocumentUpload`) hits the same insert under a client JWT, where
`private.is_staff()` is false. Clients uploading their own documents fail too,
and would keep failing under a staff-only fix. (Portal *reads* are unaffected —
that page lists `form_submissions`, not `uploaded_files`.)

## Proposed minimal fix — NOT APPLIED

Narrower than "restore write access": two INSERT policies, both pinned to the ACS
bucket, no storage change, no `allow_all_authenticated`, nothing made public.
The app performs no UPDATE or DELETE on `uploaded_files`, so none is granted.

```sql
-- Staff may file a document into the ACS bucket. Mirrors the existing
-- SELECT branch of uploaded_files_legacy_authenticated exactly.
create policy "uploaded_files_acs_staff_insert" on public.uploaded_files
  as permissive for insert to authenticated
  with check (
    bucket_id = 'therapyhub-patient-files'
    and private.is_staff()
  );

-- A portal client may file a document into their OWN chart only. Mirrors
-- storage's tpf_client_insert_own, but keyed on hire_id rather than folder.
create policy "uploaded_files_acs_client_insert_own" on public.uploaded_files
  as permissive for insert to authenticated
  with check (
    bucket_id = 'therapyhub-patient-files'
    and hire_id in (select cid from private.my_client_ids() as t(cid))
  );
```

Both are permissive INSERT policies, so they OR with each other and cannot widen
SELECT. The restrictive storage policy is untouched, `anon` gains nothing, and no
other app's rows are reachable (every branch is gated on the ACS bucket).

`hire_id` is `uuid` and `private.my_client_ids()` returns `setof uuid`, so the
comparison is direct — no cast (verified against `information_schema.columns`).

One thing to decide before applying:
1. Whether a portal client should be able to file into their own chart at all,
   or whether that flow should move to the service-role edge function like the
   upload link did. If the latter, ship only the staff policy.

## Cleanup, separate from the fix

37 objects vs 5 metadata rows. Once writes work, the ~32 orphans are invisible to
the app (the grid reads `uploaded_files`) but are real PHI sitting in the bucket.
They need either back-filled metadata rows or deletion — a decision, not a
migration, and out of scope for this pass.
