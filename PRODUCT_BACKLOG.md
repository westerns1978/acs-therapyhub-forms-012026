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

---

## 2. Dark mode is partially broken — custom `dark.*` color tokens don't emit via the Tailwind Play CDN

Found 2026-06-05. Dark-mode colors are declared as **nested** tokens
(`colors.dark.background`, `colors.dark.surface`, `colors.dark.border`, `colors.dark.primary`)
in the inline `tailwind.config` in `index.html`. The Tailwind **Play CDN does not emit** the
matching utilities (`dark:bg-dark-background`, `dark:text-dark-surface-content`,
`border-dark-border`, …), so in dark mode the `<body>` and any component using a `dark.*`
token stay light, while components using **default-palette** `dark:` classes
(`dark:bg-slate-800`, etc.) correctly darken. Result: a half-broken dark state (dark cards on
a light page).

Interim mitigation shipped (polish-v2): the app now **defaults to light** so nobody lands in
this state; the toggle still offers dark/system. The real fix belongs **with item #3** (a real
Tailwind build compiles the `dark.*` tokens), or restructure dark colors as top-level tokens /
default-palette classes. Owner: Dan.

## 3. Tailwind Play CDN is running in production — migrate to a real Tailwind build

`index.html` loads `https://cdn.tailwindcss.com` (the **Play CDN, a dev-only tool**) and
configures the theme inline. This is the root cause of: (a) the `dark.*` tokens not emitting
(#2); (b) screenshot/automation hangs on heavy views and lazy class-generation races
(utilities are generated client-side on DOM mutation); (c) slower first paint and no purge/
tree-shake of unused CSS.

Migrate to a build-time setup: add `tailwindcss` / `postcss` / `autoprefixer` as dev deps,
move the inline `tailwind.config` to `tailwind.config.js`, add an `index.css` with the
`@tailwind base/components/utilities` directives (note: `index.html` already links a
currently-404 `/index.css`), and drop the CDN `<script>`. Verify all custom tokens compile
(incl. `dark.*` and the `shadow-card*` set), then re-test dark mode (#2). Owner: Dan.
