# DAVID AUG-5 MARKUP → CODEBASE MAP — 2026-08-07

Read-only recon. No code changes, no migrations, no deploys. Sources: local worktree @ `main`
(HEAD `0e1d213`), live Supabase `ldzzlndsspkyohvzfiiu` (read-only SQL), `DEFERRED.md`,
`RECON-acs-2026-07-27.md`, `DESIGN-signatures-2026-07-27.md`, `docs/design/forms-revision-080126.md`.

## ⚠ Two things before the map

1. **`docs/RECON-acs-2026-08-06.md` does not exist.** Not in the working tree, not in any branch,
   not anywhere in git history (`git log --all --diff-filter=A -- "*RECON*"` finds only the four
   2026-07-27/28 recons). This map was built against `RECON-acs-2026-07-27.md` + `DEFERRED.md` +
   fresh code/DB witness instead. If the 08-06 doc exists somewhere else, reconcile before acting.
2. **Several premises in the Aug-5 task list are stale.** The 7/28 L-batches (`l-batches-0728`,
   merged) and the 8/1–8/2 forms-revision work (`docs/design/forms-revision-080126.md` phases 0–3,
   commits `5535f0c`…`02a2993`, merged) already shipped a large fraction of the list — including
   the item-36 CRP rebuild the brief flags as gutted (the registry form was rebuilt to the paper
   8/2; only the *wizard* remains a placeholder, at a different route). Statuses below are from
   current `main`, not from the brief's framing.

Effort scale: **XS** < 2h · **S** ≈ half-day · **M** 1–3 days · **L** ≥ a week.

---

# SHIPPED

Sorted by residual effort (all effectively zero unless noted).

**#1 Schedule box: session type, client name, in-person flag — SHIPPED.**
Both block renderers show client name ([scheduleLane.tsx:296](../components/sessions/scheduleLane.tsx)),
taxonomy session-type label (`:250,:297-299`), time (`:300-302`), Virtual chip (`:303-307`), and a
double in-person signal — amber border (`:258`) + `MapPin` chip (`:284-288`). Mirrored in the flat
Week grid at [SessionManagement.tsx:541-620](../pages/SessionManagement.tsx). Nothing hover-only.
⚠ Maintenance fact: the block markup is **hand-duplicated** in those two files — any change lands twice.

**#2 No Call No Show color/symbol — SHIPPED.**
`'No Call No Show'` is a first-class status ([types.ts:434](../types.ts)), rose fill + rose bar + badge
([AppointmentStatusModal.tsx:30](../components/sessions/AppointmentStatusModal.tsx)), `PhoneOff` icon on
the block ([scheduleLane.tsx:274-278](../components/sessions/scheduleLane.tsx)), distinct from No Show
(amber, `UserX`). Status fill overrides service color for missed sessions (`:242-245`). Set via
"Mark No Call / No Show" ([AppointmentStatusModal.tsx:589-592](../components/sessions/AppointmentStatusModal.tsx)).
DB read path normalizes `no_show`/`ncns` case-drift ([api.ts:381-399](../services/api.ts)); 2 live NCNS rows.

**#4 Reschedule history viewable — SHIPPED** (residual gaps: S).
Append-only `appointment_reschedules` ([20260728_l1b_appointment_reschedules.sql:14-36](../supabase/migrations/20260728_l1b_appointment_reschedules.sql)),
written by `updateAppointment` ([api.ts:1019-1031](../services/api.ts)), viewed two places: the
"Session history — rescheduled N×" panel ([AppointmentStatusModal.tsx:509-529](../components/sessions/AppointmentStatusModal.tsx))
and the `RotateCw`+count marker on blocks ([scheduleLane.tsx:264-268](../components/sessions/scheduleLane.tsx)).
*Missing (S total):* `reason` is never captured (writer omits it — [api.ts:1020-1029](../services/api.ts) — so the
`:524` reason render is dead), and counselor-change + actor are written but not surfaced
(`RescheduleTrailRow` drops them, [api.ts:900-908](../services/api.ts)). Stale in-code comment at
[api.ts:1044-1047](../services/api.ts) claims no reader exists.

**#7 "Standing Group" → "Groups"; multi-select 1–4 — SHIPPED.**
Rename done (commit `b161e7a`; zero "Standing Group" UI strings remain). Client-header "Groups" button
([ClientProfileHeader.tsx:295](../components/clients/ClientProfileHeader.tsx)) opens
[GroupAssignmentModal.tsx](../components/clients/GroupAssignmentModal.tsx) — checkbox **multi-select**
(`:30,:113`), batch enroll via `enrollClientInGroups` ([api.ts:682-704](../services/api.ts)) into
`group_enrollments`, one-active-row-per-(group,client) unique index
([20260728_l2_groups_remodel.sql:67-68](../supabase/migrations/20260728_l2_groups_remodel.sql)).
Live: 29 active enrollments, 11 clients in >1 group, max 3. *Note: no cap of 4 is enforced anywhere —
the "1–4" in David's ask is currently just the modal's header comment.*

