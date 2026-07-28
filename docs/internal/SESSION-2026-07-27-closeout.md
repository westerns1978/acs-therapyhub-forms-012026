# Session close-out — 2026-07-27 / overnight into 07-28

Cold-start brief. `main` clean, synced, nothing uncommitted, no open branches.

---

## Shipped tonight

| Tag | What |
|---|---|
| `honesty-critical-2026-07-27` | Certificate chain corrected (unconditional SAMPLE banner + watermark, no fabricated completion date, blank certificate number, honest attestation, packet cover fixed); Clara unmounted from the client portal; `/compliance` and `/session/:clientId` trial-hidden; welcome-email claim removed from Create Client |
| `deploy-build-and-draft-scope-2026-07-27` | `npm run deploy` builds before deploying; form drafts scoped per (form, client) with legacy drafts destroyed, plus React keys on both form render sites |
| `client-scope-bleeds-2026-07-27` | `tsc --noEmit` added to the deploy chain; four client-scope state-bleed fixes (SmartNoteImporter misattribution, CreateClientModal structural unmount, AsamAssessment state clear, ClientWorkspace `key={clientId}`) |

Docs committed (no tag): `RECON-acs-2026-07-27.md`, `SWEEP-acs-2026-07-27.md`,
`RECON-messaging-2026-07-27.md`, `RECON-aiva-signatures-2026-07-27.md`,
`DESIGN-signatures-2026-07-27.md`, three client docs under `docs/client/`,
`docs/design/means-test-native-direction.html`, and ROADMAP restructuring.

---

## Deployed live right now

- **Current: `index-BhiB5qhp.js`** — verified served == local dist, and verified executing in-page.
- Last verified-good before it: `index-Ci1a9WXt.js`.
- Earlier tonight: `index-DzSBB4eP.js`. Session started on `index-DakGBAfZ.js` (tip `a070ab9`).
- Deploy chain is now **typecheck → build → cross-deploy guard → upload**. Both new gates were
  proven by deliberate failure: build gate aborts on a syntax error, typecheck gate aborts on a
  pure type error, and in both cases Firebase was never invoked and the live hash was unchanged.

---

## Signature build (Part C) — PROPOSED, NOT STARTED

Design: `DESIGN-signatures-2026-07-27.md`. Nothing applied, no migration, no code.

Shape: drawn canvas is the default and the compliance path; AIVA's script-font picker is a
clearly-labelled fallback, excluded from staff attestations. Take AIVA's architecture
(capture once → persist → reuse across documents), not its posture (base64 in a jsonb column,
public bucket, client-generated timestamps, unpersisted consent).

**Four decisions open — this is blocked on you:**
1. Re-auth for staff attestations — password re-entry, or is an active session enough?
   (Recommend re-entry.)
2. Correction workflow — supersede-only (recommended, matches `placement_determinations`) or
   amend-with-history?
3. Styled fallback for staff — recommend excluding entirely. Confirm.
4. Consent wording — stored verbatim in `consent_text`, so the exact sentence needs approving by
   someone who can speak to ESIGN/UETA.

**Estimate: 7–11 working days** across six phases; **4–6 days for the first shippable increment**
(capture + storage + backfill + the six consent forms).

Backfill counts (queried live): `form_submissions` 23 `typed` / 31 `unsigned` — the 31 includes
2 demo placeholder strings that must **not** migrate as real signatures. `clinical_notes`
15 `legacy_boolean` (only 4 carry any `therapist_id`) / 7 `unsigned`.
`placement_determinations` needs no backfill and is the precedent being copied.

---

## Group scheduling

**1.5–2.5 weeks. Cannot land before Aug 1** — David gets a mid-August date.
Membership and add/drop are ABSENT (the `group_enrollments` table has zero code readers);
rosters are inferred from N hand-booked appointment rows; the one group note writes N duplicate
rows that are permanently unsigned; attendance persists nowhere.

---

## Messaging — the structural finding

Full detail: `RECON-messaging-2026-07-27.md`.

- **Five of six notify-worthy events are browser-side writes** (appointment create / reschedule /
  cancel, form assign, determination, manual payment, group note). There is **no server-side seam**
  to hang a send on — an SMS from those would need a send credential in the client bundle.
- **The upload-link edge function is the sole exception** and is already correctly shaped (staff
  JWT verified, service-role client, `client_id` in hand, audit write present).
  **Upload-link delivery is the only slice buildable without moving an existing write server-side.**
- **Zero consent columns exist** anywhere in the live schema. No form asks. First schema addition.
- **Phones are unnormalised**: 34/34 non-blank but only **33 of 34 have ≥10 digits**, and formats
  are mixed (`314-555-0194` alongside `3333333333`). Twilio needs E.164.
