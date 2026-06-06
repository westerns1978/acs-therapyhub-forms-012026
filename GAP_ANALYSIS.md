# ACS TherapyHub — Honest Gap Analysis

**Recon date:** 2026-06-02
**Scope:** Read-only audit. Measures the *current code* against the bar of a real, multi-tenant SaaS that could justify **$600/month** to a regulated mental-health / substance-use provider holding **real client PHI under 42 CFR Part 2 / HIPAA**.
**Method:** Source inspection with file:line citations, cross-checked against the **live** Supabase project (`ldzzlndsspkyohvzfiiu` = "westflow-platform") via read-only metadata/SQL queries.
**Rule applied:** A capability is only "REAL" if it is wired to a backend doing the work. UI that merely renders, returns hardcoded literals, or no-ops is called out as such.

> The repo's `technical_specification_v2.md` and `README.md` are treated as **unverified claims**, not truth. The internal `SECURITY_BACKLOG.md` is treated as candid internal notes and was independently verified against code and the live DB.

---

## 1. Honest Summary

**This is a single-tenant interactive demo, not a product.** It is a long way — call it a from-scratch rebuild of the entire trust layer — from anything that could responsibly hold real PHI for a paying customer. The application shell is genuinely impressive and a meaningful slice of it is wired to a real backend: clients, appointments, forms, treatment plans, and document uploads do persist to Supabase, and several AI features make real Gemini calls (document/OCR extraction, ASAM summary, SOAP drafting, a Gemini-Live voice assistant). But the three things that make a PHI SaaS *a SaaS* are absent or fake: **(1) Authentication** is a `sessionStorage` stub — the counselor "real" login resolves a hardcoded phone→role map and the client portal accepts *any* email/password; no Supabase Auth session is ever created, so the app always talks to the database as the anonymous Postgres role. **(2) Data isolation** does not exist — the Supabase anon key is committed in source and shipped in the browser bundle, and every ACS table is reachable with it (the "RLS-enabled" tables carry permissive `USING (true)` policies; the highest-value PHI tables `form_submissions`, `clinical_notes`, and `users` have RLS *off* entirely). **(3) Multi-tenancy** was never designed — the core `clients` table has no `org_id`, no query is tenant-scoped, and a single hardcoded org UUID is sprinkled through the code. On top of that, the Gemini API key is baked into the client bundle (and an older key is recoverable from git history), uploaded PHI documents are written to **public** Storage URLs, **no audit logging is ever written** despite a HIPAA claim, and there is no consent/retention/export-delete capability. Billing for the $600/mo subscription doesn't exist (the only Stripe path is a **test-mode** client-copay checkout). Several headline features are demo-shaped: the "atomic" session wrap-up's billing and task writes are empty no-ops and it never even saves the note; risk scoring and scheduling have hardcoded outputs. **Bottom line: the gap to the stated bar is large and structural — primarily an auth + tenancy + compliance rebuild — not a feature-polish exercise. Nothing real-PHI should touch this database until Blockers in group (B) are closed.**

---

## 2. Spec Reconciliation (`technical_specification_v2.md` → reality)

