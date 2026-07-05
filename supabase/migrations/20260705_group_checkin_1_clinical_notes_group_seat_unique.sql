-- WS2 (group check-in → distribute): idempotency guarantee for group-note distribution.
--
-- distributeGroupNote() posts ONE group note into each present attendee's chart, stamping
-- that attendee's own appointment_id (their seat in the group occurrence: one appointments
-- row per client sharing group_id + start_time) and note_type = 'Group Session'.
--
-- This PARTIAL UNIQUE INDEX makes a re-post physically impossible: a second insert for the
-- same seat (same appointment_id, same 'Group Session' marker) fails with 23505, which the
-- app classifies as alreadyPosted (benign) — NO duplicate chart entry, NO double-count. The
-- partial predicate scopes uniqueness to group notes only, so ordinary SOAP/DAP notes (which
-- may legitimately repeat per appointment) are untouched.
--
-- Scope: appointment_id only. Each seat's appointment_id already implies its client, so
-- (appointment_id) is a sufficient key; NULL appointment_id rows are treated as distinct by
-- the index (they never carry the 'Group Session' seat marker in practice).
--
-- NOT concurrently: this repo's migration runner wraps each migration in a transaction, and
-- CREATE INDEX CONCURRENTLY cannot run inside a txn block (matches every other index in
-- supabase/migrations, none of which use CONCURRENTLY). The clinical_notes table is small
-- and has zero existing 'Group Session' rows (dup-precheck 2026-07-05), so the build lock is
-- momentary.
--
-- Dup-precheck 2026-07-05 (read-only): 0 colliding appointment_ids, 0 rows in collisions,
-- 0 'Group Session' notes with NULL appointment_id, 0 'Group Session' rows total — clean.
--
-- No RLS change. clinical_notes stays clinician-only (staff_all_clinical_notes =
-- private.is_clinician(), RLS enabled). This migration only adds the index.
--
-- RELEASE ORDER: apply this migration to live BEFORE deploying the app bundle that calls
-- distributeGroupNote — otherwise the 23505 guarantee isn't present and a re-post double-charts.

create unique index if not exists ux_clinical_notes_group_seat
  on public.clinical_notes (appointment_id)
  where note_type = 'Group Session';
