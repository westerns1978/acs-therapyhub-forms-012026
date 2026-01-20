import React from 'react';
import { FormDefinition, RecoveryPlanData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { RadioGroup } from '../RadioGroup';
import { Checkbox } from '../Checkbox';

const initialState: RecoveryPlanData = {
  clientName: '',
  dateOfBirth: '',
  caseNumber: '',
  dateOfPlan: '',
  clientEmail: '',
  remainSober: null,
  problemsToAddress: '',
  howToAddressProblems: '',
  peoplePlacesThingsToAvoid: '',
  changesNoticed: '',
  whatToDoIfWantToUse: '',
  relapsePreventionSteps: '',
  whoSupportsRecovery: '',
  meetingsToAttend: '',
  sponsorDate: '',
  prescribedMedications: null,
  clearOnDosing: null,
  dailyRecoveryActivities: '',
  signature: '',
  acknowledgment: false,
  primaryGoals: '',
  goalMotivations: '',
  supportPeople: [],
  supportGroups: '',
  therapistName: '',
  therapistContact: '',
  triggers: '',
  copingSkills: '',
  emergencyContacts: '',
  actionSteps: [],
  signatureDataUrl: '',
};

// Step 1: Client Information & Goals
const RecoveryPlanStep1: React.FC<FormSectionProps<RecoveryPlanData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Client Identification</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="clientName" label="Client Full Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
          <FormField id="dateOfBirth" label="Date of Birth" type="date" value={formData.dateOfBirth} onChange={handleChange} error={errors.dateOfBirth} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="clientEmail" label="Email Address" type="email" value={formData.clientEmail} onChange={handleChange} error={errors.clientEmail} />
          <FormField id="caseNumber" label="Case Number" value={formData.caseNumber} onChange={handleChange} error={errors.caseNumber} />
        </div>
        <FormField id="dateOfPlan" label="Date of Plan" type="date" value={formData.dateOfPlan} onChange={handleChange} error={errors.dateOfPlan} />
      </div>

      <div>
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Recovery Goals</h3>
        <RadioGroup
          id="remainSober"
          label="Do you want to remain sober?"
          value={formData.remainSober}
          onChange={(val) => setFormData({ ...formData, remainSober: val })}
          error={errors.remainSober}
        />
        <FormField id="primaryGoals" label="What are your primary recovery goals?" type="textarea" value={formData.primaryGoals} onChange={handleChange} error={errors.primaryGoals} maxLength={500} />
        <FormField id="goalMotivations" label="What motivates you to achieve these goals?" type="textarea" value={formData.goalMotivations} onChange={handleChange} error={errors.goalMotivations} maxLength={500} />
      </div>
    </div>
  );
};

// Step 2: Problems & Solutions
const RecoveryPlanStep2: React.FC<FormSectionProps<RecoveryPlanData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Identifying Challenges</h3>
      <FormField id="problemsToAddress" label="What problems do you need to address in recovery?" type="textarea" value={formData.problemsToAddress} onChange={handleChange} error={errors.problemsToAddress} maxLength={800} />
      <FormField id="howToAddressProblems" label="How do you plan to address these problems?" type="textarea" value={formData.howToAddressProblems} onChange={handleChange} error={errors.howToAddressProblems} maxLength={800} />
      <FormField id="peoplePlacesThingsToAvoid" label="What people, places, and things do you need to avoid?" type="textarea" value={formData.peoplePlacesThingsToAvoid} onChange={handleChange} error={errors.peoplePlacesThingsToAvoid} maxLength={800} />
      <FormField id="triggers" label="What are your primary triggers?" type="textarea" value={formData.triggers} onChange={handleChange} error={errors.triggers} maxLength={500} />
    </div>
  );
};

