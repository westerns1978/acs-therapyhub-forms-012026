# Missouri Compliance Pack — Engine Specification (v1.0.0)

*Companion to `missouri-compliance-pack.json`. The JSON is what the engine reads; this is what a human reads to understand, verify, and extend it.*

---

## The one rule that governs all the others

**Deterministic code decides every count and verdict. AI never does.**

Every threshold, lock, gate, and block in this pack is enforced in code against real data. The AI layer (Clara, Smart Note Studio) may *explain* a rule, *cite* the regulation, and *surface* a status the engine computed — but it never decides whether something is compliant. In a court-mandated SUD context, a hallucinated verdict is someone's license reinstatement or billing breaking. So: the engine rules; the AI narrates.

This is why the pack ships in two halves:
- **This pack (deterministic):** thresholds, deadlines, credential gates, locks. Enforced literally.
- **The RAG knowledge base (explanatory):** what the rules mean, served to Clara for citation. Listed under `rag_handoff` in the JSON, ingested separately into pgvector. Never the source of a verdict.

---

## Architecture: rules are data, engine is code

The engine is uniform across states. Only the *pack* (this data) changes. Every rule reduces to one of seven **primitives**, so the engine implements seven evaluators once and every state's rules are just data fed to them:

| Primitive | Means | Example |
|---|---|---|
| **HOURS** | Accumulate hours toward a required total, possibly split by category | CIP's 10/20/20 |
| **DEADLINE** | A clock relative to an anchor event; may warn, lock, or block | 90-day plan review |
| **DOCUMENT** | A required artifact must exist / be current / contain fields | annual consent |
| **SIGNATURE** | An action requires authenticated sign-off, possibly co-signed | per-session group log signature |
| **CONSTRAINT** | A limit or restriction on a value or combination | group size ≤ 12 |
| **SEQUENCE** | Step A must precede step B | OMU screening before level assignment |
| **CREDENTIAL** | The acting staff member must hold a qualifying credential | only QSAP delivers CIP |

When you add a state, you write a new pack with these same primitives. You do not write new engine code. That decoupling is the moat — and the entire multi-state scale story rests on it.

---

## Enforcement vocabulary

Each rule declares how strictly it bites:

- **HARD_BLOCK** — the action is prevented outright (e.g. can't issue a completion certificate).
- **HARD_LOCK** — access is frozen until a condition clears (e.g. charting locked at day 90).
- **CREDENTIAL_GATE** — only qualifying credentials may perform the action.
- **DUAL_SIGNATURE_WORKFLOW** — draft by one role, co-sign by another.
- **WARN** / **WARN_THEN_FLAG** — surfaced to the user; doesn't block.
- **FLAG_AND_PROMPT** — flags a record and prompts a required follow-up.
- **VALIDATION** — checks fields/conditions are present and well-formed.
- **AUTO_APPEND** / **INPUT_RESTRICTION** — the system adds or constrains automatically.

---

## Program areas

### 1. Outpatient SUD treatment — `9 CSR 30-3.195`
The backbone. These rules apply to ACS's general outpatient clients and are the ones that produce the most day-to-day enforcement.

- **Annual consent (`MO-OP-CONSENT-ANNUAL`)** — written consent at intake, renewed ≤365 days. **Hard-blocks progress notes and billing** if missing or stale. This is the single most frequently-hit gate.
- **Initial goal at intake (`MO-OP-INTAKE-GOAL`)** — at least one treatment target before a client goes active.
- **Treatment plan by visit 3 (`MO-OP-TXPLAN-BY-3VISITS`)** — warn at visit 2; **block scheduling visit 4** if no plan.
- **90-day review (`MO-OP-TXPLAN-REVIEW-90D`)** — **hard calendar lock** on charting at day 90 until a documented review. Warn 7 days out. *(This is the rule behind the "Marcus Reyes — 90-Day Treatment Plan Update Due" guardrail already in the dashboard.)*
- **365-day rewrite (`MO-OP-TXPLAN-REWRITE-365D`)** — archive old plan, launch rewrite wizard, block progress notes until done.
- **Sign-off gate (`MO-OP-TXPLAN-SIGN`)** — LMHP signs; PLPC/QAP may draft but must be co-signed by LMHP.
- **DSM-5-TR only (`MO-OP-DIAGNOSIS-DSM5TR`)** + **diagnostic privilege gate (`MO-OP-DIAGNOSIS-CREDENTIAL`)** — diagnoses restricted to active DSM-5-TR codes and to LMHPs; unsupervised LMSW blocked.

### 2. SATOP — `9 CSR 30-3.201 et seq.`
The court-mandated traffic-offender program. **Entry is gated:** OMU screening by an SQP must precede level assignment (`MO-SATOP-OMU-SEQUENCE`).

- **OEP (Level I):** 10 education hours within 6 months.
- **WIP (Level II):** 20 continuous hours over a 48-hour weekend; validate funding code.
- **CIP (Level III):** the **exact 10/20/20 split** (10 individual + 20 group counseling + 20 group education), with **≥10 hours tagged impaired-driving**. Delivered by QSAP. This is the most structurally specific HOURS rule in the pack — the engine must validate each component independently, not just the total.
- **SROP (Level IV):** ≥75 clinical hours **and** ≥90 calendar days — both required; certificate locks if either is short. Delivered by QSAP. *(This is the level the founder completed.)*
- **Comparable out-of-state:** 120 total hours (≥40 counseling, ≥10 education), within 6 months of out-of-state assessment, certified/accredited provider, Sections II–IV of the Completion Form tracked, $249 supplemental fee verified.

### 3. CSTAR — `9 CSR 30-3.151/.152/.155`
For comprehensive treatment programs. Staff ASAM-training tracking and the QAP/QMHP→LMHP dual-signature intake workflow. Relevant if ACS runs CSTAR; structurally ready either way.

### 4. Group therapy (cross-program) — `9 CSR 30-3.110`
- **Size cap:** average ≤12 per facilitator per calendar month (warn/flag — it's a monthly average, so it can't hard-block a single session).
- **Group log:** exact per-attendee check-in/check-out times.
- **No signature stamps:** facilitator authenticates each session's signature.

### 5. REACT — Missouri DOC / P&P
Minimum 10 education hours; out-of-state relocation reporting to the supervising P&P officer.

### 6. 42 CFR Part 2 + HIPAA consent — `42 CFR Part 2 (2024), § 2.32`
- Single comprehensive TPO consent allowed.
- **Hard stop:** TPO consent and legal-proceeding consent **cannot** be combined — separate standalone forms.
- § 2.32 redisclosure notice auto-appended to every consented disclosure.
- Immutable consent + disclosure audit log.

> ⚠️ **Honesty flag (`MO-CONSENT-AUDIT-LOG`):** encoding these consent *rules* does **not** make the app 42-CFR compliant. Real compliance needs the trust-layer rebuild — working audit logging, encryption, RLS. The rule's `depends_on: real_audit_logging_infrastructure` says so explicitly. Do not let "we have the consent workflow" become a compliance claim before the substance exists. Same discipline as correcting the README.

### 7. Waitlist & priority populations — `9 CSR 30-3.100`
Flag and prompt outreach for the seven priority categories (pregnant/injecting, recent injection, involuntary commitments, high-risk justice referrals, TANF, Children's System of Care).

---

## How Clara uses this (the two-persona split)

**Staff Clara** pulls the *rule* from the RAG knowledge base and the *status* from this engine, and cites the CSR:
> "The regulation requires a treatment-plan review every 90 days (9 CSR 30-3.195); the system shows this client at day 87."

She never invents a threshold, never declares compliance on her own authority.

**Client Clara** is scoped to *their own program* — what their level requires, what they've completed, what's next — warmly explained, grounded in the RAG text. She does **not** predict legal/court outcomes. Wrong legal information to a court-mandated client is real harm; that boundary is a safety requirement, not polish.

---

## What's enforceable now vs. later

- **Demos now, on mock data:** the HOURS, DEADLINE, and CONSTRAINT rules driving the Clinical Guardrails card (90-day review, SROP hours/days, group size). This is the showcase — the most ACS-specific thing in the product and the clearest "SimplePractice can't do this."
- **Real-data era (Milestone 2/3):** consent enforcement, audit logging, the full credential matrix as real RBAC. These need the isolated project + trust-layer rebuild to mean anything.

---

## Provenance & caveats

- Thresholds and citations transcribed from the two source regulatory-analysis documents. **Verify each against current CSR text before production enforcement** — regulations change, and a stale threshold is the one unacceptable error in this domain.
- The RAG-able explanatory text (see `rag_handoff` in the JSON) is regenerated from DocuConvert at a **larger chunk size** than the original size-7 export (target ~400–600 tokens, semantic/heading-aware) so a full rule or definition stays intact in one chunk.
- Target store: **Gemini embeddings in pgvector, in the isolated ACS Supabase project** — not the shared DB, not a third-party vector vendor.
