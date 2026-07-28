-- K3 (2026-07-28): clear the three rows J3/K2 HELD because they carried real
-- clinical artifacts. Each was verified individually first; the artifact that
-- caused the hold turned out, in every case, to be itself a test artifact.
--
-- 4ebd1879 — the $250 "succeeded" Stripe payment is TEST MODE. Proof is in the
--   stored checkout-session id: `cs_test_…`. Stripe emits `cs_live_` for live
--   mode, so the prefix is definitive, not inferred. The event id also carries
--   the known sandbox account fragment (…PfjwLkSnCQ). Live keys were never
--   configured for this project. A sandbox ledger row is not a real payment.
--
-- dd9098b2 — BOTH identity signals confirmed: primary_phone uses the 555
--   reserved-fiction exchange, and the email domain is non-deliverable/joke.
--   Flagged DESPITE the signed level-III determination, because the signature
--   is on a fictional identity. (Its "signed" note also carries no clinician.)
--
-- cd24234c — same 2026-07-14/15 staff-walk batch as four rows already flagged
--   in K2 (batch window 07-14 16:47 → 07-15 15:52; this row lands 07-15 02:00,
--   inside it). Corroborated structurally: its 3 "signed" clinical notes have
--   therapist_id NULL and appointment_id NULL — a genuinely signed note has a
--   signing clinician. Same profile as the already-flagged demo notes.
--
-- PREDICATE VOCABULARY — add for future sweeps, alongside J3's P1 vendor-domain
-- email / P2 fixture uuid and K2's P3 zero-clinical-activity:
--   P4  RESERVED-FICTION PHONE PREFIX — the 555 exchange (NANP 555-01xx is
--       reserved for fiction; the whole 555 prefix is non-assignable in
--       practice). No real client can be reached on one.
--   P5  NON-DELIVERABLE / JOKE EMAIL DOMAIN — a domain that does not accept
--       mail. Distinct from J3's P1: P1 is the VENDOR's own real domain,
--       P5 is a domain that exists only as a punchline.
--   P6  TEST-MODE PAYMENT PROVENANCE — a payment whose provider object id
--       carries a test-mode prefix (`cs_test_`, `pi_test_`, `evt_` from a
--       sandbox account). Such a row must never count as real money.
-- P4/P5 are IDENTITY signals and so are weaker than P1/P2 provenance: use them
-- to CONFIRM a candidate, never to sweep a population unattended.
--
-- Ids are PINNED from the dry-run SELECT printed in-session. NO deletes.
-- Rows stay reachable via the per-user "Show demo data" setting (Settings)
-- through config/demoData.ts applyDemoFilter().
--
-- DOWN-PATH (exact reverse; all three were is_demo=false before this ran):
--   UPDATE clients SET is_demo = false WHERE id IN (
--     '4ebd1879-9235-4b62-a631-0958989ca5c4',
--     'dd9098b2-b24b-472a-a8ea-a635c510884e',
--     'cd24234c-263e-4115-b4d3-0abe97b47c43');

UPDATE clients SET is_demo = true
WHERE id IN (
  '4ebd1879-9235-4b62-a631-0958989ca5c4',
  'dd9098b2-b24b-472a-a8ea-a635c510884e',
  'cd24234c-263e-4115-b4d3-0abe97b47c43'
) AND is_demo = false;
