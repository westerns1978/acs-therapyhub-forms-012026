
import React from 'react';
import { FormDefinition, ConsentForTreatmentData, FormErrors } from '../../types';

/**
 * CONSENT FOR TREATMENT AND RESPONSIBILITY AGREEMENT
 *
 * REBUILT 2026-08-02 to follow ACS's paper form. David's instruction was "Need to
 * include full narratives / See submitted paper form for wording", and the paper is
 * eight numbered narrative paragraphs with ONE signature block — there is no
 * per-paragraph checkbox on it.
 *
 * The previous version paraphrased those paragraphs into eleven short boolean
 * acknowledgements ("I acknowledge that regular attendance is mandatory…"). Those
 * are GONE. They were not on the paper, they compressed legally operative text into
 * summaries, and they made the record assert eleven separate affirmations the client
 * never separately gave. The narrative text is now `static` (display-only prose,
 * types.ts) and the client agrees to the agreement ONCE by signing, exactly as on
 * paper.
 *
 * ¶ TEXT IS TRANSCRIBED VERBATIM, including two typos present on ACS's paper
 * ("for a long as I remain in treatment", "These is a fee for the screen"). They are
 * NOT silently corrected: this is the operative wording of a signed agreement, and
 * rewriting it is ACS's call, not ours. Flagged for David.
 *
 * ¶5's discharge clause uses Dan's settled wording (decision D4, 2026-08-01):
 * "…client will be discharged and/or may be recommended to the next higher treatment
 * level." — the one place the paper's margin annotation was resolved by decision.
 *
 * ¶1 is the ONE paragraph not verbatim: on paper it is a fill-in sentence
 * ("I will attend group sessions on ___ and ___, from ___am/pm to ___am/pm"), which
 * cannot render as prose and inputs at once. It introduces the three fields instead.
 *
 * The dead Step1..Step5 components are deleted rather than updated. BaseFormTemplate
 * renders fieldDefinitions only (DEFERRED #40), so they were unreachable, and leaving
 * them would have left the superseded checkbox wording in the same file as the
 * narrative that replaced it.
 */

const initialState: ConsentForTreatmentData = {
  clientName: '', clientEmail: '',
  // Pre-populate a real SATOP Level IV schedule so the field renders as a
  // readable string ("Mon, Thu") instead of an empty value or [object Object].
  groupDays: { 'Mon': true, 'Tue': false, 'Wed': false, 'Thu': true, 'Fri': false },
  groupTimeFrom: '9:00 AM',
  groupTimeTo: '12:15 PM',
  clientSignature: '', staffSignature: '', date: new Date().toISOString().split('T')[0],
};

export const CONSENT_FORM_DEFINITION: FormDefinition<ConsentForTreatmentData> = {
  id: 'consent-treatment',
  title: 'Consent for Treatment',
  description: 'Treatment and responsibility agreement for ACS SATOP/SROP/Chemical Dependency programs.',
  category: 'Legal',
  tags: ['Required', 'SATOP'],
  difficulty: 'Simple',
  estimatedTime: '5 min',
  initialState,
  validateStep: (data) => {
    // Only what the paper actually requires a person to provide: who they are, their
    // signature, and the date. Every former per-paragraph acknowledgement rule is
    // gone with the checkboxes that carried it.
    const errs: FormErrors<ConsentForTreatmentData> = {};
    if (!data.clientName) errs.clientName = 'Required.';
    if (!data.clientSignature) errs.clientSignature = 'Signature required.';
    if (!data.date) errs.date = 'Date is required.';
    return errs;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Client legal name', type: 'text', required: true },
    { id: 'clientEmail', label: 'Email', type: 'email', required: true },

    { id: 'narrativeHeading', type: 'static', label: 'SATOP/SROP/CHEMICAL DEPENDENCY PROGRAM — CONSENT FOR TREATMENT AND RESPONSIBILITY AGREEMENT' },

    // ¶1 — the only non-verbatim paragraph; it introduces the fill-ins below.
    { id: 'clause1', type: 'static', label: '1. I will attend group sessions on the day(s) and time indicated below.' },
    { id: 'groupDays', label: 'Group session day(s)', type: 'object', required: false },
    { id: 'groupTimeFrom', label: 'Group time from', type: 'text', required: false },
    { id: 'groupTimeTo', label: 'Group time to', type: 'text', required: false },

    { id: 'clause2', type: 'static', label: '2. Attendance at all sessions is expected and we understand that life happens. Inconsistent attendance and/or 3 or more missed sessions may result in an unsuccessful discharge. There are no refunds for unsuccessful discharges, and you will be required to restart your program from the beginning, including the associated fees.\n*Communication with ACS regarding missed services and life situations is always a good idea and will reduce the likelihood of an unsuccessful discharge.' },

    { id: 'clause3', type: 'static', label: '3. Program fees being paid in full is a requirement for successful discharge. Non-payment of fees may delay your completion or result in an unsuccessful discharge.' },

    { id: 'clause4', type: 'static', label: '4. A $40 cancellation fee will be assessed for individual sessions that are missed or cancelled less than 24 hours in advance. Exceptions for emergencies will be granted at the discretion of ACS management.' },

    { id: 'clause5', type: 'static', label: '5. I am making a commitment to abstain from all mood-altering substances, including alcohol in any form including Nyquil, cough meds etc., for a long as I remain in treatment. I consent to random breathalyzers and/or urine drug screens. These is a fee for the screen depending on the type required. The fee will not be greater than $30. If a chemical screen is positive for a non-prescribed substance including alcohol, client will be discharged and/or may be recommended to the next higher treatment level. Marijuana is a drug – not an herb.' },

    { id: 'clause6', type: 'static', label: '6. If I am prescribed medications, I will inform my counselor of the type, dose and name of the doctor prescribing the medication. If I am prescribed a controlled substance, I will provide proof of said prescription within two weeks of entering my treatment program.' },

    { id: 'clause7', type: 'static', label: '7. If there are medical issues that are considered to be a significant risk or if there are psychological problems which may impair the ability to progress in the program, admission or continuation in the program may be delayed until a physician clears the condition. I may go to my physician of choice at my expense.' },

    { id: 'clause8', type: 'static', label: '8. I will actively participate in program activities and follow the plan of treatment. Attendance at a self-help recovery-oriented support group is required.' },

    { id: 'emergencyNotice', type: 'static', label: 'In case of a personal emergency please call 314-849-2800. We will respond as quickly as possible. If this is a life-threatening emergency, please go to the nearest hospital emergency department.' },

    { id: 'clientSignature', label: 'Client signature', type: 'text', required: true },
    { id: 'date', label: 'Date', type: 'date', required: true },
    { id: 'staffSignature', label: 'Staff signature', type: 'text', required: false },
  ],
};
