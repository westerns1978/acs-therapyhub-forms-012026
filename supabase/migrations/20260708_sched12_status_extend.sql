-- Scheduling build, step 12 — client status 4->7 token extension. NON-DESTRUCTIVE:
-- pure CHECK-constraint widening. No UPDATE statement touches a single row's status value.
-- Live baseline (queried immediately before this migration):
--   active=16, archived=6, prospect=5, completed=2
--
-- David's 5-status target model: Pending, Active, Paused, Unsuccessful Dx, Successful Dx.
-- 'paused', 'unsuccessful_dx', 'successful_dx' are NEW tokens added here. 'active' stays.
-- 'prospect' and 'completed' are NOT renamed at the DB layer -- they display as "Pending"
-- and "Successful Dx" via a LABEL-ONLY remap in types.ts (CLIENT_STATUS_LABELS), reported
-- as label-only per Dan's explicit instruction to prefer that over rewriting stored values.
-- 'archived' is RETAINED as its own distinct admin-lifecycle state (own label "Archived"),
-- not folded into "Unsuccessful Dx" -- the 6 archived + 2 completed rows are flagged in-app
-- (types.ts needsStatusReview) for David to confirm whether any should become
-- 'unsuccessful_dx' / 'successful_dx' explicitly. No row is remapped by guess.
--
-- Re-runnable: drop-if-exists before create.

alter table public.clients drop constraint if exists clients_status_lifecycle_check;

alter table public.clients add constraint clients_status_lifecycle_check
  check (status = any (array[
    -- existing 4 (migrations 20260611, 20260617) -- kept valid, unchanged
    'active', 'completed', 'archived', 'prospect',
    -- David's 7/7 additions
    'paused', 'unsuccessful_dx', 'successful_dx'
  ]));

-- REVERT (restores the exact prior 4-token CHECK; safe only if no row has taken a new token):
--   alter table public.clients drop constraint if exists clients_status_lifecycle_check;
--   alter table public.clients add constraint clients_status_lifecycle_check
--     check (status = any (array['active','completed','archived','prospect']));
