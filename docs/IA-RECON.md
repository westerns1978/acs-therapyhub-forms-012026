# IA RECON — 2026-08-07

Read-only recon for David's Aug-7 call: navigation restructure + closing the intake
loop. **No code changes, no migrations, no deploys in this document's scope** (D6's
tab-icon fix was already shipped in a prior commit before this recon started — noted
where relevant, not claimed as new work here).

Sources: current `main` working tree, live Supabase `ldzzlndsspkyohvzfiiu` (read-only
spot-checks), git history. Facts only, cited by `file:line`. Where a prior memory note
is contradicted by current code/data, that's called out explicitly rather than silently
overwritten.

Reference points for calibration, per David's call:
- **DrChrono**: six flat top-level items (Schedule / Clinical / Patients / Reports /
  Billing / Account), no group headers.
- **TherapyNotes**: progress-note interventions link directly to treatment-plan
  objectives, documented per objective per session.

---

## D1 — Route inventory

All routes are defined in `App.tsx` (project root). Nav sources: `components/ui/
NavigationSidebar.tsx` (desktop) and `components/ui/MobileDrawer.tsx` (mobile) — kept
in lockstep, treated as one "sidebar nav" below. Portal nav is `PortalHeader` in
`layouts/PortalLayout.tsx`. `TRIAL_MODE`/`TRIAL_HIDDEN_ROUTES` live in
`config/trialMode.ts`.

### Public / auth / system

| Path | Component | Nav entry point | TRIAL_MODE hidden |
|---|---|---|---|
| `/login` | `Login` | Not in sidebar — reached via `WebsitePortalBridge`'s staff door, and Sign Out | No |
| `/oauth/callback` | `OAuthCallback` | Unreachable from nav — OAuth redirect target only | No |
| `/portal/login` | `ClientLogin` | Not in sidebar — reached via `WebsitePortalBridge`'s client door | No |
| `/website` | `WebsitePortalBridge` | Unreachable from nav — linked from `PublicIntake.tsx` | No |
| `/intake` | `PublicIntake` | Unreachable from nav — button on `WebsitePortalBridge` | No |
| `/visitor-resources` | `PortalLayout > Resources` | Unreachable from nav — link on `portal/ClientLogin.tsx` | No |
| `/help`, `/help/:slug` | `HelpLayout > HelpHome`/`HelpPage` | Sidebar **Help & Training** | No |
| `/` | `WebsitePortalBridge` | Default landing route | No |

**Flag:** `/` and `/website` both render `WebsitePortalBridge` with no distinguishing
prop found in the router — possibly a true duplicate rather than two IA nodes; worth
a second look before any nav redesign relies on them being distinct.

### Staff app

