/**
 * Field EMISSION — the single source of truth for "what stored value does
 * editing a field of type X produce?"  BaseFormTemplate's render/onChange path
 * imports these; scripts/formIntegrityCheck.tsx's producible-value model imports
 * the SAME functions. Not a mirror, not a copy — the same code. This is what
 * closes the drift gap: a change to what the renderer emits is, by construction,
 * a change to what the integrity gate models, so the gate can no longer be blind
 * to renderer-side regressions (the class that produced every form bug on
 * 2026-07-16 — dotted-id disconnect, object→text clobber, rating type mismatch).
 *
 * Emission is DISTINCT from validation (config/formValidation.ts) — this module
 * says what value an editor yields; the validator says whether a value is
 * acceptable. The invariant check compares emission against validation, so
 * breaking emission here is still caught there.
 */
import type { FieldDefinition } from '../types';

/** The distinct editor families BaseFormTemplate renders. */
export type EditorKind = 'text' | 'numeric' | 'boolean' | 'select' | 'checkbox-group' | 'readonly';

/** Is this value the {key: boolean} map a CheckboxGroup stores? */
export const isBooleanMap = (v: any): v is Record<string, boolean> =>
  v != null && typeof v === 'object' && !Array.isArray(v) &&
  Object.values(v).length > 0 && Object.values(v).every((x) => typeof x === 'boolean');

/**
 * Which editor renders for this field. Legacy 'object' splits on its value:
 * a boolean map gets the derived CheckboxGroup, anything else is read-only
 * (no editor can produce a value — that's intentional, it must not be a text
 * input that clobbers the shape).
 */
export const editorKindFor = (field: Pick<FieldDefinition, 'type'>, value: any): EditorKind => {
  switch (field.type) {
    case 'select': return 'select';
    case 'checkbox-group': return 'checkbox-group';
    case 'object': return isBooleanMap(value) ? 'checkbox-group' : 'readonly';
    case 'boolean': return 'boolean';
    case 'number': return 'numeric';
    case 'rating': return 'numeric'; // ← 2026-07-16 rating fix. Remove this line and // ← 2026-07-16 rating fix. Remove this line and
                                     //   'rating' falls to the text default → strings →
                                     //   validation (strict typeof number) rejects →
                                     //   check:forms goes RED. That is the drift the gate
                                     //   now catches because this fn is the ONE source.
    default: return 'text';          // text / textarea / tel / email / date / password
  }
};

/**
 * The stored value produced when a text-family editor emits raw string `raw`.
 * The numeric coercion is exactly where the rating bug lived: 'rating' must land
 * as a number (validation is strictly typeof === 'number'; ratings get
 * aggregated), and <input type="rating"> is not a real input type so it degrades
 * to text. Empty stays '' (never NaN).
 */
export const coerceTextInput = (kind: EditorKind, raw: string): string | number =>
  kind === 'numeric' ? (raw === '' ? '' : parseInt(raw, 10)) : raw;

/** The <input type> a text-family field renders with ('rating' has none → number). */
export const inputTypeFor = (fieldType: FieldDefinition['type']): string =>
  fieldType === 'rating' ? 'number' : fieldType;
