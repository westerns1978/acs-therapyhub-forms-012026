-- ─────────────────────────────────────────────────────────────────────────────
-- Status vocabulary normalization (2026-06-11) — PRESENT-THEN-APPLY
-- clients.status becomes LIFECYCLE-ONLY: 'active' | 'completed' | 'archived'.
--
-- Compliance standing (Compliant / Non-Compliant / Warrant Issued) is NOT a
-- stored value: the deterministic engine computes standing at render
-- (complianceEngine guardrails / packet readiness). Storing it in `status`
-- would create a second source of truth that can contradict the engine — the
-- exact divergence DisplayTruth exists to prevent.
--
-- Verified before writing (2026-06-11, read-only):
--   select distinct status → ONLY lowercase active(13) / archived(6) / completed(2)
--   column default is already 'active'::text; no NULL rows (21/21 have a value)
-- → steps 1–2 are no-op safety canonicalization, kept so the migration replays
--   idempotently against any state.
--
-- Reversible: drop the CHECK constraint, drop the NOT NULL, drop the two
-- columns. The UPDATEs are lossless on current data (no row changes).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Canonicalize casing (no-op on current data).
update public.clients
set status = lower(status)
where status is not null and status <> lower(status);

-- 2) Map any legacy/compliance-word value to its LIFECYCLE home (no-op today).
--    A client flagged compliant / non-compliant / warrant is, lifecycle-wise,
--    an ACTIVE client — standing is the engine's to say, not this column's.
update public.clients
set status = 'active'
where status is null or status not in ('active','completed','archived');

-- 3) Single vocabulary, enforced — a fourth variant can never appear again.
--    NOT NULL too: a NULL status would silently vanish from the app's
--    .neq('status','archived') default filter (NULL <> 'archived' is NULL).
alter table public.clients alter column status set not null;
alter table public.clients drop constraint if exists clients_status_lifecycle_check;
alter table public.clients
  add constraint clients_status_lifecycle_check
  check (status in ('active','completed','archived'));

-- 4) Transition timestamps for the archive lifecycle (the follow-up prompt's
--    ≈18mo-completed / 7yr-retention clocks need real dates, not inference).
--    Nullable, NO backfill — historical transition dates are unknown; null is
--    honest. Written going forward by services/api.ts updateClient on the
--    matching status transition.
alter table public.clients add column if not exists completed_at timestamptz;
alter table public.clients add column if not exists archived_at  timestamptz;

comment on column public.clients.status is
  'Lifecycle ONLY: active | completed | archived (CHECK-enforced). Compliance standing is engine-computed at render, never stored here.';
comment on column public.clients.completed_at is
  'Set by the app when status transitions to completed; cleared when it leaves. NULL for pre-2026-06 transitions (unknown — not backfilled).';
comment on column public.clients.archived_at is
  'Set by the app when status transitions to archived; cleared when it leaves. NULL for pre-2026-06 transitions (unknown — not backfilled).';
