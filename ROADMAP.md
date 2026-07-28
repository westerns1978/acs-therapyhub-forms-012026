# ACS TherapyHub — Roadmap

Three buckets. Keep terse; one line per item. Newest on top within a bucket.

## SHIPPED
- **Forms library 11 → 14 (wired built-but-dormant forms)** — MERGED `4cdafd5` + DEPLOYED live
  2026-06-29 (acs-therapyhub.web.app; entry `index-DAhFJLrE.js`, library chunk `Forms-DKqfQ85T.js`).
  Surfaced HIPAA Notice Acknowledgement, Telehealth Informed Consent, Late Cancellation Policy (all
  LEGAL) into `allForms` + `View` union (`FormLibrary.tsx`) + the `Forms.tsx` switch. Library shows 14;
  each opens and renders its real fields; original 11 unaffected. Pure surfacing — no content/field
  edits; dead-twin duplicates left logged (see ROADMAP).
- **Real staff accounts (de-demo)** — MERGED `de3b42d` + DEPLOYED live 2026-06-29
  (acs-therapyhub.web.app; entry `index-B5r9Y3wn.js`, login chunk `Login-CKR1oUma.js`). The three live
  ACS staff logins read as real people, not demo personas: Director → "David Yoder", Therapist →
  "Karen Ventimiglia", Admin → "Jessica". Runtime source = `auth.users.raw_user_meta_data.full_name`
  (3 ACS rows, roles preserved); code lists aligned (`authService.ts` DEMO_ACCOUNTS, `pages/Login.tsx`
  demoRoles). All three log in clean to the correct role surface; no "(Demo" suffix anywhere (bundle +
  live metadata witnessed). Calendar stays all-counselor by design.
- **Density & calm pass (cosmetic)** — MERGED `ded7d1d` + DEPLOYED live 2026-06-29
  (acs-therapyhub.web.app; entry `index-KzH6pJ3r.js`). Presentation-only across four surfaces, no
  query/schema/route/logic change (16 clients, 11 forms, 10 nav links unchanged): Dashboard big stat
  tiles → thin inline strip + calmed Clinical Guardrails; client grid avatars w-20→w-14 + muted "Not
  yet established"; Forms per-card badges capped to category + muted time, floating count folded into
  header; nav daily-work-first with the compliance/reporting cluster tucked under the Reports divider.
- **client-type v1 (tag + badge)** — MERGED `ec7ef4d` + DEPLOYED live 2026-06-29
  (bundle `ClientWorkspace-xbTCsnYk.js` on acs-therapyhub.web.app). `clients.client_type` tightened
  to a 6-token CHECK (`SATOP / DOT / RELAPSE_PREVENTION / ANGER_MANAGEMENT / GAMBLING_RECOVERY /
  INDIVIDUAL`); 24/28 ACS test clients tagged (derived from `program_type`; 4 prospects null).
  Read-only badge on client card + detail header. Migration `20260629_client_type_check_and_tag.sql`,
  `config/clientType.ts`, `components/clients/ClientTypeBadge.tsx`. Tokens are a straw man — revise
  after David's call (drop+recreate the one CHECK + edit clientType.ts).
- **last/next booked glance** — per-client most-recent-past + next-upcoming appointment on the
  client header. `getLastAppointment`/`getNextAppointment` (services/api.ts).

## ⛔ TRIAL_MODE FLIP — BLOCKED (release gate, not a backlog item)

**Do not flip `TRIAL_MODE` as a convenience.** It is a single boolean in
`config/trialMode.ts` that simultaneously exposes **six** surfaces:

`/video-sessions` · `/communication-center` · `/program-compliance` · `/portal/recovery-plan`
· `/compliance` · `/session/:clientId`

Each was hidden because it was **broken or dishonest**, not because it was unfinished. Hiding is
containment; the defects are all still in the code. **Every one must be individually verified and
released on its own** — the flag is not a release mechanism.