| Path | Component | Nav entry point | TRIAL_MODE hidden |
|---|---|---|---|
| `/dashboard` | `Dashboard` | Sidebar **Dashboard** | No |
| `/clients`, `/clients/:clientId` | `ClientWorkspace` | Sidebar **Clients** | No |
| `/communication-center` | `CommunicationCenter` | Sidebar **Messages** | **Yes** |
| `/session-management` | `SessionManagement` | Sidebar **Calendar** | No |
| `/session/:clientId` (ActiveSession) | `ActiveSession` | **Unreachable from sidebar** — button-only (`ClientProfileHeader`, `SessionManagement`) | **Yes** |
| `/session/:appointmentId/green-room` | `GreenRoom` | **Unreachable from sidebar** — Dashboard "Today's Schedule" row only | No — explicitly excluded, stays live |
| `/forms` | `Forms` | Sidebar **Forms** | No |
| `/fee-ledger/:clientId` | `FeeLedgerRedirect` → redirect | **Unreachable** — dead legacy bookmark shim | No |
| `/video-sessions` | `VideoSessions` | **Unreachable from nav** — zero in-app links found | **Yes** |
| `/program-compliance/:clientId` | `ProgressTracking` | **Unreachable from sidebar** — button on `ClientList.tsx` only | **Yes** |
| `/compliance-assistant` | `ComplianceAssistant` | **Unreachable from nav** — zero in-app links found | No |
| `/assessments/:clientId` | `AsamAssessment` | **Unreachable from nav** — distinct from the in-workspace "Assessment" tab component | No |
| `/compliance` | `Compliance` | **Unreachable from nav** (a stale internal doc claims "mobile-drawer only" — current `MobileDrawer.tsx` doesn't list it either) | **Yes** |
| `/program-plan/:clientId` | `ProgramPlan` (`TreatmentPlan.tsx`) | **Unreachable from nav** — distinct from the in-workspace "Treatment Plan" tab | No |
| `/treatment-plan-library` | `TreatmentPlanLibrary` | Sidebar, Oversight: **Treatment Plan Library** | No |
| `/risk-monitor` | `RiskMonitor` | Sidebar, Oversight: **Alerts** | No |
| `/financials` | `Financials` | Sidebar, Oversight: **Financials** | No (explicitly un-hidden for day-30 review) |
| `/document-intelligence` | `DocumentIntelligence` | Sidebar item present | **Yes** |
| `/reporting` | `Reporting` | Sidebar, Oversight: **Analytics** | **Yes** |
| `/compliance-readiness` | `ComplianceReadiness` | Sidebar, Oversight: **Compliance Readiness** | No |
| `/settings` | `Settings` | Sidebar, Administration: **Settings** | No |

### Client portal

Portal nav = 5 links: Dashboard, My Forms, Appointments, Fees, My Progress.

| Path | Component | Portal nav entry point | TRIAL_MODE hidden |
|---|---|---|---|
| `/portal` | redirect → `/portal/dashboard` | n/a | No |
| `/portal/dashboard` | `PortalDashboard` | **Dashboard** | No |
| `/portal/documents` | `PortalDocuments` | **My Forms** | No |
| `/portal/billing` | `PortalBilling` | **Fees** | No |
| `/portal/compliance` | `PortalCompliance` | **My Progress** | No |
| `/portal/appointments` | `PortalAppointments` | **Appointments** | No |
| `/portal/forms/:formId` | `PortalFormPage` | Unreachable from portal nav — button from `PortalDocuments` | No |
| `/portal/recovery-plan` | `RecoveryPlanForm` | Unreachable from portal nav — a `PortalDashboard` action card; the real form is `/portal/forms/recovery-plan`, reached normally | **Yes** |

### Orphaned-from-nav set (confirmed real, button/URL-only)

`/session/:clientId`, Green Room, `/program-compliance/:clientId`, `/video-sessions`,
`/compliance-assistant`, `/assessments/:clientId`, `/program-plan/:clientId`,
`/compliance`, `/fee-ledger/:clientId`, `/portal/forms/:formId`,
`/portal/recovery-plan`, `/website`, `/intake`, `/visitor-resources`.

**Not fully resolved:** dynamically-constructed paths (built at runtime from a config
object) wouldn't show up in a plain-text grep — worth a second pass if exhaustive
reachability matters for the redesign. `/oauth/callback` as the sole OAuth entry point
was inferred from naming, not traced against the exact redirect_uri config.

---

## D2 — Alerts vs Compliance Readiness

**Alerts** (`/risk-monitor`, `pages/RiskMonitor.tsx`, title "Alerts") — `services/
alertsService.ts:213` `fetchAlerts()` runs a **heuristic** function over `clients` +
accrual/determination state: missed sessions, court deadline ≤14 days, a 90-day
plan-review heuristic, missing documents. Has real write actions (log outreach,
create task). Role: Director + Therapist.

**Compliance Readiness** (`/compliance-readiness`, `pages/ComplianceReadiness.tsx`) —
`services/complianceEngine.ts:576` `fetchComplianceReadiness()` runs the **deterministic
Missouri compliance-pack engine** (`compliance/missouri-compliance-pack.json`) against
`clients` + `client_accrued_hours` + `placement_determinations` + `form_submissions` +
`treatment_plans`. Verdicts carry a 9 CSR citation. Read-only, advisory. Role:
**Director only.**

**Overlap:** real but partial. Alerts' `CSR_PLAN_REVIEW_DUE` heuristic re-implements
what the engine's `MO-OP-TXPLAN-REVIEW-90D` rule already computes with a citation —
that's genuine duplication, worth a de-dup. Everything else is complementary, not
redundant: Alerts covers attendance/scheduling/document-collection facts the
compliance engine doesn't model; Compliance Readiness covers regulatory verdicts
(including its `not_enforceable` roadmap section) that Alerts doesn't compute.

**Recommendation: do not merge.** Different audiences by design (Director-only
regulatory/audit view vs. Director+Therapist operational triage queue), different
urgency semantics (actionable work queue vs. read-only advisory with an explicit "Clara
never decides compliance" disclaimer), different data lifecycles (mutable heuristic
thresholds vs. a versioned, citation-backed rules pack). Merging would either
over-expose regulatory verdicts to Therapists or strip Directors of the operational
actions. The one real fix is smaller: point the duplicated plan-review heuristic at the
engine's own rule instead of re-deriving it.

---

## D3 — Forms vs Treatment Plan Library

**Forms** (`/forms`, `pages/Forms.tsx`) is a catalog with three distinct per-card
actions, not one blended action: **Start** (fill the form now, mounts
`BaseFormTemplate`), **Assign** (push to a client), and a conditional **Copy PDF
link**. The primary action is Start — fill-it-yourself.

**Treatment Plan Library** (`/treatment-plan-library`, `pages/
TreatmentPlanLibrary.tsx`) is browse-only with **one** action per card: "Use This
Template," which dispatches an event picked up by `CustomizeTreatmentPlanModal` in
apply-template mode — a clinician then edits problems/goals/interventions in that
modal and saves a real row to `treatment_plans`. There is no fill-in-place step and no
submission record the way `form_submissions` works for Forms.

**Cost of folding templates into Forms as a second section:** real, not cosmetic.
`FormDefinition<T>` requires `initialState`/`steps`/`validateStep`/`fieldDefinitions` —
a fillable-form schema `BaseFormTemplate` knows how to render.
`TreatmentPlanTemplate` has none of that; it's a nested problems/goals/interventions
tree with no field schema at all. `FormLibrary`'s card grid assumes every entry
resolves through `FORM_REGISTRY_BY_ID` to a `pdfSlug`/cert-gate signal — treatment
plan templates don't participate in that at all (a `treatment-plan` registry entry
exists but is explicitly documented as unable to render a card there today). Making
"Start" work for a template means faking a `FormDefinition` for something that isn't a
form, or forking the card component's primary action. On top of that, the separation
is role-gated on purpose: `/forms` is all-roles, `/treatment-plan-library` is
Director/Therapist-only, with data in a wholly separate table and RLS.

