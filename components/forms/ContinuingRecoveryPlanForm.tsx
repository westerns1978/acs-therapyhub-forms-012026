
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
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">About you</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <FormField id="clientName" label="Full name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
        <FormField id="dateOfBirth" label="Date of birth" type="date" value={formData.dateOfBirth} onChange={handleChange} error={errors.dateOfBirth} />
      </div>
      <FormField id="primaryGoals" label="Primary recovery goals" type="textarea" value={formData.primaryGoals} onChange={handleChange} error={errors.primaryGoals} placeholder="What do you hope to achieve through this program?" />
      <RadioGroup id="remainSober" label="I plan to remain sober" value={formData.remainSober} onChange={(val) => setFormData({...formData, remainSober: val})} error={errors.remainSober} />
    </div>
  );
};

const Step2: React.FC<FormSectionProps<RecoveryPlanData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Problems and goals</h3>
      <FormField id="problemsToAddress" label="Problems I need to address" type="textarea" value={formData.problemsToAddress} onChange={handleChange} error={errors.problemsToAddress} />
      <FormField id="howToAddressProblems" label="How I plan to address them" type="textarea" value={formData.howToAddressProblems} onChange={handleChange} error={errors.howToAddressProblems} />
      <FormField id="triggers" label="My triggers (people, places, things)" type="textarea" value={formData.triggers} onChange={handleChange} error={errors.triggers} />
    </div>
  );
};

const Step3: React.FC<FormSectionProps<RecoveryPlanData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Relapse prevention</h3>
      <FormField id="relapsePreventionSteps" label="Steps I'll take if I feel like using" type="textarea" value={formData.relapsePreventionSteps} onChange={handleChange} error={errors.relapsePreventionSteps} />
      <FormField id="copingSkills" label="Coping skills that work for me" type="textarea" value={formData.copingSkills} onChange={handleChange} error={errors.copingSkills} />
    </div>
  );
};

const Step4: React.FC<FormSectionProps<RecoveryPlanData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Support network</h3>
      <FormField id="whoSupportsRecovery" label="Who supports my recovery" type="textarea" value={formData.whoSupportsRecovery} onChange={handleChange} error={errors.whoSupportsRecovery} />
      <FormField id="supportGroups" label="Support groups I attend (AA, NA, etc.)" type="textarea" value={formData.supportGroups} onChange={handleChange} error={errors.supportGroups} />
      <FormField id="emergencyContacts" label="Emergency contacts" type="textarea" value={formData.emergencyContacts} onChange={handleChange} error={errors.emergencyContacts} />
    </div>
  );
};

const Step5: React.FC<FormSectionProps<RecoveryPlanData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Medications and commitment</h3>
      <RadioGroup id="prescribedMedications" label="I am taking prescribed medications" value={formData.prescribedMedications} onChange={(val) => setFormData({...formData, prescribedMedications: val})} error={errors.prescribedMedications} />
      <FormField id="dailyRecoveryActivities" label="My daily recovery activities" type="textarea" value={formData.dailyRecoveryActivities} onChange={handleChange} error={errors.dailyRecoveryActivities} />

      <div className="pt-8 border-t border-black/5 dark:border-white/5">
        <Checkbox id="acknowledgment" label="I acknowledge this is my current recovery plan." checked={formData.acknowledgment} onChange={(val) => setFormData({...formData, acknowledgment: val})} error={errors.acknowledgment} />
        <FormField id="signature" label="Signature (type your name)" value={formData.signature} onChange={handleChange} error={errors.signature} />
      </div>
    </div>
  );
};

export const RECOVERY_PLAN_DEFINITION: FormDefinition<RecoveryPlanData> = {
  id: 'recovery-plan',
  title: 'Continuing Recovery Plan',
  description: 'Your plan for maintaining long-term sobriety. Aligned with SROP requirements.',
  category: 'Treatment',
  tags: ['Required', 'SATOP'],
  difficulty: 'Moderate',
  estimatedTime: '12 min',
  initialState,
  validateStep: (data) => {

    const errs: FormErrors<RecoveryPlanData> = {};
    if (!data.clientName) errs.clientName = 'Required.';
    if (data.remainSober === null) errs.remainSober = 'Please select an option.';
    if (!data.acknowledgment) errs.acknowledgment = 'Please acknowledge to continue.';
    if (!data.signature) errs.signature = 'Signature is required.';

    return errs;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Full name', type: 'text', required: true },
    { id: 'dateOfBirth', label: 'Date of birth', type: 'date', required: true },
    { id: 'primaryGoals', label: 'Primary recovery goals', type: 'textarea', required: true },
    { id: 'remainSober', label: 'I plan to remain sober', type: 'boolean', required: true },
    { id: 'problemsToAddress', label: 'Problems I need to address', type: 'textarea', required: true },
    { id: 'howToAddressProblems', label: 'How I plan to address them', type: 'textarea', required: true },
    { id: 'triggers', label: 'My triggers (people, places, things)', type: 'textarea', required: true },
    { id: 'relapsePreventionSteps', label: "Steps I'll take if I feel like using", type: 'textarea', required: true },
    { id: 'copingSkills', label: 'Coping skills that work for me', type: 'textarea', required: true },
    { id: 'whoSupportsRecovery', label: 'Who supports my recovery', type: 'textarea', required: true },
    { id: 'supportGroups', label: 'Support groups I attend (AA, NA, etc.)', type: 'textarea', required: true },
    { id: 'emergencyContacts', label: 'Emergency contacts', type: 'textarea', required: true },
    { id: 'prescribedMedications', label: 'I am taking prescribed medications', type: 'boolean', required: true },
    { id: 'dailyRecoveryActivities', label: 'My daily recovery activities', type: 'textarea', required: true },
    { id: 'acknowledgment', label: 'I acknowledge this is my current recovery plan.', type: 'boolean', required: true },
    { id: 'signature', label: 'Signature (type your name)', type: 'text', required: true }
  ]
};
