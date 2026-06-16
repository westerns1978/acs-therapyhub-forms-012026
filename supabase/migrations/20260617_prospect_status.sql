-- ─────────────────────────────────────────────────────────────────────────────
-- Prospect status — front-door intake demo (2026-06-17) — PRESENT-THEN-APPLY
-- Adds a 'prospect' lifecycle state so a public self-serve intake can create a
-- pre-placement client record that is INVISIBLE to the active roster/engine until
-- a clinician signs a placement determination and staff "Place & Activate" it.
--
-- Mirrors the status (20260611) + program-vocab (20260616) CHECK pattern: one
-- enumerated vocabulary, enforced. clients is ACS-owned (it already carries
-- clients_status_lifecycle_check + clients_program_vocab_check).
--
-- DEMO / SYNTHETIC ONLY. A prospect carries NO clinical detail: name, phone,
-- email, and a free-text "what brings you here" (intake_interest). The real
-- program_type is set by STAFF at placement (derived from the signed determined
-- level), never by the prospect — preserving the clinician-signed placement gate.
--
-- Two changes:
--   1) status CHECK: active|completed|archived → +prospect.
--   2) intake_interest text (nullable): the home for the public form's free-text.
--      RECON NOTE (2026-06-17): no existing clients text column was a clean home —
--      every one is semantically specific (primary_substance = clinical;
--      case_number/probation_officer = legal; county/employment_status =
--      demographic). One nullable additive column is the honest minimal solution.
--
-- Verified before writing (read-only): 0 clients have a null/blank program_type
-- today, so a prospect (program_type NULL) is unambiguous; program_type is already
-- nullable. Reversible: drop the column; restore the CHECK without 'prospect'
-- (after any prospect rows are converted or removed).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Extend the lifecycle vocabulary.
alter table public.clients drop constraint if exists clients_status_lifecycle_check;
alter table public.clients
  add constraint clients_status_lifecycle_check
  check (status in ('active','completed','archived','prospect'));

-- 2) Free-text intake interest (the public form's "what brings you here").
alter table public.clients add column if not exists intake_interest text;

comment on column public.clients.status is
  'Lifecycle ONLY: active | completed | archived | prospect (CHECK-enforced). '
  'prospect = a public self-serve intake before clinician placement; excluded from '
  'the active roster + compliance engine until "Place & Activate" sets program_type '
  'from a SIGNED placement determination and flips status to active.';
comment on column public.clients.intake_interest is
  'Free-text "what brings you here" from the public /intake form. Demo/synthetic; '
  'NOT clinical detail. Surfaced only in the staff intake-queue tile.';