**Objection, as requested:** don't fold these into one nav item. "Start" would mean two
different things on two card types — fill-a-form vs. open-a-plan-editor — which is
exactly the kind of ambiguity CLAUDE.md already flags as a hazard for this app's
non-technical audience (an internal id or an overloaded verb reads as one thing and
does another). The cheaper, safer move if the goal is just "one less label to learn" is
visually grouping/relabeling `/treatment-plan-library` near Forms in the sidebar
without merging the underlying surfaces, actions, or role gates.

---

## D4 — Financials: live vs. mock

Three surfaces, not one:

1. **`pages/Financials.tsx` — fully live.** Every number is RPC-backed: `acs_report_
   money`, `acs_report_payments_by_method`, `acs_report_outstanding_by_client`
   (`supabase/migrations/20260605_reports_1_director_report_functions.sql`), gated to
   Director/Admin (`is_financial_staff()`). No hardcoded numbers found.
   **Live spot-check today** (verified independently — `select sum(amount) from
   payments` = $290, matching the RPC breakdown): revenue $40, supplemental
   remittance $0, **unallocated $250**, total collected $290; 0 clients currently
   carry an outstanding balance.
   **Correction to a prior memory note:** an earlier note recorded "$1,350 unallocated
   ($900 real) pending day-30 reconciliation." That figure is stale against current
   live data — today's real unallocated total is **$250**, not $1,350. Worth updating
   that memory.
2. **`pages/Reporting.tsx` — an honest placeholder, not mock.** The prior version
   (hardcoded $12,500 SATOP revenue, an 88→98% compliance trend) was deleted
   2026-07-28. The page now shows a plain "not yet wired to live data" notice — no
   numbers at all, live or fake.
3. **`BillingLedger.tsx`** (the client-level "Fees" tab) — fully live, reads
   `clients.balance`/`charges`/`payments` directly per client.

**Mock fee-ledger retirement, confirmed:** commit `96144c7` deleted the old
`pages/Billing.tsx` (`FeeLedger`, whose Record Payment wrote nothing to the ledger);
`/fee-ledger/:clientId` became the dead redirect shim in D1's table. `Financials.tsx`
was rebuilt on the real RPCs in a later commit. One harmless remnant: `services/
api.ts` still exports a `getPayments()` reading the old mock dataset, but has zero
callers anywhere in the app — dead code, not wired to anything live.

---

## D5 — Treatment plan as spine (most important item)

### Schema

