-- WS0 RLS enforcement (5/7) — drop the permissive "Allow all" policies on the
-- seven tables that were RLS-on-but-wide-open (RLS already enabled on these).
-- Applied + verified live 2026-06-05 (Director reads; anon returns 0 rows on all seven).

drop policy if exists "Allow all clients"                on public.clients;
drop policy if exists "Allow all appointments"           on public.appointments;
drop policy if exists "Allow all payments"               on public.payments;
drop policy if exists "Allow all treatment_plans"        on public.treatment_plans;
drop policy if exists "Allow all risk profiles"          on public.client_risk_profiles;
drop policy if exists "Allow all client communications"  on public.client_communications;
drop policy if exists "Allow all therapist availability" on public.therapist_availability;
