# Security Backlog

Post-demo (David Yoder, Tuesday 2026-05-19 1pm CT) items that we deliberately deferred
to keep scope tight. Capture only — these are NOT changes for this sprint.

---

## 1. Enable RLS on 60 tables currently open to the anon key

**Severity:** Critical. With RLS disabled, every table below is fully exposed to the
`anon` and `authenticated` roles — anyone with the Supabase publishable key can read or
modify every row. Surfaced by the Supabase advisory check during the May 2026 demo prep.

**Why we did not fix tonight:** Turning RLS on without first writing policies blocks all
reads and writes, which would crater the demo. The proper fix is per-table policies
(scoped by `auth.uid()` / `org_id` / `client_id`) before enabling RLS — that work didn't
fit before Tuesday 1pm.

**Before running this, write policies for each table.** A naive `ENABLE ROW LEVEL SECURITY`
without `CREATE POLICY` will make every table return zero rows.

```sql
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
```

**Highest-leverage tables for ACS specifically:** `form_submissions`, `clinical_notes`,
`payments`, `clients`, `appointments`, `users`. Those carry PHI and billing data, so
get policies in place there first.

**See:** https://supabase.com/docs/guides/database/postgres/row-level-security

---

## 2. Fold the assigned_therapist_id → therapists relationship into a real FK

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
