
import React from 'react';
import { FormDefinition, RecoveryPlanData, FormErrors } from '../../types';

/**
 * CONTINUING RECOVERY PLAN
 *
 * REBUILT 2026-08-02 to follow ACS's paper form line by line. David: "See markup for
 * adjustments / 'Plan to remain sober' needs to be yes OR no / Most fields need
 * minimum of 3 responses and up to 4 rather than open box that could accept 1
 * response. Maybe add numbered lines? / Following the paper form more literally may
 * be easiest way to adjust."
 *
 * THE NUMBERED-LINE PATTERN. The old form had one open textarea per question, which
 * accepts a single word and calls it a plan. The paper has FOUR numbered lines, and
 * David marked each line R (required) or O (optional) by hand. Modelled as four
 * discrete text fields per question — lines 1-3 required, line 4 optional — which
 * expresses his markup exactly and needed NO new field type: required-ness is
 * already per-field.
 *
 * R/O TRANSCRIBED PER QUESTION, not assumed uniform. Six of the seven list questions
 * are marked R·R·R·O on the scan. The relapse-steps list (page 1, last question) has
 * NO line marks at all — its R sits beside the question text. Dan's call (2026-08-02):
 * mirror R·R·R·O, on the reasoning that six preceding marked lists establish the
 * pattern and an unmarked seventh reads as "same as above" rather than as an
 * exception. RECORDED AS A CHOICE, NOT A READING — it is one `required` flag per line
 * to reverse, and it is on the list for David.
 *
 * Off-paper fields from the old version are GONE: primaryGoals, triggers, copingSkills,
 * supportGroups, emergencyContacts, dateOfBirth, caseNumber, acknowledgment. None of
 * them is on ACS's form. Zero committed rows existed, so nothing needed migrating.
 *
 * The dead Step1..Step5 components are deleted for the same reason as Consent's:
 * BaseFormTemplate renders fieldDefinitions only (DEFERRED #40).
 */

const initialState: RecoveryPlanData = {
  clientName: '',
  remainSober: null,
  problems1: '', problems2: '', problems3: '', problems4: '',
  address1: '', address2: '', address3: '', address4: '',
  avoid1: '', avoid2: '', avoid3: '', avoid4: '',
  changes1: '', changes2: '', changes3: '', changes4: '',
  whatToDoIfWantToUse: '',
  relapse1: '', relapse2: '', relapse3: '', relapse4: '',
  support1: '', support2: '', support3: '', support4: '',
  meetingsPerWeek: '',
  sponsorDate: '',
  prescribedMedications: null,
  clearOnDosing: null,
  daily1: '', daily2: '', daily3: '', daily4: '',
  referral1Organization: '', referral1ContactNumber: '', referral1ContactPerson: '',
  referral2Organization: '', referral2ContactNumber: '', referral2ContactPerson: '',
  clientSignature: '', clientDate: '',
  counselorSignature: '', counselorDate: '',
};

/** Four numbered lines for one paper question: 1-3 required, 4 optional. */
const numberedLines = (
  prefix: string,
  question: string,
): { id: string; label: string; type: 'text'; required: boolean }[] => [
  { id: `${prefix}1`, label: `${question} — 1.`, type: 'text', required: true },
  { id: `${prefix}2`, label: `${question} — 2.`, type: 'text', required: true },
  { id: `${prefix}3`, label: `${question} — 3.`, type: 'text', required: true },
  { id: `${prefix}4`, label: `${question} — 4. (optional)`, type: 'text', required: false },
];

const Q_PROBLEMS = 'Make a list of the problems that you need to address in your ongoing recovery. This can include your family, legal, social, physical, leisure, work or spiritual, etc.';
const Q_ADDRESS = 'How are you going to address these problems and what do you want to achieve?';
const Q_AVOID = 'You are making changes in your lifestyle. It will be important to avoid certain people and situations that will put you at considerable risk. List the people, places, and things you need to avoid in early recovery.';
const Q_CHANGES = 'Recovery is about making changes. What changes have you noticed in yourself since you entered the program and how will these changes help you in recovery?';
const Q_RELAPSE = 'In the event of a relapse, list the specific steps that you will take to deal with the problem.';
const Q_SUPPORT = 'In recovery you need a support system. List who is supportive of your recovery and how or what they do that helps you in your recovery.';
const Q_DAILY = 'Make a list of the things that you are going to do daily to stay clean and sober.';

