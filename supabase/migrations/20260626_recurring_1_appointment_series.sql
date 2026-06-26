-- ACS TherapyHub — Recurring Scheduling Phase 1 (2026-06-26)
-- 1:1 RECURRING SERIES ONLY. Additive, idempotent, reversible. No DDL on existing
-- appointment rows beyond two nullable columns; the one-off booking path is untouched.
--
-- WHAT THIS ADDS
--   • appointment_series — the parent rule + 1:1 enrollment (client_id is a REAL uuid FK to
--     clients, unlike appointments.client_id which is legacy TEXT — SECURITY_BACKLOG #7).
--     Occurrences are ordinary appointments rows carrying a series_id FK back here.
--   • appointments.series_id — nullable FK; NULL = ad-hoc/one-off (every existing row).
--   • appointments.notes    — per-occurrence free text (clinician note on the appointment).
--   • indexes for the series filter + the deterministic therapist-overlap conflict query.
--
-- DELIBERATELY OUT OF SCOPE (do NOT add here): group-session recurrence, group attendance,
--   group_enrollments wiring, therapist_id retrofit. therapist is matched by NAME this round
--   (mirrors appointments.therapist_name); therapist_id FK is a flagged fast-follow.
--
-- IDEMPOTENT: create table/column IF NOT EXISTS; policies dropped-then-created.
-- REVERSIBLE:
--   alter table public.appointments drop column if exists series_id;
--   alter table public.appointments drop column if exists notes;
--   drop table if exists public.appointment_series;

-- ── (1) appointment_series — parent rule + 1:1 enrollment ────────────────────────────────
create table if not exists public.appointment_series (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id),
  -- NAME-matched for now (mirrors appointments.therapist_name). FAST-FOLLOW: add a
  -- therapist_id uuid FK and switch the conflict predicate to it — one-line change.
  therapist_name   text not null,
  appointment_type text not null,
  modality         text,
  weekday          smallint not null,        -- 0=Sun .. 6=Sat ; derived from first occurrence
  start_local      time not null,
  end_local        time not null,
  service_type     text,                     -- inherited (group) or null (set at mark-complete)
  zoom_link        text,
  zoom_meeting_id  text,
  -- Exactly one of these drives generation. recurrence_count is the wired path this round;
  -- recurrence_until is stored-but-unwired (UI fast-follow). CHECK requires at least one.
  recurrence_count integer,
  recurrence_until date,
  status           text not null default 'active',
  created_at       timestamptz not null default now(),
  created_by       uuid,
  constraint appointment_series_has_bound
    check (recurrence_count is not null or recurrence_until is not null)
);

alter table public.appointment_series enable row level security;
revoke all on public.appointment_series from anon;
-- Staff-only this round (booking is a staff action). A client self-read view of their own
-- series is unexercised today — the portal reads the dated occurrences (appointments), not
-- the rule — so adding a client policy here would be untested RLS surface. Add it with a
-- witness if/when a client-facing "your recurring sessions" view is built.
drop policy if exists staff_all_appointment_series on public.appointment_series;
create policy staff_all_appointment_series on public.appointment_series
  for all to authenticated using (private.is_staff()) with check (private.is_staff());

-- ── (2) appointments.series_id + notes — nullable; existing rows stay NULL + untouched ────
alter table public.appointments
  add column if not exists series_id uuid references public.appointment_series(id),
  add column if not exists notes     text;

-- ── (3) indexes — series filter (edit-scope "entire series") + therapist-overlap conflict ─
create index if not exists appointments_series_id_idx
  on public.appointments (series_id);
-- The conflict query selects a therapist's appointments in a time window, then intersects
-- intervals client-side. (therapist_name, start_time) serves that range scan; swap the
-- leading column to therapist_id when the FK lands.
create index if not exists appointments_therapist_start_idx
  on public.appointments (therapist_name, start_time);
