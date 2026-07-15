# Domain model facts — 2026-07-15 recon

Facts only. No recommendations, no sequencing, no build order. Witnessed against repo tag
`acs-units-display-2026-07-15` (commit `4a6b17c`) and live schema on Supabase project
`ldzzlndsspkyohvzfiiu`, 2026-07-15. Every claim below carries a file:line or a live-query
citation — if a re-read finds it stale, fix it here rather than re-deriving from scratch.
Source recon: David Yoder's 7/15 packet (email + "7/15 Therapy Hub" doc + two paper form scans).
Related: [[project_domain_model_2026_07_15]] (memory), [DEFERRED.md](../DEFERRED.md) items #25-29.

---

## 1. THE HEADLINE FACT: notes are 1:1, not 1:N

Clinical notes have their own table, `clinical_notes`, and the model is **1:1 with
client/appointment** — there is no note-to-many-clients join, and there is **no foreign key at
all** enforcing even the 1:1 link. Confirmed live:

```sql
select conname from pg_constraint where conrelid = 'public.clinical_notes'::regclass;
-- → only clinical_notes_pkey. No FK on client_id, appointment_id, or therapist_id.
```

**"Group notes" are faked, not modeled.** `distributeGroupNote()`
([services/api.ts:1143-1202](../services/api.ts:1143)) loops over selected attendees and calls
`saveClinicalNote()` once per client (line 1179), inserting **N separate `clinical_notes` rows**
— identical note text copy-pasted into each row, each stamped with `note_type='Group Session'`
and that client's own `appointment_id` ("seat"). A partial unique index prevents re-posting the
*same* seat twice:

```sql
-- supabase/migrations/20260705_group_checkin_1_clinical_notes_group_seat_unique.sql:32-34
create unique index if not exists ux_clinical_notes_group_seat
  on public.clinical_notes (appointment_id)
  where note_type = 'Group Session';
```

Nothing correlates the N rows *across different clients* as one clinical event. See
[DEFERRED.md #25](../DEFERRED.md) for the resulting integrity defect (independently-editable
duplicates, no drift detection).

---

## 2. SOURCE OF TRUTH TODAY: appointment fields, never notes

`appointments.service_type` and `appointments.billable_units` are asserted directly by the
clinician in `AppointmentStatusModal` at Mark-Complete time and are **never read from
`clinical_notes`** anywhere in the repo.

Proof — `computeUnits()`, the function backing the Services-tab-equivalent unit display:

```ts
// components/clients/ClientSessionsTab.tsx:81-94
const computeUnits = (a: Appointment, program?: string): UnitsInfo | null => {
  const grain = unitGrainFor(program, a.serviceType);
  if (!grain) return null;
  const s = parseHHMM(a.startTime), e = parseHHMM(a.endTime);
  const minutes = s !== null && e !== null && e > s ? e - s : null;
  const grainMinutes = grain.unitMinutes as number;
  if (typeof a.billableUnits === 'number') {
    return { units: a.billableUnits, grainMinutes, minutes, asserted: true };
  }
  if (minutes !== null) {
    return { units: suggestedUnits(minutes, grain), grainMinutes, minutes, asserted: false };
  }
  return null;
};
```

Line 87-88 reads `a.billableUnits` (the `appointments.billable_units` column) directly — **zero
fallback to `clinical_notes` anywhere in this function or its callers.** The only fallback (line
90-91) is a *suggestion* computed from the appointment's own `startTime`/`endTime`, still not
note-derived. Session type/date display in the same component (`sessionTypeById(a.sessionTypeId)`
at line 147, `a.serviceType` at line 149, `a.date` from `start_time`/`date_time`) is likewise
straight off the `appointments` row. The only note-derived signal anywhere in this component is
`isGroup` falling back to `item.note?.note_type === 'Group Session'` (line 148) as an OR
alongside `!!a.groupId` — the note is consulted only as a secondary badge hint, never as the
source of type/units values.

**Conclusion:** for David's mechanism ("group type will be declared in the Group Note", "units
to be pulled from note"), the model as it stands contradicts the claim — the note is a
supplementary attached artifact today, not the system of record.

---

