# P0 completion-gate fixes — what changed, and the proof

**Branch:** `fix/completion-gate-p0`, cut from `main` @ `c54d45b`. **Not merged. Not deployed.**
**Date:** 2026-08-02
**Source:** `docs/qa/e2e-smoke-2026-08.md` (on `test/e2e-smoke` @ `0ee9363`)
**Design:** [`p0-gate1-recon.md`](p0-gate1-recon.md), approved with six rulings.

| Commit | Defect |
|---|---|
| `39f304b` | preflight policy snapshot + rollback migrations (landed **before** any forward apply) |
| `61ce1fb` | **D1** — the completion gate fails open (= smoke **D-1**) |
| `27da35f` | **D2** — "SSN (last 4 digits)" accepts nine (= smoke **D-5**) |
| `0425ce6` | **D3** — completion cannot be reversed (= smoke **D-2**) |

Gates: `npm run lint`, `npm run check:forms`, `npm run check:gate` — all exit 0.

---

## Database state

| | |
|---|---|
| **Applied to `ldzzlndsspkyohvzfiiu`** | `20260802_p0_1_completion_gate.sql`, `20260802_p0_3_reopen_client.sql` |
| **Applied** | `20260802_p0_2_ssn_last4_remediation.sql` — applied 2026-08-03, **0 rows**, see D2 |
| **Rollbacks, committed first** | `20260802_p0_1_rollback_clinical_notes_policy.sql`, `20260802_p0_3_rollback_reopen_client.sql` |
| **PITR** | **NOT enabled.** Daily physical backups, 7-day retention, most recent 2026-08-02 09:49:03Z ⇒ ~14h restore granularity. Dan proceeded on that basis. |

**Applied in two transactions, not one.** The statement was too large for a single tool call. The
split is safe and was chosen deliberately: transaction 1 carried the whole risk surface — the
`clinical_notes` policy split — atomically, together with everything it depends on. Transaction 2
added `complete_client`, the trigger and `reopen_client`, all purely additive. The intermediate
state (policies split, no gate yet) is exactly the pre-existing behaviour.

---

# D1 — the completion gate fails open

## Before

`updateClient` ([api.ts:2404](services/api.ts:2404)) wrote `status='completed'` + `completed_at`
with zero reference to `evaluateProgramCompletion`. The gate lived only where a PDF was *built*
([pdfDocuments.ts:127](services/pdfDocuments.ts:127)), never where the record was *written*, and
`staff_all_clients` (FOR ALL) let any authenticated staff session do it by raw update.

**Reproduced on pre-fix code**, authenticated Therapist, demo client `dc100001` (`is_demo=true`) —
the exact wire call `EditClientModal → updateClient` emits:

```
BEFORE: {"status":"active","completed_at":null,"program_type":"SATOP","balance":0}
accrued hours      : 7
signed determinations: 0 (0 => level not established)
form submissions   : 0 (6 required)
completion_signoff : 0

--- PRE-FIX: authenticated Therapist writes status=completed directly
SUCCEEDED  {"id":"dc100001-...","status":"completed","completed_at":"2026-08-02T23:28:22.512+00:00"}
AFTER : {"status":"completed","completed_at":"2026-08-02T23:28:22.512+00:00"}
```

A SATOP client with **no determination, 7 hours, 0 of 6 required forms and no sign-off**, recorded
as having completed a state-mandated programme. Reverted immediately.

## What changed

**D1 and the sign-off shipped together**, per Dan's sequencing note. D1 alone would have flipped the
P0 from fail-open to fail-closed-always: the sign-off gate reads a `completion_signoff` note that no
code path wrote (smoke D-3), so no client created through the product could ever have completed.

- **`complete_client(client_id, attestation)`** — `SECURITY DEFINER`, clinician-only, re-derives
  hours / counselling floor / minimum duration / required forms / balance in SQL and raises naming
  each failing gate with its real numbers.
- **The attestation is an argument, never a side effect.** Passing the gate does not produce it; a
  token string is refused. Stored verbatim as an immutable `completion_signoff` note carrying actor,
  **role at time of signing** (new `clinical_notes.signed_by_role`), the text, and the signing
  timestamp — never a render-time date.
