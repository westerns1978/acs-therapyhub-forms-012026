import React from 'react';
import { FormDefinition, DischargeSummaryData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { CheckboxGroup } from '../CheckboxGroup';

const initialState: DischargeSummaryData = {
  clientName: '',
  clientEmail: '',
  admissionDate: '',
  dischargeDate: '',
  referralSource: '',
  diagnosis: '',
  reasonForAdmission: '',
  servicesProvided: '',
  problem1_plan: '',
  problem1_outcome: '',
  problem2_plan: '',
  problem2_outcome: '',
  problem3_plan: '',
  problem3_outcome: '',
  reasonForDischarge: {
    completed: false,
    clientRequest: false,
    nonCompliance: false,
    other: false,
  },
  otherReason: '',
  prognosis: '',
  medicalStatus: '',
  recommendedFollowUp: '',
  counselorSignature: '',
  counselorCredentials: '',
  signatureDate: '',
};

const dischargeReasonOptions = [
  { id: 'completed', label: 'Successfully Completed' },
  { id: 'clientRequest', label: 'Client Request' },
  { id: 'nonCompliance', label: 'Non-Compliance' },
  { id: 'other', label: 'Other' },
];

const DischargeSummarySection: React.FC<FormSectionProps<DischargeSummaryData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleReasonToggle = (reasonId: string) => {
    setFormData({
      ...formData,
      reasonForDischarge: {
        ...formData.reasonForDischarge,
        [reasonId]: !formData.reasonForDischarge[reasonId as keyof typeof formData.reasonForDischarge]
      }
    });
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Client & Admission Info */}
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Client Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="clientName" label="Client Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
          <FormField id="clientEmail" label="Email Address" type="email" value={formData.clientEmail} onChange={handleChange} error={errors.clientEmail} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="admissionDate" label="Admission Date" type="date" value={formData.admissionDate} onChange={handleChange} error={errors.admissionDate} />
          <FormField id="dischargeDate" label="Discharge Date" type="date" value={formData.dischargeDate} onChange={handleChange} error={errors.dischargeDate} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="referralSource" label="Referral Source" value={formData.referralSource} onChange={handleChange} error={errors.referralSource} />
          <FormField id="diagnosis" label="Diagnosis" value={formData.diagnosis} onChange={handleChange} error={errors.diagnosis} />
        </div>
      </div>

      {/* Treatment Summary */}
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Treatment Summary</h3>
        <FormField id="reasonForAdmission" label="Reason for Admission" type="textarea" value={formData.reasonForAdmission} onChange={handleChange} error={errors.reasonForAdmission} maxLength={600} />
        <FormField id="servicesProvided" label="Services Provided" type="textarea" value={formData.servicesProvided} onChange={handleChange} error={errors.servicesProvided} maxLength={600} placeholder="List treatment services, group sessions, individual counseling, etc." />
      </div>

      {/* Treatment Problems & Outcomes */}
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Treatment Problems & Outcomes</h3>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl mb-6">
          <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4">Problem #1</h4>
          <FormField id="problem1_plan" label="Treatment Plan" type="textarea" value={formData.problem1_plan} onChange={handleChange} error={errors.problem1_plan} maxLength={400} />
          <FormField id="problem1_outcome" label="Outcome" type="textarea" value={formData.problem1_outcome} onChange={handleChange} error={errors.problem1_outcome} maxLength={400} />
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl mb-6">
          <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4">Problem #2 (Optional)</h4>
          <FormField id="problem2_plan" label="Treatment Plan" type="textarea" value={formData.problem2_plan} onChange={handleChange} error={errors.problem2_plan} maxLength={400} required={false} />
          <FormField id="problem2_outcome" label="Outcome" type="textarea" value={formData.problem2_outcome} onChange={handleChange} error={errors.problem2_outcome} maxLength={400} required={false} />
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
          <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4">Problem #3 (Optional)</h4>
          <FormField id="problem3_plan" label="Treatment Plan" type="textarea" value={formData.problem3_plan} onChange={handleChange} error={errors.problem3_plan} maxLength={400} required={false} />
          <FormField id="problem3_outcome" label="Outcome" type="textarea" value={formData.problem3_outcome} onChange={handleChange} error={errors.problem3_outcome} maxLength={400} required={false} />
        </div>
      </div>

      {/* Discharge Information */}
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Discharge Information</h3>

        <CheckboxGroup
          id="reasonForDischarge"
          label="Reason for Discharge"
          options={dischargeReasonOptions}
          values={formData.reasonForDischarge}
          onChange={handleReasonToggle}
          error={errors.reasonForDischarge}
        />

        {formData.reasonForDischarge.other && (
          <FormField id="otherReason" label="Please specify other reason" value={formData.otherReason} onChange={handleChange} error={errors.otherReason} />
        )}

        <FormField id="prognosis" label="Prognosis" type="textarea" value={formData.prognosis} onChange={handleChange} error={errors.prognosis} maxLength={500} />
        <FormField id="medicalStatus" label="Medical Status at Discharge" type="textarea" value={formData.medicalStatus} onChange={handleChange} error={errors.medicalStatus} maxLength={400} required={false} />
        <FormField id="recommendedFollowUp" label="Recommended Follow-Up Care" type="textarea" value={formData.recommendedFollowUp} onChange={handleChange} error={errors.recommendedFollowUp} maxLength={500} />
      </div>

      {/* Counselor Signature */}
      <div>
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Counselor Authorization</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="counselorSignature" label="Counselor Signature" value={formData.counselorSignature} onChange={handleChange} error={errors.counselorSignature} />
          <FormField id="counselorCredentials" label="Credentials" value={formData.counselorCredentials} onChange={handleChange} error={errors.counselorCredentials} placeholder="e.g., LCSW, LPC, CADC" />
        </div>
        <FormField id="signatureDate" label="Date" type="date" value={formData.signatureDate} onChange={handleChange} error={errors.signatureDate} />
      </div>
    </div>
  );
};

