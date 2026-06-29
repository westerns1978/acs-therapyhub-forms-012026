# ACS TherapyHub — Roadmap

Three buckets. Keep terse; one line per item. Newest on top within a bucket.

## SHIPPED
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
- **Real staff accounts (de-demo) — SHIPPED pending GO** (code witnessed, holding for GO to
  merge+deploy; the name change is already LIVE in Supabase). Stripped the "(Demo X)" suffixes from
  the three live ACS staff accounts so they read as real people: Director → "David Yoder", Therapist
  → "Karen Ventimiglia", Admin → "Jessica". Source = `auth.users.raw_user_meta_data.full_name`
  (updated for the 3 ACS rows only, roles preserved); code lists aligned in `authService.ts`
  (DEMO_ACCOUNTS) + `pages/Login.tsx` (demoRoles). All three log in clean to the correct role surface
  (David→Director, Karen→Therapist/clinical, Jessica→Admin ops). Branch `feat/real-staff-accounts`.
  Calendar scope deliberately untouched (still all-counselor — David's call).
- **Client-type token set — 3 open questions for the David call** (the straw-man revision; resolving
  these is a one-migration change: drop+recreate `clients_client_type_check` + edit `config/clientType.ts`):
  1. **DWI Court / MRT** — counselors run it (Debra; David's block bundles DWI Court) but there is NO
     bookable `AppointmentType` and NO `client_type` token for it. Own type, or folded under SATOP?
  2. **Opioid Recovery** — v1 maps `program_type=OPIOID_RECOVERY` → `RELAPSE_PREVENTION`. Should opioid
     be its own client_type, or does Relapse Prevention / Outpatient correctly absorb it?
  3. **REACT** — the `REACT Group` service is mapped under Relapse Prevention. Should REACT be its own
     client_type rather than collapsed into RELAPSE_PREVENTION?

## ROADMAP
- **Per-counselor accounts + calendar scoping (gated on David's call)** — today there are 3 shared
  role personas (Director/Therapist/Admin), not per-person counselor logins. To give each counselor
  their own day: (a) the 4 absent counselors (John, Rick, Bill, Debra) need real accounts; (b) link a
  login to its `counselors` row — `counselors` has NO `user_id`/`email` column today, so the link is a
  small migration (add `counselors.user_id` + populate); now that Karen's account name matches the
  `counselors` row ("Karen Ventimiglia"), a name-match would also work but is fragile. The link is
  mechanically TRIVIAL; the REAL work is the per-counselor scoping it enables (an RLS predicate +
  a "my sessions" calendar filter) — which David explicitly deferred (calendar stays all-counselor).
- **Capability filter (client-type v2 / NEXT PHASE)** — the capability matrix: `client_type` →
  eligible counselors/calendars, narrowing the scheduler so a client of type X can only be booked
  with credentialed staff. Ground exists today only as the `groups` table (counselor→program/
  session_kind map); no dedicated capability column. Also: DWI Court / MRT have counselors (Debra)
  but no matching bookable `AppointmentType` — a service-vocabulary gap to close here.