`public.treatment_plans` is the **only** treatment-plan table (`supabase/migrations/
20260522_treatment_plans.sql`, extended by `20260728_l5_treatment_plan_updates.sql`).
Columns: `id`, `client_id` (FK → clients), `template_id` (**text, not a FK**), `title`,
`category`, `estimated_duration`, `content` (**jsonb**, the entire problems/goals/
interventions tree), `status` ('Active'|'Completed'|'Archived'), `created_by`,
`notes`, `created_at`/`updated_at`, `supersedes_plan_id` (self-referential FK, L5),
`update_date`, `progress_comments`, `created_by_name`, `clinician_signature`,
`client_signature`, `signed_at`. RLS is currently wide-open (`USING (true)`).

**Versioning, confirmed:** an "update" is a new row with `supersedes_plan_id` pointing
at the row it replaces; the writer inserts the new row first, archives the prior
second (a deliberate ordering — a failure between the two leaves two visible plans
rather than a client with none). No version-number column; the supersedes chain is
the whole history.

### How problems/goals/interventions are represented

**Pure JSONB, no rows, no ids.** `content` is one blob shaped `{ problems: [{ title,
goals: string[], interventions: [{description, frequency?}] }] }`. A "problem" has
**no database identity** — no id column, nothing a foreign key could point at. The
edit modal mutates this array by index; nothing persists a stable identifier across
saves, so even array position isn't a durable reference.

### Does a foreign key exist today for a note to reference a specific problem?

**No — confirmed, and it needs a migration.** `clinical_notes.problems_addressed`
(added `20260728_l3_note_structure.sql`) is a bare `text` column with no FK, no check
constraint. It's fed by a plain `<input type="text">` in `SmartNoteImporter.tsx`
("Problem number(s) or a full sentence") — free recall, typed by the clinician. More
than that: **`SmartNoteImporter.tsx` never reads the client's treatment plan at all** —
zero references to the treatment plan API anywhere in that component. The clinician
gets no list to pick from; they retype from memory every time.

The deeper blocker isn't just the missing column — it's that **treatment-plan
problems have no queryable identity to found a foreign key on in the first place**,
since they live as unindexed elements of a JSONB array. Minimally, David's ask
("Tx Plan problems addressed," the TherapyNotes pattern) needs two things:
1. Give each problem a stable id — either promote `content.problems[]` into a real
   child table (`treatment_plan_problems(id, treatment_plan_id, title, ...)` — needed
   anyway if a note should be able to reference more than one problem via a join
   table), or at minimum stamp a UUID into each JSON problem object at write time.
2. Add a structured reference on `clinical_notes` (e.g. `treatment_plan_problem_id
   uuid`, or a join table for the multi-problem case) **alongside**, not necessarily
   replacing, the existing free-text `problems_addressed` — so a clinician can still
   write "or a full sentence" per David's own spec, but can also pick from the plan
   when one exists.

### Template → live plan relationship

Templates are **static TypeScript, not a database table** (`data/
treatmentPlanTemplates.ts`, `TREATMENT_PLAN_TEMPLATES`, 5 categories). Applying one is
copy-on-apply: the modal deep-clones the template's `problems` into form state, then
saves via `saveTreatmentPlan({ templateId: mode.template.id, content: buildContent()
})`. The DB row's `template_id` captures which static template id was used, **but it's
a bare text column, not a FK** — there is no `treatment_plan_templates` table to
reference. Once applied, the plan's content is a fully independent copy: a later edit
to the static template array (a code change/deploy) never propagates to any
already-created client plan, and there's no re-sync mechanism.

**Bottom line for David's question:** no FK exists today; the gap is two layers deep
(no identity on a problem, no reference column on the note); a migration is required
either way, and it's a small, well-scoped one if problems get stable ids first.

---

## D6 — Client page tabs

Seven tabs (`pages/ClientWorkspace.tsx:371-395`). *Note: the Admin/Clinical Documents
icon collision (both rendered `FileText`) was already fixed in a prior commit —
`ClipboardList` vs. `Stethoscope` — before this recon pass; not new work here.*