const validateStep = (step: number, data: DischargeSummaryData): FormErrors<DischargeSummaryData> => {
  const errors: FormErrors<DischargeSummaryData> = {};

  if (step === 1) {
    if (!data.clientName.trim()) errors.clientName = 'Client name is required';
    if (!data.clientEmail.trim()) errors.clientEmail = 'Email is required';
    if (!data.admissionDate) errors.admissionDate = 'Admission date is required';
    if (!data.dischargeDate) errors.dischargeDate = 'Discharge date is required';
    if (!data.referralSource.trim()) errors.referralSource = 'Referral source is required';
    if (!data.diagnosis.trim()) errors.diagnosis = 'Diagnosis is required';
    if (!data.reasonForAdmission.trim()) errors.reasonForAdmission = 'Reason for admission is required';
    if (!data.servicesProvided.trim()) errors.servicesProvided = 'Services provided is required';
    if (!data.problem1_plan.trim()) errors.problem1_plan = 'At least one treatment problem is required';
    if (!data.problem1_outcome.trim()) errors.problem1_outcome = 'Outcome for problem #1 is required';

    const hasDischargeReason = Object.values(data.reasonForDischarge).some(v => v);
    if (!hasDischargeReason) errors.reasonForDischarge = 'Please select at least one discharge reason';

    if (data.reasonForDischarge.other && !data.otherReason.trim()) {
      errors.otherReason = 'Please specify the other reason';
    }

    if (!data.prognosis.trim()) errors.prognosis = 'Prognosis is required';
    if (!data.recommendedFollowUp.trim()) errors.recommendedFollowUp = 'Recommended follow-up is required';
    if (!data.counselorSignature.trim()) errors.counselorSignature = 'Counselor signature is required';
    if (!data.counselorCredentials.trim()) errors.counselorCredentials = 'Credentials are required';
    if (!data.signatureDate) errors.signatureDate = 'Date is required';
  }

  return errors;
};

export const DISCHARGE_SUMMARY_DEFINITION: FormDefinition<DischargeSummaryData> = {
  id: 'discharge-summary',
  title: 'Discharge Summary',
  description: 'Comprehensive discharge documentation including treatment summary, outcomes, prognosis, and recommended follow-up care.',
  category: 'Clinical',
  tags: ['Internal'],
  estimatedTime: '10-15 min',
  difficulty: 'Moderate',
  initialState,
  steps: [DischargeSummarySection],
  validateStep,
  fieldDefinitions: [
    { key: 'admissionDate', label: 'Admission Date', type: 'date' },
    { key: 'dischargeDate', label: 'Discharge Date', type: 'date' },
    { key: 'referralSource', label: 'Referral Source' },
    { key: 'diagnosis', label: 'Diagnosis' },
    { key: 'reasonForAdmission', label: 'Reason for Admission' },
    { key: 'servicesProvided', label: 'Services Provided' },
    { key: 'problem1_plan', label: 'Problem 1 - Plan' },
    { key: 'problem1_outcome', label: 'Problem 1 - Outcome' },
    { key: 'problem2_plan', label: 'Problem 2 - Plan' },
    { key: 'problem2_outcome', label: 'Problem 2 - Outcome' },
    { key: 'problem3_plan', label: 'Problem 3 - Plan' },
    { key: 'problem3_outcome', label: 'Problem 3 - Outcome' },
    { key: 'reasonForDischarge', label: 'Reason for Discharge', type: 'object' },
    { key: 'otherReason', label: 'Other Reason' },
    { key: 'prognosis', label: 'Prognosis' },
    { key: 'medicalStatus', label: 'Medical Status' },
    { key: 'recommendedFollowUp', label: 'Recommended Follow-Up' },
    { key: 'counselorSignature', label: 'Counselor Signature' },
    { key: 'counselorCredentials', label: 'Credentials' },
    { key: 'signatureDate', label: 'Signature Date', type: 'date' },
  ]
};
