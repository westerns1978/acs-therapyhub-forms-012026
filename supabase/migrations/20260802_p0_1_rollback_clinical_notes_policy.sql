-- ============================================================================
-- ROLLBACK for 20260802_p0_1_completion_gate.sql.
--
-- WRITTEN AND COMMITTED BEFORE THE FORWARD MIGRATION WAS APPLIED, on Dan's
-- instruction. The `clinical_notes` policy split is the only change in the P0 set
-- that can break a clinician's ordinary Monday, so it is treated as the whole
-- risk: this file restores that policy EXACTLY as production carried it, from the
-- verbatim catalogue snapshot in
-- 20260802_p0_0_preflight_clinical_notes_policy_snapshot.sql — not from memory.
--
-- Run this WHOLE file to undo the forward migration. The policy restore is first
-- and stands alone: if the only problem is note access, section 1 by itself is
-- the fix, and the rest can wait.
--
-- WHAT THIS DELIBERATELY DOES NOT DO:
--
--   • It does NOT drop `clinical_notes.signed_by_role`. A nullable column is
--     harmless, and if any attestation was recorded before the rollback, dropping
--     it would destroy the record of who signed and in what role. Additive and
--     inert — leave it.
--   • It does NOT delete any `completion_signoff` note or any `audit_logs` row.
--     Those are append-only records of things that actually happened.
--   • It does NOT reinstate the `status='active' ⇒ 'completed'` coercion that was
--     removed from services/api.ts — that is application code, reverted with git.
--
-- AFTER RUNNING THIS: any client already recorded as completed KEEPS status
-- 'completed' and its completed_at. Nothing is un-completed. What is lost is the
-- enforcement: the gate goes back to being TypeScript-only, i.e. back to the P0.
-- ============================================================================

begin;

-- ── 1. THE ONE THAT MATTERS — restore clinical_notes to its exact prior state ──
-- Reconstructed from the pg_policies snapshot: PERMISSIVE, FOR ALL,
-- TO authenticated, USING private.is_clinician(), WITH CHECK private.is_clinician().
drop policy if exists clinical_notes_select_staff on public.clinical_notes;
drop policy if exists clinical_notes_insert_staff on public.clinical_notes;
drop policy if exists clinical_notes_update_staff on public.clinical_notes;
drop policy if exists clinical_notes_delete_staff on public.clinical_notes;

drop policy if exists staff_all_clinical_notes on public.clinical_notes;
create policy staff_all_clinical_notes on public.clinical_notes
  as permissive for all to authenticated
  using       (private.is_clinician())
  with check  (private.is_clinician());

-- Verify the restore against the snapshot before going any further. If this
-- raises, the transaction rolls back and clinical_notes is left untouched.
do $$
declare v_count integer; v_row record;
begin
  select count(*) into v_count from pg_policies
   where schemaname='public' and tablename='clinical_notes';
  if v_count <> 1 then
    raise exception 'clinical_notes should carry exactly 1 policy after rollback, found %.', v_count;
  end if;
  select * into v_row from pg_policies
   where schemaname='public' and tablename='clinical_notes';
  if v_row.policyname <> 'staff_all_clinical_notes'
     or v_row.permissive <> 'PERMISSIVE'
     or v_row.cmd <> 'ALL'
     or v_row.roles::text <> '{authenticated}'
     or v_row.qual <> 'private.is_clinician()'
     or v_row.with_check <> 'private.is_clinician()' then
    raise exception 'restored clinical_notes policy does not match the preflight snapshot: %', v_row;
  end if;
  raise notice 'clinical_notes policy restored and verified against the preflight snapshot.';
end $$;

-- ── 2. The completion guard ─────────────────────────────────────────────────
drop trigger  if exists trg_clients_guard_completion on public.clients;
drop function if exists public.clients_guard_completion();

-- ── 3. The gate RPC ─────────────────────────────────────────────────────────
drop function if exists public.complete_client(uuid, text);

-- ── 4. my_progress() — back to its own inlined determination predicate ──────
-- Restored verbatim from the pre-migration definition (pg_get_functiondef,
-- captured 2026-08-02 alongside the policy snapshot).
create or replace function public.my_progress()
returns table(established boolean, level text)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    (sel.determined_level is not null) as established,
    sel.determined_level               as level
  from (select 1) one
  left join lateral (
    select pd.determined_level, pd.determined_at
    from public.placement_determinations pd
    where pd.status = 'signed'
      and pd.client_id in (select private.my_client_ids())
      and not exists (
        select 1
        from public.placement_determinations s
        where s.supersedes_id = pd.id
          and s.status = 'signed'
      )
    order by pd.determined_at desc
    limit 1
  ) sel on true;
$function$;

drop function if exists private.current_determined_level(uuid);
drop function if exists private.fmt_num(numeric);

-- ── 5. The reference tables ─────────────────────────────────────────────────
-- Dropped last: nothing else depends on them once complete_client() is gone.
-- If you keep them, `npm run check:gate` keeps working — it reads the migration
-- FILE, not the database, so it is unaffected either way.
drop table if exists public.satop_required_forms;
drop table if exists public.satop_level_requirements;

commit;
