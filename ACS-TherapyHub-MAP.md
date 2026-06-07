# ACS TherapyHub — Living Map

**Map · Path · Goals · Wishlist** — the canonical orientation doc for the project.
Owner: Dan Western (Gemynd). Last updated: **2026-06-07.**
This supersedes point-in-time session handoffs as the *standing* picture. Update it at the end of every sprint (see §13). Commit it to repo root so it travels with the code and a fresh chat can read it cold.

> One-line status: *A Missouri SATOP client can be screened, placed, charged, paid (by any staffer, attributed correctly), receipted, reported on, and certified end-to-end in one secured app — with a deterministic placement engine that proposes a level for a clinician to confirm. Live at https://acs-therapyhub.web.app.*

---

## 1. What this is & who it's for

ACS TherapyHub is a practice-management web app for **Assessment & Counseling Solutions (ACS / STL ACS)**, a counselor-founded (2003), state-certified Missouri **SATOP** provider in St. Louis. A paid Gemynd pilot (**$600/mo**, David Yoder).

**People:**
- **David Yoder, MEd, LPC** — owner/Director (pilot sponsor; took the helm in 2024 with a modernization mandate). Day-30 review pending.
- **Karen Ventimiglia, LPC** — Therapist + **clinical authority** (signs off on clinical methodology — including the placement-engine rule table before real use).
- **Jessica** — Admin / front desk (payments, scheduling).

**Business reality (from David + the ACS site):**
- **SATOP/DUI ≈ 80% of revenue.** ~**80–100 clients** in programs at any time.
- **Programs are delivered online, weekly** (group + individual). This is the operational core and the biggest software-leverage point.
- The full portfolio (the other ~20%): REACT, DWI Court (St. Louis County), individual counseling, substance-use treatment, drug testing, anger management, court/employer assessments. **SATOP is the focus; the rest are future modules, if ever.**
- **Certification moat:** the state is not issuing new SATOP contracts → the certification can't be replicated by a new competitor. The game is being the most modern, trusted *incumbent*.

---

## 2. Goals & thesis

- **Counselor-led, technology-enabled.** Software does the rote so clinicians do the human work. Modern enough to differentiate; warm enough to still be ACS.
- **One secure place, screening → certificate.** Collapse the manual journey: screen, place, deliver, bill, certify.
- **Make the un-replicable moat more valuable.** Efficiency + court-trusted data = capacity without new payroll, and a differentiation enforcement-heavy competitors can't match.
- **Forcing function:** the **day-30 review with David** (confirm pricing, fee schedule, supplemental decision; show real numbers).

---

## 3. Architecture principles (non-negotiable — apply to all work)

1. **Narrate-only.** A deterministic engine decides every count/verdict/level; a credentialed human confirms or overrides (logged with reason); AI writes **prose only**, never a number or a clinical/legal verdict.
2. **Witness, don't assume.** Prove behavior — anon RLS probes → 0, forged-claims rejected, replay throwing 23505, a balance landing at $0, a truth table printed, eyes on the live screen. "It deploys" ≠ "it works."
3. **Present-then-apply** for any live-DB migration. Show SQL → human approves → apply → verify between steps. Never auto-apply.
4. **Source-of-truth in git.** Commit the `.sql` even for MCP-applied migrations (they replay 1→N).
5. **Verify RLS through the authenticated app, never `execute_sql`** (MCP runs as service_role → bypasses RLS → false pass).
6. **New tables ship with scoped RLS**, never `Allow all`. Balance always **derives from the ledger**. The **$249 supplemental is a state pass-through, never revenue.**
7. **Merge → build → deploy**, in that order (stale-bundle bug otherwise). Deploy to `hosting:acs-therapyhub`.
8. **One-person process.** Branch → verify → merge → deploy. No PR-review ceremony.
9. **Gates must agree.** A UI role gate must match its RLS predicate exactly (a Client must never see a staff surface).

---

## 4. MAP — what's LIVE (shipped, deployed, witnessed)

