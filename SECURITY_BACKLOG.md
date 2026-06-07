# Security Backlog

Post-demo (David Yoder, Tuesday 2026-05-19 1pm CT) items that we deliberately deferred
to keep scope tight.

The May 2026 trial uses **mock data only**. The two items below are named
**trial-to-live blockers** — they must both be done before any real client or PHI data
enters this database. The remaining items are smaller follow-ups.

---

## BLOCKER 1 — Rotate the leaked Gemini API key (cross-app scheduled task)

**Key:** `AIzaSyBLU362ndX18qYQO7OiW3mGniyn2Lsk93M`

**Status (2026-05-22):** This is Dan's **shared Gemini key** used across multiple
Gemynd apps and wired into Supabase secrets app-wide. Rotation is a coordinated
cross-app task — it is **NOT** happening as part of the ACS trial sprint. The ACS
side of the mitigation (stop exposing the key in the client bundle) is being
handled by Phase E2's server-side proxy migration; that closes the *new* exposure
surface even though the key remains in git history.

Committed to ACS git in `e913ed8` (April 2026) inside a `.env` file that was later
untracked, and carried as a hardcoded fallback in `services/gemini.ts:10` until
the fallback was removed in Phase D2 of the May 2026 trial sprint. Even with the
fallback gone, the key string remains in ACS git history reachable from
`origin/main` — recoverable via `git log -S "AIzaSy"`.

**Rotation is the only fix for the historical exposure.** History rewriting is out
of scope (would break clones, forks, and tags across every Gemynd repo that has
this commit).

**When rotation happens (scheduled, not this sprint):**
- Coordinate across every app that reads from the shared Supabase secret
- Open https://console.cloud.google.com/apis/credentials?project=gen-lang-client-0121881478
- Delete the key whose prefix is `AIzaSyBLU362…`
- Regenerate a new Gemini key; update the Supabase secret in one place; every app
  picks it up
- After Phase E2 proxy migration, the ACS client bundle will not need a Gemini
  key at all — only the orchestrator (server-side) holds it
- Spot-check Clara voice across all apps after rotation so the new key is exercised
  end-to-end

---

## BLOCKER 2 — Enable RLS + author policies on every public table

**Severity statement (Dan, 2026-05-21):** "Enable RLS + author per-table policies on
all public tables before any real client/PHI data enters the database. Trial is
mock-data only; this gates the trial→live transition."

> ### ✅ RESOLVED for the ACS client-data tables (2026-06-05 — WS0)
>
> Applied to the live project (`ldzzlndsspkyohvzfiiu`) via present-then-apply, with a live
> **authenticated Director** check between each enforcement step (anon probe + Director read).
> Migrations: `ws0_rls_helpers`, `ws0_rls_scoped_policies`,
> `ws0_rls_close_clinical_notes_form_submissions`, `ws0_rls_close_remaining_seven`,
> `ws0_rls_drop_user_metadata_fallback`, `ws0_rls_is_staff_fail_closed`.
>
> **Recon found the bigger hole:** seven of these tables had RLS *on* but a permissive
> `Allow all` policy (`USING (true)` for `public`) — so they were wide open too, not just the
> two with RLS off. Every `Allow all` policy is now dropped.
>
> - [x] `clinical_notes` — RLS enabled; **clinician-only** (Director/Therapist; Admin excluded)
> - [x] `form_submissions` — RLS enabled; staff full + client self-read
> - [x] `clients`, `appointments`, `payments`, `client_communications` — `Allow all` dropped; staff full + client self-read
> - [x] `treatment_plans` — `Allow all` dropped; **clinician-only** write + client self-read
> - [x] `client_risk_profiles`, `therapist_availability` — `Allow all` dropped; staff-only
> - [x] Role authority hardened to **`app_metadata.role`** (server-controlled) for the demo
>   accounts; `private.is_staff()` / `private.is_clinician()` are app_metadata-only and
>   fail-closed (`coalesce(..., false)`), so a user can no longer self-escalate via
>   `auth.updateUser({ data: { role } })`.
> - [x] Helpers `private.is_staff()`, `private.is_clinician()`, `private.my_client_ids()`
>   (the last is SECURITY DEFINER, maps client→rows by **email** — there is no
>   `clients.auth_user_id` link column).
> - **Verified:** Director session reads all nine tables; anon (anon key, no session) returns
>   **0 rows** on all nine; forged `user_metadata.role=Director` → `is_staff()=false`.
>
> **Auth model note:** the staff app and client portal share one Supabase Auth session;
> the demo staff/client accounts are real `auth.users` rows. This is a **shared multi-app**
> Supabase project — the `organizations`/`users`/`profiles`/`org_id` tables belong to *other*
> apps; ACS clinical tables have **no `org_id`**, so policies are **role-scoped, not org-scoped**
> (single clinic).
>
> **Still open:**
> - The remaining shared/cross-app tables in the reference list below remain RLS-off — other
>   apps' responsibility, out of ACS scope.
> - `assessment_inputs` / `placement_determinations` **do not exist yet** — enable RLS +
>   scoped policies at creation time (WS1 / WS2).
> - **Client policies are read-only.** When the portal's write flows go live (client submits/
>   updates a form, sends a message), add scoped `insert`/`update` policies on
>   `form_submissions` and `client_communications`. Prefer adding a real
>   `clients.auth_user_id` FK over email-matching at that point.

