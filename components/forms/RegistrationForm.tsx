import { FormDefinition, RegistrationData, FormErrors } from '../../types';

/**
 * REGISTRATION FORM (outpatient)
 *
 * NEW 2026-08-05 (David, Forms.docx): "ADD – Registration Form / Digitize the
 * submitted example / Add the following: Is this a legal requirement yes/no; If yes,
 * what is/are the related charge(s) / FYI this is the first and base form for new
 * OP (outpatient) clients."
 *
 * TITLE. The paper's printed header "DEMOGRAPHICS" is struck on his markup and
 * replaced in handwriting with "Registration Form", so that is the title here.
 *
 * R/O IS TRANSCRIBED, NOT ASSUMED. His pencil R/O marks are per-field (design doc
 * §7). Section 1 is required except `race`; sections 4-6 are wholly optional, which
 * the paper states in its own words ("please leave blank if this does not pertain to
 * you"). Two marks were unclear on the scan and are FLAGGED rather than guessed —
 * see the questions at the foot of this comment.
 *
 * SECTION 2 IS HIS ADDITION, and its placement follows his pen: the circled "ADD
 * HERE" sits directly above the HIPAA line, so the two questions precede it.
 * `relatedCharges` is CONDITIONAL, not optional — required whenever the answer is
 * Yes, hidden and unenforced otherwise, and stripped from the payload if the answer
 * changes to No after typing (config/fieldVisibility.ts).
 *
 * THE THREE INSTRUCTION PARAGRAPHS ARE VERBATIM PAPER TEXT, carried as `static`
 * fields — display-only prose that emits no stored key. They are part of the
 * document, which is exactly what that type is for; they are NOT section chrome, and
 * no invented headings were added alongside them.
 *
 * SIGNATURES ARE TYPED LEGAL NAMES. That is the current repo standard: the drawn
 * SignaturePad still has zero live consumers, and DESIGN-signatures-2026-07-27.md is
 * unbuilt. Two DIFFERENT attestations are collected here, which is new for this
 * catalog — the HIPAA acknowledgement (required, the form's primary client
 * signature, so it uses the registered `clientSignature` id) and the insurance
 * authorization (optional, its own block). See PrintPreview's
 * AUTHORIZATION_SIGNATURE note for why that is a deliberate two-place change.
 *
 * NOT WIRED AS A BASE FORM HERE — auto-assignment on client creation keyed off
 * clients.client_type (decision D5) is a separate pass. Pre-profile submission is
 * likewise not built; this is a standard client-scoped form.
 *
 * OPEN QUESTIONS FOR DAVID (flagged, not decided):
 *   Q1 "Referred by" — read as R. The mark is present but small on the scan.
 *   Q2 Section 6 signature — read as O, on the reading that the mark applies to the
 *      insurance block as a whole. If the authorization is meant to be signed by
 *      every client regardless of insurance, it is one `required` flag to flip.
 *   Q3 `legalMiddleInitial` is required by his section-1 marks, which blocks a
 *      client who has no middle name. Confirm, or make it optional.
 *   Q4 `state` — the SATOP Registration sheet specifies a 2-character state and this
 *      one does not, so this field is unconstrained free text. Same field, same
 *      practice, two rules; confirm whether both should be 2-char.
 *   Q5 PrintPreview's fixed header prints "CLIENT NAME" from a `clientName` field.
 *      This form has no such field — the paper splits the name into First/MI/Last —
 *      so a committed record prints "CLIENT NAME / N/A". This is the §10d-i gap
 *      class and it is NOT fixed here: the header is unconditional by a documented
 *      decision (an absent name must print loudly, not vanish), and reversing that
 *      for every form is not a change to make silently inside a new form's commit.
 */

const initialState: RegistrationData = {
  initialContactDate: '',
  serviceNeeded: '',
  legalFirstName: '',
  legalMiddleInitial: '',
  legalLastName: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  phone: '',
  email: '',
  ssn: '',
  referredBy: '',
  dob: '',
  age: '',
  gender: '',
  maritalStatus: '',
  race: '',
  employer: '',
  occupation: '',
  isLegalRequirement: '',
  relatedCharges: '',
  hipaaReceived: null,
  clientSignature: '',
  hipaaDate: '',
  probationOfficerName: '',
  probationOfficerEmail: '',
  probationOfficerPhone: '',
  caseworkerAgencyName: '',
  caseworkerAgencyEmail: '',
  caseworkerAgencyPhone: '',
  attorneyLawFirmName: '',
  attorneyLawFirmEmail: '',
  attorneyLawFirmPhone: '',
  nameOfInsured: '',
  insuranceCompany: '',
  relationshipToInsured: '',
  dobOfInsured: '',
  authorizationSignature: '',
  authorizationDate: '',
};

const YES_NO = [
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
];

// Verbatim paper text. Transcribed exactly, including ACS's own phrasing and
// punctuation — this is document text a client reads and signs under, so it is not
// tidied. Same discipline as the Consent for Treatment clauses.
const IF_APPLICABLE_NOTICE =
  'If applicable please provide the following information — please leave blank if this does not pertain to you.';

const INSURANCE_NOTICE =
  'Only fill out information below if we will be billing your insurance company for individual counseling sessions. Copay is due prior to your scheduled appointment. We will need a copy of your insurance card as well as a picture ID for both client and insured person (if different).';

const AUTHORIZATION_NOTICE =
  'I hereby authorize the release of information for my insurance company to process my claim. The above information is correct to the best of my knowledge. I hereby authorize payment directly to Assessment & Counseling Solutions. I understand that I am financially responsible for charges not paid in a timely manner by my insurance company.';

