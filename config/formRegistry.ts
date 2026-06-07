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
}

export const FORM_REGISTRY: FormRegistryEntry[] = [
  // ── Core required (client-signed) — the 3.206(13)(F) cert-gate set ──────────
  { id: 'consent-treatment',     title: 'Consent for Treatment',                 category: 'Legal',   audience: 'client', requiredForCompletion: true,  description: 'Treatment & responsibility agreement (attendance, fees, abstinence, testing).' },
  { id: 'hipaa-ack',             title: 'HIPAA Notice Acknowledgement',          category: 'Legal',   audience: 'client', requiredForCompletion: true,  description: 'Acknowledgement of ACS’s HIPAA Notice of Privacy Practices.' },
  { id: 'authorization-release', title: 'Authorization for Release of Information', category: 'Legal', audience: 'client', requiredForCompletion: true, description: 'Authorizes the DMH + DOR completion notice and disclosures to court/attorney/PO.' },
  { id: 'telehealth-consent',    title: 'Telehealth Informed Consent',           category: 'Legal',   audience: 'client', requiredForCompletion: true,  description: 'Consent to telehealth delivery (42 CFR Part 2 confidentiality applies).' },
  { id: 'satop-checklist',       title: 'Orientation Checklist',                 category: 'Intake',  audience: 'client', requiredForCompletion: true,  description: 'SATOP client orientation acknowledgements.' },
  { id: 'emergency-contact',     title: 'Emergency Contact',                     category: 'Intake',  audience: 'client', requiredForCompletion: true,  description: 'Emergency contact and disclosure authorization.' },

  // ── Client-facing, NOT a gate item ─────────────────────────────────────────
  { id: 'satop-intake',          title: 'SATOP Client Intake',                   category: 'Intake',    audience: 'client', requiredForCompletion: false },
  { id: 'recovery-plan',         title: 'Continuing Recovery Plan',              category: 'Treatment', audience: 'client', requiredForCompletion: false },
  { id: 'telehealth-feedback',   title: 'Telehealth Session Feedback',           category: 'Clinical',  audience: 'client', requiredForCompletion: false },
  { id: 'late-cancellation',     title: 'Late Cancellation Policy',              category: 'Legal',     audience: 'client', requiredForCompletion: false },
  // AA/NA meeting report — client-submittable (Consent clause 7). Recurring self-help
  // count, NOT a binary gate item (deferred to a future count-criterion, like hours).
  { id: 'meeting-report',        title: 'AA/NA Group Meeting Report',            category: 'Treatment', audience: 'client', requiredForCompletion: false },

  // ── Staff-authored / clinical (not portal, not gate) ───────────────────────
  { id: 'treatment-plan',        title: 'Individual Comprehensive Treatment Plan', category: 'Treatment', audience: 'staff', requiredForCompletion: false },
  { id: 'discharge-summary',     title: 'Clinical Discharge Summary',            category: 'Clinical',  audience: 'staff', requiredForCompletion: false },
  { id: 'chart-checklist',       title: 'Chart Review',                          category: 'Clinical',  audience: 'staff', requiredForCompletion: false },
  { id: 'session-attendance',    title: 'Session Attendance',                    category: 'Clinical',  audience: 'staff', requiredForCompletion: false },
];

export const FORM_REGISTRY_BY_ID: Record<string, FormRegistryEntry> =
  Object.fromEntries(FORM_REGISTRY.map((f) => [f.id, f]));

/** Is `id` a known registry form? (assignForm validates against this — but does NOT
 *  hard-reject unknown ids: non-SATOP program intakes still persist, just unmatched.) */
export const isRegistryForm = (id: string): boolean => id in FORM_REGISTRY_BY_ID;

/** Client-facing forms (portal). */
export const CLIENT_REGISTRY_FORMS = FORM_REGISTRY.filter((f) => f.audience === 'client');

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
