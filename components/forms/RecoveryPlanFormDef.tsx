import React from 'react';
import { FormDefinition, RecoveryPlanData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { RadioGroup } from '../RadioGroup';

const initialState: RecoveryPlanData = {
  clientName: '', dateOfBirth: '', caseNumber: '', dateOfPlan: '', clientEmail: '',
  remainSober: null, problemsToAddress: '', howToAddressProblems: '',
  peoplePlacesThingsToAvoid: '', changesNoticed: '', whatToDoIfWantToUse: '',
  relapsePreventionSteps: '', whoSupportsRecovery: '', meetingsToAttend: '',
  sponsorDate: '', prescribedMedications: null, clearOnDosing: null,
  dailyRecoveryActivities: '', signature: '', acknowledgment: false,
  primaryGoals: '', goalMotivations: '', supportPeople: [], supportGroups: '',
  therapistName: '', therapistContact: '', triggers: '', copingSkills: '',
  emergencyContacts: '', actionSteps: [], signatureDataUrl: ''
};

const Section1: React.FC<FormSectionProps<RecoveryPlanData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-6">
      <FormField id="clientName" label="Client Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
      <RadioGroup id="remainSober" label="Do you intend to remain sober?" value={formData.remainSober} onChange={(val) => setFormData({...formData, remainSober: val})} error={errors.remainSober} />
      <FormField id="problemsToAddress" label="What problems do you need to address?" type="textarea" value={formData.problemsToAddress} onChange={handleChange} error={errors.problemsToAddress} />
    </div>
  );
};

const Section2: React.FC<FormSectionProps<RecoveryPlanData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-6">
      <FormField id="relapsePreventionSteps" label="What steps will you take to prevent relapse?" type="textarea" value={formData.relapsePreventionSteps} onChange={handleChange} error={errors.relapsePreventionSteps} />
      <FormField id="whoSupportsRecovery" label="Who supports your recovery?" type="textarea" value={formData.whoSupportsRecovery} onChange={handleChange} error={errors.whoSupportsRecovery} />
    </div>
  );
};

export const RECOVERY_PLAN_DEFINITION: FormDefinition<RecoveryPlanData> = {
  id: 'recovery-plan',
  title: 'Continuing Recovery Plan',
  description: 'A comprehensive plan for maintaining long-term sobriety and wellness.',
  category: 'Treatment',
  initialState,
  steps: [Section1, Section2],
  validateStep: (step, data) => {
    const errs: FormErrors<RecoveryPlanData> = {};
    if (step === 1 && !data.clientName) errs.clientName = 'Required.';
    return errs;
  },
  fieldDefinitions: [
    { key: 'clientName', label: 'Client Name' },
    { key: 'remainSober', label: 'Sober Intent', type: 'boolean' }
  ]
};