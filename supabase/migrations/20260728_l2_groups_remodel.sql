-- L2 GROUPS REMODEL (David 7/15 blocks + 7/28 answers; Dan-approved 2026-07-28).
-- Design: docs/DESIGN-group-assignment-reschedule-2026-07-28.md
--
-- PART 1 — the groups table becomes David's TWELVE verbatim weekly blocks.
-- DEDUPE AUTHORITY (Dan 7/28, quoting David on the 7/28 call): "I'm doubled
-- up... one of those can be removed. I only have one Thursday 9 to 12." The
-- original 7/15 list had Thu 9-12am Grp Ed David twice; both lines identical,
-- so the deduped truth is 12 blocks and the DB keeps its single Thursday row.
--
-- program column now holds David's verbatim block label (Grp Cns / Grp Ed /
-- Grp Cns/RP / Group / MRT). PRIOR VALUES (the down path for the updates):
--   8987f295-44af-43fc-b994-75a907d1da49: program 'CIP/SROP/OP/DOT & DWI Court'
--   9079219c-40ca-485f-844b-54d245bafd63: program 'CIP/SROP/OP/DOT & DWI Court',
--       session_kind 'therapy', service_type 'counseling'
--   3d16ebc3-8e43-474f-9d39-d6758faa8db6: program 'R/P (Relapse Prevention)'
--   b2edfa85-7a71-46c6-b9ae-d4dc37297846: program 'O/P/CIP/SROP',
--       session_kind 'therapy', service_type 'counseling'
--   3ce35c03-74da-498d-ba51-aba46b78d923: program 'O/P/CIP/SROP'
--   1a61bdec-8e69-495e-84cc-601028e5824f: program 'MRT Group', weekday NULL,
--       start_local NULL, end_local NULL
-- The full counselor→service capability ground stays recorded in
-- 20260607_ws6_2_standing_groups_seed.sql (CLAUDE.md cites it) — nothing lost.
--
-- session_kind vocabulary gains 'alternating' (Deb's groups declare Ed or Cns
-- at NOTE time, never in advance — David). Deb/MRT rows keep service_type
-- 'other' so the LEGACY picker-booking path never accrues a guessed category;
-- under the new flow every seat's service_type comes from the note's declared
-- type (MRT accrues by declared type — MRT is a modality label, not an accrual
-- category; confirmed by inference from David's four-type note spec, verbal
-- confirmation pending, see ROADMAP).
--
-- Weekday: 0=Sun..6=Sat.

-- ── Part 1a: retype/relabel the five existing weekly rows ──────────────────
update public.groups set program = 'Grp Cns'
  where id = '8987f295-44af-43fc-b994-75a907d1da49';                -- Mon 9-12 David
update public.groups set program = 'Grp Ed', session_kind = 'education', service_type = 'education'
  where id = '9079219c-40ca-485f-844b-54d245bafd63';                -- Thu 9-12 David (the deduped single Thursday)
update public.groups set program = 'Grp Cns/RP'
  where id = '3d16ebc3-8e43-474f-9d39-d6758faa8db6';                -- Mon 6-9p John
update public.groups set program = 'Grp Ed', session_kind = 'education', service_type = 'education'
  where id = 'b2edfa85-7a71-46c6-b9ae-d4dc37297846';                -- Tue 6-9p John
update public.groups set program = 'Grp Cns'
  where id = '3ce35c03-74da-498d-ba51-aba46b78d923';                -- Thu 6-9p John
update public.groups set program = 'MRT', weekday = 2, start_local = '18:00', end_local = '20:00'
  where id = '1a61bdec-8e69-495e-84cc-601028e5824f';                -- Tue 6-8p MRT Deb (was by-appt)

-- ── Part 1b: insert the six new blocks (idempotent) ─────────────────────────
insert into public.groups (counselor_id, program, weekday, start_local, end_local, session_kind, service_type, active)
select c.id, v.program, v.weekday, v.start_local::time, v.end_local::time, v.session_kind, v.service_type, true
from (values
  ('Dave L', 'Grp Ed',  2, '18:00', '21:00', 'education',   'education'),
  ('Dave L', 'Grp Cns', 4, '18:00', '21:00', 'therapy',     'counseling'),
  ('Debra',  'Group',   1, '18:00', '20:00', 'alternating', 'other'),
  ('Debra',  'Group',   3, '18:00', '20:00', 'alternating', 'other'),
  ('Debra',  'Group',   4, '18:00', '20:00', 'alternating', 'other'),
  ('Debra',  'MRT',     6, '08:00', '10:00', 'mrt',         'other')
) as v(counselor_name, program, weekday, start_local, end_local, session_kind, service_type)
join public.counselors c on c.name = v.counselor_name
where not exists (
  select 1 from public.groups g
  where g.counselor_id = c.id and g.weekday = v.weekday
    and g.start_local = v.start_local::time and g.program = v.program
);

-- ── Part 2: one ACTIVE enrollment per (group, client) ───────────────────────
create unique index if not exists ux_group_enrollments_active
  on public.group_enrollments (group_id, client_id) where active;

-- ── Part 3: the group occurrence = the group note ───────────────────────────
-- (Down path: drop table group_session_attendees; drop table group_sessions;
--  alter table clinical_notes drop column group_session_id;
--  drop index ux_group_enrollments_active.)
create table if not exists public.group_sessions (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups(id),
  counselor_id  uuid references public.counselors(id),
  session_date  date not null,
  started_at    time not null,
  ended_at      time not null,
  declared_type text not null constraint group_sessions_declared_type_valid check (declared_type in
    ('group_education','group_counseling','mrt_group_education','mrt_group_counseling')),
  units         integer not null constraint group_sessions_units_valid check (units between 1 and 12),
  narrative     text not null,
  staff_name    text not null,
  staff_credentials text,
  signed_at     timestamptz,
  signed_by_name text,
  created_at    timestamptz not null default now(),
  constraint ux_group_sessions_one_per_day unique (group_id, session_date)
);
alter table public.group_sessions enable row level security;
drop policy if exists staff_all_group_sessions on public.group_sessions;
create policy staff_all_group_sessions on public.group_sessions
  for all using (private.is_staff()) with check (private.is_staff());

create table if not exists public.group_session_attendees (
  id               uuid primary key default gen_random_uuid(),
  group_session_id uuid not null references public.group_sessions(id) on delete cascade,
  client_id        uuid not null references public.clients(id),
  appointment_id   uuid references public.appointments(id),
  source           text not null constraint group_session_attendees_source_valid
                     check (source in ('standing','makeup')),
  created_at       timestamptz not null default now(),
  constraint ux_group_session_attendees_seat unique (group_session_id, client_id)
);
alter table public.group_session_attendees enable row level security;
drop policy if exists staff_all_group_session_attendees on public.group_session_attendees;
create policy staff_all_group_session_attendees on public.group_session_attendees
  for all using (private.is_staff()) with check (private.is_staff());

-- Correlates the N per-client note rows to the ONE clinical event (DEFERRED #25).
alter table public.clinical_notes add column if not exists group_session_id uuid references public.group_sessions(id);
