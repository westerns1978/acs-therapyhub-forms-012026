/**
 * Form integrity check — run before every promote that touches the renderer
 * (BaseFormTemplate), validation (config/formValidation.ts), path resolution
 * (config/fieldPath.ts), or any form definition.
 *
 *   npm run check:forms
 *
 * Five gates, exit code 1 if any fails:
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
 *
 * 4. PDF TWIN EXISTENCE: every FORM_REGISTRY entry carrying a `pdfSlug` must have
 *    public/forms/<pdfSlug>.pdf on disk. This gate exists because the failure it
 *    catches is INVISIBLE at runtime: firebase.json rewrites `**` to /index.html,
 *    and Firebase consults that rewrite whenever no static file matched — so a
 *    missing or misspelled PDF is answered with HTTP 200 and the SPA shell, not a
 *    404. The staff copy-link and the client download would both "work", and what
 *    lands is the app, not the form. Nothing at runtime can tell the difference;
 *    only a disk check before shipping can.
 *
 * 5. SIGNATURE FIELD REGISTRATION: the two halves of PrintPreview's SIGNATURE_FIELD_IDS
 *    contract, which D-i made load-bearing. (a) every signature-ish field any of the 14
 *    definitions declares must BE in the set — otherwise it prints as an ordinary data
 *    row, the defect D-i fixed for counselor/therapist. (b) every id in the set must be
 *    RENDERED by an attestation block — otherwise, since membership removes the field
 *    from the print loop, the signature vanishes from the record entirely. (b) is
 *    probed by rendering, not by a second list, so it cannot go stale. The definition
 *    of "signature-ish" is stated at the gate.
 */
/**
 * PINNED TIMEZONE. PrintPreview renders dates with toLocaleDateString and the
 * signature block with toLocaleString — both read the AMBIENT timezone, so a
 * committed baseline would otherwise encode whichever zone the machine that
 * generated it happened to be in. The date-only header hid this (7/16/2026 is
 * the same in most zones); the signature block does not (7:00:00 AM in Chicago,
 * 12:00:00 PM in UTC, from the same instant), so gate 3 would go red on CI or on
 * a colleague's laptop for a reason unrelated to the code.
 *
 * America/Chicago because ACS is in St. Louis — the zone a commit time on their
 * paperwork actually means something in.
 *
 * Set here rather than as a `TZ=… ` prefix in the npm script because that syntax
 * does not work under cmd.exe, and this repo deliberately stays cross-platform
 * without cross-env (see scripts/deploy.mjs). Node applies a runtime assignment
 * to process.env.TZ immediately; verified against an ambient TZ=UTC run.
 */
process.env.TZ = 'America/Chicago';

import React from 'react';
import { requiredFieldErrors } from '../config/formValidation';
import { resolveFieldValue, setByPath } from '../config/fieldPath';
import { editorKindFor, coerceTextInput, isBooleanMap } from '../config/fieldInput';
import { isFieldVisible, visibilityCapViolations } from '../config/fieldVisibility';
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
import { FORM_REGISTRY } from '../config/formRegistry';
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
    case 'static': return [];                                                     // document prose — no value exists
    default: return [coerceTextInput(kind, 'test value 1234')];                   // text family → coerceTextInput
  }
};

// Can SOME producible value of `field` clear its own error, given base state `st`?
const clearable = (def: any, st: any, field: FieldDefinition): boolean => {
  if (!(field.id in compose(def, st))) return true; // not erroring here
  const candidates = producibleValues(field, resolveFieldValue(st, field.id));
  return candidates.some((v) => !(field.id in compose(def, setByPath(st, field.id, v))));
};