- **`clients_guard_completion()`** — `BEFORE INSERT OR UPDATE` trigger. Four guarded transitions:
  entry into `completed`, `completed_at` stamping, **exit** from `completed`, and **erasure** of
  `completed_at`.
- **Every programme is gated.** Where Missouri imposes no rule, the applicable gate is settled
  balance + attestation.
- **The TS-only constants moved to the DB** (`satop_level_requirements`, `satop_required_forms`),
  with `npm run check:gate` failing on drift.

## After — refusals, verbatim

**The original reproduction, re-run unchanged:**

```
6.1  POST-FIX — authenticated Therapist writes status=completed directly
REFUSED
  code    : 42501
  message : Refused: completion is a gated event, not a field. A client can only be recorded as
            completed through complete_client(client_id, attestation), which re-derives the hours,
            balance, required-forms and clinician-attestation gates. Direct writes to
            clients.status / clients.completed_at are refused for every role.
```

**`service_role` and `postgres` — the line between a check and a guarantee:**

```
step                              | actor        | outcome | sqlstate | message
6.7 raw UPDATE status=completed   | service_role | REFUSED | 42501    | Refused: completion is a gated event, not a field. …
6.8 raw UPDATE status=completed   | postgres     | REFUSED | 42501    | Refused: completion is a gated event, not a field. …
6.9 INSERT a pre-completed client | postgres     | REFUSED | 42501    | Refused: completion is a gated event, not a field. …
```

RLS is bypassed by `service_role`; the trigger is not. It also refuses the table owner.

**The gate, with a level established and the client genuinely short** — the smoke scenario:

```
6.10  complete_client() as Therapist
REFUSED  code 23514
  Completion refused — 2 gate(s) not met:
    • Hours: 7/10 total (3 remaining).
    • Required forms: 6 of 6 required form(s) unsigned (authorization-release, consent-treatment,
      emergency-contact, hipaa-ack, satop-checklist, telehealth-consent).

6.11  after adding the missing 3 hours
REFUSED  code 23514
  Completion refused — 1 gate(s) not met:
    • Required forms: 6 of 6 required form(s) unsigned (…).
```

**Role, attestation quality, and forgery:**

```
6.3  complete_client() as ADMIN
REFUSED  42501  Only a clinician (Director or Therapist) may attest to a client's completion.
                Your role is Admin.

6.4  complete_client() with attestation "done"
REFUSED  22023  A completion attestation is required. The qualified professional must affirm that
                this client has completed the required programme; the attestation is recorded
                permanently against their name.

6.5  Therapist hand-inserts a completion_signoff note (forgery attempt)
REFUSED  42501  new row violates row-level security policy for table "clinical_notes"
```

That last one is the one that matters most: if a clinician could write the sign-off note by hand,
the gate's own evidence would be self-serviceable and the gate would be theatre. The
`clinical_notes` INSERT policy excludes `note_type='completion_signoff'`, so the note can only come
from `complete_client()`.

## After — the happy path

```
6.12  Every gate genuinely passes.
SUCCEEDED  [{"client_id":"dc100001-…","completed_at":"2026-08-02T23:56:57.164797+00:00",
             "signoff_note_id":"ae7b677e-0dfc-4217-80e1-896977053038"}]

6.13  The attestation recorded
{
  "note_type": "completion_signoff",
  "is_signed": true,
  "signed_at": "2026-08-02T23:56:57.164797+00:00",
  "signed_by_name": "Karen Ventimiglia",
  "signed_by_role": "Therapist",
  "therapist_id": "0859d1d9-bfc6-4b32-b9c5-b1e94e519490",
  "narrative": "I am the qualified professional responsible for this client's care. I have
                reviewed their record and attest that they have completed the requirements of
                SATOP.\n\nReviewed attendance ledger and the signed required-forms set before
                attesting."
}
```

**The certificate still issues.** Built through the app's own engine and PDF builder under an
authenticated Therapist session — and note the TS engine reached the same verdict as the SQL gate,
independently:

```
programLabel : SATOP — Offender Education Program (OEP, Level I)
hasCriteria  : true
eligible     : true
   PASS  Hours — 10/10 hours complete.
   PASS  Balance paid — No outstanding balance.
   PASS  Clinician sign-off — Completion sign-off signed by the qualified professional.
   PASS  Required forms signed — All 6 required forms completed/signed.

CERTIFICATE BUILT — 12447 chars of PDF data URI
```

