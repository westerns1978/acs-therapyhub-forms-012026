
import React from 'react';
import { FormDefinition, DischargeSummaryData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { CheckboxGroup } from '../CheckboxGroup';

const initialState: DischargeSummaryData = {
  clientName: '', clientEmail: '', admissionDate: '', dischargeDate: '',
  referralSource: '', diagnosis: '', reasonForAdmission: '', servicesProvided: '',
  problem1_plan: '', problem1_outcome: '', problem2_plan: '', problem2_outcome: '',
  problem3_plan: '', problem3_outcome: '',
  reasonForDischarge: { completed: false, clientRequest: false, nonCompliance: false, other: false },
  otherReason: '', prognosis: '', medicalStatus: '', recommendedFollowUp: '',
  counselorSignature: '', counselorCredentials: '', signatureDate: new Date().toISOString().split('T')[0]
};

const DischargeSection: React.FC<FormSectionProps<DischargeSummaryData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <FormField id="clientName" label="Client Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
        <FormField id="admissionDate" label="Admission Date" type="date" value={formData.admissionDate} onChange={handleChange} error={errors.admissionDate} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <FormField id="dischargeDate" label="Discharge Date" type="date" value={formData.dischargeDate} onChange={handleChange} error={errors.dischargeDate} />
        <FormField id="referralSource" label="Referral Source" value={formData.referralSource} onChange={handleChange} error={errors.referralSource} />
      </div>
      
      <FormField id="diagnosis" label="Clinical Diagnosis (ICD-10)" value={formData.diagnosis} onChange={handleChange} error={errors.diagnosis} />
      
      <div className="pt-4">
        <label className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 block">Termination Classification</label>
        <CheckboxGroup 
          id="reasonForDischarge" label=""
          options={[
            {id: 'completed', label: 'Protocol Completion'}, {id: 'clientRequest', label: 'Client Request'},
            {id: 'nonCompliance', label: 'Administrative Discharge'}, {id: 'other', label: 'Other Transition'}
          ]}
          values={formData.reasonForDischarge}
          onChange={(id) => setFormData({...formData, reasonForDischarge: { ...formData.reasonForDischarge, [id]: !formData.reasonForDischarge[id as keyof typeof formData.reasonForDischarge] }})}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 pt-4 border-t border-black/5 dark:border-white/5">
        <FormField id="problem1_plan" label="Core Problem #1 Plan" value={formData.problem1_plan} onChange={handleChange} />
        <FormField id="problem1_outcome" label="Outcome #1" value={formData.problem1_outcome} onChange={handleChange} />
      </div>

      <FormField id="counselorSignature" label="QMHP/Counselor Digital Verification" value={formData.counselorSignature} onChange={handleChange} error={errors.counselorSignature} />
    </div>
  );
};

export const DISCHARGE_SUMMARY_DEFINITION: FormDefinition<DischargeSummaryData> = {
  id: 'discharge-summary',
  title: 'Clinical Discharge Summary',
  description: 'Internal documentation of clinical transition or program completion. Required for case closure.',
  category: 'Clinical',
  tags: ['Internal'],
  difficulty: 'Moderate',
  estimatedTime: '15 min',
  initialState,
  validateStep: (data) => {

    const errs: FormErrors<DischargeSummaryData> = {};
    if (!data.clientName) errs.clientName = 'Mandatory.';
    if (!data.counselorSignature) errs.counselorSignature = 'Verification required.';
    return errs;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Client Name', type: 'text', required: true },
    { id: 'clientEmail', label: 'Client Email', type: 'email', required: false },
    { id: 'admissionDate', label: 'Admission Date', type: 'date', required: true },
    { id: 'dischargeDate', label: 'Discharge Date', type: 'date', required: true },
    { id: 'referralSource', label: 'Referral Source', type: 'text', required: true },
    { id: 'diagnosis', label: 'Clinical Diagnosis (ICD-10)', type: 'text', required: true },
    { id: 'reasonForAdmission', label: 'Reason For Admission', type: 'textarea', required: false },
    { id: 'servicesProvided', label: 'Services Provided', type: 'textarea', required: false },
    { id: 'problem1_plan', label: 'Core Problem #1 Plan', type: 'textarea', required: false },
    { id: 'problem1_outcome', label: 'Outcome #1', type: 'textarea', required: false },
    { id: 'problem2_plan', label: 'Core Problem #2 Plan', type: 'textarea', required: false },
    { id: 'problem2_outcome', label: 'Outcome #2', type: 'textarea', required: false },
    { id: 'problem3_plan', label: 'Core Problem #3 Plan', type: 'textarea', required: false },
    { id: 'problem3_outcome', label: 'Outcome #3', type: 'textarea', required: false },
    { id: 'reasonForDischarge', label: 'Termination Classification', type: 'object', required: true },
    { id: 'otherReason', label: 'Other Reason', type: 'textarea', required: false },
    { id: 'prognosis', label: 'Prognosis', type: 'textarea', required: false },
    { id: 'medicalStatus', label: 'Medical Status', type: 'textarea', required: false },
    { id: 'recommendedFollowUp', label: 'Recommended Follow Up', type: 'textarea', required: false },
    { id: 'counselorSignature', label: 'QMHP/Counselor Digital Verification', type: 'text', required: true },
    { id: 'counselorCredentials', label: 'Counselor Credentials', type: 'text', required: false },
    { id: 'signatureDate', label: 'Signature Date', type: 'date', required: false }
  ]
};