console.log('=== 1) SUBMITTABILITY INVARIANT (all 14 forms) ===');
for (const def of ALL) {
  const init = JSON.parse(JSON.stringify(def.initialState));
  let formOk = true;

  // CAP (enforced, not hoped): chains + dangling controllers are unsupported.
  for (const v of visibilityCapViolations(def.fieldDefinitions)) {
    formOk = false;
    fail(`${def.id} :: visibility cap — ${v}`);
  }

  const requiredFields = def.fieldDefinitions.filter((f: FieldDefinition) => f.required);
  for (const field of requiredFields) {
    if (field.visibleWhen) {
      // CONDITIONAL: a form is submittable if SOME reachable visibility state is
      // satisfiable. Two branches over the controller's editor.
      const ctrl = def.fieldDefinitions.find((f: FieldDefinition) => f.id === field.visibleWhen!.field)!;
      const ctrlKind = editorKindFor(ctrl, resolveFieldValue(init, ctrl.id));
      const ctrlVals = producibleValues(ctrl, resolveFieldValue(init, ctrl.id));
      const trigger = field.visibleWhen!.equals;
      // Can the user get the controller INTO the trigger state? A free-text /
      // numeric controller produces any value of its kind (types it); an
      // enumerated controller (select/checkbox-group/boolean) only its options.
      const triggerProducible =
        ctrlKind === 'text' ? typeof trigger === 'string'
        : ctrlKind === 'numeric' ? typeof trigger === 'number'
        : ctrlVals.some((cv) => cv === trigger);
      if (!triggerProducible) {
        formOk = false;
        fail(`${def.id} :: ${field.id} — visibleWhen trigger ${JSON.stringify(trigger)} not producible by controller '${ctrl.id}' [${ctrl.type}] — field unreachable`);
        continue;
      }
      // A value that makes the field HIDDEN (controller != trigger), or undefined
      // if the controller can only ever equal the trigger (field always visible).
      const hiddenVal =
        ctrlKind === 'text' ? (trigger === '' ? 'x' : '')
        : ctrlKind === 'numeric' ? (trigger === 0 ? 1 : 0)
        : ctrlVals.find((cv) => cv !== trigger);
      // Branch A (visible): controller at trigger → field must be clearable.
      const visSt = setByPath(init, ctrl.id, trigger);
      if (!isFieldVisible(field, visSt) || !clearable(def, visSt, field)) {
        formOk = false;
        fail(`${def.id} :: ${field.id} [${field.type}] — required & visible (${ctrl.id}=${JSON.stringify(trigger)}) but NO editor-producible value clears it`);
      }
      // Branch B (hidden): controller in a non-trigger state → NOT enforced.
      if (hiddenVal !== undefined) {
        const hidSt = setByPath(init, ctrl.id, hiddenVal);
        if (isFieldVisible(field, hidSt) || field.id in compose(def, hidSt)) {
          formOk = false;
          fail(`${def.id} :: ${field.id} — hidden (${ctrl.id}=${JSON.stringify(hiddenVal)}) but STILL enforced (a validateStep rule ignores visibility?) — unsubmittable dead-end`);
        }
      }
      continue;
    }
    // Unpredicated: erroring at initial state must be clearable by some editor value.
    if (!clearable(def, init, field)) {
      formOk = false;
      fail(`${def.id} :: ${field.id} [${field.type}] — required, erroring, and NO editor-producible value clears it (candidates: ${JSON.stringify(producibleValues(field, resolveFieldValue(init, field.id)))})`);
    }
  }
  if (formOk) {
    const nCond = requiredFields.filter((f: FieldDefinition) => f.visibleWhen).length;
    console.log(`ok    ${def.id} (${requiredFields.length} required fields all clearable${nCond ? `, ${nCond} conditional` : ''})`);
  }
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
const { PrintPreview, SIGNATURE_FIELD_IDS } = require('../components/PrintPreview');
const fs = require('fs');
const path = require('path');
// Resolve from cwd (npm scripts run at repo root) — the bundle's __dirname is node_modules/.cache.
const at = (p: string) => path.join(process.cwd(), p);

/**
 * THE FIXTURE TABLE. Each entry is one committed-record render pinned byte-for-byte.
 *
 * Chosen for RENDER-BRANCH COVERAGE, not one-per-form: PrintField has six value
 * branches and PrintPreview three structural ones, and they cluster in very few
 * forms. discharge-summary is the only form carrying select, checkbox-group AND
 * visibleWhen; telehealth-feedback is the only source of 'rating'. Forms whose
 * branches are already covered elsewhere (meeting-report's object map, duplicated
 * by consent-treatment's; satop-checklist's dotted ids, duplicated by
 * authorization-release's) are deliberately NOT fixtured — a fixture that
 * exercises no new path is maintenance cost with no coverage gain.
 *
 * Adding a form here is cheap (the whole gate runs in ~1.5s). Adding one that
 * covers nothing new is not free — it is another file to regenerate on every
 * intentional render change.
 */
const PRINT_FIXTURES: { slug: string; def: any; data: string; baseline: string; covers: string; committedAt?: string }[] = [
  {
    slug: 'authorization-release (legacy dotted shape)',
    def: AUTHORIZATION_RELEASE_DEFINITION,
    data: 'scripts/fixtures/row-47431370.json',
    baseline: 'scripts/fixtures/printpreview-47431370.baseline.html',
    covers: 'flat-dotted legacy keys + nested empties (the must-never-re-blank path); text/tel/boolean',
  },
  {
    slug: 'discharge-summary (select + checkbox-group + conditional VISIBLE)',
    def: DISCHARGE_SUMMARY_DEFINITION,
    data: 'scripts/fixtures/print-discharge-summary-conditional-visible.json',
    baseline: 'scripts/fixtures/printpreview-discharge-summary-conditional-visible.baseline.html',
    covers: "select option→label, checkbox-group option→label join, visibleWhen VISIBLE branch (reasonForDischarge='Other' → otherReason prints)",
  },
  {
    slug: 'discharge-summary (legacy value under a HIDDEN conditional)',
    def: DISCHARGE_SUMMARY_DEFINITION,
    data: 'scripts/fixtures/print-discharge-summary-legacy-hidden-value.json',
    baseline: 'scripts/fixtures/printpreview-discharge-summary-legacy-hidden-value.baseline.html',
    covers: "shouldPrintField's legacy rule: reasonForDischarge='Successful' hides otherReason, but a stored pre-predicate value MUST still print — censoring it would make paper disagree with the JSONB",
  },
  {
    // THE COUNTER-SIGNATURE ALARM BRANCH (2026-08-01), the mirror of the hipaa-ack
    // fixture below. The counter block renders on declaration-or-value, and — measured
    // before the change — every one of the sixteen other fixtures satisfies it through
    // the VALUE: the forms declaring a counter-signature all carry one in their data,
    // and the forms with no counter value declare no counter field. The two sets were
    // exactly disjoint, so the declaration half moved NO baseline and would have shipped
    // with nothing pinning it at all.
    //
    // discharge-summary is the right carrier twice over. It is the compliance document
    // the rule exists for — a discharge awaiting counselor sign-off, where "not yet
    // counter-signed" must not look like "this form has no staff line". And it declares
    // NO client signature, so the footer here contains the counter block alone: a
    // structural shape no other fixture has.
    //
    // It also pins the HEADING, which is the half that silently breaks. The old heading
    // was inferred from whichever value was truthy; with no value that chain falls
    // through to its last arm, so this record would have printed "Witness
    // Acknowledgment" over a counselor's empty signature rule. The heading now travels
    // with the declared id, and this baseline is what holds it there.
    slug: 'discharge-summary (counter-signature DECLARED but unsigned)',
    def: DISCHARGE_SUMMARY_DEFINITION,
    data: 'scripts/fixtures/print-discharge-summary-awaiting-countersignature.json',
    baseline: 'scripts/fixtures/printpreview-discharge-summary-awaiting-countersignature.baseline.html',
    covers: 'a compliance record awaiting counter-signature: the block renders from the DEFINITION with N/A rather than vanishing, captioned "Counselor Verification" from the declared id and not the value-inferred fall-through, and carrying NO "SYSTEM TIMESTAMPED" line because nothing was witnessed (§10a); also the counter-block-only footer shape (discharge-summary declares no client signature)',
  },
  {
    slug: 'telehealth-feedback (rating)',
    def: TELEHEALTH_FEEDBACK_DEFINITION,
    data: 'scripts/fixtures/print-telehealth-feedback-rating.json',
    baseline: 'scripts/fixtures/printpreview-telehealth-feedback-rating.baseline.html',
    covers: "rating → 'n/5' (sole source in the catalog); the numeric-vs-string trap from 2026-07-16",
  },
  {
    slug: 'consent-treatment (object boolean-map + STAFF signature block)',
    def: CONSENT_FORM_DEFINITION,
    data: 'scripts/fixtures/print-consent-treatment-objectmap-staffsig.json',
    baseline: 'scripts/fixtures/printpreview-consent-treatment-objectmap-staffsig.baseline.html',
    covers: "legacy 'object' boolean-map → join-truthy ('Mon, Thu'); the staffSignature block — which contains PrintPreview's SECOND clock call and was never once rendered by this gate before 2026-08-01",
  },
  {
    slug: 'emergency-contact (WITNESS signature block)',
    def: EMERGENCY_CONTACT_DEFINITION,
    data: 'scripts/fixtures/print-emergency-contact-witnesssig.json',
    baseline: 'scripts/fixtures/printpreview-emergency-contact-witnesssig.baseline.html',
    covers: 'the witness variant of the second signature block — a different heading ("Witness Acknowledgment") than the staff variant, so it is a distinct branch',
  },
  {
    // Phase 1d. The last two live forms without print coverage. satop-intake is out of
    // scope for David's revisions (Dan's D2) but still assignable and still printing;
    // late-cancellation is client-facing. Neither was guarded while three print defects
    // were found and fixed around them.
    slug: 'satop-intake (court dates + boolean false)',
    def: SATOP_INTAKE_DEFINITION,
    data: 'scripts/fixtures/print-satop-intake-court-dates.json',
    baseline: 'scripts/fixtures/printpreview-satop-intake-court-dates.baseline.html',
    covers: 'offence/conviction dates and a court case number on a committed record; previousSatop=false pinning that a required boolean answered FALSE prints "No" rather than reading as unanswered; an empty optional referralSource as N/A',
  },
  {
    slug: 'late-cancellation (fee policy acknowledgement)',
    def: LATE_CANCELLATION_DEFINITION,
    data: 'scripts/fixtures/print-late-cancellation-fee-policy.json',
    baseline: 'scripts/fixtures/printpreview-late-cancellation-fee-policy.baseline.html',
    covers: 'the $40 late-cancellation policy text, which is INTERPOLATED from LATE_CANCELLATION_FEE — so a change to that constant moves this baseline and cannot silently alter what a client is shown to have agreed to',
  },
  {
    // Phase 1c. The last CERT-GATE form without print coverage. Its seven
    // acknowledgements are the 42 CFR Part 2 / telehealth disclosures, so what this
    // record prints is the evidence the client was informed — and it went through a
    // whole phase in which three separate print defects surfaced with nothing
    // watching it.
    slug: 'telehealth-consent (cert-gate acknowledgements)',
    def: TELEHEALTH_CONSENT_DEFINITION,
    data: 'scripts/fixtures/print-telehealth-consent-certgate.json',
    baseline: 'scripts/fixtures/printpreview-telehealth-consent-certgate.baseline.html',
    covers: 'all seven telehealth disclosure acknowledgements verbatim on a committed record; the STAFF signature block; a cert-gate form previously unguarded',
  },
  {
    // Phase 1b. hipaa-ack, meeting-report and satop-checklist all had their
    // committed-record output CHANGED in Phase 1 with nothing pinning it. These three
    // fixtures close that: each covers a form David revised, so the revised wording is
    // now what the gate enforces.
    slug: 'hipaa-ack (revised acknowledgement wording)',
    def: HIPAA_ACK_DEFINITION,
    data: 'scripts/fixtures/print-hipaa-ack-revised-wording.json',
    baseline: 'scripts/fixtures/printpreview-hipaa-ack-revised-wording.baseline.html',
    covers: 'the settled acknowledgement text ("received or been advised of", no effective-date clause); the smallest form in the catalog, and one with no clientEmail field — so it also pins the corrected header behaviour',
  },
  {
    // THE ALARM BRANCH of the client-certificate gate (2026-08-01). The gate renders the
    // block when a value exists OR the definition declares a client signature field, and
    // every other fixture satisfies it through the VALUE. This one satisfies it only
    // through the DECLARATION: hipaa-ack declares clientSignature, the record's is empty,
    // so the certificate must still print — loudly, as N/A.
    //
    // Without this fixture the `OR` half is unpinned: collapsing the rule to plain
    // value-presence (the clientEmail rule, copied one form too far) would go green on all
    // sixteen other baselines while silently deleting the evidence that a form REQUIRING a
    // client signature was committed without one. That is the alarm the clientName comment
    // exists to protect, and an unsigned HIPAA acknowledgement is exactly the record where
    // it must not be swallowed.
    slug: 'hipaa-ack (client signature DECLARED but empty — the alarm branch)',
    def: HIPAA_ACK_DEFINITION,
    data: 'scripts/fixtures/print-hipaa-ack-declared-but-unsigned.json',
    baseline: 'scripts/fixtures/printpreview-hipaa-ack-declared-but-unsigned.baseline.html',
    covers: 'the client certificate printing N/A because the DEFINITION declares clientSignature even though the record carries no value — the half of the gate that keeps an unsigned form alarming instead of silently dropping the block',
  },
  {
    slug: 'meeting-report (object boolean-map + orphaned legacy key)',
    def: MEETING_REPORT_DEFINITION,
    data: 'scripts/fixtures/print-meeting-report-typemap.json',
    baseline: 'scripts/fixtures/printpreview-meeting-report-typemap.baseline.html',
    covers: "meetingType's object boolean-map joining truthy keys ('Aa, Discussion, Big Book, Open'); AND that the deleted chairpersonSignature — still present in the row as a legacy key — does NOT print, since a stored key with no fieldDefinition must never render",
  },
  {
    slug: 'satop-checklist (dotted ids + all 9 acknowledgements)',
    def: SATOP_CHECKLIST_DEFINITION,
    data: 'scripts/fixtures/print-satop-checklist-dotted-ids.json',
    baseline: 'scripts/fixtures/printpreview-satop-checklist-dotted-ids.baseline.html',
    covers: "nested checklist.* dotted-id resolution on a committed record, all five of David's reworded items, and the new feesAdvised acknowledgement",
  },
  {
    // Added with the CRP rebuild (2026-08-02). This form previously had NO print
    // coverage at all while being the largest change in Phase 1 — 40 fields, the
    // numbered-line pattern, a conditional, and a static notice. Its data deliberately
    // leaves the optional line 4 EMPTY on five of seven lists and fills it on one, so
    // the baseline pins both states: a required line that must print, and an optional
    // line that legitimately does not.
    slug: 'recovery-plan (numbered lines, conditional, static notice)',
    def: RECOVERY_PLAN_DEFINITION,
    data: 'scripts/fixtures/print-recovery-plan-numbered-lines.json',
    baseline: 'scripts/fixtures/printpreview-recovery-plan-numbered-lines.baseline.html',
    covers: 'the R·R·R·O numbered-line pattern across 7 questions; visibleWhen VISIBLE (clearOnDosing shown because prescribedMedications=true); a `static` field on a committed record; empty optional lines rendering as N/A',
  },
  {
    // THE SPARSE FIXTURE (Phase 1c). Deliberately populates ONLY required fields —
    // every optional one is empty. This is a COVERAGE AXIS, not a second example of
    // the same form: §10d-i established that fixture data authored alongside a form is
    // naturally COMPLETE, and complete data cannot exercise absent-value paths. The
    // "CLIENT EMAIL / N/A" defect shipped precisely because no fixture was sparse in
    // the right place, and was caught only by accident.
    //
    // recovery-plan is the right carrier: 13 of its 44 fields are optional (the highest
    // in the catalog), a minimally-completed plan is the LIKELIEST real record, and it
    // is the very document David's revisions exist to stop being one-word thin.
    //
    // prescribedMedications=false makes clearOnDosing hidden AND empty — the
    // visibleWhen branch no other fixture reaches (discharge-summary covers visible,
    // and hidden-with-a-legacy-value, but not hidden-and-genuinely-empty).
    slug: 'recovery-plan (SPARSE — required fields only)',
    def: RECOVERY_PLAN_DEFINITION,
    data: 'scripts/fixtures/print-recovery-plan-sparse-minimum.json',
    baseline: 'scripts/fixtures/printpreview-recovery-plan-sparse-minimum.baseline.html',
    covers: 'what a MINIMALLY-completed record prints: 7 empty optional lines and 6 empty referral fields as N/A, and a hidden-and-empty conditional (clearOnDosing) correctly not printing at all',
  },
  {
    // THE §10a REGRESSION GUARD. committedAt is deliberately a DIFFERENT instant from
    // the frozen clock (2026-05-11 vs the harness's 2026-07-16), which is the only way
    // to tell a correct render from the bug: when both dates are "now" they are
    // indistinguishable. This baseline must show 5/11/2026 in BOTH the header and the
    // signature block. If a future change reverts PrintPreview to calling new Date()
    // in the signature block, that line becomes 7/16/2026 and this fixture goes red.
    slug: 'consent-treatment (REPRINT — committedAt honoured in both stamps)',
    def: CONSENT_FORM_DEFINITION,
    data: 'scripts/fixtures/print-consent-treatment-objectmap-staffsig.json',
    baseline: 'scripts/fixtures/printpreview-consent-treatment-reprint-committedat.baseline.html',
    committedAt: '2026-05-11T15:30:00.000Z',
    covers: '§10a — a REPRINT must stamp the record date, not today. Header AND signature block must both read 5/11/2026 despite the frozen clock being 7/16/2026',
  },
];

/**
 * The baseline file carries a provenance header so nobody mistakes a generated
 * artifact for something hand-authored. It is NOT part of the comparison — the
 * header is stripped before the byte check, and rewritten verbatim on regeneration
 * (no timestamps, so the file does not churn).
 */
const BASELINE_HEADER = [
  '<!--',
  '  GENERATED FILE — do not hand-edit.',
  '',
  '  Frozen-clock, pinned-timezone (America/Chicago) render of PrintPreview.',
  '  Gate 3 of `npm run check:forms` compares the live render against everything',
  '  below this comment, byte for byte, to catch unintended drift in how a',
  '  COMMITTED clinical record prints.',
  '',
  '  THIS FIXTURE EXISTS TO COVER:',
  '    {{COVERS}}',
  '',
  '  Regenerate ONLY for a render change you have established is intentional:',
  '      UPDATE_PRINTPREVIEW_BASELINE=1 npm run check:forms',
  '  Then say in the commit message what changed and why it is correct. Moving',
  '  a baseline to silence a red gate, without that justification, defeats the',
  '  entire point of the gate.',
  '-->',
  '',
].join('\n');
const stripHeader = (s: string): string => s.replace(/^<!--[\s\S]*?-->\n\n?/, '');

const UPDATING = process.env.UPDATE_PRINTPREVIEW_BASELINE === '1';
for (const fx of PRINT_FIXTURES) {
  const formData = JSON.parse(fs.readFileSync(at(fx.data), 'utf8'));
  const rendered = renderToStaticMarkup(
    React.createElement(PrintPreview, { formData, formDefinition: fx.def, committedAt: fx.committedAt }),
  );
  if (UPDATING) {
    fs.writeFileSync(at(fx.baseline), BASELINE_HEADER.replace('{{COVERS}}', fx.covers) + rendered);
    console.log(`WROTE ${fx.slug} (${rendered.length} chars)`);
    continue;
  }
  if (!fs.existsSync(at(fx.baseline))) {
    fail(`${fx.slug} :: no baseline at ${fx.baseline} — generate it with UPDATE_PRINTPREVIEW_BASELINE=1 npm run check:forms`);
    continue;
  }
  const baseline = stripHeader(fs.readFileSync(at(fx.baseline), 'utf8'));
  if (rendered === baseline) console.log(`ok    ${fx.slug} — byte-identical (${rendered.length} chars)`);
  else fail(`${fx.slug} :: PrintPreview drift — rendered ${rendered.length} chars vs baseline ${baseline.length}. Establish WHY it changed before touching the baseline; regenerate only for an intentional change (UPDATE_PRINTPREVIEW_BASELINE=1 npm run check:forms).`);
}
if (UPDATING) console.log('Justify every regenerated baseline in your commit message.');

console.log('\n=== 4) PDF TWIN EXISTENCE (registry pdfSlug → public/forms/) ===');
{
  const fs = require('fs');
  const path = require('path');
  const withPdf = FORM_REGISTRY.filter((f) => f.pdfSlug);
  if (!withPdf.length) {
    console.log('ok    no registry entry declares a pdfSlug yet — nothing to verify');
  } else {
    for (const entry of withPdf) {
      // cwd-relative: npm scripts run at the repo root (same reason gate 3 resolves
      // its baseline that way — the esbuild bundle's __dirname is node_modules/.cache).
      const rel = path.join('public', 'forms', `${entry.pdfSlug}.pdf`);
      if (fs.existsSync(path.join(process.cwd(), rel))) {
        console.log(`ok    ${entry.id} → /forms/${entry.pdfSlug}.pdf`);
      } else {
        fail(`${entry.id} :: pdfSlug='${entry.pdfSlug}' but ${rel} does NOT exist — the link would serve a 200 + SPA shell, not a 404. Commit the PDF or unset pdfSlug.`);
      }
    }
  }
}

console.log('\n=== 5) SIGNATURE FIELD REGISTRATION (definitions ↔ PrintPreview) ===');
{
  /**
   * WHAT COUNTS AS A SIGNATURE FIELD — the rule, stated so it can be argued with.
   *
   * An id is signature-ish iff BOTH hold:
   *   (a) the LAST dot-separated segment of the id ends with the word "signature",
   *       case-insensitively — /signature$/i; and
   *   (b) the field's type can carry a typed name (anything except 'boolean' and
   *       'static').
   *
   * (a) is the whole of the naming argument: "signature" as the TERMINAL noun is what
   * makes a name mean a signature. clientSignature, staffSignature, and a future
   * guardianSignature or supervisorSignature are all head-noun 'signature' and are
   * caught. Where "signature" is a QUALIFIER there is always another word after it —
   * signatureDate is a date, signaturePad is a control — so the terminal test excludes
   * them without an exception list. The date fields this gate must not fire on are
   * excluded for two different reasons and both are load-bearing: signatureDate
   * because 'signature' is not terminal, clientDate / counselorDate because they do
   * not contain the word at all.
   *
   * Split on '.' first because ids in this catalog are genuinely dotted
   * (satop-checklist's checklist.*), so a nested attestations.clientSignature must be
   * caught by its leaf, not missed because the full id ends in a path.
   *
   * (b) removes the one realistic false positive of a pure name rule: a boolean like
   * requiresSignature / needsStaffSignature is a flag ABOUT a signature, not one — and
   * a boolean cannot hold a name, so the attestation block would print "true" over the
   * signature line. 'static' emits no stored key at all. Everything else stays in:
   * the bias is deliberately toward catching, because the two errors are not
   * symmetric. A false positive is a red gate and a five-second argument. A miss is
   * the D-i defect shipping again — a real signature printed as an ordinary data row
   * on a document that goes to courts and probation officers.
   *
   * KNOWN LIMIT, stated rather than papered over: the rule reads ids, so a signature
   * field named off-convention (id 'clientAttestation' with label "Client signature")
   * is invisible to it. The gate enforces the naming discipline it can see; it does
   * not invent one.
   */
  const SIGNATURE_EXEMPT_TYPES = new Set(['boolean', 'static']);
  const isSignatureIsh = (f: FieldDefinition): boolean =>
    /signature$/i.test(f.id.split('.').pop() ?? '') && !SIGNATURE_EXEMPT_TYPES.has(f.type);

  // 5a. DECLARED → REGISTERED. An unregistered signature prints as a data row.
  let unregistered = 0;
  const registered: string[] = [];
  for (const def of ALL) {
    for (const f of def.fieldDefinitions as FieldDefinition[]) {
      if (!isSignatureIsh(f)) continue;
      if (SIGNATURE_FIELD_IDS.has(f.id)) { registered.push(`${def.id}:${f.id}`); continue; }
      unregistered++;
      fail(
        `${def.id} :: '${f.id}' [${f.type}] is a signature field but is NOT in ` +
        `SIGNATURE_FIELD_IDS (components/PrintPreview.tsx) — it would print as an ` +
        `ordinary data row instead of in an attestation block, which is the D-i defect. ` +
        `Adding it is a TWO-PLACE change: put the id in SIGNATURE_FIELD_IDS *and* make ` +
        `a block render it, or it will vanish from the printed record instead (5b below ` +
        `enforces the second half). If '${f.id}' is not a signature, rename it — the ` +
        `rule is that a field whose name's head noun is "signature" is one.`,
      );
    }
  }
  if (!unregistered) console.log(`ok    every declared signature field is registered (${registered.length}: ${registered.join(', ')})`);

  // 5b. REGISTERED → RENDERED. The other half, and the reason 5a is safe to enforce:
  // being in the set REMOVES a field from the loop, so an id the blocks do not read
  // disappears from the record entirely. Probed behaviourally rather than by a second
  // hand-written list — render with an EMPTY fieldDefinitions so the field loop cannot
  // contribute, put a sentinel in the one id under test, and require it in the output.
  // The only path to the sentinel is an attestation block actually reading that id.
  const PROBE_DEF = { id: 'probe', title: 'Signature Probe', fieldDefinitions: [], initialState: {}, validateStep: () => ({}) };
  let unrendered = 0;
  for (const id of Array.from(SIGNATURE_FIELD_IDS as Set<string>)) {
    const sentinel = `SENTINEL_${id}_SENTINEL`;
    const html = renderToStaticMarkup(
      React.createElement(PrintPreview, { formData: { [id]: sentinel }, formDefinition: PROBE_DEF }),
    );
    if (html.includes(sentinel)) continue;
    unrendered++;
    fail(
      `'${id}' is in SIGNATURE_FIELD_IDS but NO attestation block renders it — it is ` +
      `skipped in the field loop and printed nowhere, so this id VANISHES from the ` +
      `committed record. Add it to a block's gate AND its value chain in ` +
      `components/PrintPreview.tsx, or remove it from SIGNATURE_FIELD_IDS.`,
    );
  }
  if (!unrendered) console.log(`ok    every registered id is rendered by a block (${SIGNATURE_FIELD_IDS.size} probed)`);
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL GREEN');
process.exit(failures ? 1 : 0);
