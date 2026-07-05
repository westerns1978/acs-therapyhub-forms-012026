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