**#9 Group note from calendar, roster pre-populated — SHIPPED.**
Group block click → `onSelectGroup` ([scheduleLane.tsx:217](../components/sessions/scheduleLane.tsx)) →
[GroupNoteModal](../components/sessions/GroupNoteModal.tsx) ([SessionManagement.tsx:698-704](../pages/SessionManagement.tsx)).
Roster prefills from `group_enrollments` via `getGroupRoster` (active AND enrolled on/before the session
date, [api.ts:653-666](../services/api.ts)). Re-opening a submitted date shows the read-only record
([GroupNoteModal.tsx:159-182](../components/sessions/GroupNoteModal.tsx)).
⚠ **GreenRoom is a second, older group surface** not reachable from the calendar (only from the
Dashboard, [Dashboard.tsx:262](../pages/Dashboard.tsx)); it still infers rosters from appointment rows
([greenRoom.ts:137-155](../services/greenRoom.ts)) and never reads enrollments — see #22.

**#13 Submit posts type/date/units to each client's Services tab — SHIPPED.**
`submitGroupSession` ([api.ts:797-894](../services/api.ts)) writes per attendee: a Completed seat
appointment carrying `appointment_type = declaredTypeLabel`, `service_type`, `billable_units`
(`:833-854`); a `group_session_attendees` row; and a `clinical_notes` row correlated by
`group_session_id` with date/times/units/staff/signature (`:862-882`). Services tab shows title, date,
units; L4 precedence = **note units → appointment billable_units → schedule-derived suggestion**
([ClientSessionsTab.tsx:113-135](../components/clients/ClientSessionsTab.tsx)).

**#14 Group assignment: start date, NO end date — SHIPPED, exactly as asked.**
`enrolled_at` start date; `discharged_at` stamped only on manual removal — "the ONLY way an assignment
ends" ([api.ts:706-714](../services/api.ts)). Modal exposes a start date and states the no-end-date rule
in copy ([GroupAssignmentModal.tsx:98-100,140-143](../components/clients/GroupAssignmentModal.tsx)).
Roster reads honor the start date ([api.ts:658-660](../services/api.ts)).

**#15 Seed: the 13 standing groups — SHIPPED (12/12 present; "13" is David's own double-count).**
All 12 blocks in David's list exist live in `groups` with correct weekday/time/counselor (full table in
recon appendix; witnessed 2026-08-07). The 13th was the duplicated "Thu 9-12 Grp Ed David" — deduped
per David's own 7/28 call, documented at
[20260728_l2_groups_remodel.sql:4-8](../supabase/migrations/20260728_l2_groups_remodel.sql).
**Deb's alternating groups: the schema allows it and it's the shipped design** — `session_kind='alternating'`
+ `service_type='other'` on the group row, with Group Ed vs Group Cns **declared at note time** (forced,
required select — [GroupNoteModal.tsx:209-217](../components/sessions/GroupNoteModal.tsx),
[groupNote.ts:36-40](../config/groupNote.ts)); the seat appointment's `service_type` comes from the
declared type, never the group row. Extra rows are benign: 2 inactive Rick rows + 4 weekday-null
"by appt" rows (Bill/Karen/Debra DWI) excluded from weekly rendering.

**#17 Admin Documents + Clinical Documents tabs, upload destination choice — SHIPPED.**
Two real tabs ([ClientWorkspace.tsx:366-385](../pages/ClientWorkspace.tsx)); no Forms/Documents/Records
tab remains. Capture forces an Admin-vs-Clinical category step
([StaffDocumentUpload.tsx:300-323](../components/documents/StaffDocumentUpload.tsx),
[CategoryPicker.tsx:33-58](../components/documents/CategoryPicker.tsx)); AI pre-selects, never auto-files.
Residual (was DEFERRED #41, now benign): unmapped legacy `document_type` values render in both tabs by
design ([ClientWorkspace.tsx:411](../pages/ClientWorkspace.tsx)).

**#18 "Sessions" → "Services" — SHIPPED.**
[ClientWorkspace.tsx:375](../pages/ClientWorkspace.tsx) (`label: 'Services'`; id stays `'sessions'` for
persisted state). Cosmetic residue: internal card header still says "Session History"
([ClientSessionsTab.tsx:322](../components/clients/ClientSessionsTab.tsx)).

**#25 Treatment plan versioning — SHIPPED (typed signatures), 0 live uses.**
Every sub-requirement met: clinician name create/update, immutable prior version (insert-new-then-archive
ordering, [api.ts:2667-2731](../services/api.ts)), update date, progress comments,
add/remove problem-goal-intervention ([CustomizeTreatmentPlanModal.tsx:144-165](../components/clients/CustomizeTreatmentPlanModal.tsx)),
BOTH signatures double-enforced (UI `:180-181`; API throws, [api.ts:2680-2682](../services/api.ts)),
new version Active + `supersedes_plan_id`, prior Archived, history UI with "preserved exactly as
originally signed" ([TreatmentPlanTab.tsx:259-308](../components/clients/TreatmentPlanTab.tsx)).
Schema: [20260728_l5_treatment_plan_updates.sql](../supabase/migrations/20260728_l5_treatment_plan_updates.sql).
Caveats: signatures are **typed names** (inherits #23), and live usage is **zero** (`supersedes_plan_id`
non-null = 0) — worth a witness pass before demoing.

**#26 Button relabels — SHIPPED.**
"Start transcribed session" ([ClientProfileHeader.tsx:271](../components/clients/ClientProfileHeader.tsx),
[AppointmentStatusModal.tsx:538](../components/sessions/AppointmentStatusModal.tsx)); "Start typed or
dictated note" (`:280`, primary style). No old labels render anywhere.

**#27 Drop "submit charge" + "schedule next" — SHIPPED.**
Formally cut ([SessionWrapUpModal.tsx:31-39](../components/sessions/SessionWrapUpModal.tsx)); steps are
now Sign Note + Assign Tasks only. ⚠ Follow-up question for David: the surviving "Assign Tasks" step
also cannot write (`addClientAssignment` throws, surfaced as "Not saved", `:74,:125,:134-143`) — same
cut rationale applies.

**#28 Transcribed-note formatting bug — SHIPPED (root-fixed for all new notes).**
Cause was write-time destruction by the SOAP/DAP header-splitters + a space-join renderer. Fix: verbatim
text always lands in `clinical_notes.narrative` ([api.ts:1571-1575](../services/api.ts)); the shared
renderer prefers it with `whitespace-pre-wrap` ([ClinicalNoteView.tsx:90-92](../components/clients/ClinicalNoteView.tsx)).
26/26 live notes have `narrative`. Residual: pre-fix legacy rows are unrecoverable (structure destroyed
at write); the lossy splitters still also run (deliberate, `TODO(isolation-migration)` at
[api.ts:1506-1508](../services/api.ts)). The *field* half of David's complaint is item #21, still open.

**#32 Meeting Report: delete Chairman Signature — SHIPPED** (commit `3a26648`;
[types.ts:272](../types.ts) records the deletion; a deliberate orphan-key fixture guards regression).