Surfaced by the Supabase advisory during the May 2026 trial sprint — 66 tables in the
`public` schema have RLS disabled. The high-leverage clinical ones are:
`clinical_notes`, `form_submissions`, `users`, `documents`, `uploaded_files`. With the
Supabase anon key being public-by-design (and committed in `services/supabase.ts`),
anyone with the project URL can read or modify those rows today.

**This is its own scoped sprint, not a tail-end task.** Turning RLS on without first
writing policies blocks all reads and writes, which would crater the app. The proper
fix is per-table policies (scoped by `auth.uid()` / `org_id` / `client_id`) authored
*before* enabling RLS.

**Highest-leverage tables for ACS specifically:** `form_submissions`, `clinical_notes`,
`payments`, `clients`, `appointments`, `users`, `uploaded_files`, `documents`. PHI +
billing — write policies for these first.

**Reference SQL — DO NOT RUN until per-table policies exist:**

```sql
-- A naive ENABLE without CREATE POLICY makes every table return zero rows.
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_diagrams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_visual_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.katie_logic_hub ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.katun_parts_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storyscribe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storyscribe_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storyscribe_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storyscribe_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arivia_error_codes_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpax_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fd_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fd_expense_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_in ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_call_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vision_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_sales_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_conversation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arivia_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meter_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aiva_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flowview_captured_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_work_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mynd_keepers_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dossier_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storyscribe_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pronunciation_lexicon ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pronunciation_review ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storyscribe_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.probe_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_token_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spec_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pudu_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pudu_conditions ENABLE ROW LEVEL SECURITY;
```

**See:** https://supabase.com/docs/guides/database/postgres/row-level-security

---

## 3. Fold the assigned_therapist_id → therapists relationship into a real FK

Marcus's row references therapist UUID `44444444-…` for Karen Ventimiglia, but there's
no `therapists` table and no FK enforcement. `public.users` carries an unrelated
FieldDispatcher-shaped schema (`fd_agent_id` int NOT NULL), so we deliberately did NOT
insert Karen there — risk of breaking unrelated code.

Post-demo, decide:
- (a) introduce a dedicated `public.therapists` table and add a real FK from
  `clients.assigned_therapist_id`, or
- (b) drop the `fd_agent_id` NOT NULL constraint on `users` and consolidate therapists
  into `users` with `role='therapist'`.

The temporary `THERAPIST_NAMES` lookup map in
[components/clients/ClientOverviewTab.tsx](components/clients/ClientOverviewTab.tsx)
is the visible symptom of this gap.

---

## 4. Harden `public.appointments.status` at the DB level

The column default is `'scheduled'::text` (lowercase) and there is no
`CHECK` constraint, so the DB will keep accepting any string and producing
un-normalized casing on default-only inserts. Phase F3 added app-side read
normalization (`APPOINTMENT_STATUS_MAP` + `normalizeAppointmentStatus` in
`services/api.ts`) — that's the correct trial fix because the read side is
in one place, but it leaves the source of truth lax.

Post-trial source-level fix is one of:

```sql
-- Option (a) — CHECK constraint with the canonical capitalized values
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Canceled', 'No Show'));
ALTER TABLE public.appointments
  ALTER COLUMN status SET DEFAULT 'Scheduled';
-- followed by a one-time UPDATE to normalize existing rows.
```

```sql
-- Option (b) — full Postgres ENUM (stronger, slightly more migration cost)
CREATE TYPE appointment_status AS ENUM ('Scheduled', 'In Progress', 'Completed', 'Canceled', 'No Show');
ALTER TABLE public.appointments ALTER COLUMN status TYPE appointment_status USING (initcap(status)::appointment_status);
ALTER TABLE public.appointments ALTER COLUMN status SET DEFAULT 'Scheduled';
```

Either makes the DB the source of truth and lets the app-side normalizer
go away (or stay as defense-in-depth). Do this as part of the broader
schema-hardening pass that lands alongside BLOCKER 2.

---

## 5. Treatment plans live in two tables (dual-store)

