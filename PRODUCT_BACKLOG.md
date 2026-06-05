# Product Backlog

Product / clinical-integrity decisions deferred. (Security-specific items live in
`SECURITY_BACKLOG.md`.)

---

## 1. AI Relapse Risk predictor — remove permanently OR rebuild narrate-only (DECISION PENDING)

**Status (2026-06-05): card HIDDEN.** Gated off via `SHOW_RELAPSE_RISK_CARD = false` in
`pages/ClientWorkspace.tsx`. The `RelapseRiskCard` component and the `client_risk_profiles`
table are intentionally **retained, not deleted**.

**Why it was hidden:** the card rendered an LLM-shaped numeric risk score on a clinical SUD
record — defaulting to a fabricated ~50% whose own explanation admitted there was no data to
predict from — branded "Gemini 3 Pro." That violates the **narrate-only** rule (no model may
produce a determinative number on a clinical record) and is a liability + credibility risk in
front of the pilot sponsor.

**Decision required — pick one:**
1. **Remove permanently** — delete the `RelapseRiskCard` component and drop/repurpose
   `client_risk_profiles` (the kickoff brief already treats it as advisory-only, and it's
   empty).
2. **Rebuild narrate-only** — deterministic inputs computed in code (same pattern as the
   compliance engine); the model may only *narrate/explain* the deterministic output, never
   produce the score; and it MUST show **"insufficient data"** when no telemetry exists rather
   than defaulting to any fabricated percentage. The clinical authority (Karen) signs off on
   any risk methodology before it ships.

**Do NOT** re-enable the current implementation as-is (flip `SHOW_RELAPSE_RISK_CARD` back on)
without doing option 2 first. Owner: Dan + Karen.
