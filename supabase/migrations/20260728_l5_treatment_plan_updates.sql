-- L5 TREATMENT PLAN UPDATES (David 7/15: "The Treatment Planning section is
-- really nice!" — extend, don't rebuild). Strictly additive + nullable.
--
-- The UPDATE model: an update is a NEW treatment_plans row that supersedes the
-- prior one. The prior row is archived UNTOUCHED ("prior versions saved exactly
-- as originally signed"); the new row becomes the primary plan. No in-place
-- version mutation, no version counter — the supersedes chain IS the history.
--
--   supersedes_plan_id  → the plan this row updated (null = original plan)
--   update_date         → David's "date of update" (staff-chosen)
--   progress_comments   → David's "space for progress comments"
--   created_by_name     → name of the clinician initiating or updating the plan
--                         (created_by uuid exists but was never written; the
--                         display name is what David asked to see)
--   clinician_signature / client_signature → "BOTH signatures required" on an
--                         update — typed-name signatures, consistent with the
--                         existing app-wide signature posture (design untouched).
--   signed_at           → when the pair of signatures was applied.

alter table public.treatment_plans add column if not exists supersedes_plan_id uuid references public.treatment_plans(id);
alter table public.treatment_plans add column if not exists update_date date;
alter table public.treatment_plans add column if not exists progress_comments text;
alter table public.treatment_plans add column if not exists created_by_name text;
alter table public.treatment_plans add column if not exists clinician_signature text;
alter table public.treatment_plans add column if not exists client_signature text;
alter table public.treatment_plans add column if not exists signed_at timestamptz;
