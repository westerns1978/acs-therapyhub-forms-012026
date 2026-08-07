/**
 * WS5 — single source of truth for ACS's form set, reconciled to the real
 * documents (Forms-090825 + the operational New folder).
 *
 * One registry keyed by `id` (the string written into form_submissions.form_id,
 * now `text` after 20260606_ws5_2). Drives: assignment validation, the portal
 * form list, and the cert gate's required-forms set. Replaces the old 5-entry
 * getFormTemplates() mock whose ids didn't match the components.
 *
 * `requiredForCompletion` = part of the 3.206(13)(F) "completes and signs all
 * required forms" cert gate. `audience` = where it surfaces ('client' = portal).
 */
import type { SatopLevel } from './satopFees';

export type FormAudience = 'client' | 'staff';

export interface FormRegistryEntry {
  id: string;
  title: string;
  category: string;                 // descriptive (mirrors the component's FormDefinition.category)
  audience: FormAudience;           // 'client' surfaces in the portal; 'staff' is staff-only
  requiredForCompletion: boolean;   // counts toward the cert gate (the core 6)
  description?: string;
  /**
   * Filename stem of this form's blank PDF twin in `public/forms/` — the shareable,
   * no-PHI copy. `pdfUrlFor()` derives the href; nothing stores a full URL, so a wrong
   * origin or an off-site link cannot reach either surface.
   *
   * PRESENCE IS THE SWITCH. Unset = no PDF exists, and BOTH surfaces render nothing:
   * the staff "Copy PDF link" action (components/FormLibrary.tsx) and the client
   * "Download PDF" button (pages/portal/PortalDocuments.tsx) are each gated on it.
   * That is what keeps a retired form, and a form whose revision hasn't shipped, from
   * offering a link to a file that isn't there.
   *
   * SET IT ONLY WHEN THE PDF IS COMMITTED. `npm run check:forms` gate 4 asserts
   * public/forms/<pdfSlug>.pdf exists on disk and fails the run if it doesn't — because
   * Firebase's catch-all rewrite answers a missing file with a 200 + SPA shell, not a
   * 404, so a typo would ship as a link that silently renders the app.
   *
   * Slug convention is `= id`; the two registration forms are the deliberate exception
   * (`satop-registration-form`, `registration-form`), which is why this is an explicit
   * field and not derived. See docs/design/forms-revision-080126.md §9.
   */
  pdfSlug?: string;
  /**
   * How many pages this form's blank PDF twin is expected to be — the page-count
   * assertion of the manifest pattern (docs/design/manifest-reconciliation-pattern.md).
   *
   * WHY IT LIVES ON THE REGISTRY: the manifest is the form assignment, and the
   * registry is what an assignment is created from. Declaring the expected length
   * next to `pdfSlug` keeps "what document" and "how long it should be" in one place.
   *
   * WHAT IT BUYS: a returning scanned form can be reconciled against an expectation
   * instead of classified. A short return (page 2 of 3 missing) becomes a detectable
   * event rather than a silently-filed partial record. Absence is the exposure a
   * classifier structurally cannot see, and for a DMH / 42 CFR Part 2 audit that is
   * the whole risk surface.
   *
   * DECLARATION ONLY, and unset everywhere on purpose. Nothing reads this yet: there
   * is no reconciliation logic, no gate, and no UI. Page counts are not knowable
   * until blank-template mode actually generates the PDFs, and a guessed count is
   * worse than none — it would assert a shortfall that isn't real, or mask one that
   * is. Populate it from generated output, never by estimate.
   */
  expectedPages?: number;
  /**
   * SOFT RETIREMENT. The form is withdrawn from every surface a human can pick it
   * from, but its registry entry and its FormDefinition REMAIN so historical
   * submissions keep resolving a real title and rendering real field labels.
   *
   * A hard delete would be wrong here: `form_submissions.form_id` is free text with
   * no FK, `assignForm` does not reject unknown ids, and removing a definition drops
   * every past row for that form to key-based fallback rendering. A retired clinical
   * record must still print as what it was.
   *
   * FILTER (hide) vs LOOKUP (keep) is the whole distinction:
   *   FILTER  — FormLibrary cards, the assign picker, the portal list. Anywhere a
   *             person chooses a form to fill or assign.
   *   KEEP    — ClientFormsTab / packetReadiness / formRecordCategory / assignForm's
   *             metadata read. Anywhere an id is resolved to a label for a row that
   *             already exists. Filtering these would blank the names of real records.
   */
  retired?: boolean;
}