| Workstream | What it is | State |
|---|---|---|
| **WS0 — RLS** | Role-scoped security on all 9 client-data tables; `app_metadata`-only roles, fail-closed. Helpers: `is_staff` (D/T/A), `is_clinician` (D/T), `is_financial_staff` (D/A), `my_client_ids`. | Live |
| **WS6/WS7 — Cert pipeline** | Real **MO 650-7743** completion certificate; single jsPDF renderer with zero-drift preview→save; 3-part completion gate (hours + balance==0 + signed sign-off); SAMPLE watermark on demo. | Live |
| **WS-Billing — Ledger** | `charges` + `payments` ledger as system-of-record; derived `clients.balance`; Stripe checkout + idempotent webhook; the $249 supplemental tagged pass-through. | Live |
| **Record Payment (all-staff)** | Manual cash/check/money_order entry, portaled modal, per-staffer attribution (`recorded_by = auth.uid()`). Widened from financial-staff to **all staff** (`is_staff`) — any of the three can take payment; clinical authorship stays clinician-only. | Live |
| **Receipt PDF** | Per-payment receipt reusing the cert's jsPDF + zero-drift plumbing; demo watermark; pass-through labeled; reprint-stable (no running balance). | Live |
| **Director Reports** | Read-only SQL functions (`acs_report_*`, security-invoker, Central-tz buckets): payments-by-method, outstanding-by-client, money summary. Self-auditing (`revenue + remittance + unallocated = total`); pass-through never in revenue. `/financials` un-hidden for **Director/Admin**. | Live |
| **WS1 — Placement engine** | Deterministic `computePlacement` (single source, date-free) encoding 9 CSR 30-3.206: offense-base 1→OEP/2→WIP/3+→CIP, SROP hard floor (BAC≥0.15 AND 2+ DUI-arrests-w/-DOR-action AND SUD dx), upgrade factors surfaced (not auto-applied), screening 6-month validity at view-time. Typed `assessment_inputs` table (staff-only RLS, no client self-read). Live recommendation in the Assessment tab, labeled "not a determination." Witnessed: **120/120 truth table**, RLS denials, 3 eyes-on cases. | Live |
| **Clara — surface-aware** | One shared brain (`SynapseChatPopover`, Gemini Live voice — `gemini-2.5-flash-native-audio-preview-12-2025`, ephemeral-token flow), two front doors: **staff** = header launcher (Clara's `clara2.png` avatar + `animate-ping` maroon pulse, by the bell) → **docked right panel that pushes content** (no overlay); **client/portal** = floating bubble, untouched. One identity across surfaces. UI-only — zero voice/session lines changed (proven by diff). Witnessed: Financials non-overlap proven geometrically (panel x=1020–1440, ledger ends at x=1020, Marcus's $175 visible); portal bubble unchanged; token handshake `200`. | Live |
| **WS2 — clinician sign-off + CIMOR packet** | Signed determination of record on `placement_determinations` (append-only, two-layer immutable: no update/delete GRANT + no policy; forward `supersedes_id`). Sign-off in AssessmentTab (clinician-only, gate ↔ `is_clinician` RLS): Confirm / Escalate-with-reason / below-floor BLOCKED (§3(E), DB-enforced via `pd_disposition_matches_levels`). CIMOR packet reuses the cert jsPDF zero-drift kit; deterministic facts from the signed row; one ephemeral AI prose paragraph, token-guarded + AI-down-safe (both null-paths render deterministic-only). Witnessed: full truth table (RLS denials, CHECK rejections incl. NULL-reason, supersede chain, zero-drift, AI-down, token-guard). | Live |
| **WS2.5 — compliance deadline clock** | Pure-derived `services/complianceClock.ts` (date-only, AI-free, injected `asOf`) — reuses WS1 `screeningValidity` + the extracted `isBalanceSettled` (no re-derive). Per-client **advisory deadline strip** in the Assessment tab: screening 6-mo window · fees-paid gate · 7-day post-completion certificate · DOR notification. Reads the **SIGNED** determination (never a live recompute); cert/DOR `not_applicable` until a completion exists — no fabricated dates. Advisory "confirm…" framing, never OVERDUE. **No table** (pure-derived). Witnessed: 20/20 boundary truth table + UI (signed-not-live, no-fabricated-dates, no RiskMonitor duplication). | Live |
| **WS3 — categorized session-hours accrual** | A completed session becomes hours that feed the completion gate. `appointments.service_type` (counseling/education/rehabilitative_support/other) + a derived `client_accrued_hours` view (security_invoker; `duration_minutes/60`); the gate reads per-category accrual from the view, **NOT** the static `srop_hours_completed` (now legacy/display). **SROP ≥35-counseling flipped recorded→ENFORCED** (total ≥75 AND counseling ≥35); CIP/WIP/OEP stay total-only. Mark-complete requires `service_type` (no uncategorized completion). `appointments` is the session spine. Witnessed: headline pair (75+ total but <35 counseling → NOT pass; add counseling → flips to `met`), no-phantom (gate reads 0, not the seeded 42), UI gate, placement 120/120 + clock 20/20. | Live |
| **WS4 — required total from the signed determination** | The gate's **required** side is now as authoritative as WS3 made the completed side. The completion gate derives the required total + SROP's ≥35-counseling floor from the **current signed `placement_determinations`** level (non-superseded, latest `determined_at`) via `REQUIRED_HOURS_BY_LEVEL {I:10·II:20·III:50·IV:75}` — it **no longer infers the level from a number**. Static `total_sessions_required` is legacy/display. **No signed determination → "completion not established," not eligible — never the seed.** `ClientProfileHeader` level badge reads the determination too. No migration / no RLS change (gate is staff-side; portal stays display-only on the static column). Witnessed: SROP(IV)→75+35 · CIP(III)→50 (no counseling floor) · no-phantom (static 75 but gate uses 50) · supersede IV→III→75→50 · no-determination→not established · badge "SATOP Level III" · placement 120/120 + clock 20/20. | Live |
| **WS5 — forms → cert enforcement (+ portal join-link)** | The cert gate's third determinant: **required forms signed** (3.206(13)(F)). Form set reconciled to ACS's real `Forms-090825` via one **`FORM_REGISTRY`** (id/title/category/audience/requiredForCompletion); **HIPAA, Telehealth Informed Consent, Late Cancellation** added as single-signature forms; **AA/NA report client-submittable**; **ROI now requires the DMH+DOR completion-notice authorization** (the legal basis for the clock's DOR item). `form_id` relabeled **uuid→text** + backfilled → completed-detection works (no more permanent "pending"). Scoped **client-write RLS** on `form_submissions` (the client can finally sign their own forms) + staff-attestation guard (clients can't author/alter `reviewed`). **/sign retired** (Option A — signatures persist in `form_submissions.data`). Required set derives from level (`REQUIRED_FORMS_BY_LEVEL` → core 6 all levels); no-phantom; required-core intrinsic. Portal **Join** renders the real `appointments.zoom_link`. Migrations `ws5_1` (client-write) + `ws5_2` (form_id text). Witnessed as a **real portal Client**: 5/6 signed → forms the only failing gate → NOT eligible; signs the 6th as themselves → **FLIPS to eligible**; no-phantom · intrinsic · completed-detection · join-link `zoom.us/j/…` · placement 120/120 + clock 20/20. | Live |
| **WS-DisplayTruth — display == gate (+ portal `my_progress` RPC)** | Every display surface reads the gate's OWN sources via `services/displayProgress` (`composeProgress` = `fetchClientAccrual` + signed level + `REQUIRED_HOURS_BY_LEVEL` + SROP ≥35 floor), so what's shown can't diverge from the completion verdict; static `srop_hours_completed`/`total_sessions_required` are **unread** (legacy, kept pending #10a). Portal **client** gets its authoritative required/level via a `SECURITY DEFINER` `public.my_progress()` returning **only `{established, level}`** for `auth.uid()`'s own client (self-scoped `private.my_client_ids()`, fail-closed singleton) — the **determination row stays staff-only** (WS2 boundary intact). Staff header / client-list grid / deadline-alert repointed off the neutralized `completionPercentage`; progress composed **once** in `ClientWorkspace` (header + overview one fetch). No-phantom everywhere (no number until a determination is signed). Migration `20260606_wsdisplaytruth_1_my_progress_rpc`. Witnessed both directions through the authed app (portal Client + staff): established `X/Y` + level · **boundary: Client direct `SELECT placement_determinations` → 0 rows** · no-phantom · SROP two-part (`/75` + counseling `/35`) · staff unchanged · `tsc` clean; transient witness fixture reverted to zero residue. | Live |

