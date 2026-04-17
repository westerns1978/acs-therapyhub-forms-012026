-- Augment the existing (empty) appointments table with fields the app needs.
-- The original schema was built for a different use case; rows=0 so additive + type
-- changes are safe. Keeps start_time timestamptz + duration_minutes as the source of
-- truth for when the session happens; client-side maps to the app's date/startTime/endTime trio.

-- client_id was uuid; the app uses short string IDs like '1', '2'. Relax to text.
alter table public.appointments
    alter column client_id type text using client_id::text;

alter table public.appointments
    add column if not exists title text,
    add column if not exists end_time timestamptz,
    add column if not exists modality text,
    add column if not exists zoom_link text,
    add column if not exists zoom_meeting_id text,
    add column if not exists client_name text,
    add column if not exists capacity integer,
    add column if not exists is_recurring boolean default false,
    add column if not exists google_event_id text,
    add column if not exists google_event_link text,
    add column if not exists updated_at timestamptz default now();

create index if not exists appointments_start_time_idx on public.appointments (start_time);
create index if not exists appointments_client_id_idx on public.appointments (client_id);
