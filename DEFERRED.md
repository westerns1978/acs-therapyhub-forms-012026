# DEFERRED — post-demo hardening

Findings recorded during the Phase 0 appointment-layer recon (2026-06-24). These are
intentionally **not** being fixed this sprint. The 6/30 demo calendar is built on
`appointments.therapist_name` (text), which attributes the correct counselor on screen.
The items below are about moving from name-based to a structured, referentially-enforced
`therapist_id` link — real work that depends on auth/roles plumbing we are not touching now.

## 1. `user.id → counselors.id` gap (why id-attribution isn't wired)

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
