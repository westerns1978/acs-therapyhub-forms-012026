-- Schedule attribution — index on appointments.counselor_id (DOWN).
--
-- Reverses 20260712_sched_counselor_id_index.sql. Drops ONLY the index this branch added.
-- Deliberately does NOT drop counselor_id / its FK / counselors.active — those predate this
-- branch (20260705) and their own DOWN, if ever needed, lives with that migration.

drop index if exists public.appointments_counselor_id_idx;
