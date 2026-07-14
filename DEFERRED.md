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
