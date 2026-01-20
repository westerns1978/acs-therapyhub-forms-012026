import React from 'react';
import { FormDefinition, ConsentForTreatmentData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { Checkbox } from '../Checkbox';
import { CheckboxGroup } from '../CheckboxGroup';

const initialState: ConsentForTreatmentData = {
  clientName: '',
  clientEmail: '',
  groupDays: { monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false },
  groupTimeFrom: '',
  groupTimeTo: '',
  understandsAttendancePolicy: false,
  agreesToFee: false,
  understandsCancellationPolicy: false,
  understandsExcusedAbsences: false,
  agreesToAbstinence: false,
  consentsToTesting: false,
  understandsConsequences: false,
  acknowledgesMarijuanaPolicy: false,
  disclosedMedications: '',
  disclosesControlledSubstances: false,
  disclosesMedicalIssues: false,
  agreesToSupportGroups: false,
  clientSignature: '',
  staffSignature: '',
  date: '',
};

const dayOptions = [
  { id: 'monday', label: 'Mon' },
  { id: 'tuesday', label: 'Tue' },
  { id: 'wednesday', label: 'Wed' },
  { id: 'thursday', label: 'Thu' },
  { id: 'friday', label: 'Fri' },
  { id: 'saturday', label: 'Sat' },
];

// Step 1: Client Info & Schedule
const ConsentStep1: React.FC<FormSectionProps<ConsentForTreatmentData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDayToggle = (dayId: string) => {
    setFormData({
      ...formData,
      groupDays: { ...formData.groupDays, [dayId]: !formData.groupDays[dayId] }
    });
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Client Information</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <FormField id="clientName" label="Client Full Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
        <FormField id="clientEmail" label="Email Address" type="email" value={formData.clientEmail} onChange={handleChange} error={errors.clientEmail} />
      </div>

      <div className="pt-8 border-t border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Group Schedule</h3>
        <CheckboxGroup
          id="groupDays"
          label="Select your group days"
          options={dayOptions}
          values={formData.groupDays}
          onChange={handleDayToggle}
          error={errors.groupDays}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 mt-6">
          <FormField id="groupTimeFrom" label="Group Start Time" type="time" value={formData.groupTimeFrom} onChange={handleChange} error={errors.groupTimeFrom} />
          <FormField id="groupTimeTo" label="Group End Time" type="time" value={formData.groupTimeTo} onChange={handleChange} error={errors.groupTimeTo} />
        </div>
      </div>
    </div>
  );
};

// Step 2: Attendance Policies
const ConsentStep2: React.FC<FormSectionProps<ConsentForTreatmentData>> = ({ formData, setFormData, errors }) => {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Attendance & Fee Policies</h3>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 mb-6">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>Attendance Policy:</strong> Clients are expected to attend all scheduled group sessions. More than two unexcused absences may result in termination from the program.
        </p>
      </div>

      <Checkbox
        id="understandsAttendancePolicy"
        label="I understand and agree to comply with the attendance policy."
        checked={formData.understandsAttendancePolicy}
        onChange={(e) => setFormData({ ...formData, understandsAttendancePolicy: e.target.checked })}
        error={errors.understandsAttendancePolicy}
      />

      <Checkbox
        id="agreesToFee"
        label="I agree to pay the required program fees as outlined in the fee schedule."
        checked={formData.agreesToFee}
        onChange={(e) => setFormData({ ...formData, agreesToFee: e.target.checked })}
        error={errors.agreesToFee}
      />

      <Checkbox
        id="understandsCancellationPolicy"
        label="I understand that missed sessions without 24-hour notice may incur a cancellation fee."
        checked={formData.understandsCancellationPolicy}
        onChange={(e) => setFormData({ ...formData, understandsCancellationPolicy: e.target.checked })}
        error={errors.understandsCancellationPolicy}
      />

      <Checkbox
        id="understandsExcusedAbsences"
        label="I understand what constitutes an excused absence (medical emergency, court appearance, etc.) and will provide documentation."
        checked={formData.understandsExcusedAbsences}
        onChange={(e) => setFormData({ ...formData, understandsExcusedAbsences: e.target.checked })}
        error={errors.understandsExcusedAbsences}
      />
    </div>
  );
};

