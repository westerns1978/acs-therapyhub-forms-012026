# P0 completion-gate fixes — GATE 1 recon + design

**Branch:** `fix/completion-gate-p0`, cut from `main` @ `c54d45b`
**Date:** 2026-08-02
**Source report:** `docs/qa/e2e-smoke-2026-08.md` (lives on `test/e2e-smoke` @ `0ee9363`, not on `main`)
**Scope:** three defects only — D1 (= smoke **D-1**), D2 (= smoke **D-5**), D3 (= smoke **D-2**).
**Status:** recon + design. **Nothing built. No migration applied. No deploy.**

Every DB fact below came from read-only structure/aggregate queries against
`ldzzlndsspkyohvzfiiu`. No client row values were selected.

---

## Live-database facts that change the shape of all three fixes

| Fact | Query result | Why it matters |
|---|---|---|
| **Every client row is `status='active'`** | `clients` group-by status → one row: `active`, n=13 | There are **zero** currently-completed clients. A guard trigger + backfill is safe today; the "no existing completed client is broken" check is trivially provable. |
| **`completed_at` non-null: 0** | same query | Nothing to preserve or migrate. |
| **`program_end_date` non-null: 0 of 13** | same query | Confirms the smoke finding: the column has no writer anywhere. |
| **No triggers on `public.clients`** | `pg_trigger` where `tgrelid='clients'` → `[]` | The guard trigger is a clean add — nothing to compose with. |
| **`clients` RLS = one FOR-ALL staff policy** | `staff_all_clients`: `USING private.is_staff()`, `WITH CHECK private.is_staff()` | Any authenticated Director/Therapist/Admin can raw-`UPDATE` `status='completed'`. RLS cannot express the gate; **this is the bypass to close.** |
| **`form_submissions` = 8 rows, all `emergency-contact`** | `group by form_id` over `jsonb_object_keys` | **Zero rows carry an `ssn` key.** D2's remediation migration affects **0 rows**. |
| **`clinical_notes.note_type` has no CHECK** | only `clinical_notes_units_valid` exists | `completion_signoff` is insertable without a constraint change. |
| **`audit_logs` is append-only + staff-scoped** | `audit_logs_insert_staff` (`is_staff() AND user_id = auth.uid()`), `audit_logs_select_staff` | A `SECURITY DEFINER` RPC can write the reopen/completion event; the direct-insert policy still forces `user_id = auth.uid()`. |

---

# D1 — the completion gate fails open

## (a) Every code path that can write `clients.status='completed'` or `completed_at`

**There is exactly one writer in the whole codebase: `updateClient`.**
`grep "from('clients')"` filtered to `update|insert|upsert|delete` returns **zero** direct
writes outside `services/api.ts`.

| # | Path | Location | Gated? |
|---|---|---|---|
| 1 | **`updateClient`** — the only function that writes `status`/`completed_at` | [api.ts:2404](services/api.ts:2404); the stamps at [:2436-2444](services/api.ts:2436) | **NO gate of any kind.** |
| 2 | **Edit Client modal** → `updateClient(client.id, changes)` | [EditClientModal.tsx:119](components/clients/EditClientModal.tsx:119), status included at [:117](components/clients/EditClientModal.tsx:117) when it differs | **NO.** This is the D1 hole. |
| 3 | **Completion nudge** → `updateClient(id, { status: 'completed' })` | [ClientSelectionGrid.tsx:398](components/clients/ClientSelectionGrid.tsx:398) | **YES, correctly.** Candidate filter at [:344-348](components/clients/ClientSelectionGrid.tsx:344) then the real `assessClient(...).completion.eligible` at [:361](components/clients/ClientSelectionGrid.tsx:361); the `catch` returns `false` — **fails closed**. |
| 4 | **`placeAndActivate`** → `updateClient(id, { program, status: 'active' })` | [api.ts:321](services/api.ts:321) | Writes `'active'`, never `'completed'` — but see the coercion below. |
| 5 | **Bulk actions** | none exist | — |
| 6 | **RPCs** | the only client-facing RPCs are `acs_report_*`, `my_progress` | none writes `clients`. |
| 7 | **Edge functions** | `acs-intake-submit` hardcodes `status:'prospect'` ([index.ts:67](supabase/functions/acs-intake-submit/index.ts:67)), explicitly never spread from the body | safe by construction. |
| 8 | **Raw SQL / PostgREST as an authenticated staff session** | `staff_all_clients` FOR ALL | **NO.** Unrestricted. |