**Known blocker — `pages/portal/RecoveryPlanForm.tsx:44`.** It carries the unscoped-draft bug
class that was fixed elsewhere on 2026-07-27 (`const LS_KEY = 'recovery_plan_draft_1';` with the
author's own comment *"Use client ID in real app"*). It is also hardcoded to `clientId '1'` and is
a phantom twin of the honest registry form. That is **cross-client data bleed in a 42 CFR Part 2
client-facing surface** — it must be fixed before this route is ever un-hidden.

The 2026-07-27 draft fix deliberately did **not** touch that file: half-fixing a hidden phantom
would have implied it was safe to expose. It is not.

## NEXT

- **Native Standard Means Test (MO 650-0216) — STAFF console, not client intake.** David 7/21:
  too complex to hand a client; staff will run it. Auto pay-period conversion → total →
  rate-table lookup → certification e-signature → structured determination flowing to billing,
  Notice of Cost (MO 650-0215), completion cert (MO 650-7743).
  Design: `docs/design/means-test-native-direction.html`

- **Client messaging / delivery layer (Twilio SMS candidate).** David 7/21 named "verify
  communication — ensure all communications reached the target recipient and processed
  correctly" as a production blocker. There is nothing to verify today: the app has NO outbound
  email or SMS of any kind (no provider, no edge function, `mailto:` links only), so every
  artifact the compliance spine produces reaches the client by hand. Recon: `RECON-messaging-2026-07-27.md`.
  Gated on 10DLC registration status. First schema addition will be contact-consent capture.

## HONESTY SWEEP BACKLOG (2026-07-27)

Full findings with verbatim strings, file:line, and severity: `SWEEP-acs-2026-07-27.md`
(40 live findings — 13 CLIENT-VISIBLE, 18 STAFF-VISIBLE, 9 INTERNAL groups, 4 AMBIGUOUS).
Four were closed on branch `fix/honesty-critical-2026-07-27` (tag `honesty-critical-2026-07-27`):
certificate chain, portal Clara, `/compliance`, `/session/:clientId`. **Everything below is open.**

### Four items called out explicitly

1. **`pages/ClientList.tsx` — FOR DELETION.** Unreachable dead code (`/clients` routes to
   `ClientWorkspace`; nothing imports this file). Contains five fully-styled action modals whose
   submit handler is `console.log` + close — including *"This will be securely transmitted to the
   Missouri Department of Revenue"* (:153), *"Process & Issue Certificate … will finalize their
   record"* (:212), a "Send Compliance Alert" addressed to a probation officer, and an "Update
   Court Status" select offering **"Warrant Requested"**. Harmless today because it is routed at
   nobody; catastrophic if ever revived. Delete rather than fix. (Also the last importer of the
   retired `SignedDocument` type.)
2. **Three orphan seed rows in `form_submissions` — DB cleanup, not a code fix.** All in the
   `e1000000-…` id namespace, all `status='Completed'`, all carrying `"signed": true` in their
   payload: "Gambling Recovery Intake" and "Opioid Recovery Intake" (both `form_id = NULL`,
   matching no catalog anywhere in code) and the phantom below. The Opioid narrative still names
   **"Dr. Anya Sharma"** — the fabricated clinician that commit `bbf805c` removed from
   `/compliance`. The display was fixed; the seed text was not. `data/database.ts` also still
   carries her across ~10 mock rows (audit trail, activity feed, appointments).
3. **The phantom — "Individual Comprehensive Treatment Plan"** (`config/formRegistry.ts:45`).
   Registry entry with **no component, no route, no card**, yet `getFormTemplates` publishes it as
   assignable and `assignForm` (which is real) inserts a live `form_submissions` row whose
   **Fill Out** button dead-ends silently at `/forms?open=treatment-plan`. One `Completed` row
   exists (client `dddd…`) and is **client-visible** in PortalDocuments' "My Forms".
   **The row stays untouched — it goes to David as a finding, not a scrub.**
4. **Everything hidden by `config/trialMode.ts` goes LIVE the moment `TRIAL_MODE` flips.** That is
   now eight surfaces: `/reporting`, `/document-intelligence`, `/video-sessions`,
   `/communication-center`, `/program-compliance`, `/portal/recovery-plan`, plus the two added
   2026-07-27 (`/compliance`, `/session`). Hiding is containment, not repair — each still contains
   its original defect. Treat the flag as a release gate, not a cleanup.

### By category (severity carried from the sweep)

**A — Registry/config with no implementation (7).** The phantom (above); "Completion Certificate"
document category with no producer (`ClientDocumentsGrid.tsx:29-33` — no code path can ever write
that `document_type`); 5 of 9 Missouri compliance-pack program nodes unreachable = **12 orphaned
rules** (CSTAR, GROUP_THERAPY, REACT, CONSENT_42CFR2, WAITLIST); 3 of 4 `ComplianceEvent` types
with no producer; `dbIntegrations` listing QuickBooks as `'Connected'` with no QuickBooks code
anywhere; retired `SignedDocument` type. *STAFF-VISIBLE / INTERNAL.*

**B — UI copy claiming unwired capability (10).** `PrintPreview.tsx` prints three unbacked
attestations on court/DOR-facing paper — a hardcoded fake `ENCRYPTION HASH: 0x8B1E24…` + "HIPAA
SECURE NODE 04" (:99), "ELECTRONICALLY COMMITTED VIA THERAPYHUB AUTH" (:85), and "SYSTEM
TIMESTAMPED" that is **render time, not signing time** (:93); "A high-fidelity copy has been
attached to your patient file" (`SuccessScreen.tsx:38` — no document is created); "Reminder sent
to client via Push & SMS" (`ClientFormsTab.tsx:192`); "Requires verified staff credentials for
submission" (`FormDetailModal.tsx:63` — no credential store exists); push-notification enablement
copy; the `MeetingSummary` feature deck. *CLIENT-VISIBLE / STAFF-VISIBLE.*
→ **`PrintPreview` is the highest-value remaining item.** It is client-, court-, and
auditor-facing, and `npm run check:forms` guards it byte-for-byte, so changing it requires
re-baselining deliberately.

**C — Status labels settable without the artifact (16).** The structural one: the certificate
gate's *"Required forms signed"* verifies only a status string written unconditionally on submit
(`complianceEngine.ts:733-742` ← `BaseFormTemplate.tsx:194`); every live "signature" is a
`type:'text'` field the user types their own name into. Also: a `Reviewed` row counts as signed
with `reviewed_by` nullable; "AI Verified: Signature Detected" is an unscored LLM boolean
(`ClientFormsTab.tsx:109`); "Click to Apply Digital Signature" flips a React boolean into
`clinical_notes.is_signed`, which has no signer and no `signed_at`; the treatment-plan review
clock starts from an **empty, unauthored** plan row while the Treatment Plan tab simultaneously
says "Plan content not yet authored"; "Signed \<date\>" on the overview card is `submitted_at`;
an unconditional green **SECURE** shield on every document card. *Mostly STAFF-VISIBLE; the gate
chain is CLIENT-VISIBLE.* **Largely subsumed by the WO-2 signature build.**

**D — Numbers from a mock, constant, or stub (7).** `/compliance` score + CSV (contained by the
hide); the CSR alert timeline reading one hardcoded event; hardcoded revenue-by-program and an
invented 88→98% compliance trend (`api.ts:1633-1640`, behind the `/reporting` hide); an
"Achievements" badge count that is **structurally always 0** (`gamification` is not a column);
briefing streak/completions constants; a `Math.random()` fallback "Form ID" shown to clients as a
reference number for a court-facing form (`BaseFormTemplate.tsx:225`). *CLIENT-VISIBLE for the
last one.*

**E — Shipped features quietly doing nothing (15).** `addSessionRecord` and `addClientAssignment`
are **empty function bodies** (contained by the `/session` hide, but the functions remain);
`billable_units` — writer is correct but **no enabled control saves it** on an already-Completed
row, which is every one of the 262 rows; `group_enrollments` has **zero readers** while GreenRoom
calls the roster "enrolled" three times; Green Room Present/Absent is React state that never
persists; `appointments.capacity` is collected and stored but **never read**; three dead buttons
in the client billing portal (Update Method / Download Tax Statement / **Insurance Claims**); a
header notification bell with a permanent unread dot and no handler; ⌘K advertising two
trial-hidden routes (the palette is the one entry point that does **not** filter through
`isTrialHidden`); the "Saved Draft %" panel that can never render; `tasks`/`outreach_log` written
to with **no reader anywhere**; 7 unrouted pages + 18 unreferenced components.
→ **Form-draft cross-client bleed: FIXED 2026-07-27** (branch `fix/deploy-build-and-draft-scope`).
Drafts are now keyed `acsdraft:v2:<formId>:<clientId>`, legacy `draft-*` keys are destroyed on
form mount, and both the staff and portal render sites are keyed so a client change remounts the
form. Still open: **`RecoveryPlanForm.tsx:44`** carries the same bug class behind the trial hide —
see the TRIAL_MODE gate at the top of this file.
→ **`FormLibrary.tsx` "Saved Draft %" panel — DEAD UI, delete in a cleanup branch.** It has never
rendered: `BaseFormTemplate` writes only `{ formData }` and never a `progress` key, so the
`progress > 0` condition gating the panel is always false, and the "Continue" vs "Start" button
label has always read "Start". As of 2026-07-27 its probe is hard-nulled with a comment (the
library has no client context, so it cannot look up a client-scoped draft). Either wire it to a
real per-client lookup or remove the panel and its button-label branch — do not restore the
unscoped key.

**F — AI prompts asserting absent capabilities (9).** Portal Clara is unmounted (closed), but the
**staff** prompt still promises to "Surface clinical priorities for today: pending intakes, due
court reports, missed sessions, approaching compliance deadlines" and "Answer questions about
client records, program progress, session schedules, and billing status" — all ABSENT; the only
real capability is `navigate_to_page`. Staff Clara is lower risk than the client build was
(clinicians can sanity-check her) but the persona should be scoped to what she can actually see.
`pds-gemini-proxy` holds **no** system prompt — it is a transparent key-injecting passthrough, so
there is no tenant leak; `cimorPacket`'s prompt is a clean, fact-fed, hard-constrained example
worth copying. *STAFF-VISIBLE.*

**AMBIGUOUS — need a human decision, not a code change (4).** "E-sign pending forms" (a typed
name may satisfy ESIGN/UETA; **attribution** is the gap — legal call); "Certified by the Missouri
Division of Behavioral Health" on the public landing page (a business fact — verify against the
certification paperwork, don't edit from the code side); "HIPAA-compliant clinical forms" (an
organizational/BAA posture — note drafts autosave to unencrypted `localStorage`); `tasks` /
`outreach_log` (cannot confirm the tables exist live — but either way there is no reader).

