-- WS0 RLS enforcement (4/7) — close the two RLS-off tables (atomic)
-- Drop "Allow all" and enable RLS together: exposed (RLS off) -> scoped + enforced,
-- with no committed intermediate. Applied + verified live 2026-06-05
-- (Director reads rows; anon returns 0 rows).

drop policy if exists "Allow all" on public.clinical_notes;
drop policy if exists "Allow all" on public.form_submissions;
alter table public.clinical_notes   enable row level security;
alter table public.form_submissions enable row level security;