**An additional cause the smoke report did not name.** [api.ts:2443](services/api.ts:2443):

```ts
} else if (row.status === 'active') {
    if ((before as any)?.completed_at) row.status = 'completed';
    row.archived_at = null;
}
```

`updateClient` **silently rewrites `'active'` back to `'completed'`** for any client carrying a
`completed_at`. This is a second, independent cause of D3 — fixing the Edit Client `Select`
alone would still not reactivate a completed client. It also means `placeAndActivate` would
mis-fire on a prospect that ever carried a `completed_at`.

**Downstream consumers of `status='completed'`** (not writers, but they inherit the lie):
[ClientList.tsx:331](pages/ClientList.tsx:331) gates "Process Completion Certificate" on
`client.status !== 'completed'`; `isArchiveEligible` ([ClientSelectionGrid.tsx:45](components/clients/ClientSelectionGrid.tsx:45));
[complianceEngine.ts:531](services/complianceEngine.ts:531) and [:607](services/complianceEngine.ts:607)
drop `completed` clients out of the guardrail sweeps entirely — so a wrongly-completed client
also **disappears from the compliance feed**.

## (b) `evaluateProgramCompletion` — inputs, and SQL reachability of each

Signature: `evaluateProgramCompletion(facts: ClientFacts, nowMs)` — pure, no I/O
([complianceEngine.ts:690](services/complianceEngine.ts:690)). `facts` is built by `toFacts`
([:288](services/complianceEngine.ts:288)) from a client row plus four injected fetch results.

| Gate | Input | Where it comes from today | Reachable in SQL? |
|---|---|---|---|
| **hours** (+ SROP counseling floor) | `facts.hoursCompleted`, `facts.hourComponents` | `fetchClientAccrual` → **`client_accrued_hours` view** | ✅ **Native.** The view IS the source; TS only reads it. `sum(duration_minutes) filter (service_type …)/60` over `appointments` where `lower(status)='completed'`. |
| **level** (selects which hours rule applies) | `facts.determinedLevel` | `fetchClientDetermination` → `placement_determinations` signed, non-superseded, latest `determined_at` | ✅ **Native, and the SQL already exists** — inside `my_progress()` (SECURITY DEFINER), byte-for-byte the same predicate, just self-scoped to `private.my_client_ids()`. |
| **payment** | `facts.outstandingBalance` = `clients.balance` | client row | ✅ **Native.** Also independently derivable via the existing `public.client_balance(uuid)` (`charges` minus succeeded `payments`). |
| **signoff** | `facts.completionSignedOff` | `fetchCompletionSignoff` → `clinical_notes` `note_type='completion_signoff' AND is_signed` | ✅ **Native.** One `exists()`. |
| **forms** | `facts.signedFormIds` | `fetchClientSignedForms` → `form_submissions` where `lower(status) in ('completed','reviewed')` | ✅ **Native** for the *submitted* set. |
| **duration** (SROP only) | `facts.enrollmentDate` = `clients.created_at`; `facts.completionDate` = `clients.program_end_date` | client row | ✅ **Native.** |
| **program routing** | `normalizeProgram(program_type)` | `config/programVocab.ts` | ⚠️ TS — but `clients_program_vocab_check` already pins `program_type` to 9 canonical values, so SQL only needs the SATOP-family set `('SATOP','OEP','WIP','CIP','SROP')`. Low drift risk. |

### The two inputs that exist ONLY in TypeScript

1. **Required hours / thresholds per level.**
   `REQUIRED_HOURS_BY_LEVEL = {I:10, II:20, III:50, IV:75}` ([satopFees.ts:35](config/satopFees.ts:35))
   **and again** as `total_required_hours` in `compliance/missouri-compliance-pack.json`
   (OEP 10 / WIP 20 / CIP 50 / SROP 75, `counseling_min_hours: 35` on SROP).
   The SROP 90-day minimum is a **third** copy — hardcoded `const min = 90` at
   [complianceEngine.ts:158](services/complianceEngine.ts:158), *not* read from the rule.
   → **These numbers are already duplicated twice inside TypeScript today.**
2. **The required-forms set.**
   `CORE_REQUIRED_FORM_IDS` (6 ids) → `REQUIRED_FORMS_BY_LEVEL`
   ([formRegistry.ts:147](config/formRegistry.ts:147)). No DB representation at all.

**Plain statement, as asked:** SQL can reach every *fact*, but it cannot reach these two
*constants* without copying them. Adding a literal `case level when 'I' then 10 …` inside the
RPC would create a **fourth** copy of the hours table and a **second** copy of the required-forms
list — exactly the divergence Dan is warning about. My proposal below moves the constants into
the DB and makes TypeScript the follower, with a check that fails loudly on drift.

### The three existing "current determination" derivations (confirmed)

1. `currentLevelFromRows` — [complianceEngine.ts:426](services/complianceEngine.ts:426); used by
   `fetchClientDetermination` ([:436](services/complianceEngine.ts:436)) and
   `fetchAllCurrentDeterminations` ([:449](services/complianceEngine.ts:449)).
2. `my_progress()` — SQL, SECURITY DEFINER, self-scoped. Same predicate, independently written.
3. `AssessmentTab.tsx:296-300` — an inline `useMemo` doing its own superseded-set + `find`.

They agree today. Nothing enforces that they keep agreeing.

## (c) The lifecycle vocabulary — every status value, where defined, UI-reachable

`clients_status_lifecycle_check` (DB) and `ClientStatus` ([types.ts:60](types.ts:60)) agree on
**seven** values. Labels: [types.ts:63](types.ts:63).

| Stored value | Rendered label | Defined | Reachable from the UI? |
|---|---|---|---|
| `active` | Active | CHECK + `types.ts` | **Yes** — Edit Client `Select`; `placeAndActivate` ([api.ts:321](services/api.ts:321)). |
| `completed` | **"Successful Dx"** | CHECK + `types.ts:65` (label-only remap) | **Yes** — Edit Client `Select` option "Completed" (**the D1 hole**), and the gated nudge. |
| `archived` | Archived | CHECK + `types.ts` | **Yes** — Edit Client `Select`; archive nudge. |
| `prospect` | "Pending" | CHECK + `types.ts` (migration 20260617) | **Write:** only the `acs-intake-submit` edge fn. **Not settable in the staff UI.** |
| `paused` | Paused | CHECK + `types.ts` (migration 20260708 sched12) | **NO writer anywhere.** Dead token. |
| `unsuccessful_dx` | Unsuccessful Dx | same | **NO writer anywhere.** Dead token. |
| `successful_dx` | **"Successful Dx"** | same | **NO writer anywhere.** Dead token — **and it collides with `completed`'s label.** |

Three consequences worth naming:

- **Two distinct stored values render the identical string "Successful Dx"** (`completed` and
  `successful_dx`). Nothing in the UI can tell them apart. `ClientProfileHeader.tsx:57` and
  `ClientSelectionGrid.tsx:31` already special-case them together.
- **`needsStatusReview`** ([types.ts:77](types.ts:77)) flags `archived` and `completed` with a
  warning triangle — i.e. the app already tells the user "we don't know if this discharge was
  successful", while simultaneously labelling `completed` "Successful Dx".
- **`is_demo` is not a status** and does not appear in this axis at all. It is a boolean on
  `clients`, absent from the intake wizard (smoke D-10), and — verified in the smoke run's own
  Gate 1 — read by no spine logic. It is orthogonal to the lifecycle and I recommend keeping it
  that way.

## Proposed design — D1

**One design. It is Dan's, with two extensions I'm flagging rather than assuming.**

### D1.1 — Move the two TS-only constants into the DB; make TS the follower

Migration seeds two tiny reference tables:

```
satop_level_requirements(level pk, required_hours, counseling_min_hours, min_duration_days)
   I→10/0/0   II→20/0/0   III→50/0/0   IV→75/35/90
satop_required_forms(level, form_id)   -- the 6 CORE_REQUIRED_FORM_IDS × 4 levels
```

The RPC reads these — **no literals in the function body**. A new
`npm run check:gate` (same esbuild-bundle pattern as the existing `check:forms`) asserts
`REQUIRED_HOURS_BY_LEVEL` ≡ `missouri-compliance-pack.json` `total_required_hours` ≡ the seeded
table, and `REQUIRED_FORMS_BY_LEVEL` ≡ `satop_required_forms`. **Drift fails a command, loudly.**

This is the honest answer to "derive it once": the *facts* are already single-sourced in SQL;
the *constants* were already double-sourced in TS before this change, and this makes them
single-sourced with a mechanical check instead of triple-sourced with none.

**Alternative if Dan prefers less machinery:** inline the constants in the RPC and accept a
documented fourth copy. I do not recommend it — the hours table is the number a court reads.

### D1.2 — One SQL derivation of "current determination", shared

`public.current_determined_level(p_client uuid) returns text` — STABLE, SECURITY DEFINER —
carrying the signed / non-superseded / latest-`determined_at` predicate **once**. Then:

- rewrite `my_progress()` to call it (SQL copies: 2 → 1);
- point TS `fetchClientDetermination` at it via `.rpc()` so `currentLevelFromRows` stops being a
  parallel derivation (TS copies: 2 → 1, and that one is `AssessmentTab`'s display list).

Net: **3 derivations → 2**, and the gate and the display read the same one. I am *not*
refactoring `AssessmentTab` in this pass (out of scope; it is display-only).

### D1.3 — `complete_client(p_client_id uuid, p_signoff_note_id uuid default null)`

`SECURITY DEFINER`, `search_path=''`, granted to `authenticated`, **first line asserts
`private.is_clinician()`** (Director/Therapist — Admin cannot complete a client, matching the
existing `clinical_notes` posture the smoke run verified). It re-derives every gate in SQL from
the sources in (b) and `raise exception` with the *specific* failing gates:

```
Completion refused — 2 gate(s) not met:
  • Hours: 9/10 total (1 remaining) before the completion certificate can issue.
  • Required forms signed: 1 of 6 required form(s) unsigned (emergency-contact).
```

On success, in one transaction: stamp `completed_at = now()`, `archived_at = null`, write an
`audit_logs` row `action='client.completed'` with the derived gate snapshot in `details`, and
set the tx-local guard GUC.

### D1.4 — The trigger (this is the part that actually closes the hole)

`BEFORE UPDATE ON clients`: if `NEW.status = 'completed'` and `OLD.status` is distinct from it —
or if `NEW.completed_at` is being set from null — **and** the tx-local GUC
`acs.completion_gate` does not equal this row's id, `raise exception … errcode 42501`.

`complete_client` sets that GUC with `set_config(..., is_local => true)` immediately before its
own UPDATE.

**Why this actually holds, stated precisely:**

- PostgREST runs each request in its own transaction and will not pass through an arbitrary
  `acs.*` GUC — an authenticated session has no way to set it. The raw-UPDATE bypass is refused.
- **Triggers fire for `service_role` too.** Unlike RLS, this is not bypassed by the service key.
  Only a superuser explicitly disabling the trigger (or `session_replication_role='replica'`)
  gets around it.
- **Cost to be aware of:** any future seed/migration that writes `status='completed'` must call
  `complete_client()` or set the GUC. Today that costs nothing (0 completed rows), but
  `supabase/seed/demo_reseed.sql` and any demo-completed fixture will need the same treatment.

### D1.5 — Remove "Completed" from the Edit Client status Select

Agreed, and for Dan's stated reason. Completion becomes reachable only through the gated flow.
The `Select` keeps `Active` / `Archived` (see D3 for the value/label fix), and a separate
"Complete client" action calls the RPC.

### ⚠ Two things I am flagging, not assuming

**(i) As specified, this fix makes completion unreachable in-app — for everyone.**
`complete_client` requires the sign-off gate, and smoke **D-3** established that *no code path
writes `note_type='completion_signoff'`*. Ship D1 alone and the P0 flips from fail-open to
fail-closed-always: no client can ever be completed through the product. D-3 is explicitly out
of my scope, so I need your call. My recommendation:

> Let `complete_client` **write the sign-off note itself** when `p_signoff_note_id` is null and
> `private.is_clinician()` passes — an authenticated clinician invoking "Complete client" *is*
> the completion sign-off event under 9 CSR 30-3.206(13), recorded atomically with the
> transition and with `therapist_id = auth.uid()`. When a note id *is* supplied, it is validated
> (belongs to this client, `is_signed`, correct `note_type`) and reused.

That keeps four determinants and keeps the path walkable. It does touch D-3's territory —
say the word either way.

**(ii) Removing "Completed" from the dropdown strands the five non-SATOP programs.**
`evaluateProgramCompletion` returns `hasCriteria:false, eligible:false` for
ANGER_MANAGEMENT / GAMBLING_RECOVERY / OPIOID_RECOVERY / INDIVIDUAL_COUNSELING (smoke, Client B),
and the nudge is SATOP-only ([ClientSelectionGrid.tsx:349](components/clients/ClientSelectionGrid.tsx:349)).
So after D1.5 an anger-management client can **never leave `active`** — which is a regression on
how David actually discharges them. My recommendation: `complete_client` applies **every gate
that applies**, and for a program with no state gate the applicable set is *settled balance +
clinician sign-off*. That is a defensible minimum, keeps completion an event with preconditions,
and does not invent a regulatory rule Missouri does not impose. Alternative: leave those
programs on `archived`. Your call.

---

# D2 — "SSN (last 4 digits)" accepts and stores a full SSN

## (a) Field definition, carrying form, write paths

- **Definition:** [AuthorizationForReleaseForm.tsx:130](components/forms/AuthorizationForReleaseForm.tsx:130)
  `{ id:'ssn', label:'SSN (last 4 digits)', type:'text', required:true, min:4, max:4 }`
- **Only form carrying it:** `authorization-release` (one of the 6 required-core forms).
- **Own validator:** [:102](components/forms/AuthorizationForReleaseForm.tsx:102)
  `if (!data.ssn || data.ssn.length < 4) …` — a **floor only**. Nine digits passes.

**The precise mechanism the smoke run measured (`maxLength = -1`):**

1. The form renders through the **generic renderer**, not its own JSX.
   `AUTHORIZATION_RELEASE_DEFINITION` exports no `steps` array — `Step1`…`Step4` are declared at
   [:17](components/forms/AuthorizationForReleaseForm.tsx:17)–[:83](components/forms/AuthorizationForReleaseForm.tsx:83)
   and **never referenced**. So the `<FormField … maxLength={4}>` at
   [:79](components/forms/AuthorizationForReleaseForm.tsx:79) is dead code and never mounts.
2. The live control is [BaseFormTemplate.tsx:390-398](components/BaseFormTemplate.tsx:395):
   `<input type={inputType} min={field.min} max={field.max} …>`. On a `type="text"` input,
   HTML `min`/`max` are **inert** — they apply only to number/date/range. Hence `maxLength = -1`.
3. There is **no submit-time length rule anywhere**. `requiredFieldErrors`
   ([formValidation.ts:24](config/formValidation.ts:24)) enforces *answered-ness* only; it reads
   `field.min` for `rating` ([:47](config/formValidation.ts:47)) and never for text.
4. There is **no native constraint validation to fall back on** — BaseFormTemplate has **no
   `<form>` element**; submit is `onClick={handleSubmit}` ([:420](components/BaseFormTemplate.tsx:420)).
   So `type="email"`, `min`, `max` are decorative across the entire form system.

**Write path** (single): `handleSubmit` → `stripHiddenValues` ([:240](components/BaseFormTemplate.tsx:240))
→ `saveFormSubmission` ([api.ts:1412](services/api.ts:1412)) → `form_submissions.data` jsonb.
Client-side portal writes hit the same table under `client_self_insert_form_submissions`.

## (b) Every other field with a stated constraint and nothing enforcing it — full list

**Strict reading (a length/format promised in the LABEL): `ssn` is the only one.**
A grep of all 15 form definitions for labels containing a digit-count, format mask, or
"characters" returns exactly that one field.

**Broader reading (a constraint *declared* in the definition with nothing behind it) — complete:**

| Shape | Fields | Enforcement today |
|---|---|---|
| `min`/`max` on a **`text`** field | **`ssn`** only ([AuthorizationForReleaseForm.tsx:130](components/forms/AuthorizationForReleaseForm.tsx:130)) | **None.** Inert in the renderer, absent from the validator. |
| `min:1, max:5` on **`rating`** | **15 fields**, all in [TelehealthFeedbackForm.tsx:70-83](components/forms/TelehealthFeedbackForm.tsx:70) | `min` **is** enforced, but only as the required-ness floor ([formValidation.ts:47](config/formValidation.ts:47)) and only when `required`. **`max` is enforced nowhere** — it renders `type="number"` via `inputTypeFor` and there is no `<form>`, so a rating of 99 submits. |
| `type:'email'` (a format claim) | **5 fields** — [ConsentForTreatmentForm.tsx:71](components/forms/ConsentForTreatmentForm.tsx:71), [SatopChecklistForm.tsx:85](components/forms/SatopChecklistForm.tsx:85), [SatopClientIntakeForm.tsx:101](components/forms/SatopClientIntakeForm.tsx:101), [SessionAttendanceForm.tsx:72](components/forms/SessionAttendanceForm.tsx:72), [TelehealthFeedbackForm.tsx:69](components/forms/TelehealthFeedbackForm.tsx:69) | **None.** No regex anywhere in `components/forms`; no `<form>` so the browser never checks. |
| `type:'tel'` | **8 fields** (4 ROI contact blocks, 2 EmergencyContact, 2 ContinuingRecoveryPlan, 1 SatopClientIntake) | **None** — but `tel` states no format in any browser either. Listed for completeness, not as a defect. |
| `type:'number'` on a form field | **none exist** | — |

**Proposed fix (D2):** (1) in the renderer, emit `maxLength={field.max}` for the text family and
stop emitting the inert `min`/`max` there; (2) add a generic length rule to
`config/formValidation.ts`, composed **before** `validateStep` exactly as `requiredFieldErrors`
already is, so `validateStep` can still override the message; (3) tighten the ROI's own rule
from `length < 4` to `length !== 4`. **Reject, do not silently truncate** — a client typing nine
digits must be told, not quietly edited.

## (c) Remediation migration for existing over-length values

**Believed affected row count: `0`.**

Confirmed **without selecting any value**, by aggregate only:

```sql
select count(*) filter (where data ? 'ssn')            as has_ssn_key,   -- 0
       count(*) filter (where length(data->>'ssn') > 4) as ssn_over_4,   -- 0
       count(*) filter (where length(data->>'ssn') = 9) as ssn_len_9     -- 0
from public.form_submissions;
```

`form_submissions` holds 8 rows, all `form_id='emergency-contact'`; a `jsonb_object_keys` roll-up
shows no `ssn` key on any of them. The smoke run's 9-character row was torn down (residue file:
`form_submissions` returned to its baseline of 8, delta 0).

