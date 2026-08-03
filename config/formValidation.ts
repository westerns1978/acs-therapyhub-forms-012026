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
import { editorKindFor } from './fieldInput';

export const requiredFieldErrors = (
  fieldDefinitions: FieldDefinition[],
  data: any,
): Record<string, string> => {
  const errs: Record<string, string> = {};
  for (const field of fieldDefinitions) {
    // A hidden field is not enforced — the renderer and this validator consult
    // the SAME isFieldVisible() on the same data (config/fieldVisibility.ts), so
    // "required but invisible + unresolvable" cannot happen.
    // 'static' is document prose, not a question — it can never be answered, so it
    // can never be required. Skipped before the required check so that a definition
    // which mistakenly marks a paragraph required cannot make the form unsubmittable.
    if (field.type === 'static') continue;
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

/**
 * Generic min/max enforcement, derived from fieldDefinitions[].min / .max —
 * P0/D2 (2026-08-02). Composed in BaseFormTemplate.handleSubmit alongside
 * requiredFieldErrors, BEFORE the form's own validateStep, so validateStep can
 * still override the message but can no longer be the only thing standing
 * between a declared constraint and the database.
 *
 * WHY THIS EXISTS. `authorization-release` declared
 * `{ id:'ssn', label:'SSN (last 4 digits)', type:'text', min:4, max:4 }` and
 * stored a full nine-digit SSN. Nothing enforced it:
 *
 *   • the renderer passed min/max through to the <input>, where they are INERT
 *     on type="text" — they apply only to number/date/range (hence the measured
 *     `maxLength = -1`);
 *   • BaseFormTemplate has no <form> element and submits from onClick, so native
 *     constraint validation never runs for anything;
 *   • the form's own rule was a floor (`length < 4`), which nine digits passes.
 *
 * So the label promised last-4 and the record kept the whole identifier, on a
 * 42 CFR Part 2 chart. See docs/qa/e2e-smoke-2026-08.md, D-5.
 *
 * THE TYPE RULE: min/max mean STRING LENGTH on the text family (text, textarea,
 * tel, email, password, date) and VALUE BOUNDS on the numeric family (number,
 * rating). Same declaration, different meaning per editor — which is why this
 * reads the editor family from the one shared source (config/fieldInput.ts)
 * rather than re-deciding it.
 *
 * REJECT, NEVER TRUNCATE. A client typing nine digits is told; their input is
 * not silently edited underneath them.
 */
export const lengthFieldErrors = (
  fieldDefinitions: FieldDefinition[],
  data: any,
): Record<string, string> => {
  const errs: Record<string, string> = {};
  for (const field of fieldDefinitions) {
    if (field.type === 'static') continue;
    if (field.min == null && field.max == null) continue;
    if (!isFieldVisible(field, data)) continue;

    const v = resolveFieldValue(data, field.id);
    const kind = editorKindFor(field, v);

    if (kind === 'numeric') {
      // Bounds. Required-ness (and the rating floor) is requiredFieldErrors' job;
      // this adds the ceiling nothing enforced, and the floor for optional answers.
      if (typeof v !== 'number' || Number.isNaN(v)) continue;
      if (field.max != null && v > field.max) errs[field.id] = `Enter ${field.min ?? 0}–${field.max}.`;
      else if (field.min != null && v < field.min) errs[field.id] = `Enter ${field.min}–${field.max ?? '∞'}.`;
      continue;
    }
    if (kind !== 'text') continue; // boolean / select / checkbox-group / readonly have no length

    // An empty optional field is not a length violation — that distinction
    // belongs to `required`, and doubling up would make every blank optional
    // field with a min unsubmittable.
    const s = String(v ?? '');
    if (s.length === 0) continue;

    if (field.min != null && field.max != null && field.min === field.max) {
      if (s.length !== field.min) errs[field.id] = `Enter exactly ${field.min} characters.`;
    } else if (field.max != null && s.length > field.max) {
      errs[field.id] = `Enter at most ${field.max} characters.`;
    } else if (field.min != null && s.length < field.min) {
      errs[field.id] = `Enter at least ${field.min} characters.`;
    }
  }
  return errs;
};
