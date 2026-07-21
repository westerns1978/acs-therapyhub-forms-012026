/**
 * Coarse Admin / Clinical grouping over the EXISTING `uploaded_files.document_type`
 * values (P2 capture consolidation, 2026-07-21). This is a DERIVE, not a write: the
 * document_type column is unchanged (plain `text`, no CHECK — verified live), and no
 * new column is introduced. David asked to "choose on upload" and to see records
 * grouped Admin vs Clinical; this map drives both.
 *
 * Grounding — David's examples (ACS Updates): Admin = consent, HIPAA, demographic,
 * court order; Clinical = intake, OMU, progress note, group note, drug screen,
 * assessment. Only REAL document_type values are keyed here — no synthetic types are
 * invented. Anything unmapped (verification_slip, completion_certificate, other,
 * profile, null, or a non-ACS value from the shared table) returns null and is
 * SURFACED for the user to pick — never silently bucketed.
 */

export type RecordCategory = 'Admin' | 'Clinical';

// document_type (raw, existing values) → coarse bucket.
export const RECORD_CATEGORY: Record<string, RecordCategory> = {
  // Admin — legal / identity / billing.
  consent: 'Admin',          // David: consent
  court_order: 'Admin',      // David: court order
  id_copy: 'Admin',          // identity / demographic — David's "demographic"
  billing_record: 'Admin',   // billing is administrative, never clinical
  // Clinical — the treatment record.
  intake_form: 'Clinical',   // David: intake
  treatment_plan: 'Clinical',// David: assessment / OMU treatment planning
  progress_note: 'Clinical', // David: progress note / group note
  drug_screen: 'Clinical',   // David: drug screen
};

/** The coarse bucket for a raw document_type, or null when unmapped (→ user picks). */
export function recordCategoryOf(documentType?: string | null): RecordCategory | null {
  if (!documentType) return null;
  return RECORD_CATEGORY[documentType] ?? null;
}

/** True when a document_type is one the picker can pre-select (i.e. it is mapped). */
export function isCategorizable(documentType?: string | null): boolean {
  return !!documentType && documentType in RECORD_CATEGORY;
}

export interface DocTypeOption { value: string; label: string; }

/**
 * The pickable options for the capture category step, grouped by bucket. Labels
 * mirror api.ts DOC_TYPE_LABELS. Only mapped (categorizable) types are offered; an
 * AI inference outside this set leaves the picker unselected so the user must choose.
 */
export const CATEGORY_OPTIONS: Record<RecordCategory, DocTypeOption[]> = {
  Admin: [
    { value: 'consent',        label: 'Consent' },
    { value: 'court_order',    label: 'Court Order' },
    { value: 'id_copy',        label: 'ID / License' },
    { value: 'billing_record', label: 'Billing' },
  ],
  Clinical: [
    { value: 'intake_form',    label: 'Intake' },
    { value: 'treatment_plan', label: 'Treatment Plan' },
    { value: 'progress_note',  label: 'Progress Note' },
    { value: 'drug_screen',    label: 'Drug Screen' },
  ],
};

export const RECORD_CATEGORY_ORDER: RecordCategory[] = ['Admin', 'Clinical'];
