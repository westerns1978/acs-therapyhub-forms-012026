
import React from 'react';
import { FormDefinition, DischargeSummaryData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { CheckboxGroup } from '../CheckboxGroup';

const initialState: DischargeSummaryData = {
  clientName: '', admissionDate: '', dischargeDate: '',
  referralSource: '', diagnosis: '', reasonForAdmission: '',
  servicesProvided: { groupCounseling: false, individualCounseling: false, groupEducation: false },
  problem1_plan: '', problem1_outcome: '', problem2_plan: '', problem2_outcome: '',
  problem3_plan: '', problem3_outcome: '',
  reasonForDischarge: '',
  otherReason: '', prognosis: '', medicalStatus: '', recommendedFollowUp: '',
  counselorSignature: '', counselorCredentials: '', signatureDate: new Date().toISOString().split('T')[0]
};

// DEAD — never imported/rendered (BaseFormTemplate + fieldDefinitions is the live
// path; see DEFERRED #40). Kept compiling only, not wired: reasonForDischarge is
// now a single-select string, not the old boolean map, so its CheckboxGroup usage
// below just toggles a placeholder key rather than reflecting real select state.
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
        <label className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 block">Services provided</label>
        <CheckboxGroup
          id="servicesProvided" label=""
          options={[
            {id: 'groupCounseling', label: 'Group Counseling'}, {id: 'individualCounseling', label: 'Individual Counseling'},
            {id: 'groupEducation', label: 'Group Education'}
          ]}
          values={formData.servicesProvided}
          onChange={(id) => setFormData({...formData, servicesProvided: { ...formData.servicesProvided, [id]: !formData.servicesProvided[id] }})}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 pt-4 border-t border-black/5 dark:border-white/5">
        <FormField id="problem1_plan" label="Problem #1: plan" value={formData.problem1_plan} onChange={handleChange} />
        <FormField id="problem1_outcome" label="Problem #1: outcome" value={formData.problem1_outcome} onChange={handleChange} />
      </div>

      <FormField id="counselorSignature" label="QMHP/Counselor signature" value={formData.counselorSignature} onChange={handleChange} error={errors.counselorSignature} />
    </div>
  );
};

export const DISCHARGE_SUMMARY_DEFINITION: FormDefinition<DischargeSummaryData> = {
  id: 'discharge-summary',
  title: 'Clinical Discharge Summary',
  description: 'Documents program completion or clinical transition. Required for case closure.',
  category: 'Clinical',
  tags: ['Internal'],
  difficulty: 'Moderate',
  estimatedTime: '15 min',
  initialState,
  validateStep: (data) => {

    const errs: FormErrors<DischargeSummaryData> = {};
    if (!data.clientName) errs.clientName = 'Required.';
    if (!data.counselorSignature) errs.counselorSignature = 'Signature is required.';
    return errs;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Client name', type: 'text', required: true },
    { id: 'admissionDate', label: 'Admission date', type: 'date', required: true },
    { id: 'dischargeDate', label: 'Discharge date', type: 'date', required: true },
    { id: 'referralSource', label: 'Referral source', type: 'text', required: true },
    { id: 'diagnosis', label: 'Diagnosis (ICD-10)', type: 'text', required: true },
    { id: 'reasonForAdmission', label: 'Reason for admission', type: 'textarea', required: true },
    {
      id: 'servicesProvided', label: 'Services provided', type: 'checkbox-group', required: true,
      // David-gated (7/16 markup) — these three are what he wrote; he may add
      // SATOP-specific services later. Adding an option is a one-line change.
      options: [
        { value: 'groupCounseling', label: 'Group Counseling' },
        { value: 'individualCounseling', label: 'Individual Counseling' },
        { value: 'groupEducation', label: 'Group Education' },
      ],
    },
    { id: 'problem1_plan', label: 'Problem #1: plan', type: 'textarea', required: true },
    { id: 'problem1_outcome', label: 'Problem #1: outcome', type: 'textarea', required: true },
    { id: 'problem2_plan', label: 'Problem #2: plan', type: 'textarea', required: true },
    { id: 'problem2_outcome', label: 'Problem #2: outcome', type: 'textarea', required: true },
    // Problem #3 stays optional — David circled it (page-break, unmarked on the
    // 7/16 scan); not flipping without his confirmation.
    { id: 'problem3_plan', label: 'Problem #3: plan', type: 'textarea', required: false },
    { id: 'problem3_outcome', label: 'Problem #3: outcome', type: 'textarea', required: false },
    {
      id: 'reasonForDischarge', label: 'Reason for discharge', type: 'select', required: true,
      // Boolean-map -> single-select (David's markup). Zero rows existed when
      // this changed — no stored-data migration needed.
      options: [
        { value: 'Non-compliance', label: 'Non-compliance' },
        { value: 'Voluntary withdrawal', label: 'Voluntary withdrawal' },
        { value: 'Successful', label: 'Successful' },
        { value: 'Unsuccessful', label: 'Unsuccessful' },
        { value: 'Other', label: 'Other' },
      ],
    },
    {
      id: 'otherReason', label: 'Other reason', type: 'textarea', required: true,
      // First real use of conditional visibility (Commit 3, config/fieldVisibility.ts).
      // Visible + enforced ONLY when reasonForDischarge === 'Other'; hidden
      // otherwise, and a value typed here then orphaned by switching away is
      // stripped at submit (never lands in the committed record).
      visibleWhen: { field: 'reasonForDischarge', equals: 'Other' },
    },
    { id: 'prognosis', label: 'Prognosis', type: 'textarea', required: true },
    { id: 'medicalStatus', label: 'Medical status', type: 'textarea', required: true },
    { id: 'recommendedFollowUp', label: 'Recommended follow-up', type: 'textarea', required: true },
    { id: 'counselorSignature', label: 'QMHP/Counselor signature', type: 'text', required: true },
    // No credentials field exists on the staff profile (User = {id, name, email,
    // role} — see contexts/AuthContext.tsx / types.ts). Left manual; reported.
    { id: 'counselorCredentials', label: 'Counselor credentials', type: 'text', required: true },
    { id: 'signatureDate', label: 'Signature date', type: 'date', required: true }
  ]
};
