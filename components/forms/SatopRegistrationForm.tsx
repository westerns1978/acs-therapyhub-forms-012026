import { FormDefinition, SatopRegistrationData, FormErrors } from '../../types';

/**
 * SATOP REGISTRATION FORM
 *
 * NEW 2026-08-05 (David, Forms.docx): "ADD - SATOP Registration Form / Digitize the
 * submitted example / All fields mandatory / FYI this is the first and base form for
 * new SATOP clients."
 *
 * ALL FIELDS MANDATORY, taken literally. Every field below carries `required: true`
 * except `veteranStatus`, which is CONDITIONAL rather than optional: it is required
 * whenever the client answers Veteran = Yes, and not enforced at all otherwise
 * (config/fieldVisibility.ts — the renderer and the validator consult the same
 * predicate, so a hidden field can never become an unsubmittable dead end).
 *
 * DELETED FROM THE PAPER per David's markup — absent by instruction, not omission:
 *   • "Date of Appointment" (top right, struck with "Delete")
 *   • Probation/Parole Officer + Phone Number
 *   • Name of Attorney + Phone #
 *   • Fax/Email
 *   • "You must provide us with your attorney's contact information"
 *
 * CHANGED FROM THE PAPER: the Veteran follow-up read "If yes, which branch". David
 * struck "which branch" and wrote "active or inactive", so the follow-up is a
 * two-option select, not a free-text branch name.
 *
 * SSN IS LAST-4 ONLY, matching the repo standard set by authorization-release after
 * the P0 defect (a field labelled "SSN (last 4 digits)" that accepted and stored all
 * nine on a 42 CFR Part 2 chart — see config/formValidation.ts). min/max are enforced
 * generically by lengthFieldErrors; the digits-only rule below only supplies the
 * clearer message.
 *
 * NOT WIRED AS A BASE FORM HERE. "First and base form" means auto-assignment on
 * client creation keyed off clients.client_type (design decision D5,
 * docs/design/forms-revision-080126.md §8a). That is a separate pass — this commit
 * adds the form to the library, the portal, and the registry, nothing more.
 */

const initialState: SatopRegistrationData = {
  clientName: '',
  date: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  primaryPhone: '',
  email: '',
  dob: '',
  age: '',
  sex: '',
  maritalStatus: '',
  race: '',
  ssn: '',
  driversLicense: '',
  referredBy: '',
  bac: '',
  veteran: '',
  veteranStatus: '',
  lastSchoolAttended: '',
  lastGradeCompleted: '',
  employed: '',
  annualIncome: '',
  occupation: '',
  numberInHousehold: '',
  otherAlcoholArrest: '',
  trafficTickets: '',
  drugRelatedArrests: '',
  countyOfArrestDWI: '',
  courtHandlingDWI: '',
};

const YES_NO = [
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
];

export const SATOP_REGISTRATION_DEFINITION: FormDefinition<SatopRegistrationData> = {
  id: 'satop-registration',
  title: 'SATOP Registration Form',
  description: 'Registration details ACS collects when a client enters the SATOP program.',
  category: 'Intake',
  tags: ['SATOP'],
  difficulty: 'Moderate',
  estimatedTime: '10 min',
  initialState,
  validateStep: (data) => {
    // Per-field required-ness is enforced generically from fieldDefinitions[].required
    // (config/formValidation.ts), and min/max by lengthFieldErrors. validateStep adds
    // ONLY what neither can express — here, one format rule.
    const errs: FormErrors<SatopRegistrationData> = {};
    // Same wording as authorization-release: the generic length rule already blocks
    // nine digits, but "Enter exactly 4 characters" does not tell a client WHY.
    if (data.ssn && !/^\d{4}$/.test(data.ssn)) {
      errs.ssn = 'Enter the LAST 4 DIGITS only — not the full Social Security number.';
    }
    // Added 2026-08-07 (Dan, Q4) so this sheet and the outpatient Registration Form
    // carry the IDENTICAL state rule, not merely a similar one. min/max already
    // blocks the wrong length; this blocks the wrong shape ("12" was passing).
    if (data.state && !/^[A-Za-z]{2}$/.test(data.state)) {
      errs.state = 'Enter the 2-letter state abbreviation (e.g. MO).';
    }
    return errs;
  },
  fieldDefinitions: [
    // ── Identity and contact ──────────────────────────────────────────────────
    { id: 'clientName', label: 'Client name', type: 'text', required: true },
    { id: 'date', label: 'Date', type: 'date', required: true },
    { id: 'address', label: 'Address', type: 'text', required: true },
    { id: 'city', label: 'City', type: 'text', required: true },
    { id: 'state', label: 'State', type: 'text', required: true, min: 2, max: 2 },
    { id: 'zip', label: 'Zip', type: 'text', required: true },
    { id: 'primaryPhone', label: 'Primary phone', type: 'tel', required: true },
    { id: 'email', label: 'Email', type: 'email', required: true },

    // ── Demographics ──────────────────────────────────────────────────────────
    { id: 'dob', label: 'Date of birth', type: 'date', required: true },
    { id: 'age', label: 'Age', type: 'number', required: true },
    { id: 'sex', label: 'Sex', type: 'text', required: true },
    { id: 'maritalStatus', label: 'Marital status', type: 'text', required: true },
    { id: 'race', label: 'Race', type: 'text', required: true },
    { id: 'ssn', label: 'SSN (last 4 digits)', type: 'text', required: true, min: 4, max: 4 },
    { id: 'driversLicense', label: 'Driver’s license #', type: 'text', required: true },

    // ── Referral and offense ──────────────────────────────────────────────────
    { id: 'referredBy', label: 'Referred by', type: 'text', required: true },
    { id: 'bac', label: 'BAC', type: 'text', required: true },

    // David struck "If yes, which branch" and wrote "active or inactive". One-level
    // conditional: when Veteran = No the follow-up is neither shown nor enforced, and
    // handleSubmit's stripHiddenValues drops any value typed before the answer changed.
    { id: 'veteran', label: 'Veteran', type: 'select', required: true, options: YES_NO },
    {
      id: 'veteranStatus',
      label: 'If yes, active or inactive',
      type: 'select',
      required: true,
      options: [
        { value: 'Active', label: 'Active' },
        { value: 'Inactive', label: 'Inactive' },
      ],
      visibleWhen: { field: 'veteran', equals: 'Yes' },
    },

    // ── Education, employment, household ──────────────────────────────────────
    { id: 'lastSchoolAttended', label: 'Last school attended', type: 'text', required: true },
    { id: 'lastGradeCompleted', label: 'Last grade completed', type: 'text', required: true },
    { id: 'employed', label: 'Employed', type: 'select', required: true, options: YES_NO },
    { id: 'annualIncome', label: 'Approximate annual income', type: 'text', required: true },
    { id: 'occupation', label: 'Occupation', type: 'text', required: true },
    { id: 'numberInHousehold', label: 'Number in household', type: 'number', required: true },

    // ── Legal history ─────────────────────────────────────────────────────────
    { id: 'otherAlcoholArrest', label: 'Have you ever been arrested for any other alcohol related offense not DWI?', type: 'text', required: true },
    { id: 'trafficTickets', label: 'Number of traffic tickets', type: 'number', required: true },
    { id: 'drugRelatedArrests', label: 'Number of drug related arrests', type: 'number', required: true },
    { id: 'countyOfArrestDWI', label: 'County of arrest for DWI', type: 'text', required: true },
    { id: 'courtHandlingDWI', label: 'Court handling DWI', type: 'text', required: true },
  ],
};
