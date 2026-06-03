# ACS TherapyHub — Progress Tracker

*Goal: a system that merits $600/month from David — which means a system that can safely hold
his real clients' PHI. Two launches: a **paid pilot** (mock data, near-term) and a **real-data
launch** (gated on the trust-layer rebuild). **ACS is the #1 priority project.***

*Last updated: 2026-06-03*

---

## Where we are in one line

Full auth (counselor + portal) is real and committed. A feature sprint just made three
demo-shaped/broken things real: appointment status, session-note saving (was silently losing
data), and the risk card (was showing a fake 0%). 11 commits ahead of origin, **not pushed, not
deployed**. The empty column that actually produces revenue — Milestone 1 — still hasn't moved.

---

## Milestone 0 — Neutralize liability (zero code) ✅ DONE

- [x] Correct false security/compliance claims in `README.md` (`cb16ff2`)
- [x] Mark `technical_specification_v2.md` as aspirational (`cb16ff2`)
- [ ] Fix two cosmetic README typos ("writtn", "biometri") — *trivial*
- [ ] Brief Derek on the language line: no "HIPAA-compliant / encrypted / audit-logged" to David until true

## Milestone 1 — Paid Pilot Launch (target ~July 1 / day 30) — NOT STARTED ⚠️ THE REVENUE COLUMN

*Does not require the rebuild. Still completely empty. This is what gets you the $600.*

- [ ] **Get the gating decision from David: mock vs. real pilot data.** ← single most important box on the sheet
- [ ] Karen & Jess config sessions on the calendar (gated on their availability)
- [ ] Day-30 conversion conversation — **Derek leads**, anchored to validated $600
- [ ] One-page founding-customer agreement + a billing start date
- [ ] Real-data go-live named as the next phase, not assumed

## Milestone 2 — Real-Data Launch (the trust-layer rebuild) — IN PROGRESS

*The gate to ever holding real client PHI. Auth done; the dangerous shared-DB work is still ahead.*

- [x] **Step 1 — Real counselor auth** ✅ (`8c68024`), browser-verified
- [x] **Step 2 — Client portal auth** ✅ code (`a661372`) + 2 demo Client users provisioned + staff-only guard allowlist (`a1c3d22`); browser-verified
- [ ] **Step 5 — Isolate ACS onto its own Supabase project** ← should come BEFORE tenancy/RLS (evidence: ACS auth already evaluates other apps' accounts incl. Deon). Migration-shaped, scope carefully.
- [ ] **Step 3 — Tenancy** — client→auth-user FK (replace email-match workaround) + `org_id` on PHI tables, scope queries
- [ ] **Step 4 — Real RLS** — replace permissive `USING (true)`; enable where off — **do in the isolated project, not shared**
- [ ] **Step 6 — Private document storage** — kill public Storage URLs
- [ ] **Step 7 — Secrets off the client** — wire `pds-gemini-proxy`, rotate leaked key (safe, ACS-only, no shared-schema risk — good standalone task)
- [ ] **Step 8 — Audit logging** — write to `audit_logs`
- [ ] **Step 9 — 42-CFR-Part-2 posture** — Google BAA, consent/retention/export-delete
- [ ] **Cleanup — delete or scope the 4 demo auth accounts before RLS lands** (shared DEMO_PASSWORD)

## Feature sprint — make demo-shaped things real ✅ DONE (this session)

- [x] **Appointment status real** (`bbb729d`) — Completed/No-Show/Cancel + status-colored schedule. Flips the user-guide apology into a feature.
- [x] **Session note saving** (`0332e6c`) — *found + fixed a live bug:* `saveClinicalNote` wrote phantom `content`/`source` columns → every note silently lost (Smart Note Studio too). Now writes real SOAP columns; wrap-up saves on sign.
- [x] **Risk card honest** (`44f6652`) — removed orphaned "John Doe" mock; real prediction returns null (not fake 0%) on failure with graceful "unavailable" state.

## Milestone 3 — Paid SaaS & scale — NOT STARTED

- [ ] Real Stripe subscription billing ($600/mo recurring; only test-mode copay exists)
- [ ] Production hardening — replace Tailwind CDN, tighten CSP, monitoring, backups
- [ ] Configurable compliance rulebook engine → multi-state scale (built on Milestone 2 tenancy)

---

## Findings parked this session (real, not urgent)

- **`alertsService.ts` (~lines 280, 317)** has the SAME phantom `content`/`source` insert into `clinical_notes` — silent-fail bug, untouched, fix in a cleanup pass.
- **Orphaned UI, unrouted:** `ActiveSession` (the session wrap-up wizard host) and `RiskDashboard` are built but nothing routes to them. Decide whether to wire a route + nav or treat as abandoned. Wrap-up note-save works the moment ActiveSession gets a door; Smart Note Studio is the reachable note path today.
- **Risk failure-state copy** ("temporarily unavailable") verified by code, NOT by eyeball (API works in test env, couldn't force a failure). Browser-check once with a bad API key before trial.
- **Recon (`GAP_ANALYSIS.md`) is a map, not the territory** — wrong in BOTH directions this sprint (updateAppointment real, saveClinicalNote broken). Re-verify every target against live code; never trust the label.

## Standing rules

- **No real client PHI in the DB until Milestone 2 (esp. isolation + RLS) is done.**
- **Deploy is held**; auth story is now whole, so deploy is a *deliberate* choice — coordinate a heads-up to David (demo path changed mechanism + button labels may differ).
- **On the shared DB:** any write — incl. the `auth` schema — is stop-and-ask unless explicitly authorized for one task.
- **No shared-schema RLS/tenancy work** until ACS is isolated onto its own project.

## End-of-session checklist (every time)

1. `git status` — whole list, including untracked (new files don't show in `git diff`).
2. Stage intended files, commit with a clear message.
3. `npm run build` — green from what's committed.
4. `git status` again — clean except deliberate stragglers.
5. Update this tracker.
6. `git push` so it's not all on one laptop. ← **11 commits unpushed right now.**

## Open decisions parked

- Track `GAP_ANALYSIS.md` + this tracker in the repo, or keep out of history? (candid security/account contents)
- Milestone 2 ordering is my read; true up against the recon's six-pillar table + ranked blockers when pasted.
- Real staff provisioning: `*.gemyndflow.com` accounts lost counselor access under the allowlist — give them explicit roles when ready.