Phase F2 introduced `public.treatment_plans` for the new customize/save flow.
The previous storage path — `public.form_submissions` rows with
`form_name = 'Individual Comprehensive Treatment Plan'` — was deliberately
left alone (one fictional row: Margaret Sullivan's). Coexist-at-the-data-
layer was the trial decision; building a UI surface to display one legacy
row wasn't worth the complexity.

**Post-trial revisit:**
- If real treatment plans accumulate in `form_submissions` (i.e. clinicians
  used the form-submissions surface for treatment plans during the trial),
  build a "Legacy plans from intake documents" subsection on the per-client
  Treatment Plan tab that unions the two queries.
- If they don't accumulate, formally deprecate the `form_submissions`
  treatment-plan path: backfill any remaining rows into `treatment_plans`
  (one-time INSERT...SELECT) and update the Forms UI to filter out
  `form_name ILIKE '%treatment plan%'`.

Also deferred from F2 — "save customized plan adds it to the library" was
implemented as reading (ii) only (saved plans = client's plan history).
Reading (i) — promoting a customized plan to a reusable template in the
library — would add a `treatment_plan_templates` table or an `is_template`
flag, plus a Save-as-Template button. Decide post-trial based on usage.

---

## 6. Replace `data/staffDirectory.ts` with a server-side phone→role resolver

Added in Phase D1 (May 2026 trial sprint) as a hardcoded client-side map of trial
phone numbers to roles, so iVALT success can resolve to a known staff member without
a Supabase session. Acceptable for a 3-person trial; **not** acceptable post-trial
because it ships staff phone numbers in the client bundle and has no audit trail.

Replace with either:
- (a) extend the `ivalt-auth` edge function so the `validate` action returns
  `{role, full_name}` from `auth.users.raw_user_meta_data` on success, or
- (b) a Supabase `staff_directory` table with a public-read RLS policy, seeded from
  `auth.users.phone` + `auth.users.raw_user_meta_data`.

Either option also unblocks tying iVALT success to a real Supabase session so the
RLS work from Blocker 2 can take effect on the client-side path.

---

## 7. `appointments.client_id` is `text` while every other `client_id` is `uuid` (data hygiene)

Found during WS0 (2026-06-05). `public.appointments.client_id` is **`text`**, but the
matching column on `clinical_notes`, `form_submissions`, `payments`,
`client_communications`, `treatment_plans`, `client_risk_profiles` (and `clients.id`) is
**`uuid`**. Consequences:
- The RLS client self-read policy on `appointments` had to special-case the type
  (`client_id IN (SELECT cid::text FROM private.my_client_ids() AS t(cid))`) instead of the
  clean `client_id IN (SELECT private.my_client_ids())` used everywhere else.
- There is **no FK** from `appointments.client_id` → `clients.id`, so orphaned/garbage
  values are possible and joins are unprotected.

Post-trial: normalize to `uuid` and add the FK, then simplify the policy.

```sql
-- 1) confirm every value is uuid-shaped (expect 0)
select count(*) from public.appointments
where client_id is not null and client_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 2) convert + enforce
alter table public.appointments
  alter column client_id type uuid using nullif(client_id, '')::uuid;
alter table public.appointments
  add constraint appointments_client_id_fkey
  foreign key (client_id) references public.clients(id);
```
Then drop the text cast in `client_self_read_appointments` so it matches the other tables.

---

## 8. Legacy clients show negative derived balances (WS-Billing data artifact)

Found during WS-Billing (2026-06-05). `clients.balance` now **derives** from the ledger
(`public.client_balance()` = charges − succeeded payments, trigger-maintained). Clients who
predate the ledger have recorded **payments but no `charges`**, so their derived balance is
**negative** (e.g. a $300 legacy payment with no matching charge → −$300).

This is the **honest** derived value, **not** "overpaid" — those clients simply have no
historical charges captured. The active demo clients (Jordan/Marcus/Pat) were seeded with
matching charges in migration `20260605_wsbilling_3_demo_charges_seed.sql`, so they read correctly
($0 / +$499 / $0); the negatives are confined to archived/legacy rows.

Do **not** treat this as a bug or hand-fix `clients.balance` — it derives, never hand-set.
Follow-ups:
- **Display layer (do this):** clamp/hide negative balances for **non-active** clients (show
  `$0.00` or `—` rather than a negative), so a raw `clients.balance` never reads as "overpaid".
- **Optional data backfill:** if historical charges matter, seed `charges` reconstructing what
  each legacy payment was for; the trigger recomputes balances. Out of scope for WS-Billing.

---

## 9. Non-SATOP program intakes have NULL `form_submissions.form_id` (WS5 — permanent "pending" in their own portals)

Found during WS5 (2026-06-06). The `form_id` uuid→text migration (`20260606_ws5_2_form_id_text`)
backfilled existing rows from `form_name` via a reviewed CASE, fail-closed. Two rows did **not**
map to a SATOP registry id and were deliberately left **NULL**:
- `Opioid Recovery Intake` (OPIOID_RECOVERY program)
- `Gambling Recovery Intake` (GAMBLING_RECOVERY program)

WS5's `FORM_REGISTRY` is the **SATOP** set; there are no `opioid-intake` / `gambling-intake`
entries (defining half-built registry entries for programs WS5 doesn't cover is scope creep).

**Consequence:** because `PortalDocuments` keys completion off `form_id`, these two non-SATOP
clients will see their intake as **permanent "pending"** in their own portals until those programs
get registry entries. **Harmless to the SATOP completion gate** (non-SATOP clients never reach it).

Post-WS5: when the Opioid/Gambling programs get first-class form sets, add their intake registry
ids and backfill (`update public.form_submissions set form_id='opioid-intake' where form_name='Opioid Recovery Intake'`, etc.).