> **Assessment spine — reg-grounded (2026-06-06).** The SATOP placement rules are grounded in **9 CSR 30-3.206 (verified Jan-2024 text)** — offense base, SROP floor, hours (OEP 10 · WIP 20 · CIP 50 · SROP 75 incl. ≥35 counseling), screening 6-mo validity, cert-within-7-days, DOR auto-notification. The rule pack is now cited to **3.206** on the corrected rules and **CIP's hours gate is now enforceable** (50-total, was `not_enforceable`). This is **not** "demo-only pending sign-off": a **licensed clinician confirms each determination at sign-off** (the engine proposes; the clinician signs the clinical act). As of **WS3** the **SROP ≥35-hour counseling** floor is **ENFORCED** from real Completed hours, and as of **WS4** the **required total** derives from the **signed determination's level** (not the static column). The completion gate now enforces **three** authoritative determinants — *completed* hours from accrual (WS3), *required total* from the signed determination (WS4), and *required forms signed* (WS5 — 3.206(13)(F)) — and **none passes on seed**.

**Recent commit trail (this week):** Record Payment `7757725`+`428c3dc` · widen-financial `8a91dc3`+`75417bf` · retire-mock-billing `96144c7` · receipt PDF `38c5025` · Director Reports `20260605_reports_1…` + merge `f991324` · docs un-hide `e7cb41d` · WS1 migration `a68dfbd` + feature `bb3f7cb` + merge `7d5c3e5` · Clara relocation merge `d5f8b5d` · Clara avatar+pulse merge `3bef251` · **WS2** Phase 1 `0ca04ef` (ws2_1 table+RLS · ws2_2 grant-lock) · Phase 2 sign-off `8c4fa06` · Phase 3 CIMOR packet `e394a91` · merge `7611811` · **WS2.5** engine+truth-table `87e7a93` · strip `46b3877` · merge `5f052d7` · **reg-3.206** corrections `c852796` · merge `5144bb7` · **WS3** accrual migration `f743b44` + gate+UI `dacde36` · merge `d4607d8` · **WS4** required-from-determination `0ed5191` · merge `638af2a` · **WS5** client-write `22ad5cb` + form_id-text `787298b` + forms-gate/registry `db68522` · merge `ef1091a` · **WS-DisplayTruth (one unit)** display-repoint `fcc02ad` + `my_progress` RPC `075bb12` + portal wiring `7161387` + consumer-sweep `22c65a1` (+ this MAP/backlog commit + `--no-ff` merge). (Earlier WS0/WS6/WS7/WS-Billing history is in `ACS-Session-Handoff.md`.)

