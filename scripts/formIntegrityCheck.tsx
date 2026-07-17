/**
 * Form integrity check — run before every promote that touches the renderer
 * (BaseFormTemplate), validation (config/formValidation.ts), path resolution
 * (config/fieldPath.ts), or any form definition.
 *
 *   npm run check:forms
 *
 * Three gates, exit code 1 if any fails:
 *
 * 1. SUBMITTABILITY INVARIANT (all 14 forms, from code alone — needs no rows):
 *    for every REQUIRED field, does there EXIST a value the rendered editor can
 *    actually produce that clears that field's error in the composed check
 *    ({ ...requiredFieldErrors, ...validateStep })? "An editor exists" is not
 *    enough — the editor must be able to make the field PASS. This is the check
 *    that catches, from zero rows: satop-checklist's dotted-id disconnect (dead
 *    since it shipped), meeting-report's object→text clobber trap (1b made it
 *    mandatory), and telehealth-feedback's rating type mismatch (renderer
 *    stored strings, validator demanded numbers).
 *
 * 2. GROUND-TRUTH REPLAY: the 17 renderer-provenance form_submissions rows that
 *    existed on 2026-07-16 (test personas — Flower Tester / Brandon Hale /
 *    Travis Becker, fake contact values), replayed through the composed check.
 *    Expected: 14 clean; exactly 3 known blocks (previousSatop null,
 *    offense/conviction dates empty, paymentsToDate null — the answered-not-true
 *    boolean rule firing as designed). Any other outcome = regression.
 *
 * 3. COMMITTED-RECORD DRIFT: PrintPreview of mixed-shape authorization-release
 *    row 47431370 (flat dotted keys carrying data + nested empties — the legacy
 *    shape that must never re-blank), rendered with a frozen clock and compared
 *    byte-for-byte against the checked-in baseline. Regenerate the baseline
 *    ONLY on an intentional, gated committed-record change.
 */
import React from 'react';
import { requiredFieldErrors } from '../config/formValidation';
import { resolveFieldValue, setByPath } from '../config/fieldPath';
import { editorKindFor, coerceTextInput, isBooleanMap } from '../config/fieldInput';
import type { FieldDefinition } from '../types';
import { CONSENT_FORM_DEFINITION } from '../components/forms/ConsentForTreatmentForm';
import { HIPAA_ACK_DEFINITION } from '../components/forms/HipaaAckForm';
import { AUTHORIZATION_RELEASE_DEFINITION } from '../components/forms/AuthorizationForReleaseForm';
import { TELEHEALTH_CONSENT_DEFINITION } from '../components/forms/TelehealthConsentForm';
import { SATOP_CHECKLIST_DEFINITION } from '../components/forms/SatopChecklistForm';
import { EMERGENCY_CONTACT_DEFINITION } from '../components/forms/EmergencyContactForm';
import { SATOP_INTAKE_DEFINITION } from '../components/forms/SatopClientIntakeForm';
import { RECOVERY_PLAN_DEFINITION } from '../components/forms/ContinuingRecoveryPlanForm';
import { TELEHEALTH_FEEDBACK_DEFINITION } from '../components/forms/TelehealthFeedbackForm';
import { LATE_CANCELLATION_DEFINITION } from '../components/forms/LateCancellationForm';
import { MEETING_REPORT_DEFINITION } from '../components/forms/MeetingReportForm';
import { DISCHARGE_SUMMARY_DEFINITION } from '../components/forms/DischargeSummaryForm';
import { CHART_CHECKLIST_DEFINITION } from '../components/forms/ChartChecklistForm';
import { SESSION_ATTENDANCE_DEFINITION } from '../components/forms/SessionAttendanceForm';
import groundTruth from './fixtures/form-submissions-ground-truth.json';

const ALL: any[] = [
  CONSENT_FORM_DEFINITION, HIPAA_ACK_DEFINITION, AUTHORIZATION_RELEASE_DEFINITION,
  TELEHEALTH_CONSENT_DEFINITION, SATOP_CHECKLIST_DEFINITION, EMERGENCY_CONTACT_DEFINITION,
  SATOP_INTAKE_DEFINITION, RECOVERY_PLAN_DEFINITION, TELEHEALTH_FEEDBACK_DEFINITION,
  LATE_CANCELLATION_DEFINITION, MEETING_REPORT_DEFINITION, DISCHARGE_SUMMARY_DEFINITION,
  CHART_CHECKLIST_DEFINITION, SESSION_ATTENDANCE_DEFINITION,
];

let failures = 0;
const fail = (msg: string) => { failures++; console.error('FAIL  ' + msg); };

const compose = (def: any, data: any): Record<string, string> => ({
  ...requiredFieldErrors(def.fieldDefinitions, data),
  ...def.validateStep(data),
});