The migration will still be written — idempotent, safe on zero rows, and correct if a row appears
between now and Dan applying it: `update … set data = jsonb_set(data,'{ssn}', to_jsonb(right(data->>'ssn',4)))
where length(data->>'ssn') > 4`, with one `audit_logs` row per affected submission
(`action='form_submission.ssn_truncated'`, `details` recording the prior **length**, never the
value), re-runnable because the predicate stops matching after the first run.
**Written, committed, shown — not applied.**

**Separate item, flagging not fixing:** `scripts/fixtures/form-submissions-ground-truth.json:10`
contains `"ssn":"444-56-4444"` — a full formatted SSN **checked into git**. It is a repo file, not
a DB row, so the migration will not touch it. Same defect shape, outside the three-defect scope.
Say the word and I will scrub it to `4444` in the D2 commit.

---

# D3 — completion cannot be reversed through the UI

## (a) Consumers of `CLIENT_STATUS_LABELS` and of the raw values

| Site | Use | At risk of the same mismatch? |
|---|---|---|
| **[EditClientModal.tsx:238](components/clients/EditClientModal.tsx:238)** | `<Select value={CLIENT_STATUS_LABELS[status] ?? 'Active'} options={['Active','Completed','Archived']} onChange={v => setField('status', v.toLowerCase())}>` | **YES — this is the bug.** The `value` is a *label*, the options are *labels*, and the write is `label.toLowerCase()`. `completed → 'Successful Dx'`, which is not an option, so the control falls back to displaying the first (`Active`); re-picking it fires no change; [:117](components/clients/EditClientModal.tsx:117) writes status only when it differs. |
| [ClientProfileHeader.tsx:176](components/clients/ClientProfileHeader.tsx:176) | `{CLIENT_STATUS_LABELS[client.status] ?? client.status}` | No — display only. |
| [ClientSelectionGrid.tsx:138](components/clients/ClientSelectionGrid.tsx:138), [:246](components/clients/ClientSelectionGrid.tsx:246) | same display pattern | No. |
| [ClientSelectionGrid.tsx:276](components/clients/ClientSelectionGrid.tsx:276) | filter chips `{key:'completed', label:'Successful Dx'}` — value/label kept **separate** | No — this is the correct pattern to copy. |
| [ClientList.tsx:273](pages/ClientList.tsx:273) | `<option value="completed">Completed</option>` | Not a bug (value ≠ label, correctly), but it says **"Completed"** where the rest of the app says "Successful Dx" — a vocabulary inconsistency worth noting. |
| [api.ts:107](services/api.ts:107) | `normalizeClientStatus` — membership test against `CLIENT_STATUSES` | No. |

**`EditClientModal.tsx:238` is the only place a label is used as a form value.** No other
component has the identical defect. The `Program` `Select` two lines up
([:232](components/clients/EditClientModal.tsx:232)) already does it correctly, via
`PROGRAM_OPTIONS = [{value, label}]` — that is the shape to copy.

**And, again: the Select is only half of it.** [api.ts:2443](services/api.ts:2443) coerces
`'active'` back to `'completed'` whenever `completed_at` is set. Repair the Select and the row
*still* will not reactivate. The smoke report's proposed fix is necessary but not sufficient.

## (b) Design — reopening as an audited event, not an edit

**`reopen_client(p_client_id uuid, p_reason text)`** — `SECURITY DEFINER`, `search_path=''`,
granted to `authenticated`:

1. `private.is_clinician()` or raise (an Admin cannot reopen a court-facing record).
2. Refuse unless the row is currently `completed`.
3. Refuse a blank/trivial reason (`length(btrim(p_reason)) >= 10`) — the reason is the artifact.
4. Read `completed_at` **before** the update.
5. `update clients set status='active', archived_at=null` — `completed_at` **untouched** (see (c)).
6. Insert `audit_logs`: `action='client.reopened'`, `user_id = auth.uid()`,
   `entity_type='clients'`, `entity_id = p_client_id`,
   `details = {reason, prior_status:'completed', prior_completed_at, prior_program_end_date}`.
   Append-only, no delete path — the reopen cannot be erased.
7. The guard trigger from D1.4 is unaffected (it only refuses transitions *into* `completed`).

**Client-side:**
- Drive the `Select` by stored value, not label: `options=[{value:'active',label:'Active'},{value:'archived',label:'Archived'}]`
  — "Completed" removed per D1.5, so the dropdown offers only what an edit may legitimately set.
- When `status === 'completed'`, the Status field renders **read-only** ("Successful Dx") beside
  an explicit **"Reopen client"** button, which opens a small modal requiring a typed reason and
  calls the RPC. Not a dropdown pick. Not a field change.
- **Delete the `row.status = 'completed'` coercion at [api.ts:2443](services/api.ts:2443).** It is
  what makes reopen impossible, and once `completed_at` is preserved (below) it would silently
  re-complete every reopened client on their next unrelated save. Its stated purpose —
  "unarchiving a client who had completed restores them to `completed`" — should be expressed by
  the archive path recording the prior status, not by inferring lifecycle from a timestamp. I am
  **not** building `unarchive_client` in this pass; I will note the behaviour change explicitly.

## (c) `completed_at` on reopen — recommendation: **preserve on the row, prior value into the audit row. Do not clear it, do not add a history table.**

- It is a historical fact, and `updateClient`'s own comment already treats it that way
  ([api.ts:2431](services/api.ts:2431)). Clearing it destroys the record that a completion *was*
  issued on a date — on a document a court may have already received.
- A history *table* is the theoretically right answer, but `audit_logs` is already append-only,
  staff-scoped, and has no delete path. It is a history row. Adding a table for one event is
  cost without benefit at pilot scale.
- **Precondition:** this recommendation only holds once the [api.ts:2443](services/api.ts:2443)
  coercion is gone. With it in place, "preserve `completed_at`" and "reopen works" are mutually
  exclusive.
- One consequence to accept, stated: `completed_at IS NOT NULL` stops meaning "is completed".
  Checked every reader — `isArchiveEligible` ([ClientSelectionGrid.tsx:45](components/clients/ClientSelectionGrid.tsx:45))
  already tests `status === 'completed'` **and** `completed_at`, so it stays correct. No other
  code reads `completed_at` as a lifecycle predicate.

---

## Also asked: is `clients.program_end_date` written by anything now?

**No. Nothing writes it — verified three ways.**

1. Absent from `CLIENT_UPDATE_COLUMNS` ([api.ts:2384](services/api.ts:2384)) — `updateClient`
   *cannot* write it even if a caller passes it.
2. Absent from `mapAppToClientRow` (the INSERT mapper), so `createClient` never sets it.
3. **`0 of 13` rows non-null** in the live database.

It has **two readers**:
- the certificate's **Completion Date** field (smoke report: prints blank);
- `toFacts` → `facts.completionDate` → `evaluateDeadline`'s minimum-duration **end anchor**
  ([complianceEngine.ts:156](services/complianceEngine.ts:156)) — so the SROP 90-day gate
  currently always measures to *now* instead of to the completion date.

**Recommendation (not changing it this pass): `completed_at` is authoritative.** It is the only
one with a writer, it is the lifecycle event stamp, and it is `timestamptz`. `program_end_date`
should be treated as a denormalized `date` mirror that exists because MO 650-7743 wants a date —
either derived at read time from `completed_at::date`, or stamped alongside it.

**One question, since it lands inside D1's transaction:** may `complete_client()` stamp
`program_end_date = current_date` in the same transaction as `completed_at`? It is the cheapest
moment to make both the certificate's Completion Date and the SROP duration anchor correct, and
it is additive. But it *is* a write to a column you said not to change in this pass — so I have
not assumed it. Default if you don't answer: **I do not touch it.**

---

## Summary of what needs your GO

| # | Decision | My recommendation |
|---|---|---|
| 1 | Constants in DB reference tables + `npm run check:gate` parity, vs. a documented 4th copy inlined in the RPC | **DB tables + parity check** |
| 2 | `complete_client` writes the `completion_signoff` note when none is supplied (touches D-3, out of scope) | **Yes** — otherwise D1 makes completion unreachable for everyone |
| 3 | Non-SATOP programs: gate on *balance + sign-off*, vs. leave them stranded on `active` | **Gate on balance + sign-off** |
| 4 | Delete the `status='active' → 'completed'` coercion at api.ts:2443 (changes unarchive behaviour) | **Yes** — reopen is impossible otherwise |
| 5 | Scrub the full SSN in `scripts/fixtures/form-submissions-ground-truth.json` | **Yes**, in the D2 commit |
| 6 | May `complete_client` also stamp `program_end_date`? | **Your call** — default is no |

**Nothing has been built. No migration written or applied. Awaiting your go.**
