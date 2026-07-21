-- ACS TherapyHub — Client Upload Link tokens (inbound twin of Capture).
--
-- A staff member mints a time-limited, single-active token scoped to ONE client and
-- ONE requested document type. The client uploads via the public `acs-request-upload`
-- edge function (service_role), which ingests to uploaded_files + the private bucket.
--
-- 42 CFR Part 2 hardening baked in from commit one:
--   • token_hash, NOT the raw token — the plaintext token exists only in the minted
--     URL, never at rest in this shared multi-app DB.
--   • deny-all RLS: no anon/authenticated access; the edge function (service_role)
--     is the only path. Mirrors flowvault_family_upload_tokens' posture.
--   • the public page shows NO client identity (enforced in the edge function's
--     resolve, which returns only the requested-document label + expiry).
--
-- ADDITIVE ONLY: new table + indexes. Zero changes to any existing table or function.

create table if not exists public.acs_upload_tokens (
  id                       uuid primary key default gen_random_uuid(),
  -- sha256(raw token) hex. The raw token is returned once at mint and never stored.
  token_hash               text not null unique,
  client_id                uuid not null references public.clients(id),
  -- One existing uploaded_files.document_type value, chosen by staff at mint. The
  -- upload lands pre-categorized (Admin/Clinical via config/recordCategory.ts).
  requested_document_type  text not null,
  requested_label          text,
  expires_at               timestamptz not null,
  created_at               timestamptz not null default now(),
  created_by               uuid null,
  revoked_at               timestamptz null,
  last_used_at             timestamptz null,
  upload_count             integer not null default 0,
  metadata                 jsonb not null default '{}'::jsonb
);

create index if not exists acs_upload_tokens_client_idx
  on public.acs_upload_tokens (client_id);
create index if not exists acs_upload_tokens_token_hash_idx
  on public.acs_upload_tokens (token_hash);

alter table public.acs_upload_tokens enable row level security;

-- Deny all direct client access. The edge function uses service_role (bypasses RLS).
-- No policies for anon/authenticated — intentional empty set.
revoke all on table public.acs_upload_tokens from anon, authenticated;
grant all on table public.acs_upload_tokens to service_role;

comment on table public.acs_upload_tokens is
  'ACS client upload-link tokens. Mint (staff JWT) / resolve / submit only via the acs-request-upload edge function. Stores token_hash, never the raw token.';
