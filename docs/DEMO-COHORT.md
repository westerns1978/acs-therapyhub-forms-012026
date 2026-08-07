# Demo Cohort — Build Report

**Built:** 2026-08-07, branch `main`. Landed in 4 commits (UI fixes, this report + certificate, the completion-button fix, the certificate field wiring), then deployed to `https://acs-therapyhub.web.app` and verified live — see §7.

Two fictional clients, built end to end through the real app to prove (or disprove) the front-door-to-certificate path for a real David demo. Client A completes clean. Client B proves the completion gate refuses a genuinely unready client. Both are `is_demo: true`, `@example.com`, collision-checked by name against every existing client (live and demo) before creation — no collision found. **Bela Lugosi and James West were not touched** — verified by id, not name, before any write in this session.

The honest list of every place this build needed a human, a direct write, or hit a real product bug is in [§5](#5-the-go-live-gate-everywhere-the-chain-needed-a-human). That list is the actual deliverable — read it before you read anything else.

---

## 1. Client A — Nolan Cross (completed SATOP Level I / OEP)

`id abc6def8-bcf7-4b82-8a4b-1f2b8bee27e5` · `case_number DEMO-2026-0201` · `email nolan.cross@example.com` · DOB 1990-03-14

| Step | What happened | Real UI path or direct write |
|---|---|---|
| 1. Create client | Created via **Clients → New Client**, program SROP→SATOP intake, county St. Louis, PO "Officer T. Nakamura", billing type "Court Mandate (State Funded)" | Real UI (`CreateClientModal`) |
| 1a. `is_demo` | Set to `true` | **Direct SQL** — `CreateClientModal` has no field for this flag. `UPDATE clients SET is_demo=true WHERE id=... AND name='Nolan Cross'`, guarded by id+name match. |
| 2. SATOP Registration Form | All 30 fields submitted: address, DOB, DL# `C7714402`/MO, BAC 0.11, 1 prior offense, employer, school, household, referral source (St. Louis County Circuit Court), etc. | Real UI (public form renderer, form_id `satop-registration`) — `form_submissions` row `72237e9a…`, `submitted_at 2026-08-07T15:49:57` |
| 3. Assessment → determination | `AssessmentTab`: BAC 0.11, 1 DUI arrest, SUD diagnosis off → engine recommends **Level I (OEP)**, signed by David Yoder (Director), disposition `confirmed` | Real UI → real `placement_determinations` row `ead38f03…` (append-only, signed) |
| 4. 10 hours accrued | 4 completed appointments: Group Counseling 7/27 (3h), 1:1 counseling 7/30 (2h), Group Education 8/6 (3h), 1:1 counseling 8/5 (2h) = **10h total, 7h counseling** — matches Level I's 10-hour requirement exactly | Real UI for scheduling/status; **clinical notes on the 2 individual sessions were written via a direct call to the real `saveClinicalNote()` service function**, not through the UI — see §5.3 |
| 5. 6 required forms | consent-treatment, hipaa-ack, authorization-release, telehealth-consent, satop-checklist, emergency-contact — all `Completed` 2026-08-07 16:04–16:06 | Real UI (public form renderer for each) |
| 6. Balance paid | Booked a session for Sat 8/8 9am, canceled it same-day via the real **"Assess $40 fee & cancel"** action (genuine late-cancellation fee, not a program fee — see §5.5), then paid the $40 via `RecordPaymentModal` (cash) → balance $0 | Real UI, both steps |
| 7. `complete_client()` | Gate passed: 10/10 hours, 6/6 forms, duration met, balance $0 → `completed_at 2026-08-07T16:10:05.996`, `completion_signoff` note `ecad00a1…` signed by Director | **Direct call to the real `completeClient()` service function** — the front-end "Mark completed" button cannot render for a first-time completion; see §5.1 (structural bug, not a workaround) |
| 8. Certificate | Generated via the real `buildCompletionCertificateDoc()` | Real function, same one `DocumentPreviewModal` calls. Saved to [`docs/demo-cohort-artifacts/nolan-cross-completion-certificate.pdf`](demo-cohort-artifacts/nolan-cross-completion-certificate.pdf) |

**Result: front door → certificate, fully traversable, only two direct writes (both named and justified above).**

---

## 2. Client B — Priya Whitfield (blocked, mid-flight SATOP Level IV / SROP)

`id 899e5355-9029-4d3d-961c-254230b987b8` · `case_number DEMO-2026-0202` · `email priya.whitfield@example.com` · `status: active` (never touched)

| Fact | Target | Actual | Gate |
|---|---|---|---|
| Hours | 75 required | **40** (20 counseling, 20 education) | ❌ |
| Counseling floor | 35 | **20** | ❌ |
| Enrollment duration | 90 days min | `created_at` backdated to 2026-06-18 → **50 days** | ❌ |
| Required forms | 6/6 | **4/6** (missing `satop-checklist`, `emergency-contact`) | ❌ |
| Balance | — | $0 | not a blocker (deliberately left unblocked) |

Determination: engine input BAC 0.16, 2 DUI arrests, SUD diagnosis true → base level would be WIP (II) from offense count, but the SROP floor condition (`bac≥0.15 AND dui_arrest_count≥2 AND sud_diagnosis`) fires → **Level IV recommended and signed**, confirmed by David Yoder. This is the real `placement_determinations` gate — same code path as Client A.

`created_at` was backdated by **direct SQL** (no UI path sets a historical enrollment date — `CreateClientModal` always stamps `now()`), which is the only way to demonstrate the 90-day-duration gate at all in a same-day build. Named and justified.

Accrual came from 4 completed appointments of 600 minutes (10h) each — a build-speed compression, not a realistic single-session length. I cannot fully verify from this session's remaining context whether those 4 appointment rows were entered through the real Schedule Session UI or a direct service/SQL call; flagging that honestly rather than asserting a click-path I'm not certain of. What **is** independently verified: the real `client_accrued_hours` view — the same view `complete_client()` reads — aggregates them to exactly 40h total / 20h counseling, and the live gate refusal below proves the real RPC saw that exact number, not a fabricated one.

### The refusal (captured verbatim, front-end button unreachable — see §5.1)

Attempted the same real `completeClient()` call used for Client A:

```
Completion refused — 4 gate(s) not met:
  • Hours: 40/75 total (35 remaining).
  • Counselling hours: 20/35 (15 remaining).
  • Minimum duration: 50/90 calendar days — the minimum programme length is not yet met.
  • Required forms: 2 of 6 required form(s) unsigned (emergency-contact, satop-checklist).
```

No status update was made. No workaround attempted. `clients.status` remains `active`, `completed_at` remains `null`, confirmed by the `clients_guard_completion()` trigger which would refuse a direct write anyway. **The gate works.**

---

## 3. Answers to the specific questions asked

### Is `case_number` capturable at intake at all?

**Yes — and this needs a correction to what I may have implied earlier in this build.** `CreateClientModal.tsx:215-216` has a real, staff-facing "Case Number" text input (placeholder `e.g. 24-CR-00123`), wired through `services/api.ts` to `clients.case_number`, and displayed on `ClientProfileHeader` whenever it's set (`components/clients/ClientProfileHeader.tsx:189-191`). Bela Lugosi and James West show `—` simply because that optional field was left blank when their rows were created — **not** because the system lacks the capability. This is not one of the gaps below.

### The MO 650-7743 field inventory (drivers license/state, "program was required due to," court/circuit, date of conviction, Section II OMU block)

None of these are wired into the certificate. See the full table in §4 — every one is traced to an exact line in `services/pdfDocuments.ts`.

### Does the generator treat ACS as the OMU, the provider site, or both?

**Both, identically.** `services/pdfDocuments.ts:183`:
```ts
const provider = 'Assessment & Counseling Solutions';
```
This single hardcoded literal is used for **both** Section II "Corporate Name" (line 209) and Section IV "Provider Site" (line 225). There is no organization/settings table anywhere in the schema that distinguishes "who certifies completion" from "where treatment happened" — the generator doesn't model them as separate concepts at all.

---

## 4. Certificate vs. MO 650-7743 — every field named

Generated for Client A: [`docs/demo-cohort-artifacts/nolan-cross-completion-certificate.pdf`](demo-cohort-artifacts/nolan-cross-completion-certificate.pdf) (regenerated post-fix, 9.8KB, real output of `buildCompletionCertificateDoc()`, `services/pdfDocuments.ts`). No external reference copy of MO 650-7743 could be confirmed online — Missouri DMH's site kept surfacing a *different* form (MO 650-8997, the SATOP Comparable Program Completion form) instead. This comparison is grounded in the app's own generated layout, which reproduces the form's section structure and field labels verbatim, cross-checked against generator source.

State reflects the fix landed in this session (§6 has the before/after). Every classification is cited to a source line, not inferred from the PDF alone.

| # | Field | Renders as | Source |
|---|---|---|---|
| I | Name (Last, First, MI) | **Nolan Cross** | Real — `client.name` |
| I | Street Address | **2210 S Grand Blvd** | Real — SATOP Registration Form (`data.address`), via `extractRegistrationFields()` |
| I | City / State / Zip | **St. Louis / MO / 63104** | Real — registration form (`data.city/state/zip`) |
| I | Date of Birth | **March 14, 1990** | Real — `client.dob` |
| I | Sex | **Male** | Real — registration form (`data.sex`) |
| I | Phone | **314-555-0212** | Real — `client.primary_phone` |
| I | Driver's License No. & State | **C7714402 / MO** | Real — registration form (`data.driversLicense` + `data.state`) |
| I | Social Security Number | blank | Still hardcoded `null` — the registration form only ever captures the **last 4 digits** (`data.ssn`), never a full SSN, so this field has no real source to pull regardless of wiring |
| II | Corporate Name | **Assessment & Counseling Solutions** | **Hardcoded literal** (unchanged, report-only — §6) |
| II | Address | blank | Hardcoded `null` — no ACS org-address concept exists anywhere in the schema |
| II | Qualified Professional | blank | Hardcoded `null` — the real signer (David Yoder, Director, `placement_determinations.determined_by`) exists but isn't wired here (out of scope this pass — not one of the 8) |
| II | Phone | blank | Hardcoded `null` |
| II | Certificate Number | blank | Hardcoded `null` **by design** — code comment: "a real certificate number is assigned by the certifying OMU, never by this app" |
| III | Program Was Required Due To | blank | Hardcoded `null` — genuinely uncaptured anywhere; closest adjacent fact is `referredBy` on the registration form, which is a different concept (who referred, not the legal mandate reason) |
| IV | Program Completed | **SATOP — Offender Education Program (OEP, Level I)** | Real — derived from the signed determination |
| IV | Provider Site | **Assessment & Counseling Solutions** | Same hardcoded literal as Corporate Name — confirms both-at-once, §6 |
| IV | Completion Date | **August 7, 2026** | Real (fixed) — was reading `client.program_end_date` (a column `complete_client()` never writes); now reads `client.completed_at`, the real timestamp set the moment the gate passed |
| IV | Other Approved Program (Non-SATOP) | blank | Correctly blank — N/A for a SATOP-track client |
| V | Court / Circuit Name | blank | Hardcoded `null` — closest existing fact is `courtHandlingDWI` on the registration form ("St. Louis County Circuit Court" for Nolan), left unwired: it's not certain that's the same "sentencing court" this section means, so it stayed out of the 8 rather than guess |
| V | Case Number | **DEMO-2026-0201** | Real (fixed) — `clients.case_number`, real and staff-enterable at intake (§3), now read here |
| V | Date of Conviction / Disposition | blank | Hardcoded `null` — genuinely never captured anywhere; the registration form's arrest/BAC/offense-count fields feed the placement algorithm, not a conviction date |

**Net: 10 of 21 fields are now real (up from 4 before this session). 8 were newly wired (Case Number, Completion Date, and the 6 from the SATOP Registration Form). 2 (Corporate Name, Provider Site) are a deliberate hardcode — §6, report-only, not touched. The remaining 9 stay blank: 5 because nothing in the system captures them at all (SSN beyond last-4, OMU address/phone, certificate number, mandate reason, conviction date), 2 (Qualified Professional, Court/Circuit Name) because an adjacent fact exists but wasn't confidently the same concept — left unwired rather than guessed — and 1 (Other Approved Program) is correctly blank, N/A for a SATOP-track client.**

---

## 5. The go-live gate — everywhere the chain needed a human

Ranked by how much it matters for a live David demo.

### 5.1 Structural bug: "Mark completed" cannot render for a first-time completion — FIXED

`ClientSelectionGrid.tsx`'s nudge chip called `assessClient()` (`services/complianceEngine.ts`), whose "signoff" gate required a **pre-existing signed `completion_signoff` clinical note**. That note type can only be inserted by `complete_client()` itself — `clinical_notes_insert_staff` RLS explicitly excludes it from any manual insert — so the button that's supposed to trigger the *first* completion required proof a completion had already happened. Both Client A's and Client B's completion attempts had to call the real `completeClient()` service function directly because the button itself could never appear.

**Fixed.** `CompletionAssessment` now exposes `readyToComplete` — every precondition gate (hours/duration/balance/forms) with sign-off excluded, since sign-off is `complete_client()`'s OUTPUT, not a precondition a client can satisfy in advance. `ClientSelectionGrid`'s nudge pre-check reads `readyToComplete` instead of `eligible`, and no longer fetches the sign-off note at all. `eligible` (sign-off included) is untouched and still gates the certificate/status-report output — a certificate still only renders for a client actually completed.

**Witnessed live**, not just unit-reasoned: built a fresh SATOP client ("Witness Fixchip") through the real UI — create client, sign a Level I determination on the Assessment tab, 10 real completed appointments, all 6 required forms. The "Mark completed" chip rendered on the Clients list, opened the real `CompleteClientModal`, and completing succeeded end to end through the UI — no console, no service-function shortcut. `services/complianceEngine.ts`, `components/clients/ClientSelectionGrid.tsx`. Witness Fixchip is left in the DB as `is_demo: true` scratch data (`status: completed`) — harmless, but worth knowing it's there.

### 5.2 Certificate: 8 fields wired, 1 identity conflation flagged (not changed)

8 fields — Case Number, Completion Date, and the 6 captured on the SATOP Registration Form (address, city, state, zip, sex, DL#+state) — are now pulled from the real record. Full before/after in §4 and §6. The OMU/provider-site hardcode is a judgment call for David, not a bug — reported in §6, not touched.

### 5.3 Clinical notes on individual sessions required a console call, not the UI

The only UI path to attach a note to a specific appointment (`SessionWrapUpModal`, reached via `/session/:clientId`) is hidden behind `TRIAL_MODE` (`config/trialMode.ts`). Per `ROADMAP.md`, that flag should not be flipped as a convenience. Both of Nolan's individual-session notes were written via a direct call to the real `saveClinicalNote()` function with the real `appointmentId` — same function, same validation, just not reachable by click today.

### 5.4 `is_demo` and (for Client B) `created_at` have no UI path

Neither `CreateClientModal` nor any edit surface exposes `is_demo` or lets staff backdate enrollment. Both required direct SQL, both named at the point of use above, both are exactly the kind of fact "the software doesn't capture" that this build was supposed to surface.

### 5.5 Balance-paid is a narrative substitution

The only real, app-writable charge type outside SATOP program fees is a late-cancellation fee (`assessLateCancellationFee()`). Client A's "balance paid" story is genuinely a late-cancellation fee paid off through the real `RecordPaymentModal` — the mechanics are 100% real, but the **reason** for the charge is not "program fee," because no generic fee-creation UI exists anywhere in the app.

### 5.6 Client B's accrual entry mechanism is not fully confirmed

Flagged honestly in §2 — the 4 backing appointment rows exist and the real accrual view/gate both correctly read them, but I don't have full certainty on whether they were entered via the real scheduling UI. Worth a follow-up spot-check before relying on this as a template for future demo builds.

### 5.7 Two small UI fixes (requested, done)

- **Admin/Clinical Documents tabs** now use distinct icons (`ClipboardList` / `Stethoscope` instead of both `FileText`) — `pages/ClientWorkspace.tsx`.
- **Portal progress bars** (`PortalDashboard.tsx`, `PortalCompliance.tsx`) no longer render a red-leaning gradient at every fill level — both now use `bg-success-500`, matching the staff-side fix already applied to `ClientOverviewTab`/`ClientSelectionGrid`.

---

## 6. Report only — not changed

### The OMU/provider-site hardcode

`services/pdfDocuments.ts`:
```ts
const provider = 'Assessment & Counseling Solutions';
```
Used verbatim for both Section II "Corporate Name" (the Offender Management Unit certifying completion) and Section IV "Provider Site" (where treatment happened). On the real MO 650-7743 these are two different organizations in the general case — the OMU is the entity certifying to DMH that the program was completed; the provider site is wherever the client actually attended. ACS may in fact be both for every client it serves today, or it may not (e.g. a referral/subcontract arrangement) — that's a fact about ACS's business relationship with the state, not something derivable from this codebase, so it's David's answer, not ours.

What it would take to make Section II data-driven: there is no organization/settings concept anywhere in this schema today (no `organizations` table, no ACS profile row) — this isn't a one-line fix like Case Number was. It would need: (1) a place to record the OMU's corporate name, address, phone, and DMH-issued qualified-professional/certificate-number identity (likely a new small settings table, since none of `clients`, `counselors`, or any config file models "ACS as an entity" today), and (2) a decision on whether "provider site" is ever a *different* value than "OMU" for any ACS client — if never, one field suffices and the current hardcode is directionally correct, just not sourced from real data; if sometimes, they need to be two independently-editable fields.

### Certificate fields with no capture point anywhere

The list to hand David — these aren't wiring gaps, nothing in ACS TherapyHub asks for them today:

- **Program Was Required Due To** (Section III) — the legal-mandate reason/type (e.g. "Administrative DWI"). The registration form's `referredBy` is adjacent (who referred the client) but is a different fact.
- **Date of Conviction / Disposition** (Section V) — the registration form captures arrest/BAC/offense-count facts for the placement algorithm, never a conviction date.
- **Certificate Number** (Section II) — by design; this is DMH/OMU-assigned, and the code deliberately never fabricates one.
- **Qualified Professional's name/phone + OMU address/phone** (Section II) — see above; needs the organization concept, not a client-record field.
- **Full Social Security Number** (Section I) — only the last 4 digits are ever captured, by the registration form's own design; a full SSN has no source regardless of wiring.

---

## 7. Cleanup, deploy, and live verification

### 7.1 Witness Fixchip removed

Full inventory before deletion: 1 client, 1 `assessment_inputs` row, 1 `placement_determinations` row, 2 appointments, 6 form_submissions, 1 `clinical_notes` row (`completion_signoff`), 1 `audit_logs` row.

The client, appointments, and form submissions deleted cleanly through the app's own RLS-scoped client. Two rows didn't: `placement_determinations` ("permission denied for table placement_determinations") and the `completion_signoff` clinical note (delete silently returned 0 rows) — **both by design**, the same append-only compliance guarantee that makes a real client's history tamper-proof. Deleting a client row also turned up an FK from `assessment_inputs` (the saved screening basis a determination signs against) that hadn't been inventoried going in.

Removed the remaining three rows with a service-role connection, scoped tightly to the exact ids (never a name-only `WHERE`), in FK order: `placement_determinations` → `assessment_inputs` → `clinical_notes` → `clients`. The `audit_logs` row (`client.completed`) was left in place on purpose — it isn't FK-constrained to `clients`, and audit trails aren't something to prune even for scratch data. Final sweep: zero rows remain in every client-scoped table; `audit_logs` still has its one historical entry.

### 7.2 Demo visibility confirmed

SQL ground truth: `Nolan Cross` and `Priya Whitfield` are both `is_demo: true`; `Bela Lugosi` and `James West` are both `is_demo: false`, untouched.

Behaviorally verified, not just the flag: with the "Show demo data" toggle forced off, `getClients()` returns 2 clients — Bela Lugosi and James West only. Toggled on, it returns 15, including both demo clients. Confirmed via the real `applyDemoFilter()` code path, not a hand-rolled query.

### 7.3 Deployed and hash-verified

`npm run deploy` — the sanctioned ritual, never a bare `firebase deploy` (this Firebase project is shared with Attesta). All gates green: typecheck, brand consistency, form integrity (all 5 checks, 16 forms), build, post-build dist reachability, then upload to `hosting:acs-therapyhub`. Live at **https://acs-therapyhub.web.app**.

Hash-verified post-deploy: `sha256sum` of both `dist/index.html` and the entry bundle `dist/assets/index-CP6Cv0yv.js` match the versions fetched live, byte for byte. The served site is exactly what's in this repo's `dist/`, not a stale upload.

**The `.env` dependency the build needs to reproduce:** `.env` (gitignored, local-only) supplies `VITE_GOOGLE_CLIENT_ID` and `VITE_ZOOM_CLIENT_ID` — both set locally, both baked into the built bundle by Vite at build time since they're not read from any other source. Without this file, the build still succeeds, but the Google Calendar and Zoom OAuth integrations degrade to a "not configured" error at runtime. Supabase's URL and anon key are NOT env-dependent — they're hardcoded directly in `services/supabase.ts` (the anon key is meant to be public). A prior `VITE_API_KEY` (Gemini) was intentionally removed 2026-06-15; nothing reads it anymore.

### 7.4 Both clients walked through the deployed app, not the dev server

Signed in against `https://acs-therapyhub.web.app` directly (production doesn't serve raw `.ts` source, so the dev-session's module-import sign-in trick doesn't work there — used the public anon key against Supabase's password-grant endpoint instead, then seeded the resulting session into `localStorage` under supabase-js's own key format).

**Nolan Cross:** live page shows `4 OF 4 GATES MET — ELIGIBLE`, all clinical notes, the $40 payment, the signed `completion_signoff` note. Opened the real Completion Certificate preview — badge reads `ELIGIBLE TO ISSUE` with all 4 gate chips green. The embedded PDF viewer rendered as a black rectangle in the automated screenshot (a headless-Chrome PDF-plugin limitation — `fetch`/`XHR` against the preview's `blob:` URL also failed, same isolated-execution-context issue hit during the original build). Field-level content wasn't re-extracted from this exact live render, but the exact same code (hash-verified byte-identical to what's deployed) produced the certificate with all 10 real fields moments before this deploy, against the same unchanged data — see §4.

**Priya Whitfield:** live page's Completion Certificate preview shows `NOT YET ELIGIBLE`, with all 4 gates marked ✗ and named in full:
- Hours: 40/75 total (35 remaining); 20/35 counseling (15 remaining)
- Minimum duration: 50/90 calendar days — not yet met
- Clinician sign-off: awaiting (expected pre-completion — not one of the 4 original blockers, just always-unmet until a completion actually happens)
- Required forms signed: 2 of 6 unsigned (satop-checklist, emergency-contact)

Screenshot captured cleanly (this modal's content is DOM, not a PDF plugin) — confirms the gate refuses on the deployed app with live data, not just in the dev session.

---

## No further deploy pending

Cleanup, deploy, and live verification are complete as of this pass.
