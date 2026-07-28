/**
 * UI VOCABULARY — one word per concept (2026-07-28).
 *
 * The app had SIX competing nouns for what turned out to be two distinct data
 * sources, and the alert feed alone answered to five different names depending on
 * which surface you were looking at: the sidebar said "Compliance Risk", the page
 * heading said "Risk Monitor", the breadcrumb (which title-cases the route slug)
 * said "Risk Monitor", a dashboard stat card said "Open alerts", and Clara's
 * briefing line called the same rows a "compliance flag".
 *
 * Worse, FOUR nav entries contained the word "compliance", two of which pointed at
 * genuinely different things (an actionable work queue vs. a read-only Director
 * rollup) — so the two most confusable items in the product were the two named most
 * alike.
 *
 * THE RULES (import from here; never hardcode these strings in a component):
 *
 *   ALERT      — the operational work queue from services/alertsService
 *                (missed sessions, imminent deadlines, missing documents). Things a
 *                human must ACT on. Was: "Compliance Risk" / "Risk Monitor" /
 *                "open alerts" / "compliance flag" / "risk".
 *
 *   GUARDRAIL  — a deterministic rule verdict from services/complianceEngine
 *                (warning | violation, each with a 9 CSR citation). Advisory, computed,
 *                never actioned directly. Was: "Clinical Guardrails" / "Guardrail
 *                flags" / "compliance flags" / "Active Compliance Flags".
 *
 *   READINESS  — the practice-wide Director rollup of guardrail verdicts
 *                (/compliance-readiness). Read-only. Distinct from ALERT by
 *                *audience and action*, which the labels must now show.
 *
 *   RISK       — RESERVED for the AI relapse-risk prediction ONLY. It is the one
 *                genuinely different meaning of the word, and the compliance surfaces
 *                must stop borrowing it.
 *
 *   DEADLINE   — date-anchored obligations from services/complianceClock.
 *
 * MONEY VOCABULARY (David, 7/28 call — his words are canonical):
 *
 *   BILLING    — RESERVED for billing THE STATE (Missouri DMH claims: CNS/ED
 *                units, CIMOR). NEVER client money. A surface about what a
 *                client pays must not say "billing".
 *
 *   FEES       — client payments: balances, charges, Stripe, the ledger.
 *                Was: "Billing" (portal nav + workspace tab), "Billing &
 *                Payments", "Financial Wallet", "Billing Setup".
 *
 *   CNS / ED   — Counseling / Education, the state-billing service axis.
 *                Tokenized in config/serviceType.ts (DB CHECK lock-step).
 *
 * Severity tokens stay where they are computed (VerdictStatus in complianceEngine,
 * AlertTier in alertsService); this module names the CONCEPTS, not the severities.
 */

/** Canonical singular/plural nouns per concept. */
export const VOCAB = {
    alert: { one: 'alert', many: 'alerts', title: 'Alerts' },
    guardrail: { one: 'guardrail', many: 'guardrails', title: 'Clinical Guardrails' },
    readiness: { title: 'Compliance Readiness' },
    deadline: { one: 'deadline', many: 'deadlines', title: 'Compliance Deadlines' },
    /** Client money. "Billing" is reserved for billing the state — see header. */
    fees: { one: 'fee', many: 'fees', title: 'Fees' },
} as const;

/**
 * Nav labels. The two confusable compliance entries are disambiguated by what the
 * user DOES there, not by adjective:
 *   - "Alerts"                → the work queue (act on it)
 *   - "Compliance Readiness"  → the Director rollup (read it)
 * The route slugs are unchanged (renaming /risk-monitor is a router change with
 * bookmark/deep-link fallout — deliberately not bundled into a vocabulary pass), so
 * NAV_LABELS is also the source the breadcrumb reads to avoid the slug leaking
 * through as a contradictory title.
 */
export const NAV_LABELS: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/session-management': 'Calendar',
    '/clients': 'Clients',
    '/forms': 'Forms',
    '/help': 'Help & Training',
    '/risk-monitor': 'Alerts',
    '/treatment-plan-library': 'Treatment Plan Library',
    '/compliance-readiness': 'Compliance Readiness',
    '/financials': 'Financials',
    '/settings': 'Settings',
    '/reporting': 'Analytics',
    '/communication-center': 'Messages',
    '/document-intelligence': 'AI Documents',
    '/program-plan': 'Treatment Plan',
    '/compliance-assistant': 'Compliance Assistant',
    '/assessments': 'Assessment',
};

/** Human label for a route path, for breadcrumbs and any nav-adjacent chrome.
 *  Falls back to title-casing the slug (the old breadcrumb behavior) so an
 *  unmapped route still renders something sane rather than nothing. */
export const navLabelFor = (path: string): string => {
    const clean = '/' + path.replace(/^\/+/, '').split('/')[0];
    if (NAV_LABELS[clean]) return NAV_LABELS[clean];
    return clean.slice(1).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

/** Sidebar/drawer section headings. "Reports" was wrong for a work queue, a
 *  template picker, and Settings; these two say what the group is FOR. */
export const NAV_SECTIONS = {
    oversight: 'Oversight',
    admin: 'Administration',
} as const;