/**
 * Values the RENDERED EDITOR for this field can actually emit — DERIVED from the
 * shared emission source config/fieldInput.ts (editorKindFor + coerceTextInput),
 * the SAME functions BaseFormTemplate's render/onChange path uses. This is what
 * makes the invariant honest: it is not a hand-mirror of the renderer, it runs
 * the renderer's own emission code. A change to what the renderer emits changes
 * this automatically. The text/numeric candidates run through coerceTextInput
 * exactly as the <input>'s onChange does — the rating bug (string emission) is
 * caught here because coerceTextInput is the one place that coercion lives.
 */
const producibleValues = (field: FieldDefinition, initialValue: any): any[] => {
  const kind = editorKindFor(field, initialValue);
  switch (kind) {
    case 'boolean': return [true, false];                                        // checkbox emits e.target.checked
    case 'numeric': return [                                                      // number input → coerceTextInput
      coerceTextInput(kind, String(field.min ?? 1)),
      coerceTextInput(kind, String(field.max ?? 5)),
    ];
    case 'select': return (field.options ?? []).map((o) => o.value);             // RadioGroupString emits option.value
    case 'checkbox-group': {                                                      // toggle merge, one key → true
      const opts = field.options?.map((o) => o.value)
        ?? (isBooleanMap(initialValue) ? Object.keys(initialValue) : []);
      return opts.map((k) => ({ ...(isBooleanMap(initialValue) ? initialValue : {}), [k]: true }));
    }
    case 'readonly': return [];                                                   // no editor — nothing producible
    default: return [coerceTextInput(kind, 'test value 1234')];                   // text family → coerceTextInput
  }
};

console.log('=== 1) SUBMITTABILITY INVARIANT (all 14 forms) ===');
for (const def of ALL) {
  const init = JSON.parse(JSON.stringify(def.initialState));
  const requiredFields = def.fieldDefinitions.filter((f: FieldDefinition) => f.required);
  let formOk = true;
  for (const field of requiredFields) {
    const initialValue = resolveFieldValue(init, field.id);
    // Not erroring at initial state = submittable without touching it.
    if (!(field.id in compose(def, init))) continue;
    const candidates = producibleValues(field, initialValue);
    const cleared = candidates.some((v) => !(field.id in compose(def, setByPath(init, field.id, v))));
    if (!cleared) {
      formOk = false;
      fail(`${def.id} :: ${field.id} [${field.type}] — required, erroring, and NO editor-producible value clears it (candidates tried: ${JSON.stringify(candidates)})`);
    }
  }
  if (formOk) console.log(`ok    ${def.id} (${requiredFields.length} required fields all clearable)`);
}

console.log('\n=== 2) GROUND-TRUTH REPLAY (17 rows, 2026-07-16 snapshot) ===');
const DEFS: Record<string, any> = Object.fromEntries(ALL.map((d) => [d.id, d]));
const EXPECTED_BLOCKS: Record<string, string> = {
  'de51bb0d': 'previousSatop',
  '0d2f2f0a': 'convictionDate,offenseDate',
  '8b6e5ede': 'paymentsToDate',
};
let clean = 0, known = 0;
for (const row of groundTruth as any[]) {
  const keys = Object.keys(compose(DEFS[row.form_id], row.data)).sort();
  if (!keys.length) { clean++; continue; }
  if (EXPECTED_BLOCKS[row.id] === keys.join(',')) { known++; continue; }
  fail(`replay ${row.form_id} ${row.id} — unexpected errors: ${keys.join(',')}`);
}
if (clean === 14 && known === 3) console.log(`ok    replay: ${clean} clean, ${known} known-blocks, 0 unexpected`);
else fail(`replay totals wrong: ${clean} clean (want 14), ${known} known-blocks (want 3)`);

console.log('\n=== 3) COMMITTED-RECORD DRIFT (PrintPreview vs baseline) ===');
// Frozen clock BEFORE rendering — PrintPreview stamps new Date() twice.
const FIXED = new Date('2026-07-16T12:00:00Z').valueOf();
const RealDate = Date;
// @ts-ignore
global.Date = class extends RealDate {
  constructor(...args: any[]) {
    // @ts-ignore
    super(...(args.length ? args : [FIXED]));
  }
  static now() { return FIXED; }
} as DateConstructor;
// Deferred require so the frozen clock is active when the component renders.
const { renderToStaticMarkup } = require('react-dom/server');
const { PrintPreview } = require('../components/PrintPreview');
const row47431370 = require('./fixtures/row-47431370.json');
// Resolve from cwd (npm scripts run at repo root) — the bundle's __dirname is node_modules/.cache.
const baseline = require('fs').readFileSync(require('path').join(process.cwd(), 'scripts/fixtures/printpreview-47431370.baseline.html'), 'utf8');
const rendered = renderToStaticMarkup(
  React.createElement(PrintPreview, { formData: row47431370, formDefinition: AUTHORIZATION_RELEASE_DEFINITION }),
);
if (rendered === baseline) console.log(`ok    PrintPreview byte-identical to baseline (${rendered.length} chars)`);
else fail(`PrintPreview drift: rendered ${rendered.length} chars vs baseline ${baseline.length}. If this change is INTENTIONAL and gated, regenerate the baseline.`);

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL GREEN');
process.exit(failures ? 1 : 0);
