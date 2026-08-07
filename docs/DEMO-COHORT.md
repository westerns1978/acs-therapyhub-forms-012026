# Demo Cohort — Build Report

**Built:** 2026-08-07, branch `feat/registration-forms`. Not deployed, not merged, not committed to git as of this report.

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

Generated for Client A: [`docs/demo-cohort-artifacts/nolan-cross-completion-certificate.pdf`](demo-cohort-artifacts/nolan-cross-completion-certificate.pdf) (9.2KB, real output of `buildCompletionCertificateDoc()`, `services/pdfDocuments.ts:126-251`). No external reference copy of MO 650-7743 could be confirmed online — Missouri DMH's site kept surfacing a *different* form (MO 650-8997, the SATOP Comparable Program Completion form) instead. This comparison is grounded in the app's own generated layout, which reproduces the form's section structure and field labels verbatim, cross-checked against generator source.

Every populated/blank/hardcoded classification below is cited to a source line, not inferred from the PDF alone.

| # | Field | Renders as | Source |
|---|---|---|---|
| I | Name (Last, First, MI) | **Nolan Cross** | Real — `client.name`, line 196 |
| I | Street Address | blank | Hardcoded `null`, line 197 — **captured** on the SATOP Registration Form (`data.address`) but never read here |
| I | City / State / Zip | blank | Hardcoded `null`, lines 198-200 — **captured** on the registration form, never read |
| I | Date of Birth | **March 14, 1990** | Real — `client.dob`, line 184/201 |
| I | Sex | blank | Hardcoded `null`, line 202 — **captured** on the registration form (`data.sex`), never read |
| I | Phone | **314-555-0212** | Real — `client.primary_phone`, line 185/203 |
| I | Driver's License No. & State | blank | Hardcoded `null`, line 204 — **captured** on the registration form (`data.driversLicense`, `data.state`), never read |
| I | Social Security Number | blank | Hardcoded `null`, line 205 — and even if wired, the form only ever captures the **last 4 digits** (`data.ssn`), never a full SSN, so this field can never be fully populated by design |
| II | Corporate Name | **Assessment & Counseling Solutions** | **Hardcoded literal**, line 183/209 — no org/settings table backs this |
| II | Address | blank | Hardcoded `null`, line 210 — no ACS org-address concept exists anywhere in the schema |
| II | Qualified Professional | blank | Hardcoded `null`, line 211 — the real signer (David Yoder, Director, `placement_determinations.determined_by`) exists and is never wired here |
| II | Phone | blank | Hardcoded `null`, line 212 |
| II | Certificate Number | blank | Hardcoded `null` **by design** — code comment: "a real certificate number is assigned by the certifying OMU, never by this app" (lines 213-216) |
| III | Program Was Required Due To | blank | Hardcoded `null`, line 220 — genuinely uncaptured anywhere; closest adjacent fact is `referredBy` on the registration form, which is a different concept (who referred, not the legal mandate reason) |
| IV | Program Completed | **SATOP — Offender Education Program (OEP, Level I)** | Real — derived from the signed determination, line 224 |
| IV | Provider Site | **Assessment & Counseling Solutions** | Same hardcoded literal as Corporate Name, line 183/225 — confirms both-at-once above |
| IV | Completion Date | blank | **Reads the wrong column.** Line 190: `client.program_end_date ?? client.programEndDate` — a column `complete_client()` never writes. The real timestamp, `clients.completed_at` (populated `2026-08-07T16:10:05.996` for Nolan, in the same row), sits unused. This is a known, previously-flagged issue — `docs/qa/p0-gate1-recon.md` already recommends `completed_at` as authoritative and calls `program_end_date` a stale denormalized mirror. Not fixed in this pass. **One-line fix, real bug, not a capture gap.** |
| IV | Other Approved Program (Non-SATOP) | blank | Correctly blank — N/A for a SATOP-track client |
| V | Court / Circuit Name | blank | Hardcoded `null`, line 231 — closest existing fact is `courtHandlingDWI` on the registration form ("St. Louis County Circuit Court" for Nolan), unwired, and it's not certain that's the same "sentencing court" this section means |
| V | Case Number | blank | Hardcoded `null`, line 232 — **the headline finding.** `clients.case_number` is real, staff-enterable (§3), and populated right now (`DEMO-2026-0201`) in the same row the rest of this certificate pulls from. The generator simply never reads it. **One-line fix.** |
| V | Date of Conviction / Disposition | blank | Hardcoded `null`, line 233 — genuinely never captured anywhere; the registration form's arrest/BAC/offense-count fields feed the placement algorithm, not a conviction date |