> **§4 = this team's *recent build work* only.** The full live route inventory — including the large **inherited surface** (Treatment Plan Library, ClientWorkspace + tabs, the whole client portal, Calendar, Messages, Forms, Risk Monitor, ASAM assessment, and more) — is in **§4b**, trued-up against the repo 2026-06-06.

---

## 4b. Standing feature surface (full route inventory — trued-up against repo 2026-06-06)

Recon'd read-only from router/nav/components. Tags: **REAL** = production writes/logic · **PARTIAL** = works but a piece is stub/no-op · **MOCK** = display-only/hardcoded. (Auth is REAL — WS0; ignore any claim otherwise.)

**Staff app. Gates: D=Director · T=Therapist · A=Admin.**

| Route | Nav / access | What it does | State |
|---|---|---|---|
| `/dashboard` | all | Daily snapshot: real appts, compliance alerts, Director aggregates | REAL |
| `/clients[/:id]` | all | **ClientWorkspace** — the core hub; tabs: Overview, Documents, Forms, Sessions, Assessment (WS1 + **WS2** sign-off/CIMOR packet + **WS2.5** advisory deadline strip, clinician-only · Admin read-only), Billing (D/A), Treatment Plan (D/T) | REAL |
| `/session-management` "Calendar" | all | Appt calendar; real appts + status writes; Google Calendar sync; launches ActiveSession | REAL |
| `/communication-center` "Messages" | all | Staff↔client / staff↔admin messaging → `client_communications` | REAL |
| `/forms` | all | Form library (11 templates) + real `form_submissions` | REAL |
| `/treatment-plan-library` | D/T | 8 **hardcoded** templates (`data/treatmentPlanTemplates.ts`) → customize → **real `treatment_plans` insert** (`saveTreatmentPlan()`, migration `20260522_treatment_plans.sql`); archive-and-apply if an active plan exists | REAL |
| `/risk-monitor` "Compliance Risk" (badge 3) | D/T | Deterministic alert monitor (attendance/deadlines), tiered, CTA | REAL |
| `/financials` | D/A | Director Reports over real ledger (= §4) | REAL |
| `/compliance-readiness` | D | Deterministic MO readiness checks; advisory | REAL |
| `/assessments/:id` | D/T · deep-link | ASAM 6-dimension assessment; real Gemini analysis, persists | REAL |
| `/program-plan/:id` | D/T · deep-link | View a client's active program plan | REAL |
| `/help[/:slug]` | public | Static help/training docs | REAL |
| `/compliance` "Compliance" | D/T · **mobile-drawer only** | Compliance events + audit-log *view* + staff certs — **certs hardcoded; audit log read-only (nothing writes)** | PARTIAL |
| `/program-compliance/:id` | D/T | ProgressTracking — SROP 75-hr tracker; **analysis modal = stub** | PARTIAL |
| `/session/:id` | D/T · "Start Session" | ActiveSession — live transcription + SOAP gen; **note never persisted**; "Simulate Conversation" canned | PARTIAL |
| `/settings` | D | Integrations OAuth **simulated**; reset-demo + supabase-check real | PARTIAL |
| `/reporting` "Analytics" | D | Charts from hardcoded data | MOCK · trial-HIDDEN |
| `/document-intelligence` "AI Documents" | all | OCR/extraction; black-screens | MOCK · trial-HIDDEN |
| ~~`/sign/:docType/:id`~~ | — | **RETIRED (WS5, Option A)** — the no-op save path removed; signatures persist in `form_submissions.data` via the forms | Removed |
| `/compliance-assistant` | D/T · **orphaned (no nav)** | Clara co-pilot: image upload + Gemini journal/sentiment | REAL · unreachable |
| `/video-sessions` (+ green-room) | D/T · **orphaned (no nav)** | **MOCK** — `getVideoSessions` = hardcoded array; writers (`addVideoSession`/`updateVideoSessionStatus`) are no-ops. NOT real rows. The real session spine is **`appointments`** + the Zoom edge fns (`zoom-create-meeting`/`oauth`; `appointments.zoom_link`/`zoom_meeting_id`). | MOCK · unreachable |
| `/fee-ledger/:id` | legacy | → redirects to `/clients/:id` (retired mock billing) | REDIRECT |

**WS2 surface** (in the Assessment tab of `/clients/:id` — clinician-only; Admin read-only): **`placement_determinations`** — the signed determination of record. Append-only & **two-layer immutable** (no update/delete GRANT + no policy; supersede via forward `supersedes_id`). Sign-off UI gate ↔ `is_clinician` RLS exactly; below-floor is DB-blocked (`pd_disposition_matches_levels`); the CIMOR packet is built from the signed row (deterministic) + one ephemeral, token-guarded AI prose paragraph.