**#35 Consent for Treatment full narratives — SHIPPED** (commit `bb391e8`; brief's premise stale).
Eight verbatim paper clauses as `static` fields ([ConsentForTreatmentForm.tsx:73-95](../components/forms/ConsentForTreatmentForm.tsx));
11 paraphrased checkboxes removed; ¶1 fill-ins are real fields. **Two typos on ACS's paper are preserved
verbatim and flagged for David** (`:21-24`). Not blocked on an asset — the paper form was evidently
received and transcribed 8/2.

**#36 Continuing Recovery Plan — SHIPPED as a FIELD EDIT, already done** (commits `b9ae218` + `02a2993`;
**the brief's "rebuild, not edit" read is corrected**). The registry form
([ContinuingRecoveryPlanForm.tsx:89-147](../components/forms/ContinuingRecoveryPlanForm.tsx)) was rebuilt
to the paper 8/2: "Do you plan on remaining alcohol and drug free?" is `boolean` yes/no (`:108`), and
seven questions use numbered R·R·R·Optional lines via a `numberedLines` helper (`:70-79`) — no new field
type was needed (design §8c; `BaseFormTemplate` field families at [fieldInput.ts:32-51](../config/fieldInput.ts)).
Routing truth: **`/portal/forms/recovery-plan` renders the real form** ([PortalFormPage.tsx:30](../pages/portal/PortalFormPage.tsx));
the gutted wizard placeholder lives at the *different* route `/portal/recovery-plan`
([RecoveryPlanForm.tsx:7-27](../pages/portal/RecoveryPlanForm.tsx)), trial-hidden, and correctly redirects
to documents. No wizard remnants: `RecoveryPlanFormDef.tsx` no longer exists; no definition declares `steps`.
One open flag for David: the 4th line of each question is optional (R·R·R·O) — recorded as a reversible
choice (`:22-27`).

---

# PARTIAL

Sorted by effort, smallest first.

