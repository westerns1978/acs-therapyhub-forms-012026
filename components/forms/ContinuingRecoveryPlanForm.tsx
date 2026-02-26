
import React from 'react';
import { FormDefinition, RecoveryPlanData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { RadioGroup } from '../RadioGroup';
import { Checkbox } from '../Checkbox';

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

const Step1: React.FC<FormSectionProps<RecoveryPlanData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Phase 1: Clinical Identification</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <FormField id="clientName" label="Client Full Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
        <FormField id="dateOfBirth" label="Date of Birth" type="date" value={formData.dateOfBirth} onChange={handleChange} error={errors.dateOfBirth} />
      </div>
      <FormField id="primaryGoals" label="Primary Recovery Objectives" type="textarea" value={formData.primaryGoals} onChange={handleChange} error={errors.primaryGoals} placeholder="What do you hope to achieve through this protocol?" />
      <RadioGroup id="remainSober" label="Abstinence Intent" value={formData.remainSober} onChange={(val) => setFormData({...formData, remainSober: val})} error={errors.remainSober} />
    </div>
  );
};

const Step2: React.FC<FormSectionProps<RecoveryPlanData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Phase 2: Problem Resolution</h3>
      <FormField id="problemsToAddress" label="Current Behavioral Obstacles" type="textarea" value={formData.problemsToAddress} onChange={handleChange} error={errors.problemsToAddress} />
      <FormField id="howToAddressProblems" label="Resolution Strategies" type="textarea" value={formData.howToAddressProblems} onChange={handleChange} error={errors.howToAddressProblems} />
      <FormField id="triggers" label="High-Risk Environmental Triggers" type="textarea" value={formData.triggers} onChange={handleChange} error={errors.triggers} />
    </div>
  );
};

const Step3: React.FC<FormSectionProps<RecoveryPlanData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Phase 3: Relapse Prevention Telemetry</h3>
      <FormField id="relapsePreventionSteps" label="Defensive Action Protocols" type="textarea" value={formData.relapsePreventionSteps} onChange={handleChange} error={errors.relapsePreventionSteps} />
      <FormField id="copingSkills" label="Adaptive Coping Mechanisms" type="textarea" value={formData.copingSkills} onChange={handleChange} error={errors.copingSkills} />
    </div>
  );
};

const Step4: React.FC<FormSectionProps<RecoveryPlanData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Phase 4: Support Network Grid</h3>
      <FormField id="whoSupportsRecovery" label="Recovery Support Infrastructure" type="textarea" value={formData.whoSupportsRecovery} onChange={handleChange} error={errors.whoSupportsRecovery} />
      <FormField id="supportGroups" label="Synchronized Support Modules (AA/NA)" type="textarea" value={formData.supportGroups} onChange={handleChange} error={errors.supportGroups} />
      <FormField id="emergencyContacts" label="Emergency Uplink Contacts" type="textarea" value={formData.emergencyContacts} onChange={handleChange} error={errors.emergencyContacts} />
    </div>
  );
};

const Step5: React.FC<FormSectionProps<RecoveryPlanData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Phase 5: Medication & Commitment</h3>
      <RadioGroup id="prescribedMedications" label="Active Medication Maintenance" value={formData.prescribedMedications} onChange={(val) => setFormData({...formData, prescribedMedications: val})} error={errors.prescribedMedications} />
      <FormField id="dailyRecoveryActivities" label="Daily Maintenance Routine" type="textarea" value={formData.dailyRecoveryActivities} onChange={handleChange} error={errors.dailyRecoveryActivities} />
      
      <div className="pt-8 border-t border-black/5 dark:border-white/5">
        <Checkbox id="acknowledgment" label="I verify this protocol as my current continuing recovery plan." checked={formData.acknowledgment} onChange={(val) => setFormData({...formData, acknowledgment: val})} error={errors.acknowledgment} />
        <FormField id="signature" label="Digital Verification (Type Name)" value={formData.signature} onChange={handleChange} error={errors.signature} />
      </div>
    </div>
  );
};

export const RECOVERY_PLAN_DEFINITION: FormDefinition<RecoveryPlanData> = {
  id: 'recovery-plan',
  title: 'Continuing Recovery Plan',
  description: 'High-fidelity plan for maintaining long-term sobriety and clinical wellness. Aligned with SROP requirements.',
  category: 'Treatment',
  tags: ['Required', 'SATOP'],
  difficulty: 'Moderate',
  estimatedTime: '12 min',
  initialState,
  validateStep: (data) => {

    const errs: FormErrors<RecoveryPlanData> = {};
    if (!data.clientName) errs.clientName = 'Mandatory.';
    if (data.remainSober === null) errs.remainSober = 'Select intent.';
    if (!data.acknowledgment) errs.acknowledgment = 'Acknowledge protocol.';
    if (!data.signature) errs.signature = 'Signature required.';

    return errs;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Client Full Name', type: 'text', required: true },
    { id: 'dateOfBirth', label: 'Date of Birth', type: 'date', required: true },
    { id: 'primaryGoals', label: 'Primary Recovery Objectives', type: 'textarea', required: true },
    { id: 'remainSober', label: 'Abstinence Intent', type: 'boolean', required: true },
    { id: 'problemsToAddress', label: 'Current Behavioral Obstacles', type: 'textarea', required: true },
    { id: 'howToAddressProblems', label: 'Resolution Strategies', type: 'textarea', required: true },
    { id: 'triggers', label: 'High-Risk Environmental Triggers', type: 'textarea', required: true },
    { id: 'relapsePreventionSteps', label: 'Defensive Action Protocols', type: 'textarea', required: true },
    { id: 'copingSkills', label: 'Adaptive Coping Mechanisms', type: 'textarea', required: true },
    { id: 'whoSupportsRecovery', label: 'Recovery Support Infrastructure', type: 'textarea', required: true },
    { id: 'supportGroups', label: 'Synchronized Support Modules (AA/NA)', type: 'textarea', required: true },
    { id: 'emergencyContacts', label: 'Emergency Uplink Contacts', type: 'textarea', required: true },
    { id: 'prescribedMedications', label: 'Active Medication Maintenance', type: 'boolean', required: true },
    { id: 'dailyRecoveryActivities', label: 'Daily Maintenance Routine', type: 'textarea', required: true },
    { id: 'acknowledgment', label: 'I verify this protocol as my current continuing recovery plan.', type: 'boolean', required: true },
    { id: 'signature', label: 'Digital Verification (Type Name)', type: 'text', required: true }
  ]
};
