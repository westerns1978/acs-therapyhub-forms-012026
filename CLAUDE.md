# ACS TherapyHub — working notes

Terse, read every session. See ROADMAP.md for SHIPPED / IN-FLIGHT / ROADMAP.
See [docs/DOMAIN-MODEL-2026-07-15.md](docs/DOMAIN-MODEL-2026-07-15.md) before touching the
group/note domain — notes are 1:1 not 1:N, appointment fields (not notes) are the source of
truth today, and there are 5 competing service/program vocabularies. Facts only, cited, do not
re-derive.

## Two distinct client axes — do NOT conflate
- **`program_type`** = CLINICAL placement (SATOP / OEP / WIP / CIP / SROP / OPIOID_RECOVERY /
  GAMBLING_RECOVERY / ANGER_MANAGEMENT / INDIVIDUAL_COUNSELING). CHECK-enforced. Drives the
  determination / completion gate (the level source). Normalize via `config/programVocab.ts` —
  never compare a raw `program === 'SATOP'` literal.
- **`client_type`** = OPERATIONAL / scheduling-funnel category David asked for (6-token straw man:
  SATOP / DOT / RELAPSE_PREVENTION / ANGER_MANAGEMENT / GAMBLING_RECOVERY / INDIVIDUAL). CHECK-
  enforced (migration 20260629), nullable (untagged = null). Labels in `config/clientType.ts`.
  Read-only display today (badge on card + header). The eventual job: narrow which staff/calendars
  a client can be scheduled with. Tokens WILL change post-David — revise the one CHECK + clientType.ts.

## Staff-capability ground (for the next-phase capability filter)
- There is **no dedicated capability table/column**. `counselors` is minimal (id, name, zoom, active).
- The de-facto **counselor → service map is the `groups` table** (`counselor_id` + `program` +
  `session_kind` + `service_type`), seeded from the 7/31/24 ACS Zoom sheet (WS6). e.g. David →
  CIP/SROP/OP/DOT; John/Rick → O/P/CIP/SROP + R/P; Bill → individuals; Karen → individuals + intakes;
  Debra → DWI Court + MRT. That table is the ground the `client_type → eligible counselors` matrix
  will sit on.

## Shared DB caution
- Supabase `ldzzlndsspkyohvzfiiu` (westflow-platform) is multi-app. Scope every data write to ACS
  rows only. `clients` is ACS-owned (ACS-specific CHECK constraints); messaging shares
  `client_communications`. Demo seeds use the `dee0…` id namespace (idempotent + revertible).