**#16 Header: phone, email, primary counselor — SHIPPED in code, DEAD in data. Effort XS–S.**
All three render ([ClientProfileHeader.tsx:181-195](../components/clients/ClientProfileHeader.tsx));
counselor resolves from the new `clients.primary_counselor_id` FK
([20260728_l4_primary_counselor.sql:10](../supabase/migrations/20260728_l4_primary_counselor.sql)),
settable in Edit Client ([EditClientModal.tsx:248-249](../components/clients/EditClientModal.tsx)).
**Live: 0 of 13 clients have it set → the counselor line never renders today.** The old
`assigned_therapist_id` orphans (DEFERRED #31) are cleared (0 non-null). *Missing:* data population
(staff sets it, or a backfill once David says who's primary per client) — and NOT ESTABLISHED whether
`CreateClientModal` offers the field at creation (worth checking before relying on organic fill).
Collision: supersedes DEFERRED #31 (stale).

**#30 Authorization for Release — half done. Remaining: address→email on released parties. Effort XS.**
Client email field already deleted (commit `5535f0c`). Still open: 4 party `address` fields →
`email` ([AuthorizationForReleaseForm.tsx:116,120,124,128](../components/forms/AuthorizationForReleaseForm.tsx)).
FIELD EDIT — but regenerating baseline `printpreview-47431370` is required (`npm run check:forms` goes
red otherwise), and the dead `ContactFields` component (`:33-43`) + orphan `state`/`zip` keys should go
in the same pass. 1 live row, `Not Started`, empty data — low risk.

**#19 Services line collapsed: type/subtype/date/units — PARTIAL. Effort S.**
Collapsed row shows date + units + title + modality·status
([ClientSessionsTab.tsx:325-352](../components/clients/ClientSessionsTab.tsx)). *Missing:* the taxonomy
service label ("DWI Court 1:1") renders only in the expanded drawer (`:221-223`) — one-line fix to hoist
`sessionTypeById(a.sessionTypeId)?.label` into the row; group subtype ("Group Ed"…) appears only because
`submitGroupSession` happens to write it into `appointment_type` — not a read of `group_sessions.declared_type`;
**note-only rows (unlinked notes) show no units at all** (badge gated `kind === 'appointment'`, `:342`).
Vocab exists: 4 declared types ([groupNote.ts:22-27](../config/groupNote.ts)), CNS/ED abbrevs
([serviceType.ts:31-34](../config/serviceType.ts)); no short "Group Ed/Cns" token — labels are long-form.

**#3 Note-star on calendar — feature SHIPPED; David's bug CONFIRMED with exact cause. Fix effort S.**
The star works ([api.ts:506-520](../services/api.ts) `getNotedAppointmentIds` →
[scheduleLane.tsx:248,269-273](../components/sessions/scheduleLane.tsx)); query path has no date/status/
casing filter that could exclude the session — all ruled out one by one.
**Witnessed cause (not theory):** James West's 8/5 6pm session is appointment
`05a6ae79-1c32-4fa0-98fc-962f38d9e9b1` (`2026-08-05 23:00Z` = 6pm CDT, status "No Call No Show"); the
note exists — `clinical_notes` `6ac53f42…`, DAP, signed, created 8/5 — **with `appointment_id = NULL`**.
It was written via the header "Start typed or dictated note" button, which dispatches `open-note-modal`
with only `{ clientId }` ([ClientProfileHeader.tsx:277](../components/clients/ClientProfileHeader.tsx));
`SmartNoteImporter` has no `appointmentId` prop and `saveClinicalNote` never infers one
([api.ts:1591-1612](../services/api.ts)). No link → no star. **This is DEFERRED #44 reproducing verbatim**
(fix shape already written there: offer-to-attach to a recent same-day appointment, default unlinked).
Corpus: 5 of 26 notes unlinked. Same root cause also degrades #19 (no units on unlinked rows) and #20.

**#8 Group on both calendars — staff SHIPPED, client NOT STARTED. Effort M.**
Staff: weekly blocks render client-side from `groups` on all three calendar surfaces — Day/by-counselor
([scheduleLane.tsx:205-233](../components/sessions/scheduleLane.tsx)) and Merged week
([SessionManagement.tsx:496-538](../pages/SessionManagement.tsx), commit `aab4f1f` — one block, no seat
rows to collapse). Client side: **nothing** — `PortalAppointments` reads only `appointments`
([PortalAppointments.tsx:26-30](../pages/portal/PortalAppointments.tsx)), and `groups`/`group_enrollments`
RLS is deliberately staff-only ([20260606_ws6_1_standing_groups.sql:51-55](../supabase/migrations/20260606_ws6_1_standing_groups.sql));
a client sees a group only after the note is submitted. *Missing:* client-read RLS policy + a portal
"your groups" render.

**#20 Units from the note on DAP/SOAP — write SHIPPED, read PARTIAL. Effort S–M.**
`clinical_notes.units` (CHECK 1–12) exists ([20260728_l3_note_structure.sql:33,38-46](../supabase/migrations/20260728_l3_note_structure.sql));
23/26 live notes have units. SmartNoteImporter captures units, required
([SmartNoteImporter.tsx:245-250](../components/notes/SmartNoteImporter.tsx)); L4 precedence puts note
units first ([ClientSessionsTab.tsx:116-135](../components/clients/ClientSessionsTab.tsx)). *Missing:*
`SessionWrapUpModal` has no units field (see #21); unlinked notes display no badge (#3/#44 dependency).
⚠ Deeper collision — DEFERRED #10: program-hours accrual (`client_accrued_hours`) still reads
schedule-derived `appointments.duration_minutes`; note units/times do NOT feed the completion gate.
NOT ESTABLISHED whether the 8/2 Postgres completion-gate migration (`61ce1fb`) changed the hours source —
verify before telling David units "count."

**#24 Staff credentials — PARTIAL, blocked on David's list. Effort XS–S once unblocked.**
Captured per-note as free text (`clinical_notes.staff_credentials`, 23/26 populated; inputs at
[SmartNoteImporter.tsx:262-267](../components/notes/SmartNoteImporter.tsx),
[GroupNoteModal.tsx:223-227](../components/sessions/GroupNoteModal.tsx),
[DischargeSummaryForm.tsx:129](../components/forms/DischargeSummaryForm.tsx)); rendered next to the
signer ([ClinicalNoteView.tsx:54-58](../components/clients/ClinicalNoteView.tsx)). **No profile-level
store:** `counselors` has no credentials column (live columns witnessed), `User` type has none —
clinicians retype "LPC, CRADC" every note. Fix = one `counselors.credentials` column + default-fill.
Collision: same blocker as DEFERRED #5 (David's cert/credential list, never delivered).

**#10 Add/remove attendees per session w/o touching standing assignment — PARTIAL. Effort M.**
Shipped: `group_session_attendees` with `source standing|makeup`
([20260728_l2_groups_remodel.sql:97-110](../supabase/migrations/20260728_l2_groups_remodel.sql)); per-session
absent toggle + makeup add in GroupNoteModal (`:245-249,:261-264`); enrollment provably untouched
([api.ts:792-793](../services/api.ts)). *Missing:* the override exists **only at submit** — absent/makeup
sets are React state, reset on every open (`:38-39,:61-63`); no persisted pre-note override; **no
post-submit attendee edit** (re-open is read-only; unique index blocks a second submit). GreenRoom's
present/absent remains ephemeral ([GreenRoom.tsx:248](../pages/GreenRoom.tsx)). `ManageAttendeesModal`
is dead code (imported by nothing).

**#21 Individual note required fields — SPLIT: one surface 9/9, the other 1/9. Effort M.**
Storage is fully there (`service_date, time_started, time_ended, units, problems_addressed, staff_name,
staff_credentials, narrative, signed_at, signed_by_name` — live). **SmartNoteImporter (typed/dictated):
all nine fields, required-gated** ([SmartNoteImporter.tsx:41-64,230-267,331-339](../components/notes/SmartNoteImporter.tsx)).
**SessionWrapUpModal (transcribed): narrative only** — its entire save is
`saveClinicalNote(client.id, noteText, { isSigned, noteType: 'Session', appointmentId })`
([SessionWrapUpModal.tsx:63](../components/sessions/SessionWrapUpModal.tsx)), and its "signature" is
`onClick={() => setIsSigned(true)}` (`:108-110`) — the exact anti-pattern the signature design doc names.
*This is the single largest live delta on David's clinical list:* the surface behind the button he demos
("Start transcribed session") collects 1 of 9 fields. Fix = port the L3 field block into the wrap-up modal.

**#22 Group note fields + type + attendance — SPLIT: GroupNoteModal complete, GreenRoom not. Effort S–M.**
GroupNoteModal has every field David lists incl. declared type + attendance
([GroupNoteModal.tsx:190-278](../components/sessions/GroupNoteModal.tsx)). GreenRoom's `GroupCheckInCard`
has only attendance + narrative and still posts via the old `distributeGroupNote` with no units/type/
credentials/signature ([GreenRoom.tsx:245-364](../pages/GreenRoom.tsx)). Fix = route GreenRoom's group
path to GroupNoteModal (or retire the card). Collision: GreenRoom is the last live consumer of the
pre-L2 group-note path.

**#29 Registration forms independent of add-client — architecture answer: independence HOLDS today;
the pre-profile form track itself is NOT BUILT (see #38/#39).**
Public intake and internal add-client are fully independent code paths with no shared module:
anon → `acs-intake-submit` edge fn (service-role, 4-field whitelist, hardcoded `status='prospect'`,
`program_type=NULL` — [index.ts:4-16,59-71](../supabase/functions/acs-intake-submit/index.ts)) vs staff →
`CreateClientModal` → `addClient` ([api.ts:2365-2377](../services/api.ts), soft dup-check). The separation
is enforced at the edge function (only staff can set status/program), not by shared client code. David's
"forms precede profile creation" requirement is the unbuilt half — mapped under #38/#39.

---

# NOT STARTED

Sorted by effort, smallest first.

**#12 Remove "makeup" designation from added clients — XS (UI-only) / S (with schema).**
"makeup" appears as: DB CHECK `source in ('standing','makeup')`
([20260728_l2_groups_remodel.sql:102-103](../supabase/migrations/20260728_l2_groups_remodel.sql)), the TS
union ([api.ts:785](../services/api.ts)), and 4 strings in
[GroupNoteModal.tsx:176,237,255,262](../components/sessions/GroupNoteModal.tsx). Dropping just the
visible chips/labels is XS; also collapsing the `source` distinction is a migration (S). Open question
for David: does he want the *label* gone or the *standing-vs-added distinction* gone? The distinction is
what makes #10's "without altering static assignment" auditable.

**#5 Remove "session category" from the scheduling box — S, but DECISION REQUIRED first.**
The literal label "Session category" is NOT in the booking modal — it's the required-to-complete
`service_type` select in the appointment detail box
([AppointmentStatusModal.tsx:541-555](../components/sessions/AppointmentStatusModal.tsx)), which
**hard-gates Mark Completed (`:583`) and drives WS3 hours accrual.** Removing it without a replacement
source breaks completion + accrual for individual sessions (group sessions now get `service_type` from
the note's declared type; individual sessions have no other source today). The booking modal's separate
"Service type"/"Session type"/"Type (funnel)" selects ([ScheduleSessionModal.tsx:436-480](../components/sessions/ScheduleSessionModal.tsx))
are a different taxonomy. AMBIGUOUS which control David means — resolve with him (show him the box),
then either relabel/auto-derive it or move it into the note flow. Collision: WS3 accrual, DEFERRED #10.

**#11 Save added clients WITHOUT submitting the note — M.**
No draft path exists: GroupNoteModal is Cancel/Submit only (`:287-293`), all-or-nothing required gate
(`:93-107`); **schema forbids drafts** — `group_sessions` has NOT NULL `declared_type/units/narrative/staff_name`,
no status column, and notes are born signed ([api.ts:813-814](../services/api.ts)). Needs either a
nullable-draft schema change on `group_sessions` or a separate persisted per-occurrence attendee override
(natural companion to #10's gaps). Collision: Dan-approved L2 schema would be amended — flag before building.

**#6 BLOCKING: "Group" service type drops the Client field — M (design fix, root cause established).**
`isGroup = sessionDef.label.toLowerCase().includes('group')` ([ScheduleSessionModal.tsx:132](../components/sessions/ScheduleSessionModal.tsx))
unmounts the entire client block (`:468-492`), skips client validation (`:243-246`), and inserts with no
client (`:339-342` spread → `client_id: null`, [api.ts:458-459](../services/api.ts)). **Witnessed live:**
13 phantom NULL-client rows incl. `5e27d6ed…` (8/2, real `group_id`, `op_group`) — booked via standing-group
picker + Group type on production. Intended design: group hours flow through the group-note path
(`submitGroupSession` creates real per-client seats), and standing blocks render statically — but the
modal never says so; the field silently vanishes. Phantom rows then hide "Start transcribed session"
([AppointmentStatusModal.tsx:531](../components/sessions/AppointmentStatusModal.tsx)) and block late-fee
assessment ([SessionManagement.tsx:103-105](../pages/SessionManagement.tsx)). Honest minimal fix (S):
replace the silent vanish with explanatory copy + a link to the group-note flow, and stop producing
phantom rows. Full fix (M): make "book a client into a group occurrence" a real path (client field stays,
writes a seat linked to the group). Collision: RECON 7/27 Step 3 "phantom seat" finding (surprise #8) —
same defect, still live.

**#38 + #39 New registration forms (SATOP + Outpatient) — NOT BUILT. M (in-app) / L (true pre-profile).**
Design already decided (Dan 8/1, [forms-revision-080126.md](design/forms-revision-080126.md) §8a + §7):
ids `satop-registration` / `registration`, full field lists in the doc (the OP form's "legal requirement"
yes/no + conditional "related charges" is expressible today via `boolean` + `visibleWhen`); base form
auto-assigns at client creation keyed off `clients.client_type` via existing `assignForm`. Two recorded
open sub-decisions: null/non-SATOP-OP `client_type` ⇒ silently no base form; and `assignForm` requires a
`dueDate` a creation-time assignment doesn't naturally have.
**Registration-architecture facts (the hard part):**
- DB would accept a client-less submission (`form_submissions.client_id` nullable, **no FK**, PK-only
  constraints — witnessed), **but code and RLS both refuse**: `BaseFormTemplate` hard-blocks with no
  resolved client ([BaseFormTemplate.tsx:200-208](../components/BaseFormTemplate.tsx)); RLS grants insert
  only to staff or to authenticated users whose `client_id ∈ my_client_ids()` — anon has table grants but
  zero policies ⇒ default-deny (policies witnessed verbatim).
- `assignForm` requires ≥1 existing client id and doesn't validate/block on the registry
  ([api.ts:2011-2058](../services/api.ts)).
- Draft key: `` `acsdraft:v2:${formId}:${targetClientId ?? 'noclient'}` ``
  ([BaseFormTemplate.tsx:105](../components/BaseFormTemplate.tsx)) — with no client, **every pre-profile
  session on a shared kiosk shares one `noclient` bucket** → the previous stranger's answers prefill.
  A pre-profile track must re-scope drafts (e.g., per-token) before it's safe.
- The viable existing pattern: `acs-intake-submit` proves prospect-first creation (edge fn creates the
  client, returns the id, submission then attaches) — but it documents its own production gate: no rate
  limiting/captcha, public service-role endpoint.
So: **"two more registry entries + auto-assign-on-create" is M** and consistent with the decided design;
**"truly precedes profile creation / unauthenticated" is L** (new edge function or prospect-first flow +
draft rescoping + abuse protection) and is an architecture fork David's wording implies but the decided
design does not yet cover. Needs an explicit decision before building the L version.

**#23 Drawn signature — NOT STARTED; the design doc is 0% built. L (~7–11 days per its own estimate).**
Verified on main: no `signatures` / `signature_applications` tables, no `signature_method` column
anywhere, no `acs-signatures` bucket, no capture edge function; `SignaturePad`'s only importer is the
dead `ManageAttendeesModal` — **zero live consumers**, unchanged since 7/27. What shipped instead is a
deliberate typed-name interim across notes/group notes/treatment plans, per the L3/L5 migration headers
("the signature DESIGN itself is untouched per Dan's standing instruction")
([20260728_l3_note_structure.sql:21-23](../supabase/migrations/20260728_l3_note_structure.sql)).
Everything in [DESIGN-signatures-2026-07-27.md](../DESIGN-signatures-2026-07-27.md) remains to build
(§3 schema, §3d bucket, §3e server-authoritative capture, §4 staff strictness, §5 backfill, §6 phases),
and its §8 decisions (staff re-auth, correction workflow, styled-for-staff, ESIGN consent wording) are
still open — those are David/Dan calls, not code. Collision: recon backlog #2 (signature model) — this IS it.

---

# BLOCKED

## Blocked on David's answers (no asset needed)

- **#34 Chart Review — AMBIGUOUS by David's own words; currently soft-retired (Dan's D1, deliberately
  not renamed)** ([formRegistry.ts:118-121](../config/formRegistry.ts)). What soft-retire did: removed
  the library card ([FormLibrary.tsx:34-40](../components/FormLibrary.tsx)); portal/assign lists
  unaffected (staff-audience anyway); **`/forms?open=chart-checklist` still renders the full form**
  (switch case retained) and `assignForm` still accepts the id — retire removed the card, not the routes.
  `ASSIGNABLE_REGISTRY_FORMS` is exported with zero consumers (declared, not wired). Live rows: **0**
  (DEFERRED #35's "one live row" is stale — that row is in a test fixture, not the DB). Rename-in-place
  = XS–S (registry title + component `definition.title` — the card renders the component's, per DEFERRED
  #36); repurpose to "Client Status Report" = M (field-array rebuild either way; `soberDate` is already
  dead in its JSX). **Do not act until David says delete vs rename — both paths are prepped above.**
- **#37 SATOP Client Intake — David wants to discuss delete vs modify.** Today: 11 required-ish fields
  ([SatopClientIntakeForm.tsx:97-109](../components/forms/SatopClientIntakeForm.tsx)); in the portal list
  + staff library + assign picker; **NOT in the cert gate / required forms** ([formRegistry.ts:147-156](../config/formRegistry.ts));
  0 live submissions. Explicitly out-of-scope per Dan 8/1 ([forms-revision-080126.md:127](design/forms-revision-080126.md)).
  Deleting it orphans nothing in the DB; #38's SATOP Registration is its natural successor — decide together.
- **#5** — which control "session category" refers to, and where the category should come from if removed
  (it feeds accrual + completion). See NOT STARTED.
- **#12** — label removal vs collapsing the standing/added distinction. See NOT STARTED.
- **#24** — the staff credential list (same blocker as DEFERRED #5's cert seam).
- **#38/#39** — is a true pre-profile (unauthenticated) fill required, or is create-then-assign enough?
  M vs L fork. Plus the two recorded sub-decisions (null client_type; dueDate convention).
- **Units-vs-duration rule (DEFERRED #10)** — which number the completion gate trusts. Blocks the *value*
  of #20 (note units feeding hours) and any promise that units drive completion.
- Smaller confirmations queued: cut "Assign Tasks" too (#27)? preserve or fix the two paper typos (#35)?
  R·R·R·O optional 4th line (#36)? "1–4 groups" cap enforcement (#7)? MRT accrual verbal confirm (ROADMAP).

## Blocked on assets (markup / paper forms not received)

Per instruction, no field structures invented. Two of the six the brief listed turned out to already be
built from received paper (Consent #35, CRP #36 — see SHIPPED). Still genuinely blocked:

1. **#31 HIPAA Notice** — further wording changes await David's markup. Note: one revision round already
   shipped 8/2 (`83c6252`, "received or been advised of"; effective-date clause dropped —
   [HipaaAckForm.tsx:29-32](../components/forms/HipaaAckForm.tsx)); stale "(effective January 2025)" in
   the `description` at `:15` should ride along with the next edit.
2. **#33 Client Orientation Checklist** — word changes await markup. Note: five rewordings + a fee
   acknowledgement (`checklist.feesAdvised`) already shipped 8/2 (`b76b195`) — NOT ESTABLISHED whether
   that satisfies the "new field about finances"; confirm against the markup when it arrives. It gates
   the completion certificate — any id/field change must respect the dotted-id `validateStep` coupling
   ([SatopChecklistForm.tsx:76-80](../components/forms/SatopChecklistForm.tsx)) and the Postgres gate
   parity check ([gateParityCheck.ts:129-133](../scripts/gateParityCheck.ts)).
3. **#38 SATOP Registration Form — example/paper form.** (Proposed field list exists in
   [forms-revision-080126.md:131-133](design/forms-revision-080126.md); the real asset should confirm it.)
4. **#39 Outpatient Registration Form — example/paper form.** (Same.)

*(#35 Consent and #36 CRP: no longer blocked — built 8/2 from the received paper forms.)*

---

# CROSS-CUTTING ANSWERS

**Does GreenRoom's `distributeGroupNote` path block items 9–13?** **No — none of them.** The calendar →
group-note flow (items 9–13) runs entirely on the new `submitGroupSession` path, which never touches
`distributeGroupNote`. DEFERRED #25's core defect is also materially resolved: `clinical_notes.group_session_id`
([20260728_l2_groups_remodel.sql:112-113](../supabase/migrations/20260728_l2_groups_remodel.sql)) is #25's
fix-shape (b), and 18/18 live group notes carry it. Residue: the N per-client rows are still independently
editable (drift now *detectable*, still not prevented), and **GreenRoom itself is the last consumer of the
old path** — it writes group notes with no units/type/credentials/signature (#22). The blocking relationship
is inverted: GreenRoom doesn't block 9–13; 9–13's shipped path makes GreenRoom's group card obsolete.

**Which items need the units-vs-duration decision (DEFERRED #10) first?** None are *blocked from being
built* — but #20's promise ("units pulled from the note") is only display-deep until David rules which
number feeds completion: `client_accrued_hours` still sums schedule-derived `duration_minutes`, not note
units/times. Affected: #20 (directly), #13 (group seats currently write both — consistent only because
the writer sets both), #5 (the category select exists to feed that same accrual), #21 (time started/ended
fields now exist on notes but feed nothing). NOT ESTABLISHED whether the 8/2 Postgres completion gate
(`61ce1fb`) changed the hours source — check `client_accrued_hours`' definition before the David call.

**Which items depend on the signature model (recon #2)?** Hard dependency: **#23 only.** Soft (shipped
with typed-name interim, would be upgraded by the model, not reworked): #21/#22 signature fields, #25
plan signatures, plus every consent form. #21's `SessionWrapUpModal` boolean sign is the one surface
that should NOT wait — it's below even the typed-name bar today.

**Backlog coverage vs new scope.**
Already covered by open backlog items: #3 (=DEFERRED #44, verbatim), #6 (=RECON 7/27 phantom-seat),
#23 (=recon #2 / DESIGN-signatures), #24 (=DEFERRED #5 blocker), #20's accrual half (=DEFERRED #10),
#34/#40 catalog mechanics (=DEFERRED #36's three-catalog problem, still true: FormLibrary renders
component titles, not registry titles).
Genuinely NEW scope from the Aug-5 markup: #5 (category removal), #8's client-side calendar, #10's
persisted per-occurrence override + post-submit edit, #11 (save-without-submit), #12 (makeup label),
#19's collapsed-row fields, #21's SessionWrapUpModal port, #38/#39 (registration forms + possible
pre-profile track), #34's rename option.
Stale backlog entries found while mapping (flag for a DEFERRED cleanup pass, do not act silently):
#9, #25 (partially), #26, #27 (partially), #31, #35's "one live row", RECON 7/27's Step-3 table, and
the in-code comment at [api.ts:1044-1047](../services/api.ts).

---

# THE TEN I'D SHIP THIS WEEK (no David dependency, no asset)

Ordered by value-for-effort:

1. **#3 fix — attach header-written notes to their session** (DEFERRED #44's offer-to-attach shape). S.
   Kills David's reported bug AND the #19/#20 unlinked-note display gaps at the root.
2. **#21 — port the L3 field set into `SessionWrapUpModal`.** M. The largest clinical delta; the button
   David demos collects 1 of 9 required fields with a boolean signature.
3. **#6 minimal fix — stop the silent Client-field vanish + stop writing phantom NULL-client rows**
   (explanatory copy + route to the group-note flow). S. It's his BLOCKING item; the full booking
   redesign can follow.
4. **#19 — hoist service-type label into the collapsed Services row.** S (one line + group-subtype read
   from `declared_type` if desired).
5. **#22 — route GreenRoom's group card to GroupNoteModal (or retire it).** S–M. Closes the last
   incomplete-group-note writer.
6. **#16 — surface `primary_counselor_id` in CreateClientModal + populate for the 13 live clients.**
   XS–S (values themselves may need David/staff, but the field ships).
7. **#30(b) — address→email on the four release parties.** XS + baseline regen.
8. **#4 gaps — capture a reschedule reason + show counselor-change/actor in the trail panel.** S.
9. **#40 — hard-delete session-attendance** (13 code sites, 0 rows, 0 fixtures — inventory in hand;
   David already said delete). S.
10. **#12 (label-only) — drop the "makeup" chips/wording from GroupNoteModal.** XS. (Hold the schema
    half for David's answer.)

# BLOCKED ON DAVID — the short list to bring to the call

delete-vs-rename Chart Review (#34) · delete-vs-modify SATOP Intake (#37) · what "session category"
removal means given it feeds accrual (#5) · pre-profile registration: true public fill or
create-then-assign (#38/#39, M-vs-L fork) · the units-vs-duration completion rule (DEFERRED #10) ·
staff credential list (#24) · makeup: label or distinction (#12) · plus the small confirms: Assign-Tasks
cut, consent typos, R·R·R·O 4th line, 1–4 group cap, MRT accrual.

# NOT ESTABLISHED (said plainly)

- `docs/RECON-acs-2026-08-06.md` — does not exist in this repo or its history; mapped from 7/27-28
  sources + fresh witness instead.
- Whether the Postgres completion gate (`61ce1fb`) changed the hours-accrual source (units vs
  duration_minutes) — not checked; verify `client_accrued_hours` before the David call.
- Whether `CreateClientModal` offers primary counselor at creation — not checked.
- Whether #33's shipped `feesAdvised` acknowledgement satisfies David's "new field about finances" —
  cannot know without his markup.
- Which UI control David's "session category" markup points at (detail-box select vs booking-modal
  selects) — interpreted as the detail box (the literal label lives there); confirm with a screenshot.
- Origin of the 13 phantom NULL-client group rows beyond the two witnessed creation dates — attribution
  (who booked them) not pulled.
