-- ACS TherapyHub Phase G1: columns the CreateClientModal collects but the
-- clients table didn't have yet. All nullable so existing rows are unaffected.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS dob date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS probation_officer text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS billing_type text;
