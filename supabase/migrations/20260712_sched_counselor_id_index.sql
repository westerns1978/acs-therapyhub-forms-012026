-- Schedule attribution — index on appointments.counselor_id (UP).
--
-- CONTEXT: the counselor_id column, its FK to counselors(id) ON DELETE SET NULL, and
-- counselors.active ALL already shipped in 20260705_schedule_identity_1_counselor_auth_link
-- (and the backfill ran there too — 213/241 rows attributed, reconciled byte-for-byte against
-- normalizeCounselorName() on 2026-07-12). The ONLY piece that migration did not add was an
-- index on the new FK column. Lane bucketing and the RLS visibility EXISTS-join both filter on
-- counselor_id, so it wants an index. This migration adds exactly that and nothing else.
--
-- Idempotent (if not exists) and additive. Reversible via the paired
-- 20260712_sched_counselor_id_index.down.sql. therapist_name is intentionally left untouched
-- (denormalized display + rollback path).
--
-- NOTE: plain (non-CONCURRENTLY) create so it runs inside the migration runner's transaction.
-- On the current row count (241) the brief lock is immaterial; if this table grows large before
-- apply, switch to `create index concurrently` OUTSIDE a transaction.

create index if not exists appointments_counselor_id_idx
  on public.appointments (counselor_id);