**`check:gate` proven to fail on drift** — `satopFees.ts` IV changed 75 → 70:

```
check:gate FAILED — 1 disagreement(s) with supabase/migrations/20260802_p0_1_completion_gate.sql.
The migration seed is the single source. Change it there, then bring the TypeScript copies into line.
```

---

# D2 — "SSN (last 4 digits)" accepts and stores a full SSN

## Before

Three things had to be wrong at once, and all three were:

1. The renderer passed `min`/`max` to the `<input>`, where they are **inert on `type="text"`** —
   HTML applies them only to number/date/range. The smoke test measured `maxLength = -1`.
2. `BaseFormTemplate` has **no `<form>` element** and submits from `onClick`, so native constraint
   validation never ran — for anything.
3. The form's own rule was a **floor** (`length < 4`). Nine digits passed it.

The bespoke `<FormField maxLength={4}>` at
[AuthorizationForReleaseForm.tsx:79](components/forms/AuthorizationForReleaseForm.tsx:79) is **dead
code** — the definition exports no `steps`, so `Step1`…`Step4` never mount.

## After

**In the running app** — the direct rebuttal of the `-1` measurement:

```json
{ "found": true, "id": "ssn", "type": "text", "label": "SSN (last 4 digits)*",
  "maxLength": 4, "minAttr": null, "maxAttr": null }
```

**The composed check the app actually runs** (`requiredFieldErrors` + `lengthFieldErrors` +
`validateStep`):

```
field definition : {"id":"ssn","label":"SSN (last 4 digits)","type":"text","required":true,"min":4,"max":4}

ssn="000000000"     len= 9  BLOCKED  "Enter the LAST 4 DIGITS only — not the full Social Security number."
ssn="444-56-4444"   len=11  BLOCKED  "Enter the LAST 4 DIGITS only — not the full Social Security number."
ssn="12345"         len= 5  BLOCKED  "Enter the LAST 4 DIGITS only — not the full Social Security number."
ssn="123"           len= 3  BLOCKED  "Enter the LAST 4 DIGITS only — not the full Social Security number."
ssn=""              len= 0  BLOCKED  "Last 4 digits of SSN required."
ssn="0000"          len= 4  accepted
ssn="4444"          len= 4  accepted
```

**Reject, never truncate** — a client typing nine digits is told, not silently edited underneath.

`check:forms` caught two real things when the rule landed, both fixed: its `compose()` was modelling
a validator the app no longer runs, and its producible-value model offered an over-length candidate
the capped renderer can no longer emit.

## The migration awaiting approval

`20260802_p0_2_ssn_last4_remediation.sql` — **NOT APPLIED, affects 0 rows.** Verified by aggregate,
no values selected:

```sql
select count(*) filter (where data ? 'ssn')             as has_ssn_key,  -- 0
       count(*) filter (where length(data->>'ssn') > 4) as over_length,  -- 0
       count(*)                                         as total         -- 8
  from public.form_submissions;
```

Idempotent; truncates digits-first so a formatted value yields the real last four; writes one
`audit_logs` row per affected row recording the prior **length**, never the value; refuses to commit
if any repairable row remains.

## The fixture SSN

**Provenance, as asked.** The value sat in **three** tracked files, not one —
`form-submissions-ground-truth.json:10`, `row-47431370.json`, and
`printpreview-47431370.baseline.html` — all introduced by `5dba765` (2026-07-16). The surrounding
record is one of three documented synthetic personas ("Travis Becker", `TBecker@gomail.com`, phone
`111-222-1111`, DOB `2000-01-01`); the integrity gate's own docblock calls them test personas with
fake contact values, and the two *other* `authorization-release` rows in the same file correctly
carry `"1234"`. The row is absent from the live database.

**Scrubbed to `0000`, not `000-00-0000`** — Dan's ruling accepted my reasoning: that value is itself
an over-length entry in a last-4 field, would have kept the fixture failing the very rule this
commit adds, and would have forced the integrity gate to record a violation as an expected "known
block".