- `client_communications` is a message log, not a delivery log — no recipient, channel, provider id,
  status or error columns. `audit_logs` is deliberately append-only so it cannot hold mutable
  delivery status.
- **10DLC / A2P registration is unverified and gates everything.** No implementation started.

---

## Open blockers

### Mine (engineering)
- Nothing is blocked on me. All three branches merged, tagged, pushed; live verified.
- Next actionable without any decision: the remaining ~30 sweep findings
  (`SWEEP-acs-2026-07-27.md`), highest-value being `PrintPreview`'s three unbacked attestations
  (client-, court-, auditor-facing; `check:forms` guards it byte-for-byte so it needs a deliberate
  re-baseline).
- Three more client-scope bleeds remain **behind `TRIAL_MODE`** (ActiveSession, ProgressTracking,
  CommunicationCenter) and re-arm the moment that flag moves.

### David's
- The four signature decisions above.
- Forms bucketing — `docs/client/acs-forms-inventory-2026-07-28.md` is the artifact for it.
  Specifically needs: build-or-remove the phantom treatment plan; keep/retire the four never-used
  forms; are "Gambling Recovery Intake" and "Opioid Recovery Intake" real forms he wants; which of
  the two name mismatches is correct.
- Whether the six certificate-gating forms are the right six.
- Means-test open questions (household composition, income verification, re-testing, who may
  certify, sliding-scale edges) — `docs/design/means-test-native-direction.html`.
- 10DLC registration status.
- "Certified by the Missouri Division of Behavioral Health" on the public landing page — a business
  fact to confirm against the certification paperwork, not a code change.

---

## If I were handing this to another developer tomorrow

1. **`TRIAL_MODE` is a release gate, not a convenience flag.** Flipping it exposes six surfaces at
   once, each hidden because it was broken or dishonest. See the blocked-gate section at the top of
   `ROADMAP.md`. `RecoveryPlanForm.tsx:44` still carries the unscoped-draft bug class.
2. **The `isLoading` early-return in `ClientWorkspace` was load-bearing.** `key={clientId}` now makes
   remount structural, but don't remove the key and fall back on the early-return — that silently
   re-arms ten PHI tabs. Recorded in ROADMAP.
3. **`npm run deploy` does not run `check:forms`.** Run it manually before deploying anything that
   touches forms or `PrintPreview`; it guards the committed-record baseline byte-for-byte.
4. **Always hard-reload before witnessing a deploy.** A stale tab produced a convincing false
   failure tonight — the page kept executing the previous bundle while hash checks passed. Confirm
   the bundle actually running in the page, not just the one being served.
5. **Commit before testing anything destructive.** A `git checkout` to revert a deliberate test
   break also discarded uncommitted work tonight. Recovered from a backup; avoidable.
6. **ACS client uploads are tagged `app_id='aiva'`**, so a legacy policy grants the anon key
   read+write on their metadata including OCR-extracted text. Real bug, cheap fix, deliberately
   deferred — the gate is before the first real client document lands. The mis-tag also poisons
   per-app queries for AIVA.
7. **Untouched by instruction, do not "tidy" them:** the phantom's Completed row, the three orphan
   seed rows (including the "Dr. Anya Sharma" narrative), and `pages/ClientList.tsx` (unreachable
   dead code holding a Missouri DOR "securely transmitted" modal whose handler is `console.log`;
   marked FOR DELETION in ROADMAP).
8. **Minor, pre-existing, not a bleed:** clicking "Note" on a client header while the Note Studio is
   *minimized* does not auto-expand it — the dock's expand effect only fires on an `isOpen`
   transition. The user must click the edge tab. Worth a one-line fix sometime.
9. **Switching clients now discards an in-progress note** (correct — note text is about one person)
   but the discard is **silent**. The dock already tracks `dirty`; a confirm prompt is a small
   follow-up if David finds it jarring.

---

## Tomorrow's client artifacts

- `docs/client/acs-forms-inventory-2026-07-28.md` — the forms list; ★ marks the six that gate a
  certificate. Verified: human names only, no internal ids, no file paths.
- `docs/client/acs-intake-test-script-2026-07-28.md` — Derek end to end, 37 steps. Verified every
  step maps to a route live after tonight's deploys; Part 4 was **corrected tonight** (it told
  David to open a "Forms" tab that does not exist — assigning happens on the Forms page, and
  assigned forms appear under the client's **Records** tab).
- `docs/client/acs-testing-scope-2026-07-28.md` — scope note. Verified: no findings, counts,
  severity language, or file paths.
- `docs/design/means-test-native-direction.html` — committed, renders correctly (verified in
  browser: title, 7 flow steps, CSS applied).
