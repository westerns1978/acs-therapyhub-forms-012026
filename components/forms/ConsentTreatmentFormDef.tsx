import React from 'react';
import { FormDefinition, ConsentForTreatmentData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { CheckboxGroup } from '../CheckboxGroup';

const initialState: ConsentForTreatmentData = {
  clientName: '', clientEmail: '', groupDays: {}, groupTimeFrom: '', groupTimeTo: '',
  understandsAttendancePolicy: false, agreesToFee: false, understandsCancellationPolicy: false,
  understandsExcusedAbsences: false, agreesToAbstinence: false, consentsToTesting: false,
  understandsConsequences: false, acknowledgesMarijuanaPolicy: false, disclosedMedications: '',
  disclosesControlledSubstances: false, disclosesMedicalIssues: false, agreesToSupportGroups: false,
  clientSignature: '', staffSignature: '', date: ''
};

const ConsentSection: React.FC<FormSectionProps<ConsentForTreatmentData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-6">
      <FormField id="clientName" label="Full Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
      <CheckboxGroup 
        id="policies" 
        label="Policy Acknowledgments" 
        options={[
          {id: 'understandsAttendancePolicy', label: 'Attendance Policy'},
          {id: 'agreesToFee', label: 'Fee Agreement'}
        ]}
        values={{
          understandsAttendancePolicy: formData.understandsAttendancePolicy,
          agreesToFee: formData.agreesToFee
        }}
        onChange={(id) => setFormData({...formData, [id]: !formData[id as keyof ConsentForTreatmentData]})}
      />
    </div>
  );
};

export const CONSENT_TREATMENT_DEFINITION: FormDefinition<ConsentForTreatmentData> = {
  id: 'consent-treatment',
  title: 'Consent for Treatment',
  description: 'Legal authorization and policy acknowledgment for clinical services.',
  category: 'Legal',
  initialState,
  steps: [ConsentSection],
  validateStep: (step, data) => {
    const errs: FormErrors<ConsentForTreatmentData> = {};
    if (!data.clientName) errs.clientName = 'Required.';
    return errs;
  },
  fieldDefinitions: [
    { key: 'clientName', label: 'Client Name' }
  ]
};