**No history rewrite** — agreed on all three grounds, especially that `5dba765` lands on the Attesta
fork date, so a rewrite would break that fork's shared ancestry. **Worth someone checking whether
Attesta carries the same fixture.**

---

# D3 — completion cannot be reversed through the UI

## Before

Two independent causes; the smoke report named one.

1. The Status `<Select>` was driven by the **display label**. `completed` maps to "Successful Dx",
   not an option, so a completed client rendered as "Active"; re-picking "Active" fired no change
   event ([EditClientModal.tsx:238](components/clients/EditClientModal.tsx:238), [:117](components/clients/EditClientModal.tsx:117)).
2. **[api.ts:2443](services/api.ts:2443) coerced `'active'` back to `'completed'`** for any client
   carrying a `completed_at`. Even a correctly-wired Select could not have reactivated one.

## What changed

`reopen_client(client_id, reason)` — clinician-only, refuses a reason under 10 characters, writes an
append-only `audit_logs` row naming actor, role, reason and the prior `completed_at`. The Select is
now driven by the **stored value** with value/label pairs; "Completed" is gone from its options
(D1.5); a completed client shows a read-only status plus an explicit **Reopen client** action.

## A gap my own fix had, found while proving it

Proof step 6.16 showed the D1 trigger guarded only *entry* into `completed`. A raw `status='active'`
write by an authenticated Therapist **succeeded** and un-completed the client with no reason and no
audit row — `reopen_client`'s audit trail was advisory, not enforced:

```
6.16  Raw UPDATE status=active by authenticated Therapist  (BEFORE the exit gate)
*** SUCCEEDED *** {"id":"dc100001-…","status":"active"}
```

Fixed rather than reported as partial. The trigger now guards four transitions. Re-run:

```
6.16b  Raw UPDATE status=active by an authenticated Therapist
REFUSED  42501  Refused: a completed client can only be returned to active through
                reopen_client(client_id, reason), which records who reopened them and why.
                Editing the status directly is refused for every role.

6.16c  Raw attempt to ERASE completed_at
REFUSED  42501  Refused: clients.completed_at records that a completion WAS issued, on a date, on a
                document a court may already hold. It is never cleared. Reopening a client
                preserves it.

row after both bypass attempts: {"status":"completed","completed_at":"2026-08-02T23:59:17.496212+00:00"}
```

## After

```
6.17  reopen_client() as ADMIN
REFUSED  42501  Only a clinician (Director or Therapist) may reopen a completed client.
                Your role is Admin.

6.18  reopen_client() with reason "oops"
REFUSED  22023  A reason is required to reopen a completed client. It is recorded permanently
                against your name and is the only explanation the record will carry.

6.19  reopen_client() properly
*** SUCCEEDED *** [{"status":"active","prior_completed_at":"2026-08-02T23:59:17.496212+00:00"}]

6.20  {"status":"active","completed_at":"2026-08-02T23:59:17.496212+00:00","archived_at":null}
```

`completed_at` **preserved**, as designed. The audit trail:

```
client.completed  @ 2026-08-02T23:56:57Z  actor=0859d1d9…  role=Therapist
   determined_level      : I
   signoff_note_id       : ae7b677e-0dfc-4217-80e1-896977053038
   gates                 : ["hours=true","forms=true","payment=true","signoff=true"]

client.reopened   @ 2026-08-02T23:59:18Z  actor=0859d1d9…  role=Therapist
   reason                : Court returned the completion packet: the OEP attendance ledger needs a
                           corrected session date before this completion can stand.
   prior_completed_at    : 2026-08-02T23:59:17.496212+00:00
   completed_at_preserved: true
```

**The attestation survives the reopen** — 2 `completion_signoff` notes still on file after it.
Reopening does not make it untrue that the attestation was made.

---

# Step 5 — David's Monday, checked before anything else

The `clinical_notes` policy split was the only change that could break a clinician's daily work, so
it was gated: a verbatim `pg_policies` snapshot and a self-verifying rollback migration were
committed **before** the forward apply, and the daily path was proved immediately after.

