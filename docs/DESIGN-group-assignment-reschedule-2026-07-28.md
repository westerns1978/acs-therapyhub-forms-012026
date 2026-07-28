# Schema decisions — group assignment & reschedule history (2026-07-28)

Status: **PROPOSED — awaiting Dan's review before any migration is applied.**
Source: David's 7/28 call + 7/15 requirements. Recon ground truth is cited inline.

---

## 1. Group assignment (Batch L2)

### Ground truth
- `group_enrollments` already exists (migration `20260606_ws6_1_standing_groups.sql`):
  `group_id, client_id, enrolled_at date, discharged_at date, active bool` — with staff-all +
  client-self-read RLS. It has **zero application-code readers** and 4 seed rows.
- The roster used by the Green Room today is reconstructed from
  `appointments(group_id, start_time)` — per-seat appointment rows, hand-created one at a time.
- Accrual is per-seat: `client_accrued_hours` joins `appointments.client_id` where
  `status='completed'`. **A group occurrence must produce one appointment row per attendee or
  nobody accrues.** (`20260606_ws3_1_session_hours_accrual.sql`)
- Group notes today are N duplicate `clinical_notes` rows with no correlating id — the known
  records-integrity defect (DEFERRED #25).

### Proposal

**A. Standing assignment = `group_enrollments`, adopted as-is + one guard.**
David's model maps exactly onto the existing table:

| David's requirement | Column |
|---|---|
| START date, staff-chosen | `enrolled_at` (stop defaulting silently; UI picks it) |
| NO end date — persists in perpetuity | no planned-end column exists; nothing added |
| until manually removed | `active=false` + `discharged_at` = removal date (a record of the removal, not a plan) |

One new migration line: **partial unique index `(group_id, client_id) where active`** so a
client can't be double-enrolled in the same group. Multi-group membership (1–4 groups) is
already naturally supported. No end-date field is built anywhere in the UI — David was explicit
it would mislead.

**B. Occurrence = new `group_sessions` table (the group note IS the occurrence).**

```sql
create table group_sessions (
  id            uuid pk default gen_random_uuid(),
  group_id      uuid not null references groups(id),
  counselor_id  uuid references counselors(id),
  session_date  date not null,
  started_at    time not null,
  ended_at      time not null,
  declared_type text not null check (declared_type in
    ('group_education','group_counseling','mrt_group_education','mrt_group_counseling')),
  units         int  not null check (units between 1 and 12),
  narrative     text not null,
  staff_name    text not null,
  staff_credentials text,
  signed_at     timestamptz,          -- set at submit; append-only after signing
  created_at    timestamptz not null default now(),
  unique (group_id, session_date)     -- one group note per block per day
);
```
Staff-only RLS. `declared_type` is chosen at note time — this is how Deb's alternating Ed/Cns
groups work with no ahead-of-time designation.

**C. Attendance = new `group_session_attendees` (per-seat bridge).**

```sql
create table group_session_attendees (
  id               uuid pk,
  group_session_id uuid not null references group_sessions(id),
  client_id        uuid not null references clients(id),
  appointment_id   uuid references appointments(id),  -- the materialized seat
  source           text not null check (source in ('standing','makeup')),
  unique (group_session_id, client_id)
);
```

**D. Flow (no phantom rows, accrual only on real occurrences):**
1. Weekly blocks render on the leader's calendar **computed client-side from
   `groups.weekday/start_local/end_local`** — static, recurring, zero materialization.
2. Counselor clicks block → group note pre-populated from `group_enrollments`
   (`active AND enrolled_at <= session_date`). Add (makeup) / remove (absent) touches only this
   occurrence's attendee list — standing enrollment untouched.
3. Submit → one `group_sessions` row; per final attendee: one `appointments` row
   (`group_id`, occurrence start/end, `status='Completed'`, `service_type` from declared type,
   `billable_units=units`) + one `clinical_notes` row (existing 1:1 pattern) + one
   `group_session_attendees` row.
4. New column **`clinical_notes.group_session_id uuid`** correlates the N note rows to the one
   clinical event — closes the DEFERRED #25 correlating-id gap without changing the 1:1 note
   model the rest of the app assumes.

Services-tab display per attendee: declared type + date + units — all on the seat appointment
(+ occurrence for the label). No expansion needed.

**Open question for Dan/David — MRT accrual:** `declared_type` → `service_type` mapping.
`group_counseling → counseling`, `group_education → education` are obvious. MRT is seeded as
`service_type='other'` today (deliberately non-accruing). Do `mrt_group_counseling` /
`mrt_group_education` accrue as CNS/ED, or stay `other`? Proposal defaults to **mapping MRT to
counseling/education respectively** (David named them as Ed/Cns variants), but this changes
accrual behavior vs. today's seed and needs a nod.

**Open question — the 13th group:** David's verbatim list contains **12** blocks; the brief
says 13 with a duplicate Thu 9–12 David flagged on the call. Reading: the original 13 had
Thu 9–12 David twice and the deduped truth is these 12. Seeding proceeds with the 12 listed;
confirm before anything is *dropped* from the live `groups` table.

---

## 2. Reschedule history (Batch L1)

### Ground truth
- Reschedule today is an **in-place update**: `updateAppointment` overwrites
  `start_time/end_time/duration_minutes` (`services/api.ts:624-636`). The old time is destroyed.
- `appointments.reschedule_reason/rescheduled_at` are single-slot — they hold only the last move.
- The ONLY trail that exists is `audit_logs` (`appointment.rescheduled` with from/to details,
  `api.ts:667-684`) — write-only, fire-and-forget (a failed audit write is swallowed), staff-
  scoped, no per-appointment reader. Suitable as audit, **not** as the product feature David
  asked for ("staff must see the trail").

### Proposal

**New append-only table `appointment_reschedules`:**

```sql
create table appointment_reschedules (
  id             uuid pk default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  from_start     timestamptz not null,
  from_end       timestamptz,
  to_start       timestamptz not null,
  to_end         timestamptz,
  from_counselor_id uuid references counselors(id),
  to_counselor_id   uuid references counselors(id),
  reason         text,
  moved_by       uuid,                 -- auth.uid()
  moved_at       timestamptz not null default now()
);
```
Staff-all RLS; no UPDATE/DELETE policies (append-only, same posture as `audit_logs`).

**Write path:** the reschedule branch of `updateAppointment` already reads the prior row before
writing (it needs it for the audit log). Insert the trail row in the same function, **before**
the update, and keep the existing audit write unchanged. (A two-write RPC for atomicity was
considered and rejected for now: the pre-read already exists, the failure window is tiny, and an
RPC adds a deploy surface; can be hardened later if drift is ever observed.)

**Read path / UI:** `AppointmentStatusModal` gains a "Session history" section when trail rows
exist: *Originally Mon Jul 6, 2:00 PM → moved Jul 8 (by Karen, "client called") → moved Jul 13.*
Original time = first row's `from_start`. Calendar block shows a small ↻ count marker when
`rescheduleCount > 0` (cheap: `select appointment_id, count(*)` for visible appointments).

**Semantics per David:** a reschedule is a *continuation* (same appointment row, same id, trail
grows) — distinct from No Show / No Call No Show / Canceled, which are closed terminal statuses
on the occurrence. Nothing about the existing cancel/no-show flows changes.

**Backfill (optional):** `audit_logs` rows with `action='appointment.rescheduled'` contain
from/to and can seed the trail for moves made since audit logging went live. Proposed but not
required for v1.