| Spec claim / artifact | Verdict | Evidence |
|---|---|---|
| `storageService.extractDocumentDNA` → real Gemini call on upload | **REAL** | `services/storageService.ts:18-45` — real `geminiGenerate('gemini-2.5-flash-lite', …)` with JSON schema (title/summary/tags/isSigned). |
| `uploaded_files.extracted_dna` JSONB column | **PARTIAL / MISNAMED** | Client writes DNA into `extracted_summary` + a `metadata` JSONB blob, not a column named `extracted_dna` (`storageService.ts:70-89`). Column exists in DB only as `metadata`/`extracted_summary`. |
| `generateAsamAnalysis` uses **Gemini 3 Pro, 32k thinking budget** | **REAL call, FALSE model claim** | `services/api.ts:585-599` uses **`gemini-2.5-flash`**, no thinking-budget config. Docstring `api.ts:583` ("Gemini 3 Pro with Max Thinking Budget") is contradicted by the code. |
| `callMcpOrchestrator` + Supabase Edge "MCP host" exists and runs | **REAL (but unauthenticated)** | `api.ts:140-157` → `MCP_ORCHESTRATOR_URL` (`api.ts:31`). Live: edge function `mcp-orchestrator` is **ACTIVE**, **`verify_jwt:false`**. Invoked from `components/ai/SynapseChatPopover.tsx:180,248`. Orchestrator source is not in this repo. |
| `generateSoapNoteFromTranscript` + live transcript/SOAP in `ActiveSession.tsx` | **PARTIAL** | Transcript = browser **Web Speech API** (`ActiveSession.tsx:38-58`), *not* Gemini Live as spec says. SOAP gen is REAL `gemini-2.5-flash` (`api.ts:604-607`). A "Simulate Conversation" button injects canned text (`ActiveSession.tsx:126-129`). |
| note → billing (CPT-90834) → tasks as a **single atomic transaction** | **MOCKED / FALSE** | `components/sessions/SessionWrapUpModal.tsx` is a 4-step wizard, not a transaction. Billing write `addSessionRecord` is an **empty no-op** (`api.ts:556`); task write `addClientAssignment` is an **empty no-op** (`api.ts:511`); the note is **never saved** here (no `saveClinicalNote` call); CPT "90834 / $150" is static text (`SessionWrapUpModal.tsx:104-112`). Only `addAppointment` is real. |
| `iValtService.startAuthentication` / `pollStatus` biometric flow | **PARTIAL (real edge fn, stub session)** | `services/iValtService.ts:19-108` (named `initiateHandshake`/`startPolling`) calls the **ACTIVE** `ivalt-auth` edge function; tables `ivalt_auth_requests` / `ivalt_auth_audit` exist. But on success the client just writes `sessionStorage` (`pages/Login.tsx:52-71`) — no Supabase session is created. |
| Tables that "must exist": `clients`, `uploaded_files`, `form_submissions`, `session_records`, `audit_logs` | **4 of 5 exist; `session_records` ABSENT** | Live `list_tables`: `clients`, `uploaded_files`, `form_submissions`, `audit_logs` exist (all **0 rows**). **No `session_records` table** in the schema; the app uses mock `dbSessionRecords` + `clinical_notes`. |
| PDS-Vault (GCS/S3 secure binary storage) | **PARTIAL (Supabase Storage, not secure)** | Real Supabase Storage bucket `gemynd-files` (`storageService.ts:4,56-58`), but stored via **`getPublicUrl`** (`:63`) with public RLS — world-readable, not a secure vault. |
| "Neural Sync" / MCP / Veo milestone video / Driverless Scheduling | **MOCKED / ENV-BOUND** | Milestone video depends on `window.aistudio` (`api.ts:657-685`) — crashes outside AI Studio, appends API key to a URL. Scheduling "Dispatcher" returns canned results (`services/schedulingService.ts:34-69`). |
| **Multi-tenancy (organizations / tenant isolation / per-tenant config)** | **NEVER DESIGNED** | The spec defines no tenancy model at all. Code confirms: `clients` has no `org_id`; one hardcoded `DEFAULT_ORG_ID` (`api.ts:30`, `storageService.ts:5`). See Pillar 1. |

---

## 3. Security & Compliance Claim Grading (spec §7 + README)

