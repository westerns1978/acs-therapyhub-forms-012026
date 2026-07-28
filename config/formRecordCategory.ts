/**
 * FORM → TAB MAPPING (L4, David 7/15): which client-page tab a form lands in —
 * "Admin Documents" or "Clinical Documents".
 *
 * ACS will provide the authoritative form-by-form mapping; this module is the
 * MECHANISM. Until their list arrives, the default derives from each form's
 * existing formRegistry `category`. When ACS's mapping lands, put it in
 * FORM_RECORD_CATEGORY_OVERRIDES (keyed by form id) — overrides always win,
 * and nothing else needs to change.
 *
 * A form that resolves to null is UNMAPPED and renders in BOTH tabs (same
 * never-hide rule as unmapped upload types in config/recordCategory.ts).
 */
import { FORM_REGISTRY } from './formRegistry';
import type { RecordCategory } from './recordCategory';

/** ACS's form-by-form mapping drops in here. Key = form id (FORM_REGISTRY.id). */
export const FORM_RECORD_CATEGORY_OVERRIDES: Record<string, RecordCategory> = {
    // e.g. 'consent-treatment': 'Admin',
};

/** Default derivation from the registry's coarse category until ACS's list lands. */
const CATEGORY_DEFAULTS: Record<string, RecordCategory> = {
    Intake: 'Admin',
    Legal: 'Admin',
    Assessment: 'Clinical',
    Treatment: 'Clinical',
    Clinical: 'Clinical',
    Testing: 'Clinical',
};

export const formRecordCategoryOf = (formId: string | null | undefined): RecordCategory | null => {
    if (!formId) return null;
    const override = FORM_RECORD_CATEGORY_OVERRIDES[formId];
    if (override) return override;
    const entry = FORM_REGISTRY.find(f => f.id === formId);
    if (!entry) return null;
    return CATEGORY_DEFAULTS[entry.category] ?? null;
};
