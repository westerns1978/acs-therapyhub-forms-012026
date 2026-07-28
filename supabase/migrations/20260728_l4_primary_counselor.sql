-- L4 (David 7/15): client header must show the PRIMARY COUNSELOR.
-- There was no counselor column on clients at all — counselor identity lived
-- only on appointments.counselor_id. Additive + nullable; no backfill (staff
-- set it via Edit Client; deriving it from appointment history would guess).
-- NOTE: clients.assigned_therapist_id (uuid) exists but points at auth users
-- from the legacy model and is unused by the app; the roster of record is
-- public.counselors, so this FK targets counselors(id) like appointments do.

alter table public.clients
  add column if not exists primary_counselor_id uuid references public.counselors(id);