| Claim | Grade | Evidence / Note |
|---|---|---|
| "AES-256 for all binary storage" | **FALSE — HIGH-RISK** | No encryption config in repo; relies on Supabase defaults. Worse, documents are written to **public URLs** (`storageService.ts:63`) and `uploaded_files` carries **public read/insert/update/delete** RLS policies (verified in `pg_policies`). Binaries are effectively world-readable regardless of at-rest encryption. **Must not be told to a customer.** |
| "audit_logs … HIPAA event tracking" implemented | **FALSE — HIGH-RISK** | `audit_logs` table exists but is **never written** by the app. `getAuditLogs` returns mock `dbAuditLogs` (`api.ts:552`); no `insert` into `audit_logs` exists anywhere in the client. No who-viewed/changed-what trail. |
| "Every AI summary watermarked 'Grounded in PDS records'" | **FALSE — HIGH-RISK** | Zero occurrences of the watermark string in the entire codebase. Not implemented. |
| README: "HIPAA Compliance … data encryption … Audit trails are logged to ensure accountability … secure, role-based access" (`README.md:91`) | **FALSE — HIGH-RISK** | No audit trails written; no app-level encryption; role gating is client-side only (`RequireRole`) while the data layer is fully open via the anon key. **Customer-facing doc contains false compliance assertions — must be corrected before any sales conversation.** |
| README: "Mock implementation of P3ID … simulated AuthentiCapture / ScanBot" (`README.md:12,27`) | **TRUE (honest)** | Correctly labeled as mock/simulated. `saveClientSignature` returns `{success:true}` without storing anything (`api.ts:554`). |
| "Session Latency: 8-minute max biometric uplink" | **UNVERIFIABLE** | iVALT polling has no 8-minute cap in `iValtService.ts`; enforcement (if any) is server-side in the `ivalt-auth` function, which is not in this repo. |
| Supabase anon key is safe to ship | **FALSE — HIGH-RISK** | Anon key hardcoded in `services/supabase.ts:4` and `iValtService.ts:17`, shipped in the browser bundle. Combined with permissive RLS, it grants full read/write to ACS tables. |
| Leaked Gemini key only a historical concern | **FALSE — HIGH-RISK** | Old key `AIzaSyBLU362…` is recoverable from git history (commit `e913ed8`; removed in `9e92288`). **Additionally**, the *current* key `AIzaSyApFD…` (`.env`) is inlined into the shipped bundle (`gemini.ts:10,24`; confirmed present in `dist/assets/index-*.js`). The backlog's claim that "Phase E2 proxy migration closes the exposure" is **not true in the committed client** — `pds-gemini-proxy` is deployed but never called. |

---

## 4. Six-Pillar Assessment

