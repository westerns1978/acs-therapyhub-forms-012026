# ACS TherapyHub — Progress Tracker

*Goal: a system that merits $600/month from David — which means a system that can safely hold
his real clients' PHI. The work splits into two launches: a **paid pilot** (can do on mock data,
near-term) and a **real-data launch** (gated on the trust-layer rebuild below).*

*Last updated: 2026-06-02*

---

## Where we are in one line

The counselor app now has **real authentication** — the single hardest precondition for
everything else — and all the false compliance claims are corrected and committed. The work so
far is invisible because it's foundation, not surface. Next visible-to-David milestone is the
**paid pilot conversion** at day 30; next engineering step is **portal auth**.

---

## Milestone 0 — Neutralize liability (zero code) ✅ DONE

- [x] Correct false security/compliance claims in `README.md`
- [x] Mark `technical_specification_v2.md` as aspirational / not-as-built
- [x] Both committed to git (`cb16ff2`)
- [ ] Fix two cosmetic README typos ("writtn", "biometri") — *trivial, optional*
- [ ] Brief Derek on the language line: no "HIPAA-compliant / encrypted / audit-logged" to David until true — *verbal, do before any sales talk*

## Milestone 1 — Paid Pilot Launch (target ~July 1 / day 30) — NOT STARTED

*Does not require the rebuild. Requires honesty about what David is paying for.*

- [ ] **Get the gating decision from David: mock vs. real pilot data.** (Mock → July 1 holds. Real → Milestone 2 becomes a prerequisite.)
- [ ] Karen & Jess config sessions on the calendar (gated on their availability — Karen was out)
- [ ] Day-30 conversion conversation — **Derek leads**, anchored to validated $600, framed for the piloted system as-is
- [ ] One-page founding-customer agreement + a billing start date (the signature that makes it real)
- [ ] Real-data go-live named as the next phase, not assumed

## Milestone 2 — Real-Data Launch (the trust-layer rebuild) — IN PROGRESS

*The gate to ever holding real client PHI. Auth is the keystone; everything hangs off it.*

- [x] **Step 1 — Real counselor authentication** ✅ (committed, browser-verified, **not deployed**)
  - Real Supabase Auth sessions replace the sessionStorage stub
  - App now hits the DB as `authenticated`, not `anon` — *this is what makes RLS possible at all*
  - Role sourced from JWT metadata; route guards gate on the real session; refresh-persistence works
- [ ] **Step 2 — Client portal authentication** ← NEXT ENGINEERING STEP
  - `ClientLogin.tsx` still a stub accepting any email/password into a hardcoded client — client-facing PHI, so arguably the more sensitive side
- [ ] **Step 3 — Tenancy** — add `org_id` to clients + all PHI tables, scope every query (also the foundation of the multi-tenant scale story)
- [ ] **Step 4 — Real RLS** — replace permissive `USING (true)` with `auth.uid()` / `org_id` policies; enable RLS where it's currently off
- [ ] **Step 5 — Isolate ACS onto its own Supabase project** (off shared `westflow-platform`; do before real data exists)
- [ ] **Step 6 — Private document storage** — kill public Storage URLs, signed URLs only
- [ ] **Step 7 — Secrets off the client** — wire the existing `pds-gemini-proxy`, rotate leaked key, stop shipping write-capable anon key
- [ ] **Step 8 — Audit logging** — actually write to `audit_logs`
- [ ] **Step 9 — 42-CFR-Part-2 posture** — Google BAA, consent/retention/export-delete
- [ ] **Cleanup — delete or scope the 3 demo auth accounts** before RLS lands (public demo password must not be a live key)

## Milestone 3 — Paid SaaS & scale — NOT STARTED

- [ ] Real Stripe subscription billing ($600/mo recurring; only test-mode copay exists today)
- [ ] Production hardening — replace Tailwind CDN, tighten CSP, monitoring, backups
- [ ] Configurable compliance rulebook engine → multi-state scale (built on Milestone 2 tenancy)

---

## Standing rules

- **No real client PHI in the database until Milestone 2 (esp. steps 2–5) is done.**
- **Deploy is held** until the auth story is whole (counselor + portal), then cut over
  deliberately with a heads-up to David — don't change the login under his team mid-trial.
- **On the shared DB:** any write — including to the built-in `auth` schema — is a
  stop-and-ask, not a proceed-and-disclose.

## Open decisions parked

- Track `GAP_ANALYSIS.md` in the repo, or keep it out of history? (candid security inventory)
- Milestone 2 step ordering is my read, not the recon's effort scores — true up against the
  six-pillar table + ranked blockers when those are pasted in.
