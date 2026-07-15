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
It records a COUNT only — no dollars, no DMH/CIMOR submission. **The picker renders for
NOTHING today** — every grain is unset on purpose (see #11); the mechanism/schema/gate ship,
the grain table stays empty until David's codes land. Four gaps were left open ON PURPOSE;
none is a code bug.

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

## 11. SERVICE_TYPE CANNOT EXPRESS INDIVIDUAL vs GROUP — no grain assertable (blocked on David's DMH contract)

This is no longer "the grain table is unpopulated." It is a NAMED VOCABULARY GAP:
- The GRAIN axis of the units gate ([config/billableUnits.ts](config/billableUnits.ts)) is
  `service_type` (the WS3 accrual category: counseling / education / rehabilitative_support
  / other). That vocabulary **cannot express individual vs group**. `counseling` carries
  BOTH — and unit billing needs the split, because individual counseling bills per 15-min
  unit (H0004) while group bills per 45-min unit (H0005), a different grain and a different
  cap.
- **Live proof:** Karen Ventimiglia's SATOP Group sessions are stored with
  `service_type = 'counseling'` at 120–180 min (verified against `public.appointments`,
  `group_id` set). Under a 15-min counseling grain they would prefill ~8–12 units where the
  H0005 group answer is ~3–4 — a ~3× overstatement on the practice's dominant session type.
  That is why `counseling.unitMinutes` is now UNSET, alongside education and
  rehabilitative_support.
- **Consequence:** no grain can be asserted for any category today, so the units control
  **renders for nothing**. Eligibility (program = SATOP-family) works; there is simply no
  honest grain to pair with it. This is intended, not a regression.
- **Render is now silent (2026-07-15).** The two user-visible strings the groundwork shipped —
  the modal's "Unit billing not configured for this service type." line and the drill-in's
  "Billable units —" row — were **removed rather than fixed**, because a status line about
  unfinished plumbing does not belong on the clinician's daily close-out path. When David's
  procedure codes land and a grain is set, BOTH surfaces begin rendering **on their own**: the
  modal picker appears once `unitGrainFor` returns non-null, and the drill-in row appears the
  first time a real `billable_units` value is written. There is **no un-hiding step** — nothing
  was left commented-out or feature-flagged to re-enable.
- **Two candidate resolutions — DO NOT pick one here:** (a) David's procedure-code table
  supplies the individual/group grain split per code; (b) a new individual-vs-group axis is
  added on the appointment (the service_type vocabulary is extended or a sibling field is
  introduced) so the grain can be selected without guessing.
- Blocked on David's DMH contract, **not on code**. `procedureCode` stays null everywhere;
  no UI claims a real HCPCS code, submission, or DMH/CIMOR acceptance. When it resolves,
  populate this ONE module — no other file should need to change.

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
- Any app run, any manual test write, hits **real client records**. During this deploy, an
  out-of-range test write (`billable_units=13`) was correctly rejected by the CHECK — but the
  Postgres error `DETAIL` echoed a real client's row (name + session), i.e. PHI surfaced in an
  error path. This is a **HIPAA-bound** product on a **shared** multi-app DB with no BAA
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
deploy: a rejected `billable_units = 13` write echoed a real client's name and session in the
error detail. This applies to **every CHECK on every clinical table**, not just this one. Risk
path: Supabase logs, Postgres logs, browser console, error toasts — any of which could carry
PHI off a rejected write, on a HIPAA-bound product (see [[project_compliance_recon_day30]]).

**Design rule for when the units picker goes live:** validate/clamp the unit count CLIENT-SIDE
so the DB CHECK is a backstop that never fires in normal use, and NEVER surface a raw Supabase
error to the UI on this app (map to a generic message; log the detail server-side only).
Belongs in the hardening track alongside audit_logs, note immutability, and documents RLS.