// Step 3: Relapse Prevention
const RecoveryPlanStep3: React.FC<FormSectionProps<RecoveryPlanData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Relapse Prevention Strategy</h3>
      <FormField id="changesNoticed" label="What positive changes have you noticed since beginning recovery?" type="textarea" value={formData.changesNoticed} onChange={handleChange} error={errors.changesNoticed} maxLength={600} />
      <FormField id="whatToDoIfWantToUse" label="What will you do if you feel like using?" type="textarea" value={formData.whatToDoIfWantToUse} onChange={handleChange} error={errors.whatToDoIfWantToUse} maxLength={600} />
      <FormField id="relapsePreventionSteps" label="What specific steps will you take to prevent relapse?" type="textarea" value={formData.relapsePreventionSteps} onChange={handleChange} error={errors.relapsePreventionSteps} maxLength={600} />
      <FormField id="copingSkills" label="What healthy coping skills will you use?" type="textarea" value={formData.copingSkills} onChange={handleChange} error={errors.copingSkills} maxLength={500} />
    </div>
  );
};

// Step 4: Support System
const RecoveryPlanStep4: React.FC<FormSectionProps<RecoveryPlanData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Support Network</h3>
      <FormField id="whoSupportsRecovery" label="Who supports your recovery? (Name and relationship)" type="textarea" value={formData.whoSupportsRecovery} onChange={handleChange} error={errors.whoSupportsRecovery} maxLength={500} />
      <FormField id="meetingsToAttend" label="What meetings do you plan to attend? (Type, day, time, location)" type="textarea" value={formData.meetingsToAttend} onChange={handleChange} error={errors.meetingsToAttend} maxLength={400} />
      <FormField id="supportGroups" label="What other support groups or resources will you use?" type="textarea" value={formData.supportGroups} onChange={handleChange} error={errors.supportGroups} maxLength={400} />
      <FormField id="sponsorDate" label="When do you plan to get a sponsor? (or current sponsor info)" value={formData.sponsorDate} onChange={handleChange} error={errors.sponsorDate} />
      <FormField id="emergencyContacts" label="Emergency contacts (Name, phone, relationship)" type="textarea" value={formData.emergencyContacts} onChange={handleChange} error={errors.emergencyContacts} maxLength={400} />
    </div>
  );
};

// Step 5: Medications & Acknowledgment
const RecoveryPlanStep5: React.FC<FormSectionProps<RecoveryPlanData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Medications & Daily Routine</h3>
      <RadioGroup
        id="prescribedMedications"
        label="Are you currently on any prescribed medications?"
        value={formData.prescribedMedications}
        onChange={(val) => setFormData({ ...formData, prescribedMedications: val })}
        error={errors.prescribedMedications}
      />
      {formData.prescribedMedications && (
        <RadioGroup
          id="clearOnDosing"
          label="Are you clear on proper dosing and usage?"
          value={formData.clearOnDosing}
          onChange={(val) => setFormData({ ...formData, clearOnDosing: val })}
          error={errors.clearOnDosing}
        />
      )}
      <FormField id="dailyRecoveryActivities" label="What daily activities will support your recovery?" type="textarea" value={formData.dailyRecoveryActivities} onChange={handleChange} error={errors.dailyRecoveryActivities} maxLength={500} />

      <div className="pt-8 border-t border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Acknowledgment & Signature</h3>
        <Checkbox
          id="acknowledgment"
          label="I acknowledge that I have created this recovery plan and commit to following it to the best of my ability. I understand that my recovery is my responsibility."
          checked={formData.acknowledgment}
          onChange={(e) => setFormData({ ...formData, acknowledgment: e.target.checked })}
          error={errors.acknowledgment}
        />
        <FormField id="signature" label="Electronic Signature (Type your full name)" value={formData.signature} onChange={handleChange} error={errors.signature} />
      </div>
    </div>
  );
};