export const RECOVERY_PLAN_DEFINITION: FormDefinition<RecoveryPlanData> = {
  id: 'recovery-plan',
  title: 'Continuing Recovery Plan',
  description: 'Your plan for maintaining sobriety after discharge.',
  category: 'Treatment',
  tags: ['SATOP'],
  difficulty: 'Moderate',
  estimatedTime: '15 min',
  initialState,
  validateStep: (data) => {
    // Per-field required-ness is enforced generically from fieldDefinitions[].required
    // (config/formValidation.ts). validateStep adds only what that cannot express.
    const errs: FormErrors<RecoveryPlanData> = {};
    if (data.remainSober === null) errs.remainSober = 'Please select Yes or No.';
    return errs;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Name', type: 'text', required: true },
    // David: "'Plan to remain sober' needs to be yes OR no" — the paper has Yes___ No___.
    { id: 'remainSober', label: 'Do you plan on remaining alcohol and drug free?', type: 'boolean', required: true },

    ...numberedLines('problems', Q_PROBLEMS),
    ...numberedLines('address', Q_ADDRESS),
    ...numberedLines('avoid', Q_AVOID),
    ...numberedLines('changes', Q_CHANGES),

    { id: 'whatToDoIfWantToUse', label: 'What will you do if you want to use?', type: 'textarea', required: true },

    // Lines unmarked on the scan; R·R·R·O applied by Dan's decision — see the header.
    ...numberedLines('relapse', Q_RELAPSE),
    ...numberedLines('support', Q_SUPPORT),

    { id: 'meetingsPerWeek', label: 'How many sober support meetings will you attend each week after discharge?', type: 'text', required: true },
    { id: 'sponsorDate', label: 'We recommend that you obtain a sponsor as soon as possible as part of your recovery. Set a date to obtain your sponsor.', type: 'date', required: true },

    { id: 'prescribedMedications', label: 'Do you take medications prescribed by a doctor?', type: 'boolean', required: true },
    // Conditional: the paper asks this only "If yes". One-level visibleWhen — the
    // renderer and the validator consult the same predicate, so when it is hidden it
    // is also not enforced (config/fieldVisibility.ts).
    { id: 'clearOnDosing', label: 'If yes, are you clear on the dosing instructions?', type: 'boolean', required: true, visibleWhen: { field: 'prescribedMedications', equals: true } },

    ...numberedLines('daily', Q_DAILY),

    // Referrals — every line marked O on the scan.
    { id: 'referral1Organization', label: 'Referral 1 — Organization', type: 'text', required: false },
    { id: 'referral1ContactNumber', label: 'Referral 1 — Contact Number', type: 'tel', required: false },
    { id: 'referral1ContactPerson', label: 'Referral 1 — Contact Person', type: 'text', required: false },
    { id: 'referral2Organization', label: 'Referral 2 — Organization', type: 'text', required: false },
    { id: 'referral2ContactNumber', label: 'Referral 2 — Contact Number', type: 'tel', required: false },
    { id: 'referral2ContactPerson', label: 'Referral 2 — Contact Person', type: 'text', required: false },

    { id: 'crisisNotice', type: 'static', label: 'If you have any problems or concerns in sobriety, you can always call the treatment center staff at the following number: 314-849-2800' },

    { id: 'clientSignature', label: 'Client', type: 'text', required: true },
    { id: 'clientDate', label: 'Date', type: 'date', required: true },
    { id: 'counselorSignature', label: 'Counselor', type: 'text', required: true },
    { id: 'counselorDate', label: 'Date', type: 'date', required: true },
  ],
};
