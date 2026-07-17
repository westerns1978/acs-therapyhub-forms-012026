/**
 * Field CONDITIONAL VISIBILITY — the single source of truth for "is this field
 * live right now?"  Same architecture, same reason as config/fieldInput.ts:
 * the render path, requiredFieldErrors, PrintPreview, and the integrity gate all
 * import ONE predicate function, so "hidden" cannot mean different things in
 * different places. A hidden required field enforced by a validator the user
 * can't see is exactly the bug class that bit us three times on 2026-07-16 — it
 * is structurally impossible here because the renderer and the validator ask the
 * same isFieldVisible() the same data.
 *
 * THE ORPHANED-VALUE INVARIANT (discharge summary is a clinical record):
 * new records NEVER store a hidden field's value — handleSubmit writes
 * stripHiddenValues(fieldDefinitions, formData), and the in-session print block
 * renders that SAME stripped data. So a non-empty value for a currently-hidden
 * field can only exist in a PRE-PREDICATE LEGACY ROW (stored before the field
 * became conditional). shouldPrintField therefore prints a hidden field IF its
 * stored value is non-empty: the committed record must show what is actually in
 * the record — censoring a legacy value at print would make the paper disagree
 * with the JSONB. Do NOT "simplify" shouldPrintField to always-skip-when-hidden;
 * that breaks legacy records. The strip happens at WRITE (one place), not at read.
 *
 * CAP: single-sibling strict equality, ONE level. A controller field (named in
 * some field's visibleWhen.field) may not itself carry a visibleWhen, and a
 * predicate may not reference a nonexistent field. Both are asserted RED by the
 * integrity gate — the cap is enforced, not hoped. Deeper logic is a gated
 * capability extension, not a silent allowance.
 */
import type { FieldDefinition } from '../types';
import { resolveFieldValue, setByPath } from './fieldPath';

/** Is `field` currently visible given the form's data? No predicate = always visible. */
export const isFieldVisible = (field: FieldDefinition, data: any): boolean => {
  if (!field.visibleWhen) return true;
  return resolveFieldValue(data, field.visibleWhen.field) === field.visibleWhen.equals;
};

/** Does the committed record print this field? Visible → yes. Hidden → only if a
 *  (legacy) stored value is present; see the invariant above. */
export const shouldPrintField = (field: FieldDefinition, data: any): boolean => {
  if (isFieldVisible(field, data)) return true;
  const v = resolveFieldValue(data, field.id);
  if (v == null || v === '') return false;
  if (typeof v === 'object') return Object.values(v).some((x) => x !== false && x != null && x !== '');
  return true;
};

/**
 * Return a copy of `data` with every currently-hidden field's value removed —
 * the ONE exclusion point, called at submit-payload construction and by the
 * in-session print. Dotted ids are cleared via the path helper so nested shapes
 * (checklist.*, courtInfo.*) strip correctly rather than leaving an orphan under
 * a flat key. A field with no stored value is left untouched (no spurious keys).
 */
export const stripHiddenValues = <T extends object>(
  fieldDefinitions: FieldDefinition[],
  data: T,
): T => {
  let out = data;
  for (const field of fieldDefinitions) {
    if (isFieldVisible(field, out)) continue;
    if (resolveFieldValue(out, field.id) === undefined) continue;
    // Clear to the empty-string sentinel every reader/validator already treats
    // as "unanswered" (never delete: a missing key vs an empty value read the
    // same downstream, and setByPath keeps nested structure intact).
    out = setByPath(out, field.id, '');
  }
  return out;
};

/**
 * Structural cap check for the integrity gate. Returns the list of violations
 * (empty = ok): a predicate whose controller field id doesn't exist, or a
 * controller that itself carries a visibleWhen (a chain). Both are unsupported.
 */
export const visibilityCapViolations = (fieldDefinitions: FieldDefinition[]): string[] => {
  const ids = new Set(fieldDefinitions.map((f) => f.id));
  const withPredicate = fieldDefinitions.filter((f) => f.visibleWhen);
  const violations: string[] = [];
  for (const f of withPredicate) {
    const ctrlId = f.visibleWhen!.field;
    if (!ids.has(ctrlId)) {
      violations.push(`${f.id}: visibleWhen references nonexistent field '${ctrlId}'`);
      continue;
    }
    const ctrl = fieldDefinitions.find((x) => x.id === ctrlId)!;
    if (ctrl.visibleWhen) {
      violations.push(`${f.id}: controller '${ctrlId}' itself has a visibleWhen (chains unsupported — declare flatter)`);
    }
  }
  return violations;
};
