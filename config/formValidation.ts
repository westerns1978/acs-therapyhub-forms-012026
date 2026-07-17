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
import { isFieldVisible } from './fieldVisibility';

export const requiredFieldErrors = (
  fieldDefinitions: FieldDefinition[],
  data: any,
): Record<string, string> => {
  const errs: Record<string, string> = {};
  for (const field of fieldDefinitions) {
    // A hidden field is not enforced — the renderer and this validator consult
    // the SAME isFieldVisible() on the same data (config/fieldVisibility.ts), so
    // "required but invisible + unresolvable" cannot happen.
    if (!field.required || !isFieldVisible(field, data)) continue;
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
      case 'select':
        // Stores option.value as a string; ''/null = unanswered.
        empty = String(v ?? '').trim() === '';
        break;
      case 'checkbox-group':
      case 'object': {
        // Shared boolean-map rule: a required multi-select needs >= 1 selection.
        // 'checkbox-group' is the explicit new type; 'object' is the legacy map
        // type (groupDays / meetingType / reasonForDischarge) with identical
        // stored shape. Without the explicit case, 'checkbox-group' would fall
        // to the default text rule where String(map) = '[object Object]' is
        // never empty — a required group with zero selections would pass.
        if (v == null) { empty = true; break; }
        if (typeof v !== 'object') { empty = String(v).trim() === ''; break; }
        const vals = Object.values(v);
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
