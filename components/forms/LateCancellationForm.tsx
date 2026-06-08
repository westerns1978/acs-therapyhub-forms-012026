import { FormDefinition, LateCancellationData, FormErrors } from '../../types';
import { LATE_CANCELLATION_FEE } from '../../config/satopFees';

// Late Cancellation Policy acknowledgement (ACS New folder). Single-signature.
const initialState: LateCancellationData = {
  clientName: '',
  acknowledgesPolicy: false,
  clientSignature: '',
  signatureDate: new Date().toISOString().split('T')[0],
};

export const LATE_CANCELLATION_DEFINITION: FormDefinition<LateCancellationData> = {
  id: 'late-cancellation',
  title: 'Late Cancellation Policy',
  description: 'Acknowledgement of the ACS late-cancellation policy.',
  category: 'Legal',
  tags: ['SATOP'],
  difficulty: 'Simple',
  estimatedTime: '1 min',
  initialState,
  validateStep: (d) => {
    const e: FormErrors<LateCancellationData> = {};
    if (!d.clientName) e.clientName = 'Required.';
    if (!d.acknowledgesPolicy) e.acknowledgesPolicy = 'You must acknowledge the policy.';
    if (!d.clientSignature) e.clientSignature = 'Signature is required.';
    return e;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Client name', type: 'text', required: true },
    { id: 'acknowledgesPolicy', label: `I have read and understand: a $${LATE_CANCELLATION_FEE} late-cancellation fee is assessed for appointments cancelled less than 24 hours in advance of the appointment. Exceptions for emergencies are made at the discretion of ACS management.`, type: 'boolean', required: true },
    { id: 'clientSignature', label: 'Client signature (type your full legal name)', type: 'text', required: true },
    { id: 'signatureDate', label: 'Date', type: 'date', required: false },
  ],
};
