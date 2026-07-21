# DEFERRED — post-demo hardening

Findings recorded during the Phase 0 appointment-layer recon (2026-06-24). These are
intentionally **not** being fixed this sprint. The 6/30 demo calendar is built on
`appointments.therapist_name` (text), which attributes the correct counselor on screen.
The items below are about moving from name-based to a structured, referentially-enforced
`therapist_id` link — real work that depends on auth/roles plumbing we are not touching now.

## 1. `user.id → counselors.id` gap (why id-attribution isn't wired)

**STATUS (2026-07-14): STALE.** The identity link now exists — `counselors.auth_user_id`
(uuid, FK → `auth.users`, backfilled by exact full_name for staff accounts) was added in
`20260705_schedule_identity_1_counselor_auth_link`. Live attribution rides the explicit
`counselor_id` FK (see §4), so the text-only constraint this item described no longer holds.
Kept for history.

The booking flows ([components/sessions/ScheduleSessionModal.tsx](components/sessions/ScheduleSessionModal.tsx),
[components/sessions/SessionWrapUpModal.tsx](components/sessions/SessionWrapUpModal.tsx)) resolve the
therapist from the logged-in session as a display **name** (`user?.name`, or the standing
group's `counselor_name`) and persist it to `appointments.therapist_name`. There is no path
to resolve the logged-in user to a `counselors` row: the `counselors` table (id, name,
zoom_link, zoom_meeting_id, active — 6 rows) has **no column linking it to an auth user**,
and there is no server-side role/identity mapping that ties a session to a counselor id.
Until counselors are linked to auth identities (or some deterministic name→id resolver is
introduced), the insert path cannot populate `appointments.therapist_id`, so attribution
stays text-based by necessity, not by preference.

## 2. Orphan rows blocking referential integrity

**Escalated 2026-07-15 — see #31.** The `clients.assigned_therapist_id` half of this finding is
no longer just tech debt: it's now blocking David's 7/15 "Primary Counselor" ask on the client
header.

The structured id columns already exist but are effectively unused and partly dirty.
`appointments.therapist_id` (uuid) is set on only **11 of 215** rows, and **all 11** point
at no `counselors` row (orphans). `clients.assigned_therapist_id` (uuid) has **19** values
that likewise reference no counselor. These orphans are leftovers, not live attribution —
the app writes `therapist_name`, not these id columns. Before any FK can exist, the orphans
must be resolved: backfill from `therapist_name` where the name matches an active counselor,
and NULL out the remainder. That cleanup is a present-then-apply migration with the exact
`UPDATE` SQL shown for approval — deferred here, not yet written.

## 3. The legacy `therapist_id` RESTRICT FK (distinct from the live `counselor_id` FK)

The audit called for `FOREIGN KEY (therapist_id) REFERENCES counselors(id) ON DELETE RESTRICT`
on `appointments`, and the equivalent on `clients.assigned_therapist_id`. Neither constraint
can be created against the current data — Postgres will reject the `ADD CONSTRAINT` because of
the 11 + 19 orphan rows above. NOTE (2026-07-12): a SEPARATE, nullable attribution FK —
`appointments.counselor_id → counselors(id) ON DELETE SET NULL` — now exists and is the live
attribution path (see §4). The old `therapist_id` uuid column is unrelated leftover (11 orphan
rows, written by nothing); it can simply be dropped in a future cleanup rather than
constrained. `clients.assigned_therapist_id` (19 orphans) is still unconstrained.

## 4. Lane attribution now rides the `counselor_id` FK — name match is fallback only (2026-07-12)

**STATUS (2026-07-14): DONE.** The live `counselor_id` FK attribution path is in place and
is the primary lane resolver; this entry documents the shipped design, not pending work.

**SUPERSEDES the earlier "name-normalization bandaid."** Sessions attribute to a counselor lane
by the real `appointments.counselor_id` FK (added + backfilled in
`20260705_schedule_identity_1`, reconciled byte-for-byte against `normalizeCounselorName` on
2026-07-12 — 241/241 rows agree; index added in `20260712_sched_counselor_id_index`).
`bucketByCounselor()` and the double-booking `conflictIds`
([scheduleLane.tsx](components/sessions/scheduleLane.tsx), [SessionManagement.tsx](pages/SessionManagement.tsx))
resolve FK-first via `laneCounselorIdFor()`, falling back to the normalized-name match ONLY for
the legacy/NULL tail (28 rows: `Dr. Anya Sharma` 14, NULL 7, `Jessica` 6, `Karen (Demo
Therapist)` 1 — none of which map to a real counselor). The booking modal and the reschedule/
edit modal both write `counselor_id` + `therapist_name` together, so new rows are FK-attributed
from creation. The name-collision assert in `bucketByCounselor` guards the fallback path.

`therapist_name` is intentionally KEPT (denormalized display + the name-fallback + rollback
path). It can be dropped in a later migration once every consumer reads `counselor_id` and the
legacy tail is either reassigned or accepted as permanently unattributed.

## 5. Cert-gating seam awaits David's certification list (2026-07-12)

`qualifiedCounselorsFor(sessionTypeId, activeRoster)` in
[config/sessionTaxonomy.ts](config/sessionTaxonomy.ts) is THE single place that decides which
counselors may take a session type — the booking modal's counselor picker AND the reschedule/
edit picker both call it. TODAY it gates on the static config matrix (`counselorsForSessionType`;
OPEN/unknown types → full active roster). This is NOT a real certification source — David's
per-counselor cert/qualification list has not been delivered. When it arrives, change ONLY this
function's body to intersect the active roster with the certified set. No cert data is
fabricated in the meantime.

For now `appointments.counselor_id → counselors(id)` and `appointments.group_id → groups(id)`
are the FKs on the table, and the `service_type` CHECK
(`counseling`/`education`/`rehabilitative_support`/`other`, nullable) remains the appointment
layer's only other DB-level guard.

## 6. Clickable Session History (client record → Sessions tab) — David, walk not Tuesday (surfaced 2026-07-XX)

**STATUS (2026-07-14): DONE.** Shipped in commit `773d98b`, deployed to `acs-therapyhub`
2026-07-14. Rows in `components/clients/ClientSessionsTab.tsx` are now clickable and route by
kind: appointment-derived rows → an `AppointmentDetail` drawer (date, time + derived duration,
modality, status, therapist, service/session type, Zoom link, Group-session chip, plus the
linked note if one exists); "Session note" rows → the shared `ClinicalNoteView`. The note card
was extracted to `components/clients/ClinicalNoteView.tsx` and is reused by the Overview tab.

New requirement, surfaced from a Sessions-tab screenshot review. **Not a Tuesday-demo
blocker — do not start before the counselor_id FK branch and the by-counselor week-board
scroll fix ship.**

Each row in a client's Session History list is currently read-only. David wants rows
clickable, opening a detail view/drawer that surfaces:
- whether a clinical note was placed/signed for that session (note status + a link to the
  note itself)
- modality: Virtual (Zoom) / In-Person
- session shape: Individual / Group
- session type (SATOP Group, 1:1, Assessment, etc.), date, counselor, status

The underlying data mostly already exists at summary level in each row — the gap is the
click-through affordance and the detail view, not new data plumbing.

The list already mixes two distinct row kinds and any click handler needs to route each to
the right destination, not a single generic "session detail":
- **"Session note" rows** — a clinical note record. Click → the note viewer.
- **Appointment-derived rows** (e.g. "SATOP Group") — an appointment, not a note. Click →
  a session detail view (the fields listed above), not the note viewer.

Scope note: find/confirm which client-record component currently renders Session History
before starting — not yet located as part of this entry (recon-first when this item is
picked up).

## 7. Demo-seed cleanup log (revertible — not prod data)

Direct DB edits made to clean up the demo picture, logged here so they're traceable and
reversible. None of this is real clinical/scheduling data — it's the `dee0…`-namespace demo
seed described in [[project_sched_cascade_build]].

- **2026-07-12** — appointment `40134284-f0e7-474e-b955-6c2154a05cf2` (client James West,
  Individual Counseling, Virtual (Zoom), Tue 2026-07-07 6–8 PM local): `therapist_name`
  changed from **`Jessica`** (not a `counselors` row under any spelling — the last
  genuinely-unattributed row inside the Jul 6–12 demo week) to **`John Burns`**, with
  `counselor_id` set to John Burns's row together in the same write (so this row reads via
  the FK path, not the name-fallback). Chosen because John Burns was free at that exact
  slot (David Yoder already had a session in that window) and qualifies for general 1:1
  counseling with the lightest load of the free options (4 sessions pre-change). To revert:
  `update appointments set therapist_name = 'Jessica', counselor_id = null where id =
  '40134284-f0e7-474e-b955-6c2154a05cf2';`

