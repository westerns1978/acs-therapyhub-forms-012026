-- ACS TherapyHub — WS7 completion-gate columns (2026-06-05)
--
-- The completion-certificate gate is: hours_completed >= required_hours
--   AND balance == 0  AND a SIGNED completion sign-off exists.
-- Two of those three need backing columns that don't exist yet:
--   • clients.balance — the outstanding balance the gate requires to be 0.
--       (pages/portal/PortalBilling.tsx already SELECTs this column; until now it
--        was absent, so that read silently fell back to 0. Adding it gives the
--        gate a real input.)
--   • clients.is_demo — marks demo/sample records so generated certificates carry
--       the "SAMPLE — NOT VALID FOR SUBMISSION" watermark + a non-real cert number.
--       Presentation only; it NEVER affects the gate (the one legitimate use of a
--       demo flag here).
-- Sign-off needs no new column: it is a signed clinical_notes row with
-- note_type = 'completion_signoff'.
--
-- Additive + idempotent. No data destroyed; defaults are gate-safe: balance 0
-- (every existing client reads as paid-up, so none is falsely blocked) and
-- is_demo false (no real record is ever stamped SAMPLE by accident).

alter table public.clients add column if not exists balance numeric not null default 0;
alter table public.clients add column if not exists is_demo boolean not null default false;

comment on column public.clients.balance is
  'Outstanding client balance (USD). Completion-certificate gate requires 0.';
comment on column public.clients.is_demo is
  'Demo/sample record. Drives the SAMPLE watermark on generated certificates; never affects gating.';
