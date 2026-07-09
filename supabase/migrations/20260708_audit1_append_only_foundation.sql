-- Audit logging v1, foundation — turn audit_logs from a wide-open, never-written table into
-- an append-only, staff-scoped ledger. Confirmed live before this migration:
--   * 0 rows.
--   * RLS enabled (relrowsecurity=true) but the ONLY policy was "Allow all audit"
--     (FOR ALL, roles=PUBLIC, using(true), with check(true)) -- i.e. every role, including
--     anon, could SELECT/INSERT/UPDATE/DELETE unconditionally.
--   * GRANTs: anon AND authenticated both hold ALL privileges (SELECT/INSERT/UPDATE/DELETE/
--     TRUNCATE/REFERENCES/TRIGGER) -- the same auto-grant-on-create behavior the
--     placement_determinations recon (20260606_ws2_2) already found and fixed for that table.
--   * Schema (pre-existing, NOT changed here): id uuid pk, user_id uuid, action text not null,
--     entity_type text, entity_id uuid, details jsonb default '{}', ip_address text,
--     created_at timestamptz default now().
--
-- CHANGE: replace "Allow all audit" with two policies (SELECT staff-wide, INSERT self-
-- attributed) and NO update/delete policy -- plus the explicit GRANT-layer revoke, since RLS
-- alone is not "doubly enforced" here (same lesson as ws2_2). Immutable by construction:
-- even if a future policy bug reopened RLS, the GRANT layer has no UPDATE/DELETE/TRUNCATE
-- privilege for authenticated to exploit, and anon has nothing at all.

alter table public.audit_logs enable row level security;

drop policy if exists "Allow all audit" on public.audit_logs;

-- Grant layer: authenticated keeps exactly SELECT + INSERT (both already held from the prior
-- ALL grant; only the destructive privileges are revoked). anon loses everything.
revoke all on table public.audit_logs from anon;
revoke update, delete, truncate, references, trigger on table public.audit_logs from authenticated;

-- SELECT: any staff (Director/Therapist/Admin) may read the trail -- mirrors
-- pd_select_staff on placement_determinations.
create policy audit_logs_select_staff on public.audit_logs
  for select to authenticated
  using (private.is_staff());

-- INSERT: staff-only, and the actor must BE the auth user (self-attribution guard) --
-- mirrors pd_insert_clinician's determined_by = auth.uid() pattern.
create policy audit_logs_insert_staff on public.audit_logs
  for insert to authenticated
  with check (private.is_staff() and user_id = auth.uid());

-- NO update policy, NO delete policy -> immutable once written. Omission is the mechanism.

-- REVERT (restores the prior wide-open policy -- NOT recommended, kept for completeness only):
--   drop policy if exists audit_logs_select_staff on public.audit_logs;
--   drop policy if exists audit_logs_insert_staff on public.audit_logs;
--   grant all on table public.audit_logs to anon, authenticated;
--   create policy "Allow all audit" on public.audit_logs for all using (true) with check (true);