**Net: 6 of 21 fields are real. 2 more (Completion Date, Case Number) are one-line fixes — the data already exists in the same row. 6 more exist in `form_submissions` but the generator never reaches them. The rest (OMU identity, certificate number, mandate reason, conviction date) aren't captured anywhere in the system today.**

---

## 5. The go-live gate — everywhere the chain needed a human

Ranked by how much it matters for a live David demo.

### 5.1 Structural bug: "Mark completed" cannot render for a first-time completion (real product bug)

`ClientSelectionGrid.tsx`'s nudge chip calls `assessClient()` (`services/complianceEngine.ts`), whose "signoff" gate is `passed: facts.completionSignedOff === true` — it requires a **pre-existing signed `completion_signoff` clinical note**. But that note type can only be inserted by `complete_client()` itself; `clinical_notes_insert_staff` RLS explicitly excludes it from any manual insert. **The button that's supposed to trigger the first completion requires proof a completion already happened.** Both Client A's and Client B's completion attempts had to call the real `completeClient()` service function directly (same function, same RLS, same gate logic the button would call) because the button itself cannot appear. This needs a real fix before David clicks anything.

### 5.2 Certificate: 2 one-line fixes, 6 unwired-but-captured fields, 1 identity conflation

Full detail in §4. The two one-line fixes (Case Number, Completion Date) should ship before any demo where David looks closely at the PDF.

### 5.3 Clinical notes on individual sessions required a console call, not the UI

The only UI path to attach a note to a specific appointment (`SessionWrapUpModal`, reached via `/session/:clientId`) is hidden behind `TRIAL_MODE` (`config/trialMode.ts`). Per `ROADMAP.md`, that flag should not be flipped as a convenience. Both of Nolan's individual-session notes were written via a direct call to the real `saveClinicalNote()` function with the real `appointmentId` — same function, same validation, just not reachable by click today.

### 5.4 `is_demo` and (for Client B) `created_at` have no UI path

Neither `CreateClientModal` nor any edit surface exposes `is_demo` or lets staff backdate enrollment. Both required direct SQL, both named at the point of use above, both are exactly the kind of fact "the software doesn't capture" that this build was supposed to surface.

### 5.5 Balance-paid is a narrative substitution

The only real, app-writable charge type outside SATOP program fees is a late-cancellation fee (`assessLateCancellationFee()`). Client A's "balance paid" story is genuinely a late-cancellation fee paid off through the real `RecordPaymentModal` — the mechanics are 100% real, but the **reason** for the charge is not "program fee," because no generic fee-creation UI exists anywhere in the app.

### 5.6 Client B's accrual entry mechanism is not fully confirmed

Flagged honestly in §2 — the 4 backing appointment rows exist and the real accrual view/gate both correctly read them, but I don't have full certainty on whether they were entered via the real scheduling UI. Worth a follow-up spot-check before relying on this as a template for future demo builds.

### 5.7 Two small UI fixes (requested, done, not committed)

- **Admin/Clinical Documents tabs** now use distinct icons (`ClipboardList` / `Stethoscope` instead of both `FileText`) — [`pages/ClientWorkspace.tsx:378-379`](../pages/ClientWorkspace.tsx).
- **Portal progress bars** (`PortalDashboard.tsx`, `PortalCompliance.tsx`) no longer render a red-leaning gradient at every fill level — both now use `bg-success-500`, matching the staff-side fix already applied to `ClientOverviewTab`/`ClientSelectionGrid`.

Both are uncommitted working-tree changes as of this report (`git status`: 3 modified files, 1 new `docs/demo-cohort-artifacts/` directory).

---

## No deploy, no merge, no commit

Per instruction: this report is the checkpoint. Nothing in this build has been committed, merged, or deployed.