/** Public href for a form's blank PDF twin. The ONE place the path shape lives. */
export const pdfPathFor = (pdfSlug: string): string => `/forms/${pdfSlug}.pdf`;

/** Absolute URL for sharing (staff copy-link) — needs a browser origin. */
export const pdfUrlFor = (pdfSlug: string): string =>
  `${window.location.origin}${pdfPathFor(pdfSlug)}`;

export const FORM_REGISTRY: FormRegistryEntry[] = [
  // ── Core required (client-signed) — the 3.206(13)(F) cert-gate set ──────────
  { id: 'consent-treatment',     title: 'Consent for Treatment',                 category: 'Legal',   audience: 'client', requiredForCompletion: true,  description: 'Treatment & responsibility agreement (attendance, fees, abstinence, testing).' },
  { id: 'hipaa-ack',             title: 'HIPAA Notice Acknowledgement',          category: 'Legal',   audience: 'client', requiredForCompletion: true,  description: 'Acknowledgement of ACS’s HIPAA Notice of Privacy Practices.' },
  { id: 'authorization-release', title: 'Authorization for Release of Information', category: 'Legal', audience: 'client', requiredForCompletion: true, description: 'Authorizes the DMH + DOR completion notice and disclosures to court/attorney/PO.' },
  { id: 'telehealth-consent',    title: 'Telehealth Informed Consent',           category: 'Legal',   audience: 'client', requiredForCompletion: true,  description: 'Consent to telehealth delivery (42 CFR Part 2 confidentiality applies).' },
  { id: 'satop-checklist',       title: 'Orientation Checklist',                 category: 'Intake',  audience: 'client', requiredForCompletion: true,  description: 'SATOP client orientation acknowledgements.' },
  { id: 'emergency-contact',     title: 'Emergency Contact',                     category: 'Intake',  audience: 'client', requiredForCompletion: true,  description: 'Emergency contact and disclosure authorization.' },

  // ── Client-facing, NOT a gate item ─────────────────────────────────────────
  // NEW 2026-08-05 — David: "ADD - SATOP Registration Form … this is the first and
  // base form for new SATOP clients." NOT a cert-gate item: the 3.206(13)(F) set is
  // fixed at the core 6 and adding to it would change what completion requires, which
  // David did not ask for. "First and base" = auto-assignment on client creation keyed
  // off clients.client_type (decision D5) — deliberately NOT wired in this commit.
  { id: 'satop-registration',    title: 'SATOP Registration Form',               category: 'Intake',    audience: 'client', requiredForCompletion: false, description: 'Registration details ACS collects when a client enters the SATOP program.' },
  // NEW 2026-08-05 — David: "ADD – Registration Form … this is the first and base
  // form for new OP (outpatient) clients." Same posture as satop-registration: not a
  // cert-gate item, and base-form auto-assignment is a separate pass.
  { id: 'registration',          title: 'Registration Form',                     category: 'Intake',    audience: 'client', requiredForCompletion: false, description: 'Registration details ACS collects when a client enters outpatient services.' },
  { id: 'satop-intake',          title: 'SATOP Client Intake',                   category: 'Intake',    audience: 'client', requiredForCompletion: false },
  { id: 'recovery-plan',         title: 'Continuing Recovery Plan',              category: 'Treatment', audience: 'client', requiredForCompletion: false },
  { id: 'telehealth-feedback',   title: 'Telehealth Session Feedback',           category: 'Clinical',  audience: 'client', requiredForCompletion: false },
  { id: 'late-cancellation',     title: 'Late Cancellation Policy',              category: 'Legal',     audience: 'client', requiredForCompletion: false },
  // AA/NA meeting report — client-submittable (Consent clause 7). Recurring self-help
  // count, NOT a binary gate item (deferred to a future count-criterion, like hours).
  // Title reconciled to the component's 2026-08-02 (was 'AA/NA Group Meeting Report'
  // here while MeetingReportForm rendered 'Support Group Meeting Report' — the two
  // catalogs disagreed, DEFERRED #36). David's Forms.docx calls it "Support Group
  // Meeting Report", so the component's title is the correct one and this follows it.
  { id: 'meeting-report',        title: 'Support Group Meeting Report',          category: 'Treatment', audience: 'client', requiredForCompletion: false },

  // ── Staff-authored / clinical (not portal, not gate) ───────────────────────
  { id: 'treatment-plan',        title: 'Individual Comprehensive Treatment Plan', category: 'Treatment', audience: 'staff', requiredForCompletion: false },
  { id: 'discharge-summary',     title: 'Clinical Discharge Summary',            category: 'Clinical',  audience: 'staff', requiredForCompletion: false },
  // RETIRED 2026-08-02 — David: "Chart Review – Not needed and similar to another
  // form". Dan's decision D1: soft-retire only; the "Client Status Report" rename in
  // David's note is deliberately NOT actioned. Zero submissions ever existed.
  { id: 'chart-checklist',       title: 'Chart Review',                          category: 'Clinical',  audience: 'staff', requiredForCompletion: false, retired: true },
  // RETIRED 2026-08-02 — David: "Session Attendance – not needed, delete".
  // Zero submissions ever existed.
  { id: 'session-attendance',    title: 'Session Attendance',                    category: 'Clinical',  audience: 'staff', requiredForCompletion: false, retired: true },
];

export const FORM_REGISTRY_BY_ID: Record<string, FormRegistryEntry> =
  Object.fromEntries(FORM_REGISTRY.map((f) => [f.id, f]));

/** Is `id` a known registry form? (assignForm validates against this — but does NOT
 *  hard-reject unknown ids: non-SATOP program intakes still persist, just unmatched.) */
export const isRegistryForm = (id: string): boolean => id in FORM_REGISTRY_BY_ID;

/** Client-facing forms (portal) — retired forms are never offered. */
export const CLIENT_REGISTRY_FORMS = FORM_REGISTRY.filter((f) => f.audience === 'client' && !f.retired);

/** Forms a person may still CHOOSE to fill or assign. Use this for any picker;
 *  use FORM_REGISTRY / FORM_REGISTRY_BY_ID when resolving an id that already exists. */
export const ASSIGNABLE_REGISTRY_FORMS = FORM_REGISTRY.filter((f) => !f.retired);

/** Is this form withdrawn from the pickers? Historical rows still resolve normally. */
export const isRetiredForm = (id: string): boolean => FORM_REGISTRY_BY_ID[id]?.retired === true;

// Required-for-completion form ids by SATOP level — mirrors REQUIRED_HOURS_BY_LEVEL.
// All four levels map to the same core 6 today; the per-level shape is the hook for
// later refinement (e.g. if ACS ever lightens OEP).
const CORE_REQUIRED_FORM_IDS = [
  'consent-treatment', 'hipaa-ack', 'authorization-release',
  'telehealth-consent', 'satop-checklist', 'emergency-contact',
];
export const REQUIRED_FORMS_BY_LEVEL: Record<SatopLevel, string[]> = {
  I: CORE_REQUIRED_FORM_IDS,
  II: CORE_REQUIRED_FORM_IDS,
  III: CORE_REQUIRED_FORM_IDS,
  IV: CORE_REQUIRED_FORM_IDS,
};
