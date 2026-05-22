-- ACS TherapyHub Phase F2: per-client treatment plans.
--
-- A "treatment plan" is conceptually distinct from a form_submission: it's a
-- living document with problems, goals, and interventions that gets revised
-- and archived over time. Margaret Sullivan's existing "Individual
-- Comprehensive Treatment Plan" stays in public.form_submissions (per F2
-- decision to coexist at the data layer; see SECURITY_BACKLOG.md).
--
-- Content is stored as a JSONB tree matching the TreatmentPlanContent TS
-- interface — same shape as data/treatmentPlanTemplates.ts so customize/save
-- is a 1:1 serialize.
--
-- created_by is nullable because demo-mode users (no Supabase session) need
-- to be able to save plans during the trial.

CREATE TABLE IF NOT EXISTS public.treatment_plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  template_id         text,
  title               text NOT NULL,
  category            text NOT NULL,
  estimated_duration  text,
  content             jsonb NOT NULL DEFAULT '{}'::jsonb,
  status              text NOT NULL DEFAULT 'Active',
  created_by          uuid REFERENCES auth.users(id),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS treatment_plans_client_id_idx ON public.treatment_plans (client_id);
CREATE INDEX IF NOT EXISTS treatment_plans_status_idx ON public.treatment_plans (status);

ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all treatment_plans" ON public.treatment_plans;
CREATE POLICY "Allow all treatment_plans" ON public.treatment_plans
  FOR ALL USING (true) WITH CHECK (true);