| Tab | What staff actually do there |
|---|---|
| Overview | Pure read dashboard — CSR alerts, Packet Readiness checklist, a Treatment Plan *summary card* (sourced from `form_submissions`, ilike-matched — **a different table than the Treatment Plan tab**), notes list, activity feed, payments list. No create/edit action. |
| Admin Documents / Clinical Documents | Same two stacked lanes (forms + uploads), filtered by category, unmapped items shown in both. Assign/review/approve forms, upload/scan/capture documents. |
| Services | Read-only merged timeline of appointments + clinical notes, drill into billable-unit detail. No create action — a history view. |
| Assessment | The placement-engine capture form + clinician sign-off/determination workflow (append-only, never downgrades in-app) + CIMOR packet generation. |
| Fees | The real charges/payments ledger — record payments, waive charges, generate a receipt PDF. |
| Treatment Plan | Full CRUD on `treatment_plans` — create from template, edit, versioned update, archive. |

**Flag — a naming collision, not a merge candidate:** Overview's "Treatment Plan"
summary card and the Treatment Plan tab share a label but read from **different
tables** (`form_submissions` vs. `treatment_plans`). Worth putting in front of David
as a naming fix on its own, independent of any tab-merge decision.

**Merge candidates considered (none recommended — David's call per the brief):**
- *Overview / Assessment* — not a good merge. Overview is a passive summary of gate
  outcomes; Assessment is the active data-entry + clinical-decision surface that
  produces the determination Overview only displays. Merging would collapse a safe
  glance into a deliberate clinical act on the landing tab.
- *Services / Clinical Documents* — no data overlap (Services reads
  appointments+notes; Clinical Documents reads form_submissions+uploaded_files;
  clinical notes never appear in Clinical Documents today), but real conceptual
  overlap ("what happened clinically"). A merge would mix a session timeline with a
  document approve/review workflow that has its own distinct affordances.
- *Fees / Services* — billable units show on both (Services: display-only from
  notes/appointments; Fees: the actual ledger). David's own naming split (Fees =
  client money, distinct from state billing) argues against merging what's charged
  from what a session recorded.
- *Admin / Clinical Documents* — already an explicit split David made 7/15; a merge
  here would reopen a decision already settled.

---

## D7 — Document viewer

**What `PrintPreview.tsx` renders, and for what:** exactly one shape — a
`FormDefinition.fieldDefinitions` array walked against `formData`, plus
signature-block logic keyed to specific field ids. Two call sites, both
form-shaped: `BaseFormTemplate.tsx` (pre-commit draft print) and
`SubmissionViewer.tsx`'s `RecordPrintRoot` (reprint of a committed row). It does
**not** handle clinical notes, uploaded files, or generated PDFs — nothing else in the
app constructs a `FormDefinition`-shaped object for those types.

**The Ctrl+P bug on a DAP note — confirmed, root cause found.**
`ClinicalNoteView.tsx` is a plain card with no print button, no portal, no isolation
wrapper — rendered inline inside Overview/Services tabs alongside other cards. Ctrl+P
there hits the browser's native print governed only by the *global* `@media print`
block (`public/index.css`), which hides chrome (header/nav/aside) but does nothing to
isolate one note from the rest of the tab. The per-document isolation mechanism that
*does* exist (`#record-print-root`) only activates for the forms path, triggered
programmatically by `SubmissionViewer.tsx`'s `printRecord()` — whose own code comment
states the gap directly: browser-native Ctrl+P "never reaches this function." So:
David's Ctrl+P prints chrome-stripped but content-unscoped — the whole visible tab,
not an isolated note — because clinical notes never got the print-portal treatment
forms did.

**No unified viewer exists.** Four fully separate paths:
- **Forms** → `PrintPreview.tsx` (schema+data walk).
- **Generated PDFs** (Completion Certificate, Status Report, Payment Receipt, CIMOR
  packet) → built with jsPDF (`services/pdfDocuments.ts`, `cimorPacket.ts`,
  `paymentReceipt.ts`), previewed as an already-rendered blob in an iframe.
- **Uploaded files** (scans/images) → `components/documents/DocumentViewer.tsx`, a raw
  native embed (`<iframe>` for PDF, `<img>` for images).
- **Clinical notes** → no dedicated viewer or printer at all; only the ambient global
  print CSS above.

**Noted in passing, not requested but relevant to "prints weekly probation
reports":** `components/compliance/CourtReportPreview.tsx` — a probation-report-shaped
component — exists in the codebase but has **zero call sites anywhere**. It's dead
code, unreachable from any route. Worth knowing about before building anything new for
that need, since something shaped like it may already exist, unfinished/unwired.

**What a single viewer would need to accept, per type (not a design — just the
shape):**
- **Forms** — structured: `fieldDefinitions[]` + a flat `formData` object +
  `committedAt`. Needs a field-mapping renderer.
