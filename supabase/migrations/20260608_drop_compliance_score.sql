-- compliance_score retired: replaced on the dashboard by the computed "Open Guardrail
-- Flags" count; removed from all 5 staff surfaces + the EditClientModal hand-edit
-- (merge 2484abf). Zero display readers, zero app writers. Mirrors the #10a cleanup.
ALTER TABLE public.clients DROP COLUMN IF EXISTS compliance_score;
