# ACS TherapyHub — Compliance Rule-Pack Summary

**Status:** fixture / pilot — *for clinical + legal sign-off before these rules become governing.*
**Pack:** `compliance/missouri-compliance-pack.json` · **Engine:** `services/complianceEngine.ts`
**Authored:** 2026-06-09 (program-aware build) · **Reviewers:** Karen (clinical), David (legal/compliance)

---

## How to read this

The compliance engine is **deterministic and rules-as-data**. Each program is a node in the pack
JSON; each rule names a *primitive* (DEADLINE, DOCUMENT, SIGNATURE, CONSTRAINT, CREDENTIAL,
HOURS, SEQUENCE) and a *threshold*, and cites the Missouri regulation it comes from. The engine
code only evaluates primitives — it never invents a number or a verdict, and the AI assistant
never produces a compliance result. **Every rule below traces to a citation.**

A rule is in one of three states:

| State | Meaning |
|---|---|
| **LIVE** | The data it needs exists and is wired; it produces a real verdict today (met / warning / overdue). |
| **not_enforceable** | The rule is authored and cited, but the data it checks isn't stored/wired yet. It is shown honestly as "needs data" — **never faked as a pass.** |
| **no-gate** | The program is honestly *not* state-regulated; there is no completion floor to enforce (completion is court-determined). |

**Program → pack routing** (`packKeyForProgram`, `complianceEngine.ts`):

| Client `program_type` | Pack node | Notes |
|---|---|---|
| `SATOP` | `SATOP` (level logic) | Unchanged — routes through the OEP/WIP/CIP/SROP level rules + required hours/forms. |
| `OPIOID_RECOVERY` | `OUTPATIENT_SUD` | Opioid has **no distinct node**; generic outpatient SUD governs it. |
| `INDIVIDUAL COUNSELING` | `OUTPATIENT_SUD` | Same generic outpatient SUD rules. |
| `GAMBLING_RECOVERY` | `GAMBLING` | New node (this build). |
| `Anger Management` | `ANGER` | New node (this build) — **no-gate**. |

The **plan-review clock** is anchored on the client's treatment-plan **execution date**
(`treatment_plans.created_at`, read by `fetchClientPlan`). No plan on file ⇒ the review rule is
`not_enforceable` (honest), not a violation.

---

## SATOP (Substance Awareness Traffic Offender Program) — *unchanged*

Routes through the existing level logic (OEP I / WIP II / CIP III / SROP IV). Completion is gated
on **required hours** (`{I:10, II:20, III:50, IV:75}`), SROP's **35-hour counseling floor**,
**minimum 90-day duration** (SROP), **balance ≤ 0**, **clinician completion sign-off**, and
**required forms signed**. Citations: **9 CSR 30-3.206**. *This build did not modify any SATOP
rule or the SATOP completion gate.*

---

## OUTPATIENT_SUD (covers Opioid Recovery & Individual Counseling)

Citations: **9 CSR 30-3.195** (treatment plan / review), **9 CSR 30-3.151** (diagnosis/credential).
Confidentiality: **42 CFR Part 2 applies** (federally-assisted SUD).

| Rule | Primitive | Threshold | Citation | State today |
|---|---|---|---|---|
| `MO-OP-TXPLAN-REVIEW-90D` | DEADLINE | Plan reviewed/updated **every 90 days** from plan execution | 9 CSR 30-3.195 | **LIVE** — fires *overdue* once a plan is ≥ 90 days old (e.g. Denise Park, 100 days). |
| `MO-OP-TXPLAN-BY-3VISITS` | DEADLINE | Plan finalized **within first 3 visits** | 9 CSR 30-3.195 | not_enforceable — needs per-client visit sequence. |
| `MO-OP-TXPLAN-REWRITE-365D` | DEADLINE | Plan rewritten **annually** (365 days) | 9 CSR 30-3.195 | not_enforceable — needs plan-version history. |
| `MO-OP-CONSENT-ANNUAL` | DOCUMENT | Informed consent **≤ 365 days** old | 9 CSR 30-3.195 | not_enforceable — no consent store wired. |
| `MO-OP-INTAKE-GOAL` | DOCUMENT | Intake includes individualized goal | 9 CSR 30-3.195 | not_enforceable — needs intake fields. |
| `MO-OP-TXPLAN-SIGN` | SIGNATURE | Plan signed by qualified professional | 9 CSR 30-3.151 | not_enforceable — no signature/credential store. |
| `MO-OP-DIAGNOSIS-DSM5TR` | CONSTRAINT | Diagnosis uses **DSM-5-TR** | 9 CSR 30-3.151 | not_enforceable — no diagnosis store. |
| `MO-OP-DIAGNOSIS-CREDENTIAL` | CREDENTIAL | Diagnosis by credentialed clinician | 9 CSR 30-3.151 | not_enforceable — no credential store. |

> **The 90-day plan review is the LIVE rule.** The rest are authored + cited but await their data
> stores (a later increment). They surface honestly as "needs data," never as a pass.

---

## GAMBLING (Compulsive Gambling Disorder Treatment) — *new this build*

Citations: **9 CSR 30-3.134** (gambling-specific); core clinical-record standards **9 CSR 10-7.030**.
**Confidentiality is DISTINCT from SUD: 42 CFR Part 2 does NOT apply** to standalone gambling
treatment (not a federally-assisted SUD program) — **HIPAA + RSMo 630.140** govern.