**WS2.5 surface** (same Assessment tab): an advisory **compliance deadline strip** — `services/complianceClock.ts` (pure, date-only, AI-free) renders the screening 6-mo window / fees-paid gate / 7-day post-completion certificate / DOR windows for the SIGNED determination. Reuses `screeningValidity` + the **extracted `isBalanceSettled` helper** (now shared by the cert completion gate and the clock — defined once, no drift). Display-only — NOT an alert feed (no RiskMonitor overlap); no table (pure-derived).

**Client portal. Nav: Dashboard · My Forms · Appointments · Billing · My Progress.**

| Route | What it does | State |
|---|---|---|
| `/portal/dashboard` | Program overview + Gemini resource finder | REAL |
| `/portal/documents` "My Forms" | Forms library + paper upload | REAL |
| `/portal/billing` | Real balance/charges/payments; "Pay Now" = Stripe **TEST** | REAL |
| `/portal/compliance` "My Progress" | Own SROP progress/score/tasks | REAL |
| `/portal/appointments` | Own upcoming/past appointments | REAL |
| `/portal/forms/:id` | Fill/submit a form (real save) | REAL |
| `/portal/recovery-plan` | Seeded demo data; submit real; AI-suggest stub | PARTIAL |
| ~~`/portal/documents/sign/:id`~~ | **RETIRED (WS5)** — removed; in-form signatures persist in `form_submissions.data` | Removed |

**⚠ Routable but NOT production-real — never demo as working:** ActiveSession SOAP (not persisted) · Analytics (hardcoded, hidden) · AI Documents (black-screens, hidden) · Settings OAuth (simulated) · ProgressTracking analysis (stub) · RecoveryPlanForm (seeded) · Compliance audit-log (read-only, nothing written) · relapse-risk card (hidden). *These are the day-30 landmines — the demo script must route around them.*

**Orphaned-but-real (exist, role-gated, no nav link):** `/compliance-assistant` (Clara co-pilot) · `/video-sessions` + green-room (**a MOCK page — `getVideoSessions` is a hardcoded array, writers no-op; NOT real rows. The real session spine is `appointments` + the Zoom edge fns. Group rosters are UI-only: `Attendee[]`/`capacity` exist but attendees are NOT persisted**). Also: `/compliance` is missing from the desktop sidebar (mobile-drawer only).

---

## 5. In flight

- *Nothing active.* **WS3 (accrual) · WS4 (required-from-determination) · WS5 (forms→cert + join-link)** all shipped (→ §4) — the cert gate now enforces hours + required-total + required-forms-signed, and the forms round-trip is real end-to-end. **Next major: WS6 — standing-groups scheduling remodel** (fixed per-counselor Zoom IDs + a recurring group entity, per the real Zoom-ID list + Therapy/Education schedule), then the messaging fork. Deferred on the session spine: persisted rosters + per-program group caps, Zoom participant-report attendance, iVALT-at-join.

---

## 6. PATH — the roadmap (sequenced)

**Next major (assessment):**
- **WS2 — clinician sign-off + CIMOR packet.** `placement_determinations` table; confirm/escalate-above-floor with logged reason (downward deviation = a **department-approval exception** per §3(E), not a free-text override); the CIMOR-ready packet (deterministic facts + clinician sign-off; AI-narrated prose is the narrate-only showcase, prose-only, never a level). Built on the now-proven engine.
- **WS2.5 — compliance timeline & at-risk alerts.** *(from the ops research — high leverage.)* WS1 computes the *level*; this adds the *clock*. A per-client deterministic case timeline: 6-month screening-window countdown, fees-paid gate (have it), **7-day post-completion certificate deadline**, DOR-notification events — with **at-risk alerts** when any is about to slip. Turns the engine from "proposes a placement" into "protects ACS from a late-cert / missed-window finding." Deterministic dates + flags only (no AI); slots naturally on top of WS2 + the cert pipeline.

**The big operational workstream (where the daily business lives):**
- **Online-session system of record (the "Zoom" enhancement).** ~80–100 clients × weekly online sessions × regulated hour totals (OEP 10 / WIP 20 / CIP 50 / SROP 75-incl-35). The plan: scheduling + rosters (with reg group-size limits); **attendance→hours auto-accrual** via Zoom API participant reports ingested by a Supabase edge fn → feeds the existing completion gate; **iVALT identity at join**; a "your next session" client view with a progress bar; no-show + sequence handling. **Seat/group utilization** (from ops research): show "WIP weekend 10/15 filled," steer a new client into the earliest slot that fits their court timeline — a revenue *and* throughput lever for a group business. **No session recording** (42 CFR Part 2 / consent). SATOP-first. *This is the largest remaining build; sequence after WS2.* **⚠ Recon `/video-sessions` (+green-room) FIRST** — it's orphaned (no nav) but already writes **real Zoom session rows**; some of this infra may exist (see §4b).

