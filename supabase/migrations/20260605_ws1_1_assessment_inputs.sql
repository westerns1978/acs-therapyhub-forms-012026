-- WS1 — typed assessment inputs (capture layer for the deterministic placement engine).
-- Sensitive clinical/legal screening data → staff-only, NO client self-read.
--
-- The placement RULES (9 CSR 30-3.206) are NOT encoded here — they live in
-- services/placementEngine.ts as the single source of truth. This table only
-- captures the typed inputs the engine reads. No determination is stored in WS1;
-- the clinician sign-off (placement_determinations) is WS2.
create table public.assessment_inputs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  screening_date date not null default (now() at time zone 'America/Chicago')::date,
  offense_count int not null default 0,         -- drives base level
  dui_arrest_count int not null default 0,      -- SROP condition (DUI arrests w/ DOR administrative action)
  bac numeric,                                  -- SROP condition + upgrade factor
  sud_diagnosis boolean not null default false, -- SROP condition (clinical)
  dri2_result text,                             -- captured, NEVER computed (proprietary)
  dri2_date date,                               -- DRI-2 administration date (captured)
  prior_treatment boolean not null default false, -- upgrade factor
  other_arrests int not null default 0,         -- upgrade factor
  life_issues boolean not null default false,   -- upgrade factor
  notes text,
  created_by uuid,                              -- app sets = auth.uid() (attribution only)
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  -- Defense-in-depth for a highest-stakes table: reject impossible values at the DB
  -- (the engine/UI also validate). Counts are non-negative; BAC if present is non-negative.
  constraint assessment_inputs_nonneg check (
    offense_count >= 0 and dui_arrest_count >= 0 and other_arrests >= 0
    and (bac is null or bac >= 0)
  )
);

-- Lookups are always by client (the capture screen loads a client's inputs).
create index assessment_inputs_client_id_idx on public.assessment_inputs (client_id);

alter table public.assessment_inputs enable row level security;
-- Collaboratively edited (front desk captures, clinician reviews/corrects), so NO
-- created_by = auth.uid() guard in WITH CHECK (unlike payments) — a clinician must be
-- able to edit a record the front desk created. created_by is attribution, not a lock.
create policy staff_all_assessment_inputs on public.assessment_inputs
  for all to authenticated
  using (private.is_staff())
  with check (private.is_staff());
-- NO client self-read policy: this is internal clinical screening data.
