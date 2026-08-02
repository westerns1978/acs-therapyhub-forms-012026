-- ============================================================================
-- ROLLBACK for 20260802_p0_3_reopen_client.sql.
--
-- Touches no policy and no table — reopen_client() is purely additive, so undoing
-- it is a single DROP. It does NOT delete the `client.reopened` audit_logs rows
-- it wrote: those are append-only records of things that actually happened.
--
-- AFTER RUNNING THIS: a completed client has no reopen path at all (which was the
-- state before this work — smoke defect D-2). Any client already reopened stays
-- active, with completed_at preserved, exactly as reopen_client() left them.
-- ============================================================================

begin;

drop function if exists public.reopen_client(uuid, text);

commit;