// Step 3: Abstinence & Testing
const ConsentStep3: React.FC<FormSectionProps<ConsentForTreatmentData>> = ({ formData, setFormData, errors }) => {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Abstinence & Drug Testing</h3>

      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30 mb-6">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          <strong>Abstinence Requirement:</strong> Clients must maintain complete abstinence from alcohol and all non-prescribed mood-altering substances throughout the program.
        </p>
      </div>

      <Checkbox
        id="agreesToAbstinence"
        label="I agree to maintain complete abstinence from alcohol and all illicit substances during my participation in this program."
        checked={formData.agreesToAbstinence}
        onChange={(e) => setFormData({ ...formData, agreesToAbstinence: e.target.checked })}
        error={errors.agreesToAbstinence}
      />

      <Checkbox
        id="consentsToTesting"
        label="I consent to random drug and alcohol testing as part of my treatment program. I understand that refusing a test is treated as a positive result."
        checked={formData.consentsToTesting}
        onChange={(e) => setFormData({ ...formData, consentsToTesting: e.target.checked })}
        error={errors.consentsToTesting}
      />

      <Checkbox
        id="understandsConsequences"
        label="I understand that a positive drug/alcohol test may result in program termination and notification of my probation/parole officer and/or the court."
        checked={formData.understandsConsequences}
        onChange={(e) => setFormData({ ...formData, understandsConsequences: e.target.checked })}
        error={errors.understandsConsequences}
      />

      <Checkbox
        id="acknowledgesMarijuanaPolicy"
        label="I acknowledge that marijuana use, even with a medical card, is not permitted while in this program."
        checked={formData.acknowledgesMarijuanaPolicy}
        onChange={(e) => setFormData({ ...formData, acknowledgesMarijuanaPolicy: e.target.checked })}
        error={errors.acknowledgesMarijuanaPolicy}
      />
    </div>
  );
};

// Step 4: Medications & Medical
const ConsentStep4: React.FC<FormSectionProps<ConsentForTreatmentData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Medications & Medical Disclosure</h3>

      <FormField
        id="disclosedMedications"
        label="List all current medications (prescription and over-the-counter)"
        type="textarea"
        value={formData.disclosedMedications}
        onChange={handleChange}
        error={errors.disclosedMedications}
        maxLength={500}
        required={false}
      />

      <Checkbox
        id="disclosesControlledSubstances"
        label="I agree to disclose any prescribed controlled substances to my counselor and provide documentation from my prescribing physician."
        checked={formData.disclosesControlledSubstances}
        onChange={(e) => setFormData({ ...formData, disclosesControlledSubstances: e.target.checked })}
        error={errors.disclosesControlledSubstances}
      />

      <Checkbox
        id="disclosesMedicalIssues"
        label="I agree to inform staff of any medical conditions that may affect my participation in treatment."
        checked={formData.disclosesMedicalIssues}
        onChange={(e) => setFormData({ ...formData, disclosesMedicalIssues: e.target.checked })}
        error={errors.disclosesMedicalIssues}
      />

      <Checkbox
        id="agreesToSupportGroups"
        label="I agree to attend outside support group meetings (AA/NA) as recommended by my counselor."
        checked={formData.agreesToSupportGroups}
        onChange={(e) => setFormData({ ...formData, agreesToSupportGroups: e.target.checked })}
        error={errors.agreesToSupportGroups}
      />
    </div>
  );
};

// Step 5: Signatures
const ConsentStep5: React.FC<FormSectionProps<ConsentForTreatmentData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Authorization & Signatures</h3>

      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 mb-6">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          By signing below, I certify that I have read, understand, and agree to comply with all policies outlined in this consent form. I understand that violation of these policies may result in termination from the program.
        </p>
      </div>

      <FormField id="clientSignature" label="Client Signature (Type full legal name)" value={formData.clientSignature} onChange={handleChange} error={errors.clientSignature} />
      <FormField id="staffSignature" label="Staff Signature (Type full name)" value={formData.staffSignature} onChange={handleChange} error={errors.staffSignature} />
      <FormField id="date" label="Date" type="date" value={formData.date} onChange={handleChange} error={errors.date} />
    </div>
  );
};

const validateStep = (step: number, data: ConsentForTreatmentData): FormErrors<ConsentForTreatmentData> => {
  const errors: FormErrors<ConsentForTreatmentData> = {};

  if (step === 1) {
    if (!data.clientName.trim()) errors.clientName = 'Client name is required';
    if (!data.clientEmail.trim()) errors.clientEmail = 'Email is required';
    if (data.clientEmail && !/\S+@\S+\.\S+/.test(data.clientEmail)) errors.clientEmail = 'Invalid email format';
    const hasSelectedDay = Object.values(data.groupDays).some(v => v);
    if (!hasSelectedDay) errors.groupDays = 'Please select at least one group day';
  }

  if (step === 2) {
    if (!data.understandsAttendancePolicy) errors.understandsAttendancePolicy = 'You must acknowledge this policy';
    if (!data.agreesToFee) errors.agreesToFee = 'You must agree to the fee policy';
  }

  if (step === 3) {
    if (!data.agreesToAbstinence) errors.agreesToAbstinence = 'You must agree to maintain abstinence';
    if (!data.consentsToTesting) errors.consentsToTesting = 'You must consent to drug testing';
    if (!data.understandsConsequences) errors.understandsConsequences = 'You must acknowledge consequences';
  }

  if (step === 4) {
    if (!data.disclosesControlledSubstances) errors.disclosesControlledSubstances = 'You must agree to disclose medications';
    if (!data.disclosesMedicalIssues) errors.disclosesMedicalIssues = 'You must agree to disclose medical issues';
  }

  if (step === 5) {
    if (!data.clientSignature.trim()) errors.clientSignature = 'Client signature is required';
    if (!data.staffSignature.trim()) errors.staffSignature = 'Staff signature is required';
    if (!data.date) errors.date = 'Date is required';
  }

  return errors;
};

export const CONSENT_FORM_DEFINITION: FormDefinition<ConsentForTreatmentData> = {
  id: 'consent-treatment',
  title: 'Consent for Treatment',
  description: 'Comprehensive consent document covering attendance policies, abstinence requirements, drug testing protocols, and program rules.',
  category: 'Intake',
  tags: ['Required', 'SATOP'],
  estimatedTime: '10-15 min',
  difficulty: 'Moderate',
  isRecommended: true,
  initialState,
  steps: [ConsentStep1, ConsentStep2, ConsentStep3, ConsentStep4, ConsentStep5],
  validateStep,
  fieldDefinitions: [
    { key: 'groupDays', label: 'Group Days', type: 'object' },
    { key: 'groupTimeFrom', label: 'Group Start Time' },
    { key: 'groupTimeTo', label: 'Group End Time' },
    { key: 'understandsAttendancePolicy', label: 'Understands Attendance Policy', type: 'boolean' },
    { key: 'agreesToFee', label: 'Agrees to Fees', type: 'boolean' },
    { key: 'understandsCancellationPolicy', label: 'Understands Cancellation Policy', type: 'boolean' },
    { key: 'understandsExcusedAbsences', label: 'Understands Excused Absences', type: 'boolean' },
    { key: 'agreesToAbstinence', label: 'Agrees to Abstinence', type: 'boolean' },
    { key: 'consentsToTesting', label: 'Consents to Testing', type: 'boolean' },
    { key: 'understandsConsequences', label: 'Understands Consequences', type: 'boolean' },
    { key: 'acknowledgesMarijuanaPolicy', label: 'Acknowledges Marijuana Policy', type: 'boolean' },
    { key: 'disclosedMedications', label: 'Disclosed Medications' },
    { key: 'disclosesControlledSubstances', label: 'Discloses Controlled Substances', type: 'boolean' },
    { key: 'disclosesMedicalIssues', label: 'Discloses Medical Issues', type: 'boolean' },
    { key: 'agreesToSupportGroups', label: 'Agrees to Support Groups', type: 'boolean' },
    { key: 'clientSignature', label: 'Client Signature' },
    { key: 'staffSignature', label: 'Staff Signature' },
    { key: 'date', label: 'Date', type: 'date' },
  ]
};
