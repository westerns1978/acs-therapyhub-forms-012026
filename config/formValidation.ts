/**
 * Generic required-field enforcement, derived from fieldDefinitions[].required —
 * GATE 1 design (2026-07-16). Runs in BaseFormTemplate.handleSubmit BEFORE the
 * form's own validateStep; composition is
 *
 *   { ...requiredFieldErrors(...), ...validateStep(data) }
 *
 * so validateStep ADDS rules (format, must-be-true, cross-field) and WINS on
 * message, but can no longer be the only source of required-ness.
 *
 * THE BOOLEAN RULE (accepted at GATE 1): required means ANSWERED, not true.
 * `false` passes — "I do NOT give permission" / "No, payments are not up to
 * date" are valid answers; only a never-touched tri-state (null/undefined)
 * blocks. Must-be-true consent boxes are validateStep's job (witnessed: the
 * satop-checklist loop fires on answered-false).
 *
 * Reads go through resolveFieldValue so dotted ids (checklist.clientRights,
 * courtInfo.name) resolve nested-or-legacy-flat exactly as the renderer does.
 */
import type { FieldDefinition } from '../types';
import { resolveFieldValue } from './fieldPath';

export const requiredFieldErrors = (
  fieldDefinitions: FieldDefinition[],
  data: any,
): Record<string, string> => {
  const errs: Record<string, string> = {};
  for (const field of fieldDefinitions) {
    if (!field.required) continue;
    const v = resolveFieldValue(data, field.id);
    let empty: boolean;
    switch (field.type) {
      case 'boolean':
        // Answered, not true. null/undefined = never answered.
        empty = v == null;
        break;
      case 'rating':
        // Ratings initialize to 0 = unanswered; min (default 1) is the floor.
        empty = !(typeof v === 'number' && v >= (field.min ?? 1));
        break;
      case 'number':
        empty = v == null || v === '' || (typeof v === 'number' && Number.isNaN(v));
        break;
      case 'object': {
        if (v == null) { empty = true; break; }
        if (typeof v !== 'object') { empty = String(v).trim() === ''; break; }
        const vals = Object.values(v);
        // Boolean-map (CheckboxGroup shape) → at least one selection.
        empty = vals.length > 0 && vals.every((x) => typeof x === 'boolean')
          ? !vals.some(Boolean)
          : vals.every((x) => x == null || x === '');
        break;
      }
      default:
        // text / textarea / tel / email / date / password
        empty = String(v ?? '').trim() === '';
    }
    if (empty) errs[field.id] = 'Required.';
  }
  return errs;
};
