-- L1b RESCHEDULE HISTORY (David 7/28: "a session has a lifespan"; Dan-approved).
-- Design: docs/DESIGN-group-assignment-reschedule-2026-07-28.md
--
-- Append-only trail: one row per move, written by the reschedule branch of
-- updateAppointment BEFORE the in-place start/end overwrite (which is what
-- destroys the old time today). Original date/time = the earliest row's
-- from_start. A reschedule is a CONTINUATION of the same appointment id —
-- distinct from the terminal No Show / NCNS / Canceled statuses.
--
-- Posture matches audit_logs: staff can INSERT and SELECT; no UPDATE/DELETE
-- policies exist, so the trail cannot be edited from the app.
-- (Down path: drop table public.appointment_reschedules.)

create table if not exists public.appointment_reschedules (
  id                uuid primary key default gen_random_uuid(),
  appointment_id    uuid not null references public.appointments(id) on delete cascade,
  from_start        timestamptz not null,
  from_end          timestamptz,
  to_start          timestamptz not null,
  to_end            timestamptz,
  from_counselor_id uuid references public.counselors(id),
  to_counselor_id   uuid references public.counselors(id),
  reason            text,
  moved_by          uuid,
  moved_at          timestamptz not null default now()
);
create index if not exists ix_appointment_reschedules_appt
  on public.appointment_reschedules (appointment_id, moved_at);

alter table public.appointment_reschedules enable row level security;
drop policy if exists staff_insert_appointment_reschedules on public.appointment_reschedules;
create policy staff_insert_appointment_reschedules on public.appointment_reschedules
  for insert with check (private.is_staff());
drop policy if exists staff_read_appointment_reschedules on public.appointment_reschedules;
create policy staff_read_appointment_reschedules on public.appointment_reschedules
  for select using (private.is_staff());
