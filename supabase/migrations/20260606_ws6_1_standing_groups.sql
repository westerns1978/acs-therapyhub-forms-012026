-- WS6 Phase 1 — standing groups (ADDITIVE ONLY). Creates the group model + a nullable
-- appointments.group_id FK. Does NOT alter existing appointment rows, zoom_link, or the
-- google_event_* sync fields — the old per-session path + Google Calendar sync keep working
-- untouched; the new group path rides alongside until witnessed.
--
-- NAMING: the typed-slot column is `session_kind` (NOT session_type) — appointments already
-- has an unused legacy `session_type` column distinct from WS3's `service_type`; two columns
-- named session_type is the form_id/client_id ambiguity trap. The seed maps session_kind
-- EXPLICITLY to WS3's service_type (stored on the group), and service_type='other' is the
-- proven-ignored bucket (client_accrued_hours.total_hours filters it out).

-- ── (1) counselors — the permanent per-counselor Zoom room (ACS 7/31/24 sheet) ──────────
-- Minimal by design (no appointments.therapist_id retrofit — that's SECURITY_BACKLOG #3).
create table if not exists public.counselors (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  zoom_link       text,
  zoom_meeting_id text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
alter table public.counselors enable row level security;
revoke all on public.counselors from anon;
drop policy if exists staff_all_counselors on public.counselors;
create policy staff_all_counselors on public.counselors
  for all to authenticated using (private.is_staff()) with check (private.is_staff());

-- ── (2) groups — ONE row per weekly TYPED slot (Decision 1) ─────────────────────────────
-- session_kind is the human/schedule label; service_type is WS3's reg category, mapped at
-- seed (therapy/individual → counseling · education → education · intake/dwi_court/mrt/
-- anger/adep → other). A counselor's shared Zoom ID lives on counselors, referenced here.
create table if not exists public.groups (
  id           uuid primary key default gen_random_uuid(),
  counselor_id uuid references public.counselors(id),
  program      text not null,            -- OEP/WIP/CIP/SROP/OP/RP/ADEP/MRT/DWI_COURT/ANGER
  weekday      smallint,                 -- 0=Sun .. 6=Sat ; null = by-appointment
  start_local  time,
  end_local    time,
  session_kind text not null,            -- therapy | education | individual | intake | dwi_court | mrt | anger | adep
  service_type text not null,            -- WS3 enum (mapped from session_kind at seed)
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint groups_service_type_valid
    check (service_type in ('counseling','education','rehabilitative_support','other'))
);
alter table public.groups enable row level security;
revoke all on public.groups from anon;
drop policy if exists staff_all_groups on public.groups;
create policy staff_all_groups on public.groups
  for all to authenticated using (private.is_staff()) with check (private.is_staff());
-- groups stay STAFF-ONLY for WS6. The portal gets the join-link from the appointment's
-- inherited zoom_link (Decision 3), so no client-facing "your standing groups" view exists
-- yet — a client_read policy here would be unexercised and add RLS-within-RLS (a subquery
-- into group_enrollments) visibility risk. If that view is wanted later, add it then with a
-- SECURITY DEFINER private.my_group_ids() helper and witness it specifically.
-- NOTE: `program` is free TEXT (no CHECK) and INFORMATIONAL only — it holds multi-program
-- rooms like 'CIP/SROP/OP'; the accrual path is driven solely by session_kind→service_type.

-- ── (3) group_enrollments — client_id is uuid + FK to clients (clean; NOT the appointments
-- text legacy, SECURITY_BACKLOG #7). The appointment↔group join lives on appointments.group_id.
create table if not exists public.group_enrollments (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups(id),
  client_id     uuid not null references public.clients(id),
  enrolled_at   date not null default current_date,
  discharged_at date,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
alter table public.group_enrollments enable row level security;
revoke all on public.group_enrollments from anon;
drop policy if exists staff_all_group_enrollments on public.group_enrollments;
create policy staff_all_group_enrollments on public.group_enrollments
  for all to authenticated using (private.is_staff()) with check (private.is_staff());
drop policy if exists client_self_read_group_enrollments on public.group_enrollments;
create policy client_self_read_group_enrollments on public.group_enrollments
  for select to authenticated using (client_id in (select private.my_client_ids()));

-- ── (4) appointments.group_id — nullable FK; existing rows stay NULL + untouched ─────────
alter table public.appointments
  add column if not exists group_id uuid references public.groups(id);