```
PASS  clinician can READ clinical_notes  rows=22
PASS  clinician can WRITE an ordinary note (note_type=Session)
PASS  the note PERSISTS and reads back
PASS  clinician can UPDATE/sign an ordinary note  is_signed=true
PASS  Admin (office role) still sees ZERO clinical_notes  rows=0
PASS  Admin still cannot INSERT a clinical note  new row violates row-level security policy…
PASS  probe note DELETED (ordinary notes remain deletable)

=== STEP 5 PASSED — daily path intact ===
```

Ordering the policy dump first paid for itself: it exposed that my four replacement policies carried
**no `TO` clause**, so they would have defaulted to `PUBLIC` where the policy they replace is scoped
to `{authenticated}`. Fixed before it was applied. That defect would have shipped had the rollback
been written from memory.

---

# What the fix does NOT cover

1. ~~The attestation modal was not click-tested.~~ **Done 2026-08-03** — driven end to end through
   the authenticated UI, including the refusal case, and re-verified on the live site after deploy.
   See "The attestation modal, click-tested" below. Screenshots could not be captured (the Browser
   pane was not compositing); rendered DOM text was substituted.
2. **Anyone who can drop the trigger can still write `status='completed'`.** A superuser, or
   `session_replication_role='replica'`. This is a guarantee against the application and against
   `service_role`, not against someone with the keys to the database.
3. **`archived_at` is only half-orthogonal to `status`** (decision 4). The coercion is gone and
   unarchiving can no longer restore a completion — the *second* clause of your instruction is fully
   met. The *first* ("archiving must not touch status") is not: `status='archived'` remains the
   storage representation, because changing that reaches `getClients`, every filter chip, `ClientList`
   and the badge palette. Not done here; not refactored around.
4. **The whole form system's other declared constraints are still decorative.** There is no `<form>`
   element, so nothing native validates: the 15 `rating` fields' `max:5` is enforced nowhere, and the
   5 `type:'email'` fields have no format check anywhere. `lengthFieldErrors` now covers min/max
   generically, which closes the rating ceiling, but email format remains unenforced. Named in the
   Gate 1 report; out of scope here.
5. **A form is still "signed" by typing a name** (smoke D-12). The required-forms gate counts a
   submission a staff member filled in on the client's behalf. The gate is now enforced in SQL, but
   what it counts is unchanged — the SAMPLE banner remains the honest signal.
6. **Three TypeScript derivations of "the current determination" are still three.** The gate reuses
   `private.current_determined_level()` (shared with `my_progress()`) rather than adding a fourth, and
   `my_progress()` lost its inline copy — but `currentLevelFromRows` and `AssessmentTab`'s `useMemo`
   remain. Repointing TS at the shared function is follow-up work, not a refactor to do mid-P0.
7. **`complete_client` is not exercised for a non-SATOP programme.** The rule (balance + attestation)
   is implemented and reviewed but the only end-to-end run was SATOP Level I.

---

# The attestation modal, click-tested (2026-08-03)

The only piece of this fix a human touches. Driven end to end through the authenticated UI as a
Therapist against `dc100001` (`is_demo=true`), with real mouse and keyboard input.

**Screenshots could not be captured** — the Browser pane was not compositing frames, so
`computer{action:"screenshot"}` timed out every attempt. Substituted rendered DOM text captured from
the live page, which is more checkable than an image, but it is a substitution and worth saying so.

| # | Case | Result |
|---|---|---|
| 1 | Modal opens from the completion nudge | Renders portalled to `body`, titled "Attest to completion", showing the attestation prose, the 9 CSR 30-3.206(13) citation, and "Signing as Karen Ventimiglia · Therapist" |
| 2 | Submit with no attestation text | **Refused** — "Sign and complete" is `disabled`, with "20 more character(s) required — there is no default text." |
| 3 | Submit with attestation, client fails a gate | **Refused, with the real numbers** (below) |
| 4 | Submit with attestation, client passes | **Completed** — attestation recorded, grid flipped to "Successful Dx" |
| 5 | Admin | **0 nudges rendered**, and the RPC refuses regardless |

**Case 3 is the interesting one.** The modal is only reachable *from* the nudge, and the nudge only
appears when the client is already eligible — so a clinician can normally only open it on a client
who passes. To exercise the refusal I removed a required form **while the modal was open**, which is
exactly the race the server-side gate exists for: the UI decided eligibility at render, the data
changed, and the clinician pressed submit. What they saw, in the modal:

```
Completion refused — 1 gate(s) not met:
  • Required forms: 1 of 6 required form(s) unsigned (emergency-contact).
```

The modal stays open with the typed statement preserved. Restoring the form and pressing submit
again completed the client, recording:

```
signed_by_name : Karen Ventimiglia
signed_by_role : Therapist
signed_at      : 2026-08-03T00:18:17.656702+00:00
narrative      : I am the qualified professional responsible for this client's care. I have
                 reviewed Marcus Reyes's record and I attest that they have completed the
                 requirements of SATOP. I understand this attestation is recorded permanently
                 against my name and cannot afterwards be edited or deleted.

                 Reviewed the attendance ledger and the signed required-forms set for this
                 client before attesting.
```

**On the Admin result, precisely:** the nudge is not offered because the eligibility probe calls
`fetchCompletionSignoff`, which reads `clinical_notes` — a table Admin cannot read — so the probe
returns false and the client is never marked eligible. That is *incidental* rather than an explicit
role check on the nudge, but it fails **closed**, and `complete_client` refuses an Admin on its own
terms anyway. Worth knowing the reason rather than assuming the UI is role-gated here.

No UI defects were found; nothing needed fixing at that layer.

---

# Post-deploy verification against the live site

Deployed with `npm run deploy` (never a bare `firebase deploy`). The predeploy guard confirmed the
target before upload:

```
[predeploy-guard] OK — DEPLOY_TARGET + firebase.json both 'acs-therapyhub'.
+ hosting[acs-therapyhub]: release complete
Hosting URL: https://acs-therapyhub.web.app
```

All four checks run against **`https://acs-therapyhub.web.app`**, signed in through the app's own
login form as `demo.therapist@acs-therapyhub.com` (the demo account is not iVALT-enrolled, so the
phone step never fires). Served bundle: `/assets/index-a9gP9Cq9.js`.

| Check | Result |
|---|---|
| Attestation modal renders | **Yes** — full attestation prose, signer line, submit `disabled` with no text |
| "Completed" gone from the Edit Client status Select | **Yes** — options are exactly `[{active, "Active"}, {archived, "Archived"}]`; value/label pairs, not labels |
| An ordinary clinical note still saves | **Yes** — `POST /clinical_notes` `note_type='Session'` → **201**, from the live origin with the session the live app itself established. Probe deleted (200). |
| A forged attestation is still refused from the live origin | **403** — `new row violates row-level security policy for table "clinical_notes"` |

The full clinician daily-path suite was also re-run against production: read 25 notes, write, persist,
sign, Admin sees zero, Admin cannot insert, probe deleted. **7 of 7 PASS.**

One thing to know: the live site had **demo data hidden** for this browser profile
(`acs-show-demo-rows:<uid>` unset, default OFF), so only the 2 real clients showed until I enabled it.
That is correct behaviour, not a defect — but it means the demo clients are invisible on a fresh
browser until Settings → Show demo data is turned on.

---

# Named debt — decision 6, `program_end_date`

`completed_at` is authoritative. `program_end_date` was **not** written in this pass, per your
ruling. Recording the debt so it is not rediscovered:

- Nothing writes `program_end_date`. Verified three ways: absent from `CLIENT_UPDATE_COLUMNS`, absent
  from the INSERT mapper, and **0 of 13 rows non-null**.
- It has **two readers**, and both should be repointed at `completed_at` in the Completion Packet work:
  1. the certificate's **Completion Date** field ([pdfDocuments.ts](services/pdfDocuments.ts)) — prints blank today;
  2. the **SROP 90-day minimum-duration end anchor** (`toFacts` → `facts.completionDate` →
     [complianceEngine.ts:156](services/complianceEngine.ts:156)) — so that gate currently always
     measures to *now* rather than to the completion date.
- The new SQL gate deliberately does **not** read it: `complete_client` measures duration to `now()`,
  because a client being completed today ends today.

# Named debt — `archived_at` is only half-orthogonal

Decision 4 had two clauses. The second is fully met, the first is not.

- **Met:** the `completed_at ⇒ status='completed'` coercion is deleted, status is never inferred from
  a timestamp, and the archive → unarchive back door is closed — the trigger now refuses any exit
  from `completed` that did not come through `reopen_client()`, and refuses erasing `completed_at`
  outright.
