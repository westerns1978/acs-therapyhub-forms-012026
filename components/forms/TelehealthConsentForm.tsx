import { FormDefinition, TelehealthConsentData, FormErrors } from '../../types';

// Telehealth Informed Consent (ACS Forms-090825) — the 7 clauses captured as
// individual acknowledgements + consent + signatures. Distinct from the
// Telehealth Session FEEDBACK survey (telehealth-feedback). Persists to form_submissions.
const initialState: TelehealthConsentData = {
  clientName: '',
  understandsWithdrawAnytime: false,
  understandsRisks: false,
  understandsNoRecording: false,
  understandsPrivacyLimits: false,
  understandsCrisisHigherCare: false,
  understandsReconnectProtocol: false,
  consentsToTelehealth: false,
  clientSignature: '',
  staffSignature: '',
  signatureDate: new Date().toISOString().split('T')[0],
};

const ACK_KEYS: (keyof TelehealthConsentData)[] = [
  'understandsWithdrawAnytime', 'understandsRisks', 'understandsNoRecording',
  'understandsPrivacyLimits', 'understandsCrisisHigherCare', 'understandsReconnectProtocol',
  'consentsToTelehealth',
];

export const TELEHEALTH_CONSENT_DEFINITION: FormDefinition<TelehealthConsentData> = {
  id: 'telehealth-consent',
  title: 'Telehealth Informed Consent',
  description: 'Consent to participate in telehealth with Assessment & Counseling Solutions. Confidentiality protections (incl. 42 CFR Part 2) apply.',
  category: 'Legal',
  tags: ['Required', 'SATOP', 'Telehealth'],
  difficulty: 'Simple',
  estimatedTime: '4 min',
  initialState,
  validateStep: (d) => {
    const e: FormErrors<TelehealthConsentData> = {};
    if (!d.clientName) e.clientName = 'Required.';
    for (const k of ACK_KEYS) {
      if (!d[k]) e[k] = 'Please acknowledge each statement to consent.';
    }
    if (!d.clientSignature) e.clientSignature = 'Signature is required.';
    return e;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Client name', type: 'text', required: true },
    { id: 'understandsWithdrawAnytime', label: 'I understand I may withdraw consent at any time without affecting my right to future care; the agency may return to in-person services.', type: 'boolean', required: true },
    { id: 'understandsRisks', label: 'I understand the risks, benefits, and consequences of telehealth, including possible technology failures, interruptions/breaches of confidentiality, and limited ability to respond to emergencies.', type: 'boolean', required: true },
    { id: 'understandsNoRecording', label: 'I understand there will be NO recording of online sessions by either party; all information disclosed and written records are confidential.', type: 'boolean', required: true },
    { id: 'understandsPrivacyLimits', label: 'I understand the privacy laws protecting my PHI also apply to telehealth, except where an exception applies (mandated reporting of abuse; danger to self/others; mental health raised in a legal proceeding).', type: 'boolean', required: true },
    { id: 'understandsCrisisHigherCare', label: 'I understand that for suicidal/homicidal thoughts, active psychosis, or a crisis that cannot be resolved remotely, a higher level of care may be required.', type: 'boolean', required: true },
    { id: 'understandsReconnectProtocol', label: 'I understand that on a technical interruption we will end and restart; if we cannot reconnect within ten minutes I will call 314-849-2800 or call/text my counselor to switch to phone or reschedule.', type: 'boolean', required: true },
    { id: 'consentsToTelehealth', label: 'I consent to participate in telehealth services with Assessment & Counseling Solutions.', type: 'boolean', required: true },
    { id: 'clientSignature', label: 'Client signature (type your full legal name)', type: 'text', required: true },
    { id: 'staffSignature', label: 'Staff signature', type: 'text', required: false },
    { id: 'signatureDate', label: 'Date', type: 'date', required: false },
  ],
};