export const REGISTRATION_DEFINITION: FormDefinition<RegistrationData> = {
  id: 'registration',
  title: 'Registration Form',
  description: 'Registration details ACS collects when a client enters outpatient services.',
  category: 'Intake',
  tags: ['Outpatient'],
  difficulty: 'Moderate',
  estimatedTime: '12 min',
  initialState,
  validateStep: (data) => {
    // Required-ness and min/max are generic (config/formValidation.ts). validateStep
    // adds ONLY what neither expresses: one format rule, one must-be-true.
    const errs: FormErrors<RegistrationData> = {};
    if (data.ssn && !/^\d{4}$/.test(data.ssn)) {
      errs.ssn = 'Enter the LAST 4 DIGITS only — not the full Social Security number.';
    }
    // The generic boolean rule is ANSWERED, not true — deliberately, since "No" is a
    // valid answer to most questions. This one is an acknowledgement of receipt, so
    // an explicit false must not pass as a completed acknowledgement.
    if (data.hipaaReceived !== true) {
      errs.hipaaReceived = 'Please acknowledge that you have received the Notice of HIPAA Privacy Practices.';
    }
    return errs;
  },
  fieldDefinitions: [
    // ── Section 1 — client information ────────────────────────────────────────
    { id: 'initialContactDate', label: 'Initial contact date', type: 'date', required: true },
    { id: 'serviceNeeded', label: 'Service needed', type: 'text', required: true },
    { id: 'legalFirstName', label: 'Legal first name', type: 'text', required: true },
    { id: 'legalMiddleInitial', label: 'Legal middle initial', type: 'text', required: true },
    { id: 'legalLastName', label: 'Legal last name', type: 'text', required: true },
    { id: 'address', label: 'Address', type: 'text', required: true },
    { id: 'city', label: 'City', type: 'text', required: true },
    { id: 'state', label: 'State', type: 'text', required: true },
    { id: 'zip', label: 'Zip', type: 'text', required: true },
    { id: 'phone', label: 'Phone', type: 'tel', required: true },
    { id: 'email', label: 'Email', type: 'email', required: true },
    { id: 'ssn', label: 'SSN (last 4 digits)', type: 'text', required: true, min: 4, max: 4 },
    { id: 'referredBy', label: 'Referred by', type: 'text', required: true },
    { id: 'dob', label: 'Date of birth', type: 'date', required: true },
    { id: 'age', label: 'Age', type: 'number', required: true },
    { id: 'gender', label: 'Gender', type: 'text', required: true },
    { id: 'maritalStatus', label: 'Marital status', type: 'text', required: true },
    // The one field in section 1 marked O.
    { id: 'race', label: 'Race', type: 'text', required: false },
    { id: 'employer', label: 'Employer', type: 'text', required: true },
    { id: 'occupation', label: 'Occupation', type: 'text', required: true },

    // ── Section 2 — David's addition, placed where his "ADD HERE" circle sits ──
    { id: 'isLegalRequirement', label: 'Is this a legal requirement?', type: 'select', required: true, options: YES_NO },
    {
      id: 'relatedCharges',
      label: 'If yes, what is/are the related charge(s)?',
      type: 'textarea',
      required: true,
      visibleWhen: { field: 'isLegalRequirement', equals: 'Yes' },
    },

    // ── Section 3 — HIPAA acknowledgement ─────────────────────────────────────
    { id: 'hipaaReceived', label: 'I have received the Notice of HIPAA Privacy Practices', type: 'boolean', required: true },
    { id: 'clientSignature', label: 'Client signature (type your full legal name)', type: 'text', required: true },
    { id: 'hipaaDate', label: 'Date', type: 'date', required: true },

    // ── Section 4 — "if applicable", every field optional ─────────────────────
    { id: 'ifApplicableNotice', label: IF_APPLICABLE_NOTICE, type: 'static' },
    { id: 'probationOfficerName', label: 'Probation officer — name', type: 'text', required: false },
    { id: 'probationOfficerEmail', label: 'Probation officer — email', type: 'email', required: false },
    { id: 'probationOfficerPhone', label: 'Probation officer — phone', type: 'tel', required: false },
    { id: 'caseworkerAgencyName', label: 'Caseworker / agency — name', type: 'text', required: false },
    { id: 'caseworkerAgencyEmail', label: 'Caseworker / agency — email', type: 'email', required: false },
    { id: 'caseworkerAgencyPhone', label: 'Caseworker / agency — phone', type: 'tel', required: false },
    { id: 'attorneyLawFirmName', label: 'Attorney / law firm — name', type: 'text', required: false },
    { id: 'attorneyLawFirmEmail', label: 'Attorney / law firm — email', type: 'email', required: false },
    { id: 'attorneyLawFirmPhone', label: 'Attorney / law firm — phone', type: 'tel', required: false },

    // ── Section 5 — insurance, every field optional ───────────────────────────
    { id: 'insuranceNotice', label: INSURANCE_NOTICE, type: 'static' },
    { id: 'nameOfInsured', label: 'Name of insured', type: 'text', required: false },
    { id: 'insuranceCompany', label: 'Insurance company', type: 'text', required: false },
    { id: 'relationshipToInsured', label: 'Relationship to insured', type: 'text', required: false },
    { id: 'dobOfInsured', label: 'Date of birth of insured', type: 'date', required: false },

    // ── Section 6 — insurance authorization ───────────────────────────────────
    { id: 'authorizationNotice', label: AUTHORIZATION_NOTICE, type: 'static' },
    { id: 'authorizationSignature', label: 'Signature', type: 'text', required: false },
    { id: 'authorizationDate', label: 'Date', type: 'date', required: false },
  ],
};