| Pillar | Current state (with proof) | Gap to the bar | Effort | Blocks |
|---|---|---|---|---|
| **0 — Spec accuracy** | Spec & README assert capabilities (Gemini 3 Pro, AES-256, audit logging, watermark, atomic transaction, PDS-Vault) that are mocked, misnamed, or absent. See §2/§3. | Stop repeating false claims; align docs to reality before any customer sees them. | **S** (docs) | (A) paid launch |
| **1 — Multi-tenancy** | `organizations` table exists; `users`/`uploaded_files` have `org_id`, but **`clients` has none** (verified). No query is tenant-scoped — `getClients` = `select *` (`api.ts:163`), same for appointments/forms (`api.ts:293,380`). `fetchVault` filters only by a hardcoded `DEFAULT_ORG_ID` (`storageService.ts:100`). Permissive `USING(true)` RLS means no isolation even if filters existed. | Introduce a real tenant model on every clinical entity; scope all reads/writes by tenant; enforce in RLS. Two practices' data would intermix today. | **L** | (C) scale |
| **2 — Users & Auth** | `contexts/AuthContext.tsx` = pure `sessionStorage`. Counselor "real" login → iVALT modal → hardcoded `staffDirectory` map (`data/staffDirectory.ts:23-42`) → `sessionStorage`; a "demo access" button bypasses iVALT entirely (`Login.tsx:73-82`). Portal login accepts **any** email/password → hardcoded client (`ClientLogin.tsx:33-47`); `usePortalClient` trusts `sessionStorage` (`hooks/usePortalClient.ts:9`). No Supabase Auth, no passwords, no provisioning/invite/deactivate, no MFA enforcement at the data layer; roles hardcoded. | Replace with real Supabase Auth (or equivalent): provisioning, password/MFA, per-tenant roles, sessions that drive RLS. | **L** | (A) launch, (B) PHI |
| **3 — Persistent document storage** | REAL Supabase Storage upload to bucket `gemynd-files` (`storageService.ts:56-58`), metadata row in `uploaded_files`. But `getPublicUrl` (`:63`) yields **public** links; RLS policies allow **public read/insert/update/delete** (verified); `uploaded_by` hardcoded `'dan-executive'`, `org_id` hardcoded. Anon **delete** policy = anyone can delete files. | Private buckets + signed URLs scoped to authenticated tenant/user; retention & deletion policy; remove public/anon-delete policies. | **M–L** | (B) PHI |
| **4 — Real Gemini evaluation of content** | REAL across the board: `documentExtraction.ts` (`gemini-2.5-flash-lite`, PDF/image/docx/xlsx), `ocrService.ts` (handwriting OCR w/ per-field confidence), `api.ts` ASAM/SOAP/relapse (`gemini-2.5-flash`), `deepReasoningService.ts`, and Clara **Gemini Live** voice (`SynapseChatPopover.tsx:216-251`). Key supplied via `VITE_API_KEY` **client-side** (`gemini.ts:10,24`), shared across Gemynd apps. | Move all Gemini calls server-side (the deployed `pds-gemini-proxy` is unused); per-tenant key/quota; current model (not spec's Gemini 3 Pro). **Safety:** AI outputs (`isSigned`, `documentType`, `complianceStatus`, ASAM level, OCR fields) are written into records; human review is a *convention* (`requires_review` flag `api.ts:471` + `approveFormSubmission` `api.ts:481`), not a DB-enforced gate. No AI value auto-drives billing only because the billing write is a no-op. | **M** | (B) PHI |
| **5 — Compliance / PHI-readiness** | **RLS:** live advisory = **69 tables RLS-disabled** in the shared `public` schema; ACS PHI tables `form_submissions`, `clinical_notes`, `users`, `documents` are **off**; `clients`/`appointments`/`payments`/`uploaded_files`/`treatment_plans`/`audit_logs` are **on but with permissive `USING(true)` public policies** (verified in `pg_policies`) → equivalent to open. Anon key is public + bundled. **No audit logging written.** No app encryption beyond defaults; binaries public. No consent tracking, retention, or export/delete (42 CFR Part 2). Leaked key in git history; current key bundled. | This is the hard gate. Real RLS scoped to `auth.uid()`/tenant on every table; written audit log; private storage; consent/retention/export-delete; key rotation + server-side key; Google BAA + PHI hosting posture. | **L** | (B) PHI (gate) |
| **6 — Paid-customer operational readiness** | **Billing:** only path is client copay via `acs-create-checkout` (`PortalBilling.tsx:56`) in explicit **TEST MODE** (`:108`); `getPayments` is mock (`api.ts:309`). **No SaaS subscription billing** for the $600/mo. No per-tenant config. No error monitoring (console + `ErrorBoundary` only). Backups = Supabase defaults. **Tailwind via CDN in production** (`index.html:23`); wide-open CSP (`index.html:6`). Shared single Supabase project + single Gemini key/GCP project across ~15 apps (verified: story-cascade, wissums, dossier, passare, familysearch, photo-restore, etc. in the same project). | Real subscription billing; per-tenant config; monitoring/alerting; verified backups/DR; production CSS build; isolate ACS from the shared project/key (blast-radius). | **M–L** | (A) launch, (C) scale |

---

## 5. "Demo-Shaped, Not Real" — looks present but isn't wired

- **Appointment status** — the wizard always writes `status:'Scheduled'` (`SessionWrapUpModal.tsx:67`); read-side normalization exists (`api.ts:223-238`) but no reachable control sets other statuses on write; DB has no CHECK constraint (per backlog §4).
- **Session wrap-up "atomic" finalize** — billing (`addSessionRecord` `api.ts:556`) and tasks (`addClientAssignment` `api.ts:511`) are **empty no-ops**; the SOAP note is **never persisted** from this flow; "Apply Digital Signature" just flips local state; only the next appointment is actually saved.
- **Live-session SOAP note** — generated (real) but not saved (Smart Note Studio's `saveClinicalNote` at `SmartNoteImporter.tsx:48` *does* persist; the `ActiveSession` path does not).
- **Signatures** — `saveClientSignature` returns `{success:true}` and stores nothing (`api.ts:554`).
- **Practice dashboards** — `getPayments`, `getPracticeMetrics`, `getRevenueData`, `getComplianceTrendData`, `getDailyBriefingData` return **hardcoded** values (`api.ts:309-310,559,562-576`). *(The Financials page no longer uses these — it reads the real ledger via `acs_report_*`; these mocks now back only the Dashboard's headline figures.)*
- **Predictive risk** — `riskModelingService.getClientRiskProfile`/`getCohortSummary` return a hardcoded "John Doe" / fixed counts with no Gemini call (`riskModelingService.ts:29-55`). (Note: `generateRelapseRiskPrediction` used in `ClientWorkspace.tsx:59` *is* a real call — two parallel implementations, one real, one mock.)
- **Driverless scheduling / Dispatcher** — `createDispatcher().handleRequest` returns "Appointment rescheduled." unconditionally; `processSchedulingRequest` returns canned slots (`schedulingService.ts:34-69`). Per-client Scheduling tab hidden in trial for this reason (`config/trialMode.ts:21`).
- **Travel risk** — `analyzeTravelRisk` returns hardcoded `{risk:'Low'}` (`api.ts:831`).
- **Misc AI stubs** — `getComplianceAnalysis` → `"Analysis"`, `generateFormSuggestions` → `"Suggestion"`, `getWestFlowExecutiveSummary` → `"Executive summary data"` (`api.ts:557-560`).
- **Document Intelligence** — real extraction code (`documentExtraction.ts`, `deepReasoningService.ts`) but the whole tab is **hidden** because it black-screens (`config/trialMode.ts:3-12`).
- **Audit log UI** — reads mock data (`api.ts:552`); nothing is ever logged.
- **Milestone video** — `generateMilestoneCelebration` requires `window.aistudio` (`api.ts:657-685`); breaks outside AI Studio.
- **Reporting (Analytics) page** — hidden via `TRIAL_HIDDEN_ROUTES` (`trialMode.ts`). **Financials is now live** — rebuilt on the real charges/payments ledger via the `acs_report_*` RPCs and un-hidden for Director/Admin (`pages/Financials.tsx`, `supabase/migrations/20260605_reports_1_director_report_functions.sql`).

---

## 6. Ranked Blockers

### (A) Blocks paid launch
1. **No real authentication** — `sessionStorage` stub for both counselor and portal; demo bypass; portal accepts any password (`AuthContext.tsx`, `Login.tsx`, `ClientLogin.tsx:33-47`). *(Also a PHI blocker.)*
2. **No SaaS subscription billing** for the $600/mo — only a test-mode client-copay checkout exists (`PortalBilling.tsx:56,108`).
3. **False compliance claims in customer-facing docs** — README "audit trails are logged / data encryption / secure role-based access" (`README.md:91`) and spec §7 must be corrected before selling.
4. **Production hygiene** — Tailwind CDN in prod (`index.html:23`), wide-open CSP (`index.html:6`), no error monitoring.

### (B) Blocks real-data (PHI) use — *the hard gate; nothing PHI until these close*
1. **Anon key + permissive/absent RLS = total data exposure** — key committed (`supabase.ts:4`) and bundled; `USING(true)` policies on "protected" tables, RLS off on `form_submissions`/`clinical_notes`/`users`/`documents`. Anyone with the key reads/writes all PHI.
2. **Public document storage** — PHI files at public URLs with public read **and delete** policies (`storageService.ts:63`).
3. **No audit logging** (HIPAA) — table exists, never written (`api.ts:552`).
4. **Client-side Gemini key sending PHI to Gemini from the browser** — bundled current key + leaked historical key (`gemini.ts`, git `e913ed8`); shared across apps; no BAA-aligned server proxy in use.
5. **Portal horizontal access (IDOR-class)** — `client_id` is client-supplied and unenforced under permissive RLS (`PortalBilling.tsx:33`, `usePortalClient.ts`).
6. **No consent / retention / export-delete** (42 CFR Part 2).
7. **AI judgments without an enforced human-confirmation gate** — `isSigned`/`complianceStatus`/OCR fields persist with only a UI-convention review flag.

### (C) Blocks scale beyond one tenant
1. **No tenant model on core entities** — `clients` has no `org_id`; no query is tenant-scoped; hardcoded `DEFAULT_ORG_ID` (`api.ts:30`).
2. **Shared blast radius** — one Supabase project + one `public` schema shared with ~15 other apps; one Gemini key / GCP project across all Gemynd apps.
3. **Hardcoded rosters in the client bundle** — `staffDirectory.ts`, demo clients in `ClientLogin.tsx`.

---

*End of analysis. This document is recon only — no remediation has been started.*
