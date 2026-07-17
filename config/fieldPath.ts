/**
 * Dotted-field-id path resolution for form data — the ONE shared resolver used by
 * BOTH the live renderer (BaseFormTemplate) and the committed-record renderer
 * (PrintPreview). Do not fork this logic: if the two ever drift, a committed
 * record can render differently from what the client saw and signed.
 *
 * Why literal-key-FIRST is load-bearing (2026-07-16 recon, GATE 1 blocker 2):
 * before this module existed, the renderer wrote dotted field ids as FLAT keys
 * (formData['courtInfo.name'] = 'x') while initialState carried the real NESTED
 * objects at their initial empty values. Live rows (e.g. authorization-release
 * 47431370) therefore hold BOTH shapes at once — the flat dotted key has the
 * user's data, the nested path has ''. Nested-first resolution would blank every
 * such value. Literal-first preserves old/mixed rows byte-for-byte; new rows
 * written via setByPath are nested-only and fall through to getByPath.
 */

/** Walk a dotted path through nested objects. Undefined at any gap. */
export const getByPath = (obj: any, path: string): any =>
  path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/**
 * Read a field value by field-definition id: exact stored key wins (legacy flat
 * dotted rows, and every non-dotted id), else resolve the id as a nested path.
 */
export const resolveFieldValue = (data: any, id: string): any =>
  data != null && Object.prototype.hasOwnProperty.call(data, id)
    ? data[id]
    : getByPath(data, id);

/**
 * Immutably set a (possibly dotted) field id as a NESTED path. 'checklist.rules'
 * updates formData.checklist.rules rather than creating a flat 'checklist.rules'
 * key — so validators and stored shapes see the real object structure.
 */
export const setByPath = <T extends object>(obj: T, path: string, value: any): T => {
  const dot = path.indexOf('.');
  if (dot === -1) return { ...obj, [path]: value };
  const head = path.slice(0, dot);
  const rest = path.slice(dot + 1);
  const child = (obj as any)[head];
  return {
    ...obj,
    [head]: setByPath(child && typeof child === 'object' ? child : {}, rest, value),
  } as T;
};
