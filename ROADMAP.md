# ACS TherapyHub — Roadmap

Three buckets. Keep terse; one line per item. Newest on top within a bucket.

## SHIPPED
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
- **Density & calm pass (cosmetic)** — holding for GO to merge+deploy. Four surfaces, presentation-only
  (no query/schema/route/logic change, same clients/counts/routes): (1) Dashboard — big stat tiles →
  thin inline strip; Clinical Guardrails calmed (smaller heading, neutral cards w/ thin accent vs wall
  of red/amber); schedule already leads. (2) Client grid — avatars w-20→w-14; "Not yet established"
  filler muted, empty 0% bar dropped. (3) Forms — per-card badges capped to category + muted time
  (difficulty/tags dropped); floating "Available Forms" card folded into header text. (4) Nav — daily
  work leads (Dashboard/Calendar/Clients/Forms); Compliance Risk + Treatment Plan Library + Financials
  tucked under the Reports divider. Branch `feat/density-calm`.
- **Client-type token set — 3 open questions for the David call** (the straw-man revision; resolving
  these is a one-migration change: drop+recreate `clients_client_type_check` + edit `config/clientType.ts`):
  1. **DWI Court / MRT** — counselors run it (Debra; David's block bundles DWI Court) but there is NO
     bookable `AppointmentType` and NO `client_type` token for it. Own type, or folded under SATOP?
  2. **Opioid Recovery** — v1 maps `program_type=OPIOID_RECOVERY` → `RELAPSE_PREVENTION`. Should opioid
     be its own client_type, or does Relapse Prevention / Outpatient correctly absorb it?
  3. **REACT** — the `REACT Group` service is mapped under Relapse Prevention. Should REACT be its own
     client_type rather than collapsed into RELAPSE_PREVENTION?

## ROADMAP
- **Capability filter (client-type v2 / NEXT PHASE)** — the capability matrix: `client_type` →
  eligible counselors/calendars, narrowing the scheduler so a client of type X can only be booked
  with credentialed staff. Ground exists today only as the `groups` table (counselor→program/
  session_kind map); no dedicated capability column. Also: DWI Court / MRT have counselors (Debra)
  but no matching bookable `AppointmentType` — a service-vocabulary gap to close here.