| Rule | Primitive | Threshold | Citation | State today |
|---|---|---|---|---|
| `MO-GAM-TXPLAN-REVIEW-180D` | DEADLINE | Plan reviewed/updated **every 180 days** from plan execution | **9 CSR 10-7.030(6)(A)** | **LIVE** — *program-distinct cadence.* 180 is the regulatory **floor**; not yet due at 150 days (e.g. Reggie Vance). |
| `MO-GAM-TXPLAN-BY-3VISITS` | DEADLINE | Plan finalized within first 3 visits | 9 CSR 10-7.030 | not_enforceable — needs visit sequence. |
| `MO-GAM-CONSENT-ANNUAL` | DOCUMENT | Informed consent **≤ 365 days** old | 9 CSR 10-7.030 | not_enforceable — no consent store. |
| `MO-GAM-NOTES-5DAY` | DEADLINE | Progress notes within **5 business days** of service | 9 CSR 10-7.030 | not_enforceable — needs per-note service-vs-authored dates. |
| `MO-GAM-DISCHARGE-SUMMARY` | DOCUMENT | Discharge summary at conclusion | 9 CSR 10-7.030 | not_enforceable — needs discharge record. |
| `MO-GAM-CREDENTIAL-CGDC` | CREDENTIAL | Services by a **CGDC** (Certified Gambling Disorder Counselor) | 9 CSR 30-3.134 | not_enforceable — no credential store. |

> **⚠ Reviewer note — the 90 vs 180 distinction is the whole point of program-awareness.** The SUD
> plan-review cadence is 90 days; the gambling floor is **180 days** per 9 CSR 10-7.030(6)(A). A
> DBH contract *may* tighten gambling to 90, but **180 is the regulatory floor** — confirm whether
> ACS's DBH contract imposes a tighter cadence before this goes governing.

---

## ANGER (Anger Management, standalone) — *new this build · NO-GATE*

**There is no Missouri state regulatory framework for *standalone* anger management.** It is
**unregulated**; completion is **court-determined** — typically **8–52 hours over 4–12 weeks**, set
by the referring judicial circuit / probation, **not by a Missouri rule.**

| Rule | Primitive | Threshold | Citation | State today |
|---|---|---|---|---|
| `MO-ANGER-NO-STATE-GATE` | CONSTRAINT | *No state compliance gate* | Unregulated (standalone) | **no-gate** — surfaced as "No regulatory gate (court-determined)." No deadline is fabricated. |

> **Plainly stated for sign-off:** ACS should **not** apply a treatment-plan-review deadline (90 or
> 180 day) to standalone anger-management clients. The system intentionally shows *no* compliance
> clock for them.
>
> **Future hook (not wired):** a *clinically-integrated* anger subtype (co-occurring SUD) would
> behave like OUTPATIENT_SUD — 3-visit plan, 90-day review, 5-day notes — per **9 CSR 30-4.190**.
> This is documented in the pack as `future_subtype_note` and will be wired only when a subtype
> field exists. Until then, anger is treated as standalone / no-gate.

---

## Other pack nodes (present, not part of this build)

`CSTAR`, `GROUP_THERAPY`, `REACT`, `CONSENT_42CFR2`, `WAITLIST` exist in the pack with their own
rules + citations and are unaffected by the program-aware routing change.

---

## What's LIVE vs pending (data wiring)

| Capability | State | Needs |
|---|---|---|
| Plan-review clock (90d SUD / 180d gambling) | **LIVE** | `treatment_plans.created_at` (wired). |
| No-gate (anger) | **LIVE** | none — declarative. |
| Consent annual (`*-CONSENT-ANNUAL`) | pending | a consent record with execution date (or derive from `form_submissions` `consent-treatment.submitted_at`). |
| 3-visit plan deadline | pending | per-client visit sequence from `appointments`. |
| 5-day progress notes | pending | per-note service-date vs authored-date. |
| Signature / diagnosis / credential rules | pending | signature, diagnosis, and credential stores (schema add — a later increment). |

---

## Evidence (witness, 2026-06-09 — real DB, deterministic engine)

| Client | Program → pack | Plan age | Review rule | Verdict | Card shown |
|---|---|---|---|---|---|
| Marcus Reyes | SATOP IV | (no plan) | 90D | not_enforceable | *(SATOP %: 21%)* — unchanged |
| Travis Becker | SATOP IV | (no plan) | 90D | not_enforceable | *(SATOP %: 92%)* — unchanged |
| Anthony Cole | SATOP III | (no plan) | 90D | not_enforceable | *(SATOP %: 60%)* — unchanged |
| **Denise Park** | OPIOID → OUTPATIENT_SUD | 100d | 90D | **violation** | "Plan review overdue" |
| **Reggie Vance** | GAMBLING → GAMBLING | 150d | 180D | **met** | "Plan review due in 30 days" |
| Brandon Hale | OPIOID → OUTPATIENT_SUD | 5d | 90D | met | "Plan review due in 85 days" |
| Curtis Lane | ANGER → ANGER | — | — | no-gate | "No regulatory gate (court-determined)" |

**Denise (100d) is overdue while Reggie (150d) is not — because the engine applies each program's
own regulatory cadence (90 vs 180), not one rule for everyone.** SATOP output is identical to before
this build.