**Then:**
- **WS3 — guided online intake funnel** (their book→pay→secure-forms→intake-call→confirm flow, owned in-app; anon INSERT; provisional client → portal account). 42 CFR Part 2 consent becomes load-bearing here.
- **Outcomes dashboards** — completion rates, time-to-certificate, recidivism — **benchmarked by referring court**, with a per-court quarterly snapshot ("here's how your ACS cases performed vs. your docket"). *That's the mechanism for "go-to provider"*: it makes the moat measurable to the people who feed it, not just an internal metric.
- **Audit logging** — the **read-side already exists** (the `/compliance` page renders an audit-log view, §4b), but **nothing writes to it**. The build is the write path: a tamper-evident access/modification log that actually records events. (Recurring backlog item; see §9.)
- **Tailwind Play CDN → real build + dark-mode fix** (coupled; root-cause cluster).
- **Mobile responsive sweep** — client portal is mobile-first **essential**; deep staff pages need "not broken" (desktop-primary). Client-detail/ClientWorkspace overflows on phone width.

---

## 7. WISH LIST / backlog (tiered)

**Real & in-scope, not built:**
- Audit/immutable access log (flagged independently 3×: reg, AI due-diligence doc, business analysis).
- Clara after-hours **phone intake** (Twilio + Gemini Live, server-side) — "Clara answers at 11pm and books the assessment." The demo wow-moment.
- 42 CFR Part 2 granular consent module (needed once WS3 / any disclosure ships).
- **Payment plans / installments at the program level** (from ops research) — structured installment objects in a cash-heavy, plan-heavy practice; each plan knows the ACS-revenue vs. state-remit split and warns if a state amount is unpaid near a reporting/cert event. Builds on the existing ledger.
- **Proactive milestone messaging + per-audience report generation** (from ops research) — SMS/email keyed to milestones ("you're halfway through CIP," "we sent your completion to DOR"); "send to referrer" report actions tailored to court / PO / attorney / DMV, with logging (who/when/whom). Kills the "did you send my paperwork?" calls. (Outcomes-by-court lives in §6.)
- **WS2.5 deadline-clock roll-up (deferred — needs its OWN recon).** Surface the clock's at-risk items in the existing RiskMonitor/Dashboard inbox (practice-wide). Must first recon vs the existing `DEADLINE_IMMINENT` (alertsService) + the `DEADLINE` primitive (complianceEngine) so reasons don't collide or double-count. The per-client Assessment-tab strip shipped in WS2.5; this is only the roll-up. (Surfaced in WS2.5.)
- **`compliance_milestones` table.** Record cert-issued / DOR-sent events so the deadline clock can show a real **closed/"done"** state. Today the clock only shows advisory windows (pending / due-soon / window-elapsed) and never asserts closure — there is no such record to read. (WS2.5 follow-on; enables the clock to clear items.)

**Future modules (the other ~20% — only if David wants them):**
- REACT (note: separate **$60** pass-through to the DOC Correctional Substance Abuse Earnings Fund — *different fund* than SATOP's $249 Mental Health Earnings Fund; the ledger's pass-through logic must handle multiple funds before REACT enters).
- DWI Court, individual counseling, substance-use treatment groups, drug testing, anger management, general assessments.