## IN-FLIGHT
- **WS2 group check-in → chart distribution (branch `feat/group-checkin-distribute`, no-deploy pass)** —
  `distributeGroupNote()` posts one group note into each present attendee's chart, stamping that
  attendee's own `appointment_id` + `note_type='Group Session'` and looping the existing
  `saveClinicalNote` (clinician-only RLS, untouched). UI is a "who's in the room" check-in card on
  GreenRoom (group sessions only). **Idempotency = Option C, DB-enforced**: migration
  `20260705_group_checkin_1_clinical_notes_group_seat_unique.sql` adds a partial unique index
  `ux_clinical_notes_group_seat on clinical_notes(appointment_id) where note_type='Group Session'`,
  so a re-post raises 23505 → classified `alreadyPosted` (no duplicate, no double-count). **RELEASE
  ORDER: apply the migration to live BEFORE deploying the bundle** — without the index the 23505
  guarantee is absent and a re-post double-charts. **DEFERRED delta**: attendance persistence —
  Present/No-Show is React-state only (no `attendance_status` column) until David asks to record it;
  MVP is note distribution only.
- **Client-type token set — 3 open questions for the David call** (the straw-man revision; resolving
  these is a one-migration change: drop+recreate `clients_client_type_check` + edit `config/clientType.ts`):
  1. **DWI Court / MRT** — counselors run it (Debra; David's block bundles DWI Court) but there is NO
     bookable `AppointmentType` and NO `client_type` token for it. Own type, or folded under SATOP?
  2. **Opioid Recovery** — v1 maps `program_type=OPIOID_RECOVERY` → `RELAPSE_PREVENTION`. Should opioid
     be its own client_type, or does Relapse Prevention / Outpatient correctly absorb it?
  3. **REACT** — the `REACT Group` service is mapped under Relapse Prevention. Should REACT be its own
     client_type rather than collapsed into RELAPSE_PREVENTION?

- **Forms content reconciliation (from the 2026-06-29 recon — content is REAL, these are nits)** —
  (a) **Consent for Treatment**: reconcile the payment-terms / "Responsibility Agreement" portion
  against David's source PDF (`Consent for Treatment and Responsibility Agreement.pdf`); the $40 fee +
  core terms are present but the 14-day payment clause and the "Responsibility Agreement" framing are
  thinner than the PDF. (b) **SATOP Client Intake**: program-track labels use generic `12-Week /
  16-Week Track` — switch to the SATOP level vocabulary (OEP/WIP/CIP/SROP) the rest of the app uses.
  (c) **Dead-twin export cleanup**: remove the unused duplicate definitions `CONSENT_TREATMENT_DEFINITION`
  (`ConsentTreatmentFormDef.tsx`, shares id `consent-treatment`) and `RECOVERY_PLAN_DEFINITION`
  (`RecoveryPlanFormDef.tsx`) — logged, not touched this pass.
- **All-staff accounts + self-serve provisioning + counselor identity link (post-pilot)** — DECISION:
  all staff see the shared practice calendar by design (10-person shop, everyone lives in it) — NO
  per-counselor visibility scoping. The engagement instead: (a) real per-person accounts for all staff
  (incl. the 4 counselors without logins — John, Rick, Bill, Debra); (b) a self-serve provisioning UI
  to create/role accounts (today roles are set by hand in `app_metadata`); (c) a `counselors.user_id`
  identity link for ATTRIBUTION — name-on-blocks ("whose session"), not visibility scoping. The link
  is a small migration (add `counselors.user_id` + populate); the value is identity, not filtering.
- **Capability filter (client-type v2 / NEXT PHASE)** — the capability matrix: `client_type` →
  eligible counselors/calendars, narrowing the scheduler so a client of type X can only be booked
  with credentialed staff. Ground exists today only as the `groups` table (counselor→program/
  session_kind map); no dedicated capability column. Also: DWI Court / MRT have counselors (Debra)
  but no matching bookable `AppointmentType` — a service-vocabulary gap to close here.
