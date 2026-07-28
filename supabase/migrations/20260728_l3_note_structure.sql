-- L3 NOTE STRUCTURE (David 7/15 required fields; built 2026-07-28).
--
-- David's individual-note structure: Date | Time started/ended | Units (1-12,
-- staff-entered) | Client name | Tx Plan problems addressed | Staff name +
-- credentials | Narrative | Staff signature + date | Submit.
--
-- clinical_notes today is SOAP-shaped (subjective/objective/assessment/plan +
-- is_signed) with none of those fields. This migration is STRICTLY ADDITIVE and
-- every column is nullable — legacy rows stay valid, no backfill, revertible by
-- dropping the columns.
--
-- narrative: the note body VERBATIM. This is also the fix-at-the-root for the
-- "Start Session note loses formatting" defect: the SOAP splitter
-- (services/api.ts sliceByHeaderMatches) destroys headers and blank-line
-- structure at write time. New notes store the full text here untouched;
-- the split columns remain populated for legacy renderers.
--
-- signed_at / signed_by_name: "Staff signature + date". Typed-name signature
-- consistent with the existing is_signed flow (the signature DESIGN itself is
-- untouched per Dan's standing instruction — no pad, no image).

alter table public.clinical_notes add column if not exists service_date date;
alter table public.clinical_notes add column if not exists time_started time;
alter table public.clinical_notes add column if not exists time_ended time;
alter table public.clinical_notes add column if not exists units integer;
alter table public.clinical_notes add column if not exists problems_addressed text;
alter table public.clinical_notes add column if not exists staff_name text;
alter table public.clinical_notes add column if not exists staff_credentials text;
alter table public.clinical_notes add column if not exists narrative text;
alter table public.clinical_notes add column if not exists signed_at timestamptz;
alter table public.clinical_notes add column if not exists signed_by_name text;

-- Units are a state-billing COUNT (15-min grain), same 1..12 domain as
-- appointments.billable_units (20260715_billable_units.sql).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clinical_notes_units_valid'
  ) then
    alter table public.clinical_notes
      add constraint clinical_notes_units_valid
      check (units is null or (units between 1 and 12));
  end if;
end $$;