- **Clinical notes** — mostly unstructured: a verbatim narrative string (or legacy
  split S/O/A/P fields) plus sidecar metadata (date, times, units, signer). Needs a
  narrative/typography renderer, not a field-mapper.
- **Uploaded files** — opaque binary: a `url` + mime type. Needs a native embed, not a
  data projector.
- **Generated PDFs** — already a finished rendered document (jsPDF instance/Blob).
  Needs only a frame to display it.

Not built here, per instruction — Dan is supplying a component from another repo.

---

## D8 — Document categories

**No dedicated category column exists.** `uploaded_files.document_type` (plain
`text`, no CHECK constraint) is the only categorization field —
`config/recordCategory.ts` client-side-derives Admin/Clinical from 8 known values
(`consent, court_order, id_copy, billing_record` → Admin; `intake_form,
treatment_plan, progress_note, drug_screen` → Clinical). Anything else renders in
both tabs and must be hand-picked via `CategoryPicker.tsx`, which is staff-facing
only and just renders those 8 values as buttons.

**David's six named types — none exist today.** ISAP intake assessment, SATP
evaluation, driving record, legal/charge documents, proof of ID, proof of residence
are all new. Closest partial matches: "legal/charge documents" ≈ `court_order`;
"proof of ID" ≈ `id_copy` (labeled "ID / License," not specifically driver's
license). ISAP, SATP evaluation, driving record, and proof of residence have no
analog anywhere in the existing 8-value set or the separate 12-value `DOC_TYPE_LABELS`
display map — **a second, independent vocabulary**, echoing the same "more than one
catalog for the same thing" pattern already flagged elsewhere in this codebase
(DEFERRED #36's three-form-catalog problem). Worth folding into that same cleanup
conversation rather than treating as a one-off.

**Cost of adding these: additive only.** No CHECK constraint on `document_type` means
new string values need no migration — just extend `RECORD_CATEGORY`/
`CATEGORY_OPTIONS` in `config/recordCategory.ts`, and `REQUESTABLE_DOC_TYPES` in the
`acs-request-upload` edge function if these should be requestable via link.
`CategoryPicker.tsx` needs no change — it already renders whatever
`CATEGORY_OPTIONS` contains. No new table, no new column, no RLS change.

**Does a staff-requested category already survive to the resulting file? Yes — for
one of the two upload paths, already wired end to end.** Trace: staff picks a
`docType` in `RequestUploadLinkModal` → `mintClientUploadLink` → the `acs-request-
upload` edge function's `mint` action validates it and writes it to
`acs_upload_tokens.requested_document_type`. On `submit`, that same stored value is
read back and written straight into the new row's `uploaded_files.document_type` —
the code comment there says it plainly: *"staff-chosen — pre-categorized, no Gemini on
this path."* Zero AI classification needed on this path, already true today.

**The gap:** this pass-through only covers the link-based "request from client" flow.
There's no equivalent for a client already logged into the portal uploading in
response to an in-app request — that path (`MobileDocumentUpload.tsx` →
`storageService.ingestDocument`) always re-classifies via OCR/AI regardless of what
was asked for. Extending David's six new types costs nothing structural on the
working link path — add them to `REQUESTABLE_DOC_TYPES` and `CATEGORY_OPTIONS`, no
carry-through mechanism changes. Also worth knowing before building on this: per a
same-day recon (`RECON-upload-break-2026-08-07.md`), the link-based flow is currently
the *only* upload path that works at all — direct staff/client uploads are broken by
a missing RLS insert policy, unrelated to categorization, fix proposed but not yet
applied.

---

## Cross-cutting: clarity-principle violations spotted (not fixed, per scope)

Per the brief's design principle — plain words, one obvious action per screen, no
control that requires knowing what it does before clicking:

1. **"Treatment Plan" names two different things one tab apart** (D6) — Overview's
   summary card and the Treatment Plan tab share a label but read different tables.
   A clinician has no way to know that from the screen.
2. **Two independent document-type vocabularies** (D8) — the 8-value Admin/Clinical
   category set and the separate 12-value `DOC_TYPE_LABELS` display map cover
   overlapping ground with different token sets.
3. **`/` and `/website` may be an unintentional duplicate route** (D1) — not a
   clarity issue for a user, but worth resolving before it's load-bearing in a nav
   redesign.
4. **A stale figure in prior notes** (D4) — the $1,350 unallocated figure doesn't
   match live data ($250); flagged so it isn't repeated to David as current.
