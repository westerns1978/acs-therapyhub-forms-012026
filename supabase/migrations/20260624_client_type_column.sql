-- ACS TherapyHub — Phase 1: clients.client_type column (2026-06-24)
--
-- PURPOSE
--   Add a single free-text column `client_type` to public.clients. This is the
--   operational scheduling-funnel category David described (e.g. DOT, Outpatient,
--   Relapse Prevention) that will later narrow the service dropdown when booking.
--
-- DELIBERATELY DISTINCT FROM program_type:
--   program_type is CLINICAL placement (SATOP/SROP/CIP/...) and stays the determination
--   gate's level source — untouched here. client_type is OPERATIONAL/scheduling and is a
--   separate axis. Keep them distinct.
--
-- DESIGN
--   • TEXT, nullable, NO CHECK constraint yet. David's canonical list is pending; we do
--     NOT guess the allowed values. Once his list lands we tighten this to a CHECK in a
--     follow-up migration (mirrors the program_vocab pattern).
--   • No default — existing rows stay NULL; no backfill (no operational categories known).
--   • status is NOT touched: active/completed/archived/prospect already covers the lifecycle
--     and `prospect` is load-bearing for the intake front-door.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS.
-- REVERTIBLE:
--     alter table public.clients drop column if exists client_type;

alter table public.clients
    add column if not exists client_type text;

comment on column public.clients.client_type is
    'Operational scheduling-funnel category (e.g. DOT, Outpatient, Relapse Prevention). '
    'Free-text for now; tighten to a CHECK once David''s canonical list lands. '
    'Distinct from program_type (clinical placement: SATOP/SROP/CIP).';