const validateStep = (step: number, data: RecoveryPlanData): FormErrors<RecoveryPlanData> => {
  const errors: FormErrors<RecoveryPlanData> = {};

  if (step === 1) {
    if (!data.clientName.trim()) errors.clientName = 'Client name is required';
    if (!data.clientEmail.trim()) errors.clientEmail = 'Email is required';
    if (data.clientEmail && !/\S+@\S+\.\S+/.test(data.clientEmail)) errors.clientEmail = 'Invalid email format';
    if (!data.dateOfPlan) errors.dateOfPlan = 'Date of plan is required';
    if (data.remainSober === null) errors.remainSober = 'Please answer this question';
  }

  if (step === 2) {
    if (!data.problemsToAddress.trim()) errors.problemsToAddress = 'Please identify problems to address';
    if (!data.howToAddressProblems.trim()) errors.howToAddressProblems = 'Please describe how you will address problems';
  }

  if (step === 3) {
    if (!data.whatToDoIfWantToUse.trim()) errors.whatToDoIfWantToUse = 'Please describe your plan';
    if (!data.relapsePreventionSteps.trim()) errors.relapsePreventionSteps = 'Please list prevention steps';
  }

  if (step === 4) {
    if (!data.whoSupportsRecovery.trim()) errors.whoSupportsRecovery = 'Please identify your support network';
  }

  if (step === 5) {
    if (data.prescribedMedications === null) errors.prescribedMedications = 'Please answer this question';
    if (!data.acknowledgment) errors.acknowledgment = 'You must acknowledge the recovery plan';
    if (!data.signature.trim()) errors.signature = 'Signature is required';
  }

  return errors;
};

export const RECOVERY_PLAN_DEFINITION: FormDefinition<RecoveryPlanData> = {
  id: 'recovery-plan',
  title: 'Continuing Recovery Plan',
  description: 'Comprehensive recovery planning document for clients to outline their sobriety goals, support systems, and relapse prevention strategies.',
  category: 'Treatment',
  tags: ['Required', 'SATOP'],
  estimatedTime: '15-20 min',
  difficulty: 'Moderate',
  isRecommended: true,
  successScreen: { googleReview: true },
  initialState,
  steps: [RecoveryPlanStep1, RecoveryPlanStep2, RecoveryPlanStep3, RecoveryPlanStep4, RecoveryPlanStep5],
  validateStep,
  fieldDefinitions: [
    { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
    { key: 'caseNumber', label: 'Case Number' },
    { key: 'dateOfPlan', label: 'Date of Plan', type: 'date' },
    { key: 'remainSober', label: 'Wants to Remain Sober', type: 'boolean' },
    { key: 'primaryGoals', label: 'Primary Goals' },
    { key: 'problemsToAddress', label: 'Problems to Address' },
    { key: 'howToAddressProblems', label: 'How to Address Problems' },
    { key: 'peoplePlacesThingsToAvoid', label: 'People/Places/Things to Avoid' },
    { key: 'triggers', label: 'Triggers' },
    { key: 'changesNoticed', label: 'Positive Changes Noticed' },
    { key: 'whatToDoIfWantToUse', label: 'Plan If Urge to Use' },
    { key: 'relapsePreventionSteps', label: 'Relapse Prevention Steps' },
    { key: 'copingSkills', label: 'Coping Skills' },
    { key: 'whoSupportsRecovery', label: 'Support Network' },
    { key: 'meetingsToAttend', label: 'Meetings to Attend' },
    { key: 'supportGroups', label: 'Support Groups' },
    { key: 'sponsorDate', label: 'Sponsor Information' },
    { key: 'emergencyContacts', label: 'Emergency Contacts' },
    { key: 'prescribedMedications', label: 'On Medications', type: 'boolean' },
    { key: 'clearOnDosing', label: 'Clear on Dosing', type: 'boolean' },
    { key: 'dailyRecoveryActivities', label: 'Daily Recovery Activities' },
    { key: 'acknowledgment', label: 'Acknowledgment', type: 'boolean' },
    { key: 'signature', label: 'Client Signature' },
  ]
};
