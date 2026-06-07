import { FormDefinition, HipaaAckData, FormErrors } from '../../types';

// HIPAA Notice of Privacy Practices — Acknowledgement Cover Sheet (ACS Forms-090825).
// Single-signature acknowledgement; persists to form_submissions like every other form.
const initialState: HipaaAckData = {
  clientName: '',
  acknowledgesNotice: false,
  clientSignature: '',
  signatureDate: new Date().toISOString().split('T')[0],
};

export const HIPAA_ACK_DEFINITION: FormDefinition<HipaaAckData> = {
  id: 'hipaa-ack',
  title: 'HIPAA Notice Acknowledgement',
  description: 'Acknowledgement of receipt of ACS’s HIPAA Notice of Privacy Practices (effective January 2025).',
  category: 'Legal',
  tags: ['Required', 'SATOP'],
  difficulty: 'Simple',
  estimatedTime: '2 min',
  initialState,
  validateStep: (d) => {
    const e: FormErrors<HipaaAckData> = {};
    if (!d.clientName) e.clientName = 'Required.';
    if (!d.acknowledgesNotice) e.acknowledgesNotice = 'You must acknowledge receipt of the Notice.';
    if (!d.clientSignature) e.clientSignature = 'Signature is required.';
    return e;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Client name', type: 'text', required: true },
    { id: 'acknowledgesNotice', label: 'I acknowledge that I have received ACS’s HIPAA Notice of Privacy Practices, with an effective date of January 2025.', type: 'boolean', required: true },
    { id: 'clientSignature', label: 'Client signature (type your full legal name)', type: 'text', required: true },
    { id: 'signatureDate', label: 'Date', type: 'date', required: false },
  ],
};