# Surfaced 2026-07-14

Follow-ups that fell out of the clickable Session-History drill-in (§6). Both are net-new,
low-risk, and NOT started.

## 8. Real signer name on notes

The `THERAPIST_NAMES` mock map (a 2-entry hardcoded UUID→name lookup) was deleted with the
drill-in work — it was a demo fiction, not a data source. Note footers now render the honest
role label **"Clinician"** ([components/clients/ClinicalNoteView.tsx](components/clients/ClinicalNoteView.tsx)).

Follow-up: resolve `clinical_notes.therapist_id → counselors.name` so the note footer shows the
REAL signer instead of the generic role. The roster already exists (the `counselors` table,
used by the demo seed) — this is a join/lookup, not new plumbing. Small, low-risk. NOT started.

## 9. Group-note authoring UI

`distributeGroupNote` already fans a single note out to one `clinical_notes` row per enrolled
member of a group occurrence, idempotently (per-seat `appointment_id` + `note_type='Group
Session'` unique marker) — [services/api.ts](services/api.ts) (function at 1134-1193). The
Session-History drill-in now also labels group sessions (Group-session chip / `note_type='Group
Session'`).

Missing: the clinician-facing "write once → post to group" screen that CALLS
`distributeGroupNote`. The distribution primitive is done; the authoring surface is not.
Fast-follow, net-new UI. NOT started.

# Surfaced 2026-07-15 — billable-units groundwork (feat/billable-units)

15-minute billable units shipped as GROUNDWORK for the Aug 1 testing phase (David 7/14):
`appointments.billable_units` (nullable int, CHECK 1–12), a TWO-AXIS gate
([config/billableUnits.ts](config/billableUnits.ts)) — program (eligibility) × service_type
(grain) — a completion-time picker in
[components/sessions/AppointmentStatusModal.tsx](components/sessions/AppointmentStatusModal.tsx),
and a read-only DetailRow in [components/clients/ClientSessionsTab.tsx](components/clients/ClientSessionsTab.tsx).
It records a COUNT only — no dollars, no DMH/CIMOR submission.

**UPDATE 2026-07-15 (feat/units-on):** the `counseling` grain is **ON** — 15-minute units,
1–12, group and individual alike, per David's direct confirmation on the ACS Updates call
(2026-07-14, 00:20:44 / 00:26:51). The picker now renders for SATOP-family clients on
`counseling` sessions, and the drill-in shows "N units · M min" (asserted) or "N units
suggested · M min" (prefill, not asserted). education/rehabilitative_support grains stay
unset (transcript doesn't cover them). See the revised #11.

## 10. UNITS ↔ HOURS RECONCILIATION (blocked on David + Missouri billing rules)

There are now TWO time quantities on a session row, and they are NOT reconciled:
- `duration_minutes` (writer-derived from start/end, [services/api.ts:425](services/api.ts:425)) feeds
  the `client_accrued_hours` view ([20260606_ws3_1_session_hours_accrual.sql:55](supabase/migrations/20260606_ws3_1_session_hours_accrual.sql:55)),
  which is THE source the SATOP HOURS completion gate reads
  ([services/complianceEngine.ts:304](services/complianceEngine.ts:304)). **Unchanged — the gate
  still reads duration_minutes.**
- `billable_units` is a second, HUMAN-asserted time quantity that will disagree with it
  routinely. Concrete example: a session **booked for 60 minutes** where the clinician
  bills **3 units = 45 minutes billed to the State**, while the SATOP gate still credits
  **1.0 hour** toward the required total. Both numbers are "correct" for their own purpose;
  they simply don't agree.

Deliberately unreconciled for now. Which quantity is authoritative for billing vs. for
program-completion (and whether they must ever be forced to agree) is a David + Missouri
billing-rules question, NOT a code question. Do NOT wire `billable_units` into the accrual
view or the compliance engine until that decision lands.

**UPDATE 2026-07-15 — the 7/14 transcript raises the stakes (00:26:51).** David: "We still
have to put those in for the state so they get their completion. So whether they're
reimbursed or not, we need to do our part." → Units are NOT a parallel billing-only number:
they feed the **COMPLETION CERTIFICATE** as well as state billing, and **self-pay clients
still need units recorded for completion**. The reconciliation between `billable_units`
(clinician-dictated) and `client_accrued_hours` (reads `duration_minutes`) is therefore
**load-bearing, not cosmetic** — two different numbers feeding the same completion story.
Still not built. Still David's call on the rule (which number the gate trusts, or how they
must agree).

**STATUS (2026-07-16): RESOLVED — David answered directly.** Margin notes on the 7/16 review:
*"Units calculated on their actual time entered NOT on scheduled time"* + *"Counselor must
enter time start and end of services"* + *"Counselor entered time rules."* A THIRD answer,
distinct from both "clock" and "typed unit count": the counselor enters the session's actual
start/end time, and units COMPUTE from that — matching the paper Individual Note ("Time
2:00-3:15pm → Units: 5"). Program hours are meant to come from counselor-entered actual time,
not the schedule.

Confirmed wrong as feared. `client_accrued_hours` sums `duration_minutes`
(`20260606_ws3_1_session_hours_accrual.sql:51-63`), and `duration_minutes` has exactly two
write paths, both schedule-derived: booking insert (`services/api.ts:417-426`, from the chosen
scheduled slot) and reschedule update (`services/api.ts:601-611`, from the new scheduled slot).
Mark-Complete (`AppointmentStatusModal.tsx`'s `onSetStatus`, line 547) never touches
`duration_minutes`. So today: program hours (the SATOP completion gate,
`services/complianceEngine.ts:304`) run entirely on SCHEDULED time — exactly the mechanism
David just said is wrong. Live spot-check 2026-07-16: 20 sampled Completed appointments all
show `duration_minutes` exactly equal to scheduled `end_time - start_time`, and
`billable_units` is NULL on all 20 — the gate is running on pure schedule-derived hours with
zero counselor correction in live data today.

`clinical_notes` (11 columns, confirmed live 2026-07-16, unchanged since the 7/15 domain-model
recon — see `docs/DOMAIN-MODEL-2026-07-15.md` §5) has **no time-of-service field** — adding
counselor-entered start/end requires a migration. The units picker
(`AppointmentStatusModal.tsx:527-543`) is a unit-COUNT select prefilled from scheduled duration
(`:137-141,158-166`), not a time-range input — David wants counselors entering TIME, not
adjusting a count. `suggestedUnits()`/`unitGrainFor()` (`config/billableUnits.ts:76-94`) are
pure arithmetic on a minutes number and need no change; `computeUnits()`'s `asserted`/
`suggested` split (`components/clients/ClientSessionsTab.tsx:81-94`) today distinguishes
"human-entered count" vs. "schedule-derived suggestion," not "actual time" vs. "scheduled
time" — it would need restructuring so a future actual-time-derived suggestion isn't
indistinguishable from today's schedule-derived one.

Scope: BOTH schema (a new time-of-service field, likely on `clinical_notes`; `duration_minutes`
and/or `client_accrued_hours` need to point at the new source or be redefined) AND UI
(`AppointmentStatusModal.tsx`'s Mark-Complete panel needs a time-range control, not just a
count select). Fix pending — not built here, this entry records what's now confirmed true.

## 11. UNIT GRAIN — RESOLVED 2026-07-15 (was: "service_type can't express individual vs group")

**STATUS: RESOLVED — grain turned on 2026-07-15 (feat/units-on).** This entry previously
claimed a vocabulary gap: that `counseling` bundling individual AND group blocked any honest
grain, because individual bills per 15-min unit (H0004) while group bills per 45-min unit
(H0005). **That theory came from an out-of-state regulation, not from ACS, and David's own
words overrule it.** ACS Updates call, 2026-07-14 (00:20:44): units "from 1 to 12 …
dictated in each note", confirmed on **15-minute intervals**, on "the **group and** session
notes" — **one grain for both group and individual**. No procedure-code table, no per-code
caps, no HCPCS (00:26:51: "what we need … is to be able to show the number of units").

Consequences of the resolution:
- `counseling` = `{ unitMinutes: 15, maxUnits: 12 }` in [config/billableUnits.ts](config/billableUnits.ts).
  Karen's 120–180-min SATOP Groups prefilling 8–12 units is very likely **CORRECT**, not a
  misfire — the earlier "~3× overstatement" claim in this entry is retracted.
- The picker and the drill-in row render on their own (no un-hiding step was needed —
  exactly as designed when the render was made silent).
- `education` and `rehabilitative_support` grains stay **unset** — the transcript doesn't
  cover them; still no guessing. `procedureCode` stays null (David specified none).
- Kept for history: the individual/group vocabulary limitation in `service_type` is still
  factually true — it just no longer matters for unit grain, since both share 15 min.

## 12. DEAD LEGACY BILLING COLUMNS (decide later)

`appointments` still carries pre-app billing columns that this feature did NOT reuse and
that have **zero code references** (confirmed at 47c0535): `session_rate` (default 125.00),
`payment_status` (default 'unbilled'), `notes_complete`, `date_time`, `is_court_mandated`.
They were intentionally left untouched — the new work uses the new `billable_units` column,
not these. A future cleanup can drop them after confirming no out-of-repo consumer reads
them; not this sprint.

## 13. `billing_type` IS NOT A TRUSTWORTHY PAYER FIELD (cleanup + CHECK before anything gates on it)

The units gate keys ELIGIBILITY off `program_type` (via `isSatopProgram`), NOT off any payer
field, on purpose — `clients.billing_type` is not fit to gate on today:
- **No CHECK constraint** (added free-text in
  [20260522_clients_add_intake_fields.sql:6](supabase/migrations/20260522_clients_add_intake_fields.sql:6));
  every other client axis (`program_type`, `client_type`) is CHECK-enforced.
- **22 of 34 live clients are NULL**; only Self-Pay (10) and Court Mandate (2) are populated.
- The TS union ([types.ts:103](types.ts:103)) lists `Court Mandate | Employer Mandate |
  State Funded | Insurance | Sliding Scale` — it **omits `Self-Pay`, which is the modal
  default** ([components/clients/EditClientModal.tsx:198](components/clients/EditClientModal.tsx:198)),
  so the type and the data already disagree.

Before any logic (billing eligibility, payer routing) may key on `billing_type`, it needs a
cleanup pass + a CHECK constraint reconciled with the TS union. Not this sprint.

## 14. NO ENVIRONMENT SEPARATION — dev and prod are the same DB (discovered 2026-07-15)

[services/supabase.ts:3](services/supabase.ts:3) is **hardcoded** to the shared remote
`ldzzlndsspkyohvzfiiu.supabase.co`; there is **no `supabase/config.toml`** and **no local or
dev database**. Consequences:
- Dev and prod are the SAME database. There is no environment to rehearse a schema change in
  — the billable-units migration could not be smoke-tested against a real column anywhere but
  prod (the gate logic was proven with a standalone in-memory test instead).
- Any app run, any manual test write, hits **the shared DB**; contents are **demo data today**.
  It becomes a PHI concern the day real client records exist. During this deploy, an out-of-range
  test write (`billable_units=13`) was correctly rejected by the CHECK — but the Postgres error
  `DETAIL` echoed a demo client's row (name + session), which would be a PHI leak against real
  records. This is a **HIPAA-bound** product on a **shared** multi-app DB with no BAA
  (see [[project_compliance_recon_day30]]).

Discovered during the billable-units deploy. **Not scoped, not scheduled** — written down so it
stops being invisible. Real fix is a separate dev/staging Supabase project (or local stack) so
schema and data changes never rehearse against production PHI.

## 15. PROGRAM FALLBACK FAILS OPEN for the billing gate (discovered 2026-07-15)

[services/api.ts:154](services/api.ts:154) defaults a **non-prospect** client with a null
`program_type` to `'SATOP'`:
```ts
const program = c.program ?? c.program_type ?? (status === 'prospect' ? '' : 'SATOP');
```
This was written when `program` only drove **compliance rule selection**, where defaulting an
unknown client INTO the regulated program is the conservative (fail-closed) error. It is now
ALSO the **billing eligibility gate** (config/billableUnits.ts → `isSatopProgram`), where the
same default is the DANGEROUS (fail-OPEN) error: an unknown client reads as DMH-billable.

- **Harmless today**: every grain is unset, so nothing renders regardless of eligibility.
- **Live the day David's procedure codes land**: a non-prospect null-program client would then
  render a units picker and be billable.
- **The only guarantee is a data-fact comment dated 2026-06-17.** Re-checked live 2026-07-15:
  `SELECT status, count(*) FROM public.clients WHERE program_type IS NULL GROUP BY status`
  → `[{"status":"prospect","count":5}]`. All 5 null-program clients are prospects (→ `''` →
  not eligible), so the fallback is fail-closed **in current data only**. Nothing in the schema
  enforces it — no CHECK forbids a non-prospect null `program_type`.

Not fixed here — changing the default also touches compliance rule selection and needs its own
recon (which surfaces should read null-program as "unknown/ineligible" vs. "SATOP").

## 16. PHI IN CONSTRAINT-ERROR DETAIL (observed 2026-07-15)

Postgres emits the FULL failing row in a CHECK violation's `DETAIL`. Observed live during this
deploy: a rejected `billable_units = 13` write echoed a **demo** client's name and session in the
error detail. The mechanism is real and applies to **every CHECK on every clinical table**, not
just this one — it becomes a PHI leak when real records exist. Risk path: Supabase logs, Postgres
logs, browser console, error toasts — any of which could carry PHI off a rejected write, on a
HIPAA-bound product (see [[project_compliance_recon_day30]]).

**Design rule for when the units picker goes live:** validate/clamp the unit count CLIENT-SIDE
so the DB CHECK is a backstop that never fires in normal use, and NEVER surface a raw Supabase
error to the UI on this app (map to a generic message; log the detail server-side only).
Belongs in the hardening track alongside audit_logs, note immutability, and documents RLS.

## 17. RECORDS TAB merges the Documents and Forms surfaces (2026-07-15)

The client record's former `Documents` and `Forms` tabs were merged into one `Records` tab
([pages/ClientWorkspace.tsx](pages/ClientWorkspace.tsx)) — a form is a document, and two tabs
for one concept was two places to look. **Surface merge ONLY:** the Records tab reuses the two
existing components verbatim (`ClientFormsTab` over `Forms`, `ClientDocumentsGrid` over
`Uploaded documents`), stacked under plain headings. No merged list, no schema change, no data
movement.

The underlying **facts remain separate primitives by design** — `signedFormIds` (SIGNATURE,
from `form_submissions`, `client_id` uuid FK) vs `document_type` (DOCUMENT, from `uploaded_files`,
associated by `metadata.clientId` filtered in memory at [services/storageService.ts:229](services/storageService.ts:229)).
The surface unions; the truth stays two lanes.

**Open (not decided):** whether `composePacketReadiness` (the green-check/amber-gap readiness
checklist) moves from the Overview tab to Records once document rules join the checklist. It was
deliberately left on Overview here — moving it is a separate decision.

## 18. STALE BUNDLE AFTER DEPLOY — index.html cached for an hour (observed 2026-07-15)

Firebase Hosting serves `index.html` with `cache-control: max-age=3600`, so a returning user's
browser can serve the **PREVIOUS** app for up to an hour after a deploy — the cached `index.html`
keeps pointing at the old hashed JS bundle even though the server already returns the new one.

**Observed live 2026-07-15** during the Records-tab post-deploy verify: the server returned
`index-m5wKCmFN.js` while a cached `index.html` still pointed at `index-DRqQJeLL.js` (the pre-deploy
bundle); a cache-busted reload was required to load the new app. **Four deploys shipped 2026-07-15**
(billable-units groundwork, units re-gate, units render-quiet, Records tab) — a returning user may
not see any of them for up to an hour after each.

**Consequence:** David may report shipped work as missing (he'd be looking at a cached old app).
**Candidate fix:** set a `no-cache` / `max-age=0` header on `index.html` in `firebase.json`
(hashed `assets/*` stay long-cached — their names change per build, so they're safe to cache
forever). **Not scoped, not applied.**

## 19. PDS-GEMINI-PROXY IS AN OPEN RELAY (discovered 2026-07-15)

The `pds-gemini-proxy` Supabase edge function (project `ldzzlndsspkyohvzfiiu`, version 17, ACTIVE)
gates on `verify_jwt: true` — but that verifies the Supabase **anon** key, which is **public by
design and ships in every client bundle**. The function has **no model allowlist, no rate limit,
and no tenant check**; it is a transparent passthrough that strips any client-supplied `?key=` and
injects the server-side `GEMINI_API_KEY`, forwarding to `https://generativelanguage.googleapis.com`.

**Consequence:** anyone who reads the bundle can call any Gemini model at any volume, billed to
that key. Compounds the known **Tier-1 quota cap** (hit 4/21–22) shared with FieldFlow, AIVA, and
Story Scribe.

**Related exposure:** the same shared anon key sits in plaintext on disk at
`Aiva\031926\utils\pdfStamper.ts:19` and `Aiva\032226\utils\pdfStamper.ts:19`.

**Candidate fixes:** reject `role='anon'` and require an authenticated user JWT; or add an
app/tenant check; or add a model allowlist + rate limit.

**Billing project UNRESOLVED** — the `GEMINI_API_KEY` value is write-only via the Management API.
To resolve: AI Studio → API keys → find the key and read its owning GCP project. A personal Gmail
project vs `gen-lang-client-0121881478` changes the urgency. **Not scoped, not fixed.**

## 20. DOC-TYPE ACCURACY IS UNMEASURED — and the 'other' rate is not the evidence (2026-07-15)

20 of 33 rows in `therapyhub-patient-files` carry `document_type='other'`. Investigated 2026-07-15:
**most are non-clinical test material** scanned in during development (marketing PDFs, an
AI-generated image, a downloaded `.jfif`, another app's collateral) — `'other'` is the **correct**
label for those. **This rate says nothing about classifier quality**; the classifier is working.

Separately and still true: the labels in `uploaded_files` were produced **by `gemini-2.5-flash-lite`
itself**, so there is **no ground truth** in the table. If label accuracy ever needs to be known,
it requires a **human-labeled sample**, not a model-vs-model comparison. **Not scoped.**

(For the record: the flash-lite → gemini-2.5-flash switch was evaluated 2026-07-15 and **CANCELLED**
— `'other'` was measuring test junk, not classifier weakness. Stay on `gemini-2.5-flash-lite`.)

## 21. UNIT CAP — RESOLVED 2026-07-15 (cap is 12)

Earlier open question: David said "1 to 12" (00:20:44) but separately described "four hours of
individual session" (00:21:37 = 16 units). **RESOLVED — the cap is 12**, confirmed twice:
David 7/15 ("Units entered by staff based on group length, 1 to 12") and the paper Individual
Note (2:00–3:15pm = 75 min = Units: 5, confirming the 15-min grain; a 3-hour group ÷ 15 = 12).
The "four hours" was loose speech. The DB CHECK (`appointments_billable_units_range`) and the
picker both enforce 1–12 correctly — no change needed.

## 22. FORM-ASSIGNMENT MODEL IS WRONG FOR THIS PRACTICE (client-side removed 2026-07-15)

Admin/intake documents are a **pre-scheduling gate** (complete / incomplete), not a task queue
with due dates. The client-side "Assign New Form" button was **removed 2026-07-15** — it was
already inert (opened `AssignFormModal` with no `forms` prop → empty template dropdown →
no-op submit). Rebuild as **packet-status**, pending David's answer to "what paperwork must be
done before you can schedule a client?"

The pre-scheduling packet **may already be derivable** from the registry, pending David:
- `requiredForCompletion: true` + `audience: 'client'` = **consent-treatment, hipaa-ack,
  authorization-release, telehealth-consent, satop-checklist, emergency-contact** — near-identical
  to David's admin examples (HIPAA, consent to treatment).
- `audience: 'staff'` (**treatment-plan, discharge-summary, chart-checklist, session-attendance**)
  is a clinical signal.
- **Unresolved:** `satop-checklist` and `satop-intake` (which side?). **Missing tokens:**
  a *demographic sheet* (admin) and an *OMU* (clinical) have no registry entry at all.
- **Do NOT build on this** — pending David. Admin-side Forms library assign flow
  (FormsLibraryTab, FormLibrary) is untouched and still works.

## 23. FORM ASSIGNMENTS CARRY NO PARTY/CONTEXT — legitimate duplicates are indistinguishable (2026-07-15)

`assignForm` ([services/api.ts:1421-1448](services/api.ts:1421)) has no uniqueness guard — but a
**constraint on `(client_id, form_id)` would be WRONG**: multiple Authorizations for Release of
Information to **different parties** (one to the court, one to an employer) is a legitimate
clinical case. The real gap is that assignments carry **no party/context field**, so two valid
ROIs are indistinguishable in the list (it shows only the form name). Witnessed on **Derek Stone
2026-07-15**: two `authorization-release` rows, assigned 6/9 and 6/30, different due dates, both
valid. **Do not "fix" with a constraint** — the fix is to capture the party/context per
assignment so the list can tell them apart. Pending the packet-status rebuild (#22).

## 24. UNDEFINED SECONDARY-TEXT TOKEN — washed-out labels app-wide (2026-07-15)

`text-on-surface-secondary` is referenced **431×** across the app but is **UNDEFINED** in the
index.html Tailwind theme config — it resolves to nothing (no color emitted), which is the root
cause of washed-out/near-invisible secondary labels app-wide. The defined token is
**`surface.secondary` (#64748B, dark #94A3B8)** → `text-surface-secondary`, used 174×.

Fix is likely a **single theme addition** (define `on-surface`/`on-surface-secondary` in the
`colors` block, or codemod the 431 sites to `text-surface-secondary`), but **431 call sites means
it needs its own verification pass** — a wrong global swap could shift contrast in surfaces that
were relying on the inherited fallback. Found 2026-07-15 during the units-display DetailRow fix
(that one component was moved to the correct `text-surface-secondary` token). Not scoped here.

# Surfaced 2026-07-15 — David 7/15 packet recon (docs/DOMAIN-MODEL-2026-07-15.md)

## 30. APPOINTMENT↔NOTE LINK — FIXED for the wrap-up path, left honestly unlinked for the other

**Note-attached star on the calendar grid — assessed and SKIPPED, same commit batch.** Now that
0d verifies, this was back in scope conditionally: reuse the existing `noteByAppt` Map, skip if
it's not trivially reusable. It isn't. `noteByAppt` is built inside
[ClientSessionsTab.tsx:207-217](components/clients/ClientSessionsTab.tsx:207) from a
`clinical_notes` query hard-scoped `.eq('client_id', client.id)` — one client's notes only.
[components/sessions/scheduleLane.tsx](components/sessions/scheduleLane.tsx) (the calendar grid)
has no `clinical_notes` fetch at all and renders appointments across every client and counselor
for a whole week simultaneously — there is no single `client_id` to scope a reused query to.
Making the star work would mean a NEW query (all visible appointments' notes) and a NEW Map at
the grid level — exactly the "second resolution path" this item said not to build. Skipped;
revisit only as its own scoped task, not a reuse of `noteByAppt`.

**STATUS: FIXED (partial) 2026-07-15, branch `feat/crawl-batch-1`.** The 7/14 Session History
drill-in's join ([ClientSessionsTab.tsx:216-217](components/clients/ClientSessionsTab.tsx:216),
`noteByAppt.get(a.id)` keyed on `appointment_id`) was always correct — but it had never linked
a single real, app-written individual note. `saveClinicalNote()` only sets `appointment_id`
when the caller passes one ([services/api.ts:1078](services/api.ts:1078)), and neither
individual-note save site did. Live before the fix: 21 total `clinical_notes` rows, 3 linked,
and all 3 were hand-seeded directly via SQL migration (`20260518_demo_data_marcus_pat.sql`,
`20260605_demo_data_completed_oep.sql`), not written by the app at all.

**`SessionWrapUpModal.tsx` (the wrap-up path) — fixed.** It does NOT itself have an appointment
in scope (the earlier recon's premise that it did was imprecise), but two of its trigger paths
do: `SessionManagement.tsx`'s `handleStartSession` holds a real `selectedAppt` (an `Appointment`)
at the moment it navigates, and now threads `selectedAppt.id` through as a `?appointmentId=`
query param on `/session/:clientId`. `ActiveSession.tsx` reads it via `useSearchParams` and
passes it down as a new optional `appointmentId` prop into `SessionWrapUpModal`, which now
passes it into `saveClinicalNote(..., { appointmentId })`. Verified live: booked a real dev
session from `SessionManagement` → Jessica Marie's Anger Evaluation appointment → confirmed the
URL carried `?appointmentId=72768937-...` → wrote a note via `saveClinicalNote` with that id →
`clinical_notes.appointment_id` populated → the Session History tab rendered "NOTE ON FILE" on
the real appointment row. Test row deleted after verification.

Two entry points stay deliberately unlinked, honestly:
- **`ClientProfileHeader.tsx`'s direct "Start Session" button** (`navigate('/session/${client.id}')`,
  no query param) — this is a client-initiated "start a session with this client" affordance,
  not triggered from any specific scheduled appointment. There is no real appointment id to
  thread here; inventing one (e.g. "today's next appointment") would be exactly the
  date/client-proximity guess this item was told not to make. Left unlinked.
- **`pages/VideoSessions.tsx`'s wrap-up** — `sessionToWrapUp` is a `VideoSession` (`types.ts:541`),
  a distinct mock entity with no `appointments.id` field at all, and this whole surface is
  already a known MOCK (TRIAL_HIDDEN). Left unlinked; no fake id passed.

**`SmartNoteImporter.tsx` (the typed/dictated note path) — genuinely does not know its
appointment, left unchanged.** Traced its only entry points: the `open-note-modal` window event
(`MainLayout.tsx`) and `NoteStudioDock.tsx` both carry only a `clientId`, never an appointment
reference — this is a free-floating "write a note for this client right now" surface, not tied
to any specific scheduled session (it can be opened from the client header at any time, session
or not). No appointment id exists anywhere in this call chain to pass through. Per the
no-heuristic-backfill rule, `saveClinicalNote` calls here (`SmartNoteImporter.tsx:62,81`) are
unchanged — these notes stay unlinked, shown as their own standalone rows in Session History
(the existing, correct behavior for notes with no `appointment_id`).

**The 18 pre-existing orphaned demo notes were left as-is, deliberately** — demo data, and a
heuristic backfill (matching by date/client proximity) is exactly the kind of guess that becomes
a wrong clinical record. Not touched.

## 25. GROUP NOTE INTEGRITY DEFECT — N duplicate rows, no correlating identifier

**This is a records-integrity DEFECT, not a roadmap gap.** `distributeGroupNote()`
([services/api.ts:1143-1202](services/api.ts:1143)) writes N independent `clinical_notes` rows —
one per attendee — via a loop over `saveClinicalNote()` (line 1179). Each row is stamped with
that attendee's own `appointment_id` and `note_type='Group Session'`, and the partial unique
index `ux_clinical_notes_group_seat`
([20260705_group_checkin_1_clinical_notes_group_seat_unique.sql:32-34](supabase/migrations/20260705_group_checkin_1_clinical_notes_group_seat_unique.sql))
makes a re-post for the SAME seat idempotent (Postgres 23505 → classified `alreadyPosted`,
line 1196 — no duplicate chart entry).

**What the idempotency guard does NOT do: correlate the N rows across DIFFERENT clients as one
clinical event.** Nothing links attendee A's row to attendee B's row from the same occurrence —
no shared `occurrence_id`, no `group_note_id`, nothing beyond `note_type` plus each attendee's
own seat coincidentally sharing `group_id`+`start_time`. Each of the N rows is independently
editable after posting — there is no fan-out on edit, so amending one client's copy does not
touch the others. **Amending a group note after the fact silently diverges the attendees'
records: up to 12 versions of what should be one clinical event, with no mechanism to detect
or reconcile drift.**

Pre-production, no real client data exists yet, so this is not urgent — but it is a
records-integrity defect in a compliance product and **must not survive into production**.

**Fix shape (fact, not a plan):** either (a) a `note_attendees` join table so one
`clinical_notes` row structurally covers N clients, replacing the per-seat write; or (b) keep
the per-seat write pattern but add a shared `occurrence_id`/`group_note_id` column so the N rows
are provably one event and an edit can be fanned out (or at minimum drift can be detected).

Witnessed 2026-07-15 recon; full context in [[project_domain_model_2026_07_15]].

## 26. GROUP ROSTER SCAFFOLDING IS UNUSED

`group_enrollments` (the real client↔group many-to-many table,
[20260606_ws6_1_standing_groups.sql:61-69](supabase/migrations/20260606_ws6_1_standing_groups.sql:61))
has **zero application-code readers** — grep for `group_enrollments` across the repo hits only
migration/seed files. Live row count: 4, all from seed SQL.

In its place, "who's in a group occurrence" is reconstructed at runtime from whichever
`appointments` rows happen to share `group_id`+`start_time`
([services/greenRoom.ts:134-151](services/greenRoom.ts:134)), and "who showed up"
(present/absent) is **ephemeral client-side state only** —
[pages/GreenRoom.tsx:232-233](pages/GreenRoom.tsx:232), a `useState<Set<string>>` defaulting
everyone present, never persisted. The UI itself admits the gap: *"Live attendance isn't
available yet... We show the enrolled roster from the schedule"*
([pages/GreenRoom.tsx:469-470](pages/GreenRoom.tsx:469)) — though that "enrolled roster" claim
is itself inaccurate, since `group_enrollments` (the actual enrollment table) is never queried.

Net effect: the roster David describes ("add or remove clients... without effecting the static
group assignment") has no durable place to live today — there's a real M:N table for the static
assignment, unused, and no table at all for a per-occurrence override.

## 27. NOTE PROVENANCE FIELDS ARE INCOMPLETE FOR A COMPLIANCE SURFACE

Three related gaps, all on `clinical_notes` or its neighbor `treatment_plans`:
- `clinical_notes.appointment_id` is null in practice for BOTH individual-note save paths
  (`SmartNoteImporter.tsx`'s `handleSave`, `SessionWrapUpModal.tsx`'s `handleNext`) — neither
  passes `appointmentId` to `saveClinicalNote()`. Only `distributeGroupNote()` populates it (see
  #25). The appointment↔note link Session History relies on
  ([components/clients/ClientSessionsTab.tsx:216-217](components/clients/ClientSessionsTab.tsx:216))
  is therefore only ever populated for group notes today.
- `clinical_notes.is_signed` is a boolean only — no `signed_by`/`signed_at` column exists.
  [components/clients/ClinicalNoteView.tsx:8-14](components/clients/ClinicalNoteView.tsx:8)
  documents this explicitly and renders the generic role "Clinician" instead of a name, and
  "Recorded" (created_at) instead of "Signed at", because neither exists.
- `treatment_plans.content` (jsonb) problems have no stable id/ordinal —
  [components/clients/TreatmentPlanTab.tsx:176-179](components/clients/TreatmentPlanTab.tsx:176)
  numbers them from array position at render time, which shifts on reorder/edit.

All three block a reliable "who signed this, when, referencing which problem" trail — the
honesty guards already in the code are working as intended; the underlying data just isn't
there yet.

## 28. CALENDAR STATE ISN'T SCHEMA-ENFORCED OR FULLY WIRED

`appointments.status` has no DB CHECK constraint — plain `text` (confirmed live), enforced only
by the TS union `AppointmentStatus` ([types.ts:411](types.ts:411)); live data already shows
case-drift (`completed`:182 vs `Completed`:3, a stray `no_show`:1), confirming nothing enforces
it at the DB layer.

Separately, `appointments` carries `reschedule_reason`, `rescheduled_at`, `cancellation_reason`,
`cancelled_at` columns (confirmed live) that no code anywhere writes to or reads — a repo-wide
grep for these four column names returns zero matches outside `information_schema`. They look
purpose-built for reschedule/cancellation history but are vestigial.

Neither is urgent alone; together they mean "what happened to this appointment and when" has no
enforced vocabulary and no populated audit trail today (reschedule/cancel actions also don't
reach `audit_logs` — same 2026-07-15 recon).

## 29. SIGNATURE CAPTURE EXISTS BUT ISN'T CONNECTED TO ANY LIVE CONSENT FORM

The only real canvas/stroke signature component in the app,
[components/ui/SignaturePad.tsx](components/ui/SignaturePad.tsx) (`canvas.toDataURL('image/png')`
→ base64 PNG), is wired to exactly two places: session-attendance sign-in
(`ManageAttendeesModal.tsx`) and a trial-hidden, unreachable route
(`pages/portal/RecoveryPlanForm.tsx` — see `App.tsx:173-174`'s own "phantom twin" comment).
**None of the 15 live FORM_REGISTRY entries use it.** Every "signature" field on a live
client-facing consent form (`consent-treatment`, `hipaa-ack`, `authorization-release`,
`telehealth-consent`, `satop-checklist`, `emergency-contact`, etc.) is a plain typed-text
`FormField`, not a captured stroke.

Relevant to B5 (signed-copy portal prerequisite, 7/15 packet): whether a typed name satisfies
"signed" for the pilot, or whether real capture needs wiring into `BaseFormTemplate` first, is a
scope-defining decision, not a technical gap — the component to wire already exists.

## 31. "PRIMARY COUNSELOR" ON THE CLIENT HEADER IS NOT A MISSING FIELD — IT'S #2, ESCALATED

**Same debt as [#2](#2-orphan-rows-blocking-referential-integrity), not a new one.** David's
7/15 doc asks for "Primary Counselor" in the client header (crawl-batch-1, item 4). The only
candidate column, `clients.assigned_therapist_id` (uuid), exists but is **100% orphaned live —
19 of 19 non-null rows point to no `counselors` row** (re-witnessed 2026-07-15, matches #2's
original June count exactly: nothing has written to or cleaned this column since). This was
tech debt in June; as of this ask it's on David's critical path.

**Fix shape (same as #2/#3, not a new mechanism):** resolve the 19 orphans (backfill from a
reliable source or NULL them out — #2's original "present-then-apply migration, exact UPDATE
SQL shown for approval" plan still applies), then add the FK
(`clients.assigned_therapist_id → counselors(id)`, the constraint #3 already specifies but
couldn't apply against dirty data). Once that lands, the header field itself is trivial — a
straight join, no new mechanism needed.

**Do not parse a name out of `appointments.therapist_name` as a workaround** — free text, no
guarantee it matches a `counselors` row, and "primary" implies one stable answer per client, not
whatever the most recent appointment's text happened to say. Not built here; this entry exists
so it's not re-discovered as if new.

# Surfaced 2026-07-16 — David 7/16 review answers

## 34. NO GUARD ON CLIENT CREATION — accidental duplicate confirmed live

No uniqueness check, DB constraint, or client-side warning exists anywhere in the client-
creation path. `components/clients/CreateClientModal.tsx:26-62` validates only that `name` and
`phone` are non-empty; `services/api.ts:1747-1759`'s `addClient()` does a plain insert with no
pre-check. The only DB constraints on `public.clients` are three CHECKs (`client_type`,
`program_vocab`, `status_lifecycle`) plus the primary key — no unique index on `name`, `dob`,
`case_number`, `email`, or `primary_phone`.

**Live-witnessed 2026-07-16**: two "Jessica Marie" rows (`df2e0d21-8363-4cf5-944a-14627980cb87`,
`6cbbf0d6-2d26-4c95-842b-cb68cf0c54a6`), created 12 minutes apart on 2026-07-15, every field
identical (`dob`, `case_number`, `email`, `primary_phone`, `program_type=ANGER_MANAGEMENT`) — an
exact resubmit, consistent with Jess's reported duplicate-create incident.

Unlike [#23](#23-form-assignments-carry-no-partycontext--legitimate-duplicates-are-indistinguishable-2026-07-15)
(two ROIs to different parties is legitimate — a constraint there would be WRONG), duplicate
client records are never legitimate — same class of gap, opposite correct fix. The only two
fields populated on every live row are the practical match candidates: `name` (34/34) and
`primary_phone` (34/34); `email` is ~71% populated, `case_number` ~56%, `dob` only ~29% (too
sparse to require). A soft "a client named X already exists — continue?" pre-insert check is
the shape that fits: a client-side lookup-then-confirm in `CreateClientModal.tsx` before the
`addClient()` call, matching on name (+ phone/email/dob when populated) — UI-only, no schema/
migration needed, no hard DB constraint (name alone isn't unique-safe — common names and
legitimate re-registrations exist).

A second name collision, "Derek Flower" (`7286f2a2-...` active with full data, `8f2c1747-...`
prospect with mostly-null fields, created a day apart), looks like a separate prospect-intake
shell rather than the same accidental-duplicate bug class — noted, not conflated.

Reported by ACS staff (Jess), 2026-07-16.

## 35. THREE FORM_REGISTRY ENTRIES UNRECOGNIZED BY DAVID — two are scaffolding, one is a real gate under the wrong name

David Yoder (clinical director) circled `chart-checklist`, `session-attendance`,
`satop-checklist` in the 7/15 packet and wrote "Don't know what these are." All three trace to
the same origin commit, `5abcf27` "Initial commit: ACS TherapyHub with 11 Clinical Forms"
(2026-01-20, AI-scaffolded bootstrap) — not a transcription pass against a specific ACS
document set.

**`session-attendance`** (`config/formRegistry.ts:48`) — zero live `form_submissions` rows, not
in `CORE_REQUIRED_FORM_IDS`/any gate, and its only same-named neighbor
(`ManageAttendeesModal.tsx`'s sign-in `SignaturePad`) is structurally unrelated code. **Ours —
safe to remove pending David's explicit confirm.**

**`chart-checklist`** (`config/formRegistry.ts:47`) — not gated, exactly one live row and it's
on the demo witness client (Marcus Reyes, `aaaaaaaa-...`), not a real client. **Ours — safe to
remove pending David's explicit confirm.**

**`satop-checklist`** (`config/formRegistry.ts:32`) — DIFFERENT. It carries
`requiredForCompletion: true`, is one of 6 ids in `CORE_REQUIRED_FORM_IDS`
(`config/formRegistry.ts:64-67`) feeding `REQUIRED_FORMS_BY_LEVEL`, and its gate
(`services/complianceEngine.ts:725-743`) fails the "Required forms signed" gate — and therefore
blocks `eligible` (the completion certificate) — if unsigned, citing 9 CSR 30-3.206(13)(F).
Staff-facing UI (`services/packetReadiness.ts:93-111`) never shows the raw id — only its title,
"Orientation Checklist." Its field content (Client Bill of Rights, grievance procedure,
confidentiality/HIPAA, program rules, "I agree to begin treatment") is exactly the shape of a
real SATOP intake-orientation acknowledgment, distinct from the separate `satop-intake` entry.
The two live rows are empty-data 2026-06-05 seed inserts, not organic submissions — that
reflects no real client has been run through the live gate yet, not that the form is fake.
**Likely theirs in substance, ours only in the technical id/label — moderate-to-high
confidence. Do not remove without re-confirming with David using the title "Orientation
Checklist," not the id — removing it would silently break the completion-certificate gate for
every SATOP level.**

**#35's removal is now BLOCKED on #36 below, not on David.** Discovered while scoping the
removal: `FORM_REGISTRY` does not gate what staff can assign or fill, so deleting the two
entries would not achieve "no longer assignable" — see #36.

## 36. THREE INDEPENDENT "FORM CATALOG" SOURCES, NOT ONE — FORM_REGISTRY GATES COMPLIANCE, NOT ASSIGN/FILL

Found 2026-07-16 while scoping removal of `chart-checklist`/`session-attendance` (#35). There
is no single source of truth for "what forms exist" — three completely independent lists coexist,
disagree in places, and are consumed by different code paths:

1. **`config/formRegistry.ts`'s `FORM_REGISTRY`** (15 entries) — feeds
   `REQUIRED_FORMS_BY_LEVEL`/the completion-cert gate (`services/complianceEngine.ts:725-743`,
   9 CSR 30-3.206(13)(F)) and `CLIENT_REGISTRY_FORMS` (the client-portal list,
   `pages/portal/PortalDocuments.tsx:18`). **This is load-bearing for compliance.**
2. **`components/FormLibrary.tsx`'s own hardcoded `allForms` array** (14 entries, imports each
   form component's own `*_DEFINITION` object directly, `FormLibrary.tsx:33-48`) — this is what
   actually renders the "Assign" and "Start" buttons staff use. Fully decoupled from
   `FORM_REGISTRY`; `assignForm()` (`services/api.ts:1498-1526`) documents itself explicitly:
   *"NOT a hard allowlist — assignForm still inserts whatever formId it's given"* — it only
   looks up `FORM_REGISTRY`/`getFormTemplates()` for a title/category label on the inserted row,
   never to block.
3. **`components/clients/ClientFormsTab.tsx`** — reads `dbForms` from `data/database.ts`
   (`ClientFormsTab.tsx:8`, explicitly commented *"Using mock forms for now"*) — a THIRD,
   disconnected list, mock data, consulted by neither of the other two.

**The three disagree.** `FORM_REGISTRY` has 15 ids; `FormLibrary.tsx`'s `allForms` and
`pages/Forms.tsx`'s router `switch` (`pages/Forms.tsx:76-103`) both have the SAME 14 — missing
`treatment-plan` entirely. `treatment-plan` exists only in `FORM_REGISTRY`; there is no `View`
value, no switch case, no FormLibrary card for it — a staff member can never see or fill it
through any live UI path. Two titles also disagree between `FORM_REGISTRY` and the component
that actually renders (`FormCard` renders `definition.title` off the imported component object,
`FormLibrary.tsx:86-88`, NOT `FORM_REGISTRY`'s title):

| id | FORM_REGISTRY title | component (rendered) title |
|---|---|---|
| `meeting-report` | "AA/NA Group Meeting Report" | "Support Group Meeting Report" (`MeetingReportForm.tsx:50`) |
| `telehealth-feedback` | "Telehealth Session Feedback" | "Telehealth Experience Feedback" (`TelehealthFeedbackForm.tsx:53`) |

Separately, two ORPHAN definition files exist that neither `FormLibrary.tsx` nor
`pages/Forms.tsx` import at all: `components/forms/ConsentTreatmentFormDef.tsx`
(`CONSENT_TREATMENT_DEFINITION`, duplicate of `ConsentForTreatmentForm.tsx`'s
`CONSENT_FORM_DEFINITION`) and `components/forms/RecoveryPlanFormDef.tsx`
(`RECOVERY_PLAN_DEFINITION`, duplicate of `ContinuingRecoveryPlanForm.tsx`'s own
`RECOVERY_PLAN_DEFINITION` — same export name, different file, neither one wired to the other).
Dead scaffolding, not currently reachable from any route.

**Consequence for the pending admin/clinical split** (David unblocked 11 of 15 on 2026-07-16):
the split was scoped as "add a designation field to `FORM_REGISTRY`." That field alone would
render nothing, since `FormLibrary.tsx` (the actual staff-facing forms surface) doesn't read
`FORM_REGISTRY` at all. Before that work starts, a source-of-truth decision is needed:
consolidate onto one registry `FormLibrary.tsx`/`pages/Forms.tsx` actually read, or accept the
split lives in whichever file genuinely renders each surface. Not decided here.

**Not built. No files touched.** `#35`'s two removals (`chart-checklist`, `session-attendance`)
are on hold pending this decision, not pending David.

## 37. `public.uploaded_files` IS WORLD-READABLE/WRITABLE — ACS CLINICAL DOCUMENTS ARE EXPOSED (witnessed 2026-07-16, read-only)

Witnessed 2026-07-16 during Attesta's bucket/table recovery work (read-only introspection —
`select`/`information_schema` only, no writes). `public.uploaded_files` carries **18 accumulated
RLS policies**, including `"Allow public read/insert/update/delete"` (role `PUBLIC`) plus several
redundant `anon_*` policies — permissive-everything, not scoped by `is_staff()`/ownership/anything.

ACS's own clinical document pipeline (`services/storageService.ts` —
`ingestDocument`/`uploadToVault`/`fetchVault`, the exact file in THIS repo) writes into this table
under these same policies. Checked directly (read-only) 2026-07-16: **104 total rows; 33 lack
`hire_id`**. `hire_id` set = AIVA (see #39) — the 33 without it may be ACS or another app entirely;
**composition unverified, not guessed at here**. ACS's pilot with David Yoder is live, so any of
those 33 could be real client clinical documents (`extracted_text`, `extracted_entities`,
`clinical_significance`, `risk_flags` columns all exposed by the same policies) — did not read row
content to check, that's a separate step from this recon.

Fix reference: Attesta repo, `supabase/migrations/20260716_uploaded_files_and_bucket_recovery.sql`
— recreates the table with `private.is_staff()`/`private.my_client_ids()` RLS instead of copying
the permissive stack. Not a drop-in for this repo (check this repo's own RLS-helper naming/shape
before reusing the pattern), but the model — staff full access, client sees/inserts own rows only,
zero policy for anon — is the reference.

**Do NOT fix tonight. Do NOT touch westflow-platform.**

## 38. OPERATIONAL FALLBACKS LAND IN `clinical_notes` WHEN `outreach_log`/`tasks` ARE MISSING (low priority, report only)

Found 2026-07-16 alongside #37, during the same recon (diffing every `.from()` call in the
Attesta fork against its own `list_tables`). `services/alertsService.ts` (`logOutreach`,
`createTask`) tries a dedicated `outreach_log`/`tasks` table first, and on error falls back to
inserting a `clinical_notes` row with `note_type: 'Outreach'`/`'Task'`. Same file, same fallback
code, exists in this repo too.

Checked directly (read-only) on westflow-platform: **neither `outreach_log` nor `tasks` exists
here either** — this repo IS westflow-platform, so if this code path has ever run in production,
every outreach call and every task has landed as a `clinical_notes` row, not in its own table.

Not obviously right for a compliance product: operational records (a phone call log, a follow-up
task) blurring into the clinical record blurs what's supposed to be clean clinical documentation.
Not fixed, not urgent — report only, worth a look next time `alertsService.ts` or the
`clinical_notes` shape is touched.

## 39. AIVA HIRING DOCUMENTS EXPOSED BY THE SAME `uploaded_files` RLS — HIGHER URGENCY THAN #37 (witnessed 2026-07-16, read-only — flag for the AIVA repo, recorded here for now)

Same table, same read-only check, same date as #37 — split out because this is a different
app's data and a different urgency level. `public.uploaded_files` — AIVA's own hiring-document
vault (`bucket_id`/`app_id` default to `'project-aiva-afridroids'`/`'aiva'`) — has **71 rows with
`hire_id` set**. A "hire" is an employee being onboarded; ACS has clients, not hires, so these 71
are AIVA's, not ACS's (see #37 for the 33 that aren't AIVA-shaped).

**A June 2026 note recorded this exact RLS gap as "hardening required BEFORE real hire data
flows."** 71 hire-keyed rows existing now means that gate was already passed, unnoticed. AIVA is
live, with Deon Boshoff / Nashua Paarl as the anchor client — these 71 rows are real employees'
onboarding documents in South Africa, sitting behind `"Allow public read/insert/update/delete"`.
Dillon Jenner (Deon's son) is onboarding as a developer on this repo, for what it's worth as
context, not as a cause.

Witnessed read-only 2026-07-16 — row counts only, no row content read.

**Recorded here because this session is scoped to the ACS/Attesta side and this repo is what's
open — this is AIVA's problem, not ACS's or Attesta's. Flag for Dan to carry to the AIVA repo's
own tracker.** Do not fix. Do not touch westflow-platform.

## 40. CAPTURE: DRAG-DROP IS NOW ONE FILE AT A TIME (P2 consolidation, 2026-07-21)

Before P2 the grid dropzone ingested MULTIPLE dropped files in a loop (auto-classified, no
category step). P2 routes the dropzone through the shared capture flow (StaffDocumentUpload →
classify → Admin/Clinical category → ingest) so nothing enters uncategorized — but that flow is
single-document (the category is chosen per file). So a multi-file drop now takes the FIRST file
only. Fine for the common case (one doc at a time); if batch capture becomes common, add a
per-file category queue. Not urgent — flagged so the narrowing is on record, not silent.

## 41. RECORDS: EXISTING UNMAPPED DOCS LIVE ONLY UNDER "ALL" (P2, 2026-07-21)

The Admin/Clinical segmented filter is a DERIVE over the existing `document_type` via
`config/recordCategory.ts` — no backfill. Rows whose type is unmapped (`verification_slip`,
`completion_certificate`, `other`, `profile`, `null`, and the shared-table HR values) are never
bucketed into Admin or Clinical — they show under "All" with their type chip, correctly (the rule
is surface-don't-guess). But there is no in-grid affordance to RE-categorize an already-stored
doc; a user can only set the category at capture time. If David wants old docs re-filed, add a
"change category" action on the doc card (writes `document_type` through the same existing column).
App-only when it comes; deferred from P2 to keep scope to capture + grouping.
