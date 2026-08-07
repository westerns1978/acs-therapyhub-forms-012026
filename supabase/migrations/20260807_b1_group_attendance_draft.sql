-- B1 (David's Aug-5 markup, Aug-7 build): save who showed up to a group session
-- WITHOUT submitting the note. group_sessions forbids drafts by design (David
-- 7/28: born-signed, NOT NULL narrative/units/declared_type/staff_name) and
-- group_session_attendees is FK'd to a submitted group_sessions row — neither
-- can hold a pre-note attendance mark. This is a new, separate, low-risk table
-- instead of loosening either constraint: additive, no existing row touched.
--
-- One row per DELTA from the standing roster for a (group, date) occurrence —
-- an absence off the roster, or a makeup add — not a full roster snapshot.
-- Cleared once the real note is submitted (submitGroupSession); a leftover
-- draft after that point would just be dead weight, never read.
--
-- Down path: drop table group_session_attendance_drafts.
create table if not exists public.group_session_attendance_drafts (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  session_date date not null,
  client_id    uuid not null references public.clients(id),
  source       text not null constraint group_session_attendance_drafts_source_valid
                 check (source in ('standing','makeup')),
  updated_at   timestamptz not null default now(),
  constraint ux_group_attendance_draft_seat unique (group_id, session_date, client_id)
);
alter table public.group_session_attendance_drafts enable row level security;
drop policy if exists staff_all_group_session_attendance_drafts on public.group_session_attendance_drafts;
create policy staff_all_group_session_attendance_drafts on public.group_session_attendance_drafts
  for all using (private.is_staff()) with check (private.is_staff());