## 3. THE COMPETING VOCABULARIES — the single most confusable thing in this repo

Five separate, independently-defined "type" concepts exist on or near a client/session. None of
these are interchangeable and the codebase itself warns about it:

```ts
// config/sessionTaxonomy.ts:16-17
// NOTE: appointments.service_type (accrual axis, 'counseling'/'other') is a
// DIFFERENT concept from ServiceType below — do not write these tokens there.
```

| Vocabulary | Where defined | Values | Purpose |
|---|---|---|---|
| `appointments.service_type` | DB CHECK `appointments_service_type_valid` (`20260606_ws3_1_session_hours_accrual.sql:28-31`) | `counseling \| education \| rehabilitative_support \| other` | Billing/accrual grain axis. Drives `client_accrued_hours` (hours-completion gate) and the `billableUnits.ts` unit grain. |
| `sessionTaxonomy.ts` `ServiceType` | [config/sessionTaxonomy.ts:19](../config/sessionTaxonomy.ts:19) | `'OP' \| 'SATOP' \| 'Evaluation'` | Level 1 of the 3-level booking cascade (Service → Session Type → Counselor). |
| `session_type` tokens | [config/sessionTaxonomy.ts:50-79](../config/sessionTaxonomy.ts:50), persisted on `appointments.session_type` (text) | Stable ids, e.g. `op_group`, `satop_group`, `cip_1on1`, `mrt_1on1`, `omu` | Booking-time session label; drives counselor eligibility (`counselorsForSessionType`) and calendar color. |
| `clients.program_type` | DB CHECK, live schema | `SATOP \| OEP \| WIP \| CIP \| SROP \| OPIOID_RECOVERY \| GAMBLING_RECOVERY \| ANGER_MANAGEMENT \| INDIVIDUAL_COUNSELING` | CLINICAL placement — drives the determination/completion gate. Normalize via `config/programVocab.ts`. |
| `clients.client_type` | DB CHECK (migration `20260629`), live schema, nullable | 15-token operational/scheduling set | OPERATIONAL scheduling-funnel category (David's straw man). Read-only display today. Labels in `config/clientType.ts`. |

Concretely, **"CIP" appears in three of these five independently** — `clients.program_type`
(`CIP` = SATOP Level III per `config/programVocab.ts:29,41,84`), `clients.client_type` (`CIP` as
one of the 15 operational tokens), and `session_type` (`cip_1on1`, label `'CIP 1:1'`,
`config/sessionTaxonomy.ts:67`). `appointments.service_type` — the column whose name sounds most
like it should hold "CIP" — **does not** carry it; that CHECK only allows the four accrual-grain
values above.

`ScheduleSessionModal.tsx:127` derives group-ness from a label string, not a dedicated flag:
`const isGroup = sessionDef.label.toLowerCase().includes('group');`

---

## 4. WS6 STANDING-GROUPS SCHEMA

Migration: [supabase/migrations/20260606_ws6_1_standing_groups.sql](../supabase/migrations/20260606_ws6_1_standing_groups.sql).
Seed: `supabase/migrations/20260607_ws6_2_standing_groups_seed.sql` (6 counselors, 12 group rows
transcribed from the 7/31/24 ACS Zoom sheet).

**What exists (live column lists, `information_schema.columns`):**

`counselors`: `id uuid PK, name text NOT NULL, zoom_link text, zoom_meeting_id text, active boolean NOT NULL default true, created_at timestamptz NOT NULL default now(), auth_user_id uuid` (auth link added later, `20260705_schedule_identity_1_counselor_auth_link`).

`groups`: `id uuid PK, counselor_id uuid → counselors(id), program text NOT NULL (free text,
informational only — holds multi-program strings like 'CIP/SROP/OP'), weekday smallint,
start_local time, end_local time, session_kind text NOT NULL, service_type text NOT NULL
(CHECK: counseling/education/rehabilitative_support/other), active boolean NOT NULL default
true, created_at timestamptz`. Live: 12 rows.

`group_enrollments`: `id uuid PK, group_id uuid NOT NULL → groups(id), client_id uuid NOT NULL →
clients(id), enrolled_at date NOT NULL default current_date, discharged_at date, active boolean
NOT NULL default true, created_at timestamptz NOT NULL`. Live: 4 rows.

`appointments.group_id`: nullable `uuid → groups(id)`, added additively by this same migration
(lines 79-81), existing rows left NULL/untouched.

**What reads it:** `getGroupsWithCounselor()` ([services/api.ts:530-552](../services/api.ts:530))
selects `groups` joined to `counselors(name, zoom_link, zoom_meeting_id)`, filtered
`active=true`. Consumed by exactly one place —
[components/sessions/ScheduleSessionModal.tsx:93-95](../components/sessions/ScheduleSessionModal.tsx:93)
— to populate a group picker. Selecting a group inherits the counselor's Zoom room and
`service_type`, sets `groupId` on **one new appointment for one selected client per submit**
(lines 239, 285-329) — there is no bulk "book this occurrence for the whole roster" action.

**What doesn't read it:** `group_enrollments` — grep for the table name across the whole repo
hits only migration/seed files; zero application-code selects from it (see
[DEFERRED.md #26](../DEFERRED.md)). A group "occurrence" with multiple attendees exists only
because multiple independent single-client bookings happen to share `(group_id, start_time)`
([services/greenRoom.ts:15-18](../services/greenRoom.ts:15)).

---

## 5. FULL COLUMN LISTS (live, `ldzzlndsspkyohvzfiiu`, queried 2026-07-15)

### `appointments` (34 columns)

`id` uuid PK · `client_id` text (legacy, relaxed from uuid — `20260417_appointments.sql:6-8`) ·
`therapist_id` uuid · `start_time` timestamptz NOT NULL · `duration_minutes` int default 60 ·
`appointment_type` text default `'Individual Session'` · `status` text default `'scheduled'`
(no CHECK — see [DEFERRED.md #28](../DEFERRED.md)) · `notes_complete` boolean default false ·
`session_rate` numeric default 125.00 (dead — [DEFERRED.md #12](../DEFERRED.md)) ·
`payment_status` text default `'unbilled'` (dead) · `created_at` timestamptz · `date_time`
timestamptz (legacy dup of `start_time`) · `session_type` text (booking-taxonomy token, §3
above) · `is_court_mandated` boolean default false (dead) · `therapist_name` text (the actual
attribution key — see [DEFERRED.md #4](../DEFERRED.md)) · `reschedule_reason` text (vestigial,
nothing writes it) · `rescheduled_at` timestamptz (vestigial) · `cancellation_reason` text
(vestigial) · `cancelled_at` timestamptz (vestigial) · `title` text · `end_time` timestamptz ·
`modality` text · `zoom_link` text · `zoom_meeting_id` text · `client_name` text (denormalized) ·
`capacity` int (no code reader found) · `is_recurring` boolean default false · `google_event_id`
text · `google_event_link` text · `updated_at` timestamptz · `service_type` text (CHECK:
counseling/education/rehabilitative_support/other — the billing/accrual axis, §3 above) ·
`group_id` uuid → `groups(id)` · `series_id` uuid → `appointment_series(id)` · `notes` text
(free-text per-occurrence field, unrelated to `clinical_notes`) · `counselor_id` uuid →
`counselors(id)` · `billable_units` int (CHECK 1-12, `20260715_billable_units.sql`).

### `clinical_notes` (11 columns)

`id` uuid PK · `client_id` uuid (no FK) · `appointment_id` uuid (no FK; null in practice for
both individual-note save paths — see [DEFERRED.md #27](../DEFERRED.md)) · `therapist_id` uuid
(no FK) · `note_type` text default `'soap'` (format encoded here, e.g. `'Session (DAP)'`,
`'Group Session'`) · `subjective` text · `objective` text · `assessment` text · `plan` text ·
`is_signed` boolean default false (no `signed_by`/`signed_at`) · `created_at` timestamptz
(not a sign timestamp) · `embedding` (vector, unrelated to this recon).

### `clients` (relevant subset)

`program_type` text default `'SATOP'` (CHECK, §3) · `client_type` text nullable (CHECK, §3) ·
`case_number` text · `assigned_therapist_id` uuid (orphaned, see
[DEFERRED.md #2](../DEFERRED.md)) · `billing_type` text (no CHECK, see
[DEFERRED.md #13](../DEFERRED.md)) · `dob` date · `county` text · `probation_officer` text ·
`balance` numeric. **No `dmh_number` column. No `sober_date` column.** (§6 below.)

### `treatment_plans`

`id` uuid PK · `client_id` uuid NOT NULL · `template_id` text · `title` text NOT NULL ·
`category` text NOT NULL · `estimated_duration` text · `content` jsonb NOT NULL default `'{}'`
(shape: `{ problems: TreatmentPlanProblem[] }`, each problem `{ title, goals, interventions }`
— **no id/ordinal field on a problem, anywhere**, TS type at `types.ts:552-560`) · `status` text
default `'Active'` · `created_by` uuid · `notes` text · `created_at`/`updated_at` timestamptz.

---

## 6. NOT FOUND — net-new columns, do not re-search

- **DMH number.** No column named/shaped like a DMH client id (e.g. `106365`) exists on
  `clients` or `clinical_notes`. The only "dmh" hits in the repo are an unrelated
  `authorizeDMH: boolean` consent checkbox (`types.ts:344`,
  `components/forms/AuthorizationForReleaseForm.tsx:10,27,99,110`) and prose references to the
  agency.
- **Sober date.** No real date field on `clients` or `clinical_notes`. The only "sober" hits are
  `ChartChecklistData.soberDate: boolean | null` (`types.ts:378-379`) — a yes/no checklist flag,
  and itself **dead/unrendered** in `ChartChecklistForm.tsx`'s JSX — plus
  `RecoveryPlanData.remainSober: boolean` (an intent boolean, not a date) and one hardcoded mock
  string in `pages/ClientWorkspace.tsx:41`.
- **Staff credentials.** No credentials column on `counselors`, `clinical_notes`, or any
  profiles/users table. Credentials only ever appear as free text embedded inside
  `appointments.therapist_name` strings (e.g. `'Karen Ventimiglia, LPC'`,
  `20260714_demo_week_seed_v2_full_week.sql:62`).
- **Stable treatment-plan problem ids.** `treatment_plans.content.problems[]` has no id/ordinal
  field — see §5 above. Referencing "problem 1, problem 2" today is array-index only, unstable
  across edits.
- **Note signer identity.** `clinical_notes.is_signed` is a boolean with no `signed_by`/
  `signed_at` columns — see §5 above and [DEFERRED.md #27](../DEFERRED.md).

---

## 7. jsPDF ZERO-DRIFT `build()` CONTRACT

`jspdf@^4.2.1` ([package.json:17](../package.json:17)) backs receipts, completion certificates,
and CIMOR packets. The zero-drift guarantee — preview and saved file are byte-identical because
they come from the same instance, never regenerated — lives in
[components/clients/DocumentPreviewModal.tsx](../components/clients/DocumentPreviewModal.tsx):

```ts
// components/clients/DocumentPreviewModal.tsx:72
const docRef = useRef<jsPDF | null>(null);

// :88-97 (build once, preview from that instance)
const doc = isGenericProps(props)
  ? props.build()
  : props.kind === 'certificate'
    ? buildCompletionCertificateDoc(props.client, props.completion)
    : buildStatusReportDoc(props.client, props.verdicts, props.completion, props.progress);
docRef.current = doc;
url = URL.createObjectURL(doc.output('blob'));
setBlobUrl(url);

// :126-136 (save from the SAME instance — no rebuild)
const handleCreatePdf = () => {
  const doc = docRef.current;
  if (!doc) return;
  doc.save(/* filename */);
};
```

Component doc comment (`DocumentPreviewModal.tsx:57-66`): *"One renderer, no drift: the in-app
preview is the ACTUAL jsPDF document... 'Create PDF' saves that exact same document... The same
plumbing also powers the payment receipt via the `receipt` mode, which hands in a pre-bound
`build()` closure instead of cert/status inputs — reused, not forked, so the zero-drift guarantee
holds identically."* This `build()`-closure contract is the reusable pattern for any new document
type (e.g. a signed digital-form PDF) that needs the same preview-equals-saved guarantee.