**Cleanup / debt:**
- The **$900 historical unallocated** (9 succeeded payments, no charge_id, non-demo) — reconcile *with David*; don't guess charge links. + $450 Pat Novak demo-seed cruft to clear.
- `dbIntegrations` dead code in `data/database.ts` (orphaned after Billing.tsx retirement).
- `appointments.client_id` is `text` not `uuid` (SECURITY_BACKLOG #7).
- Legacy clients show negative derived balances (display-layer clamp).
- The relapse-risk card stays killed/feature-flagged (narrate-only violation) unless rebuilt deterministic w/ Karen sign-off.
- **`treatment_plans` table still has `Allow all` RLS** — a real exposure (clinical problems/goals/interventions, unscoped). **→ SECURITY_BACKLOG**; scope to `is_staff` / `my_client_ids` like the other 9 tables. (Surfaced in WS2 recon.)
- **Project-wide default privileges** grant `anon`/`authenticated` full DML on every new public table — only RLS blocks it (confirmed: `assessment_inputs`, which issued no grants, carries the full grant set). WS2's `placement_determinations` is hardened **two-layer** (GRANT + policy); **consider a project-wide REVOKE** so every table matches. **→ SECURITY_BACKLOG.** Pairs with the `treatment_plans` Allow-all item above. (Surfaced in WS2 Phase 1 witness.)
- **AsamAssessment (`/assessments/:id`) shows an AI-generated level** and persists nothing — display-only, so low-stakes, but same narrate-only class as the killed relapse-risk card. WS2 deliberately keys off `computePlacement`, not this. Rebuild deterministic or label clearly if it ever becomes load-bearing. (Surfaced in WS2 recon.)
- **Session hour-type categorization (`hourComponents`) — RESOLVED for SROP (WS3).** `appointments.service_type` + the `client_accrued_hours` view populate `hourComponents`, so SROP's **≥35-counseling** floor is now ENFORCED (total ≥75 AND counseling ≥35). SROP counseling is the **only** per-category floor in 9 CSR 30-3.206 (CIP/WIP/OEP are total-only), so nothing more is needed here. (Was the root blocker from the 3.206 corrections; closed by WS3 categorized accrual.)
- **Cert gate — all THREE determinants now ENFORCED (WS3/4/5).** *Completed hours* from accrual (WS3), *required total* from the signed determination (WS4), and *required forms signed* (WS5 — 3.206(13)(F), `REQUIRED_FORMS_BY_LEVEL`) — **none passes on seed**; no signed determination → "completion not established." Forms persist via scoped client-write RLS + the `form_id` uuid→text fix; `/sign` retired (signatures in `form_submissions.data`).
- ~~**Displays still read static columns**~~ **✅ RESOLVED (WS-DisplayTruth, 2026-06-06).** Every display surface now reads the gate's own sources via `services/displayProgress` (accrual + signed determination + `REQUIRED_HOURS_BY_LEVEL`); the static `srop_hours_completed`/`total_sessions_required` columns **and** the neutralized `completionPercentage` are **unread** by all live surfaces (PortalDashboard/PortalCompliance, ClientOverviewTab, the client-list grid, the staff header, the deadline alert, the progress-% in `api.ts`). **Display == gate.** Columns stay in place pending **#10a** removal (post-WS6). The seeded **"SATOP Level IV — Court mandate"** free-text descriptor remains a referral note (not a computed level; the computed badge reads the determination). The **court report** is the one remaining `completionPercentage` reader — but it's **mock end-to-end** (dead for real clients; SECURITY_BACKLOG #10(d)). (Surfaced WS3/WS4; closed WS-DisplayTruth.)
- **WS5 fix + what's left.** Fixed: `PortalAppointments` keyed its Join button on a non-existent `appt.location` (so it never rendered) → now reads `modality`/`zoom_link`; the real Zoom join-link renders. **Remaining:** **WS6 standing-groups remodel** (fixed per-counselor Zoom IDs + a recurring group entity, per the real Zoom-ID list — the audit's "competent wrong model"), the **messaging fork** (client↔staff async vs staff-internal), **display-legacy cleanup** (the static-column readers above), the **MOCK trend charts** (`getRevenueData`/`getComplianceTrendData` are hardcoded), and **SECURITY_BACKLOG #9** (the two non-SATOP NULL `form_id` rows → permanent "pending" in their portals).
- **Full-pack 3.201→3.206 citation audit** — the corrected SATOP rules now cite 3.206, but the **program umbrella** (`"9 CSR 30-3.201 et seq."`) and the legacy JSON key **`comparable_out_of_state`** were left this sprint. Sweep the rest of the pack for stale 3.201 cites + rename the key (needs a `complianceEngine.buildRuleIndex` update). (Surfaced in the 3.206 corrections.)
- **True out-of-state comparable path not encoded** — 3.206(10)(A)1 (out-of-state = minimum 10h education unless screening indicates more) is distinct from the now-relabeled **Missouri-resident** 120h comparable; not separately encoded. (Surfaced in the 3.206 corrections.)

---

## 8. Open decisions / questions for David (day-30 agenda)

1. **Online sessions** — platform, group/individual mix, how attendance + hours are tracked today (drives the biggest workstream).
2. **Fee schedule** — lock current DMH/ACS figures (`satopFees.ts` is placeholders).
3. **$249 supplemental** — collect-and-remit vs. client pays the state directly.
4. **$900 historical money** — reconcile pre-itemized payments.
5. **Roles** — confirm all-three-staff-operational + clinical-sign-off-clinician-only matches the office.
6. **Outcomes** — which metrics earn court/referral trust.
7. **Karen's methodology sign-off** — the placement rules are now grounded in 9 CSR 30-3.206 (verified Jan-2024 text) and a licensed clinician confirms each determination at sign-off; remaining is the *cadence* for Karen's periodic methodology review (and signing off the SROP ≥35-hour counseling floor once hour-type tracking enables enforcement).
8. **Program portfolio — templates exist; confirm which are *active revenue lines*.** The Treatment Plan Library already ships clinical templates for SATOP III/IV, **Gambling Recovery, Opioid Recovery w/ MAT**, Anger Management, Mental Health, + eval-bridge & aftercare. So the clinical foundation is multi-program. Open question for David: which of these are *active programs with paying clients today* (a template existing ≠ a running revenue line), and how deep to take each **operationally** (scheduling, hour-tracking, placement, billing price-cards) beyond SATOP. SATOP/DUI is ~80% → operational depth stays SATOP-first; the rest ride the shared clinical templates until David says otherwise.

---

## 9. Known gotchas (will recur)

- **Modal/transform trap:** layout's persisted `fadeInUp` breaks `position:fixed` → modals must `createPortal` to `document.body`.
- **`execute_sql` bypasses RLS** — never use it to verify row visibility; use the authed app.
- **Tailwind Play CDN** generates classes lazily → screenshot tool hangs, dark-class races. Verify styling by computed values / eyes-on.
- **Date-only strings:** bare `new Date('YYYY-MM-DD')` parses UTC → shifts a day in Central. Use `new Date(d + 'T00:00:00')`. Daily report buckets use `(ts at time zone 'America/Chicago')::date`.
- **`payments.status`** default is now `'succeeded'` (was `'paid'`); `client_balance()` only counts `succeeded`.
- **`FOR ALL` + `recorded_by = auth.uid()` check** on payments also runs on UPDATE → void/refund of a Stripe-origin (`recorded_by = NULL`) row will reject; handle with a `voided_by` column when WS-void lands.
- **Trial-mode hidden routes:** currently Analytics + AI Documents (Financials was un-hidden for Director/Admin). Docs/user-guide must not describe hidden features as available.
- **Clara voice = ephemeral-token flow, NOT raw key.** Clara uses `gemini-live-token` edge fn → `GoogleGenAI({ apiKey: token.name, httpOptions:{ apiVersion:'v1alpha' }})`. The `gemini-live-voice-fix` skill still teaches the older raw-`VITE_API_KEY` pattern — do **not** let a future session "fix" Clara backward into a raw key; the ephemeral token is the more secure, working form. (`v1alpha` = API-version select, not the websocket-breaking `apiProxy`.) Skill itself is due an update.

---

## 10. Infra & repo anchors

- **Repo:** `westerns1978/acs-therapyhub-forms-012026` · **Local:** `C:\Users\dlwes\Documents\WestFlow\acs-therapyhub\012026\acs-therapyhub-forms-012026`
- **Stack:** Vite + React 19 + TS; Supabase (Postgres + edge fns + auth); jsPDF (client-side); Tailwind Play CDN (⚠ migrate — §6).
- **Supabase:** `ldzzlndsspkyohvzfiiu` (shared multi-app — namespace ACS secrets `ACS_*`; single-tenant, role-scoped, no `org_id`).
- **Firebase:** project `gen-lang-client-0121881478`, site **`acs-therapyhub`** → https://acs-therapyhub.web.app
- **Deploy:** `npm run build` → `firebase deploy --only hosting:acs-therapyhub`. Merge to main first.
- **Stripe:** TEST mode; ACS-namespaced secrets (`ACS_STRIPE_WEBHOOK_SECRET_TEST`); webhook `org=acs` guard. ⚠ A real Stripe HTTP round-trip has never run end-to-end — watch the first real card payment.
- **Demo logins:** `demo.director` / `demo.therapist` / `demo.admin` @acs-therapyhub.com — pwd `acs-demo-trial-2026!`. Marcus Reyes = mid-program demo client.
- **Reg of record:** 9 CSR 30-3.206 (current to Jan 30 2024) — verified to match the encoded placement rules.

---

## 11. Where ACS sits in Gemynd

One of several Gemynd products (Story Scribe is the lead pillar via NFDA Charlotte; the WestFlow/capture suite — FlowView, Katie, FlowHub/TWAIN — is pillar two; AIVA, Wissums, ACS round it out). ACS is a **funded pilot with recurring revenue** and the clearest "deterministic-engine + narrate-only" exemplar of Gemynd's method. Shares the Supabase/Firebase fabric with the rest.

---

## 12. The discipline that's kept this clean (read before any sprint)

Recon-first → present migration & stop for approval → build → **witness** (the real proof, not "it compiled") → merge → build → deploy → push. Every sprint this week caught at least one wrong assumption *because* of the witness step (the `untied=$1350` canary; the Therapist-could-already-create-clients finding; the screening-validity-vs-DRI2 correction; the SUD-false truth-table row). Trust the witness over the summary, every time.

---

## 13. Maintaining this map (recursive improvement)

The map only compounds if it stays current. Lightweight ritual:

1. **End every Claude Code sprint by updating this file** — add a line to §4 (or §5/§6 as state moves), bump the `Last updated` date, append the commit to the trail. Make it the last item in each sprint's Definition of Done.
2. **This doc is what a fresh chat reads.** Kickoff prompts say "read `ACS-TherapyHub-MAP.md` at repo root first." It replaces re-explaining context.
3. **Decisions get recorded here, not just in chat** — when David answers a §8 question, move it from "open" to a one-line decision in the relevant section.
4. **Keep the wishlist honest** — when a backlog item ships, move it to the map; when a new one appears mid-sprint, log it in §7 rather than letting it live only in a chat thread.
5. **Quarterly (or pre-day-30) review** — re-read top to bottom, prune what's stale, re-sequence §6 against what David now wants.

The point: the map is the memory. Chat threads are where work happens; this file is where the *state* lives.

### 13a. ✅ One-time true-up — DONE (2026-06-06)

**Ran.** A recon-only repo/router walk reconciled the live surface; findings folded into **§4b** (full route inventory + REAL/MOCK/PARTIAL tags + demo landmines + orphaned-real routes). Root cause of the original miss: §4 was assembled from **chat history, not a repo walk**, so it silently scoped to recent build work and omitted the inherited surface (Treatment Plan Library, etc.). **Standing lesson:** "what's live" entries must be **witnessed from the app/repo**, never reconstructed from memory — the same recon-before-assert rule the build sprints follow. Re-run a §4b true-up after any sprint that adds/removes a route.