- **Not met:** `status='archived'` remains the storage representation of "archived", so archiving
  still writes `status`. Making `archived_at` a genuinely independent axis reaches `getClients`
  (which filters `status='archived'` query-side and is the single choke-point every picker inherits),
  the six lifecycle filter chips, `ClientList`'s status dropdown, and the badge palettes in
  `ClientProfileHeader` and `ClientSelectionGrid`. That is a lifecycle-vocabulary change, not a P0
  fix, and it was not attempted here.

---

# Attesta fork — does it carry the same fixture SSN?

**No. Checked read-only; nothing in that repo was changed.**

`C:\Users\dlwes\Documents\WestFlow\attesta` @ `9c3ba7c`:

| Check | Result |
|---|---|
| `scripts/fixtures/` — the ground-truth file, `row-47431370.json`, the PrintPreview baseline | **Absent.** No fixture files tracked at all. |
| Any `NNN-NN-NNNN`-shaped literal in any tracked file | **None.** |
| Commit `5dba765` (which introduced the fixture here, 2026-07-16) | **Not in Attesta's history** — the fork point predates it. |

So the fork does **not** inherit the value, and the scrub not reaching it costs nothing.

**But it does inherit the defect.** `components/forms/AuthorizationForReleaseForm.tsx:133` in Attesta
still declares `{ id: 'ssn', label: 'SSN (last 4 digits)', type: 'text', required: true, min: 4, max: 4 }`
with, presumably, the same inert enforcement — so its SSN field will accept nine digits exactly as
this one did, on its own Supabase project. **Reported, not touched.** Porting D2 there is a decision
for whoever owns Attesta.

---

# Fixtures, residue, and the counts

Every fixture was created on `dc100001-…0001` — **`is_demo = true`**. No real client row was written
to at any point (2 non-demo clients, both still `active`).

| Fixture | Torn down? |
|---|---|
| 6 × `form_submissions` (the required core) | **Yes** — removed 6 |
| 1 × `appointments` (180 min education) | **Yes** — removed 1 |
| 1 × `assessment_inputs` | **No** — FK-pinned by the determination |
| 1 × `placement_determinations` (signed Level I) | **No** — `permission denied`, append-only by design |
| 2 × `completion_signoff` notes | **No** — immutable by design (this commit made them so) |
| `clients.completed_at` on `dc100001` | **No** — preserved by design; now un-erasable |

Teardown was attempted **as the authenticated Therapist, without owner privilege**, exactly as the
application would. What the append-only chain refused was left in place rather than forced through
`postgres` — consistent with the smoke run's precedent.

**Offer:** I can remove the determination, its `assessment_inputs` row, the two attestations and the
residual `completed_at` via owner privilege, which the application can never do. I did not, because
quietly deleting from append-only clinical tables to keep a test tidy is a habit worth not forming.
Your call.

**Counts, before and after:**

| | Before | After |
|---|---|---|
| clients | 13 | **13** |
| clients with `status='completed'` | **0** | **0** |
| clients with `completed_at` non-null | 0 | 1 *(the reopened fixture)* |
| non-demo clients | 2 | 2, **all still `active`** |

**No existing completed client was broken, because there were none.** Every row was `active` with
`completed_at IS NULL` before this work, which is why the trigger could be added without a backfill.

**Smoke residue row is untouched:**

```
12a6ac18-9f49-4f3c-96a7-79135af004dc
  status=active  is_demo=true  case=SMOKE-2026-08-02
  completed_at=null  archived_at=null
  determinations=1  assessment_inputs=1  clinical_notes=0
  audit rows: 3 of 3 expected still present
```

---

# If it needs to come out

```bash
# restores clinical_notes exactly, verified against the snapshot inside the transaction
psql "$DB" -f supabase/migrations/20260802_p0_1_rollback_clinical_notes_policy.sql
psql "$DB" -f supabase/migrations/20260802_p0_3_rollback_reopen_client.sql
git revert 0425ce6 27da35f 61ce1fb
```

Section 1 of the first file is standalone: if the only problem is note access, that section alone is
the fix. Neither rollback deletes an attestation or an audit row, and neither un-completes anybody.
