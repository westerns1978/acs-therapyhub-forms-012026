
import React from 'react';
import { FormDefinition, ConsentForTreatmentData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { CheckboxGroup } from '../CheckboxGroup';
import { Checkbox } from '../Checkbox';

const initialState: ConsentForTreatmentData = {
  clientName: '', clientEmail: '', groupDays: { 'Mon': false, 'Tue': false, 'Wed': false, 'Thu': false, 'Fri': false }, groupTimeFrom: '', groupTimeTo: '',
  understandsAttendancePolicy: false, agreesToFee: false, understandsCancellationPolicy: false,
  understandsExcusedAbsences: false, agreesToAbstinence: false, consentsToTesting: false,
  understandsConsequences: false, acknowledgesMarijuanaPolicy: false, disclosedMedications: '',
  disclosesControlledSubstances: false, disclosesMedicalIssues: false, agreesToSupportGroups: false,
  clientSignature: '', staffSignature: '', date: new Date().toISOString().split('T')[0]
};

const Step1: React.FC<FormSectionProps<ConsentForTreatmentData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Phase 1: Basic Parameters</h3>
      <FormField id="clientName" label="Client Legal Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
      <FormField id="clientEmail" label="Secure Communication Channel" type="email" value={formData.clientEmail} onChange={handleChange} error={errors.clientEmail} />
      
      <div className="pt-4">
        <label className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 block">Designated Group Schedule</label>
        <CheckboxGroup 
          id="groupDays"
          label=""
          options={[
            { id: 'Mon', label: 'Mon' }, { id: 'Tue', label: 'Tue' },
            { id: 'Wed', label: 'Wed' }, { id: 'Thu', label: 'Thu' }, { id: 'Fri', label: 'Fri' }
          ]}
          values={formData.groupDays}
          onChange={(id) => setFormData({...formData, groupDays: { ...formData.groupDays, [id]: !formData.groupDays[id] }})}
        />
      </div>
    </div>
  );
};

const Step2: React.FC<FormSectionProps<ConsentForTreatmentData>> = ({ formData, setFormData, errors }) => {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Phase 2: Operational Policies</h3>
      <Checkbox id="understandsAttendancePolicy" label="I acknowledge that regular attendance is mandatory for certification." checked={formData.understandsAttendancePolicy} onChange={(val) => setFormData({...formData, understandsAttendancePolicy: val})} error={errors.understandsAttendancePolicy} />
      <Checkbox id="agreesToFee" label="I agree to the $40 missed session fee for any non-excused absence." checked={formData.agreesToFee} onChange={(val) => setFormData({...formData, agreesToFee: val})} error={errors.agreesToFee} />
      <Checkbox id="understandsCancellationPolicy" label="I acknowledge that 24-hour notice is required for cancellation." checked={formData.understandsCancellationPolicy} onChange={(val) => setFormData({...formData, understandsCancellationPolicy: val})} error={errors.understandsCancellationPolicy} />
    </div>
  );
};

const Step3: React.FC<FormSectionProps<ConsentForTreatmentData>> = ({ formData, setFormData, errors }) => {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Phase 3: Clinical Compliance</h3>
      <Checkbox id="agreesToAbstinence" label="I agree to maintain full abstinence from all non-prescribed substances." checked={formData.agreesToAbstinence} onChange={(val) => setFormData({...formData, agreesToAbstinence: val})} error={errors.agreesToAbstinence} />
      <Checkbox id="consentsToTesting" label="I consent to random toxicology screening as part of this protocol." checked={formData.consentsToTesting} onChange={(val) => setFormData({...formData, consentsToTesting: val})} error={errors.consentsToTesting} />
      <Checkbox id="acknowledgesMarijuanaPolicy" label="I acknowledge that medical marijuana use requires valid clinical documentation." checked={formData.acknowledgesMarijuanaPolicy} onChange={(val) => setFormData({...formData, acknowledgesMarijuanaPolicy: val})} error={errors.acknowledgesMarijuanaPolicy} />
    </div>
  );
};

const Step4: React.FC<FormSectionProps<ConsentForTreatmentData>> = ({ formData, setFormData, errors }) => {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Phase 4: Disclosure Inventory</h3>
      <FormField id="disclosedMedications" label="Active Medications Inventory" type="textarea" value={formData.disclosedMedications} onChange={(e) => setFormData({...formData, disclosedMedications: e.target.value})} error={errors.disclosedMedications} />
      <Checkbox id="disclosesControlledSubstances" label="I disclosed any use of controlled substances within the last 30 days." checked={formData.disclosesControlledSubstances} onChange={(val) => setFormData({...formData, disclosesControlledSubstances: val})} error={errors.disclosesControlledSubstances} />
      <Checkbox id="agreesToSupportGroups" label="I agree to attend verified 12-step or support group modules." checked={formData.agreesToSupportGroups} onChange={(val) => setFormData({...formData, agreesToSupportGroups: val})} error={errors.agreesToSupportGroups} />
    </div>
  );
};

const Step5: React.FC<FormSectionProps<ConsentForTreatmentData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Phase 5: Legal Handshake</h3>
      <FormField id="clientSignature" label="Client Digital Signature" value={formData.clientSignature} onChange={handleChange} error={errors.clientSignature} />
      <FormField id="staffSignature" label="Staff Witness/QMHP Verification" value={formData.staffSignature} onChange={handleChange} error={errors.staffSignature} />
      <FormField id="date" label="Commitment Timestamp" type="date" value={formData.date} onChange={handleChange} error={errors.date} />
    </div>
  );
};

export const CONSENT_FORM_DEFINITION: FormDefinition<ConsentForTreatmentData> = {
  id: 'consent-treatment',
  title: 'Consent for Treatment',
  description: 'Legal authorization and clinical policy acknowledgment for ACS programs. Required for SATOP Level IV.',
  category: 'Legal',
  tags: ['Required', 'SATOP'],
  difficulty: 'Moderate',
  estimatedTime: '10 min',
  initialState,
  validateStep: (data) => {

    const errs: FormErrors<ConsentForTreatmentData> = {};
    if (!data.clientName) errs.clientName = 'Mandatory.';
    if (!data.understandsAttendancePolicy) errs.understandsAttendancePolicy = 'Policy acknowledgment required.';
    if (!data.agreesToFee) errs.agreesToFee = 'Fee acknowledgment required.';
    if (!data.understandsCancellationPolicy) errs.understandsCancellationPolicy = 'Policy acknowledgment required.';
    if (!data.agreesToAbstinence) errs.agreesToAbstinence = 'Policy acknowledgment required.';
    if (!data.consentsToTesting) errs.consentsToTesting = 'Policy acknowledgment required.';
    if (!data.acknowledgesMarijuanaPolicy) errs.acknowledgesMarijuanaPolicy = 'Policy acknowledgment required.';
    if (!data.clientSignature) errs.clientSignature = 'Signature required.';
    if (!data.date) errs.date = 'Date is required.';

    return errs;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Client Legal Name', type: 'text', required: true },
    { id: 'clientEmail', label: 'Secure Communication Channel', type: 'email', required: true },
    { id: 'groupDays', label: 'Designated Group Schedule', type: 'object', required: false },
    { id: 'groupTimeFrom', label: 'Group Time From', type: 'text', required: false },
    { id: 'groupTimeTo', label: 'Group Time To', type: 'text', required: false },
    { id: 'understandsAttendancePolicy', label: 'I acknowledge that regular attendance is mandatory for certification.', type: 'boolean', required: true },
    { id: 'agreesToFee', label: 'I agree to the $40 missed session fee for any non-excused absence.', type: 'boolean', required: true },
    { id: 'understandsCancellationPolicy', label: 'I acknowledge that 24-hour notice is required for cancellation.', type: 'boolean', required: true },
    { id: 'understandsExcusedAbsences', label: 'I understand that excused absences require documentation.', type: 'boolean', required: false },
    { id: 'agreesToAbstinence', label: 'I agree to maintain full abstinence from all non-prescribed substances.', type: 'boolean', required: true },
    { id: 'consentsToTesting', label: 'I consent to random toxicology screening as part of this protocol.', type: 'boolean', required: true },
    { id: 'understandsConsequences', label: 'I understand the consequences of non-compliance.', type: 'boolean', required: false },
    { id: 'acknowledgesMarijuanaPolicy', label: 'I acknowledge that medical marijuana use requires valid clinical documentation.', type: 'boolean', required: true },
    { id: 'disclosedMedications', label: 'Active Medications Inventory', type: 'textarea', required: false },
    { id: 'disclosesControlledSubstances', label: 'I disclosed any use of controlled substances within the last 30 days.', type: 'boolean', required: false },
    { id: 'disclosesMedicalIssues', label: 'I disclosed any medical issues relevant to my treatment.', type: 'boolean', required: false },
    { id: 'agreesToSupportGroups', label: 'I agree to attend verified 12-step or support group modules.', type: 'boolean', required: false },
    { id: 'clientSignature', label: 'Client Digital Signature', type: 'text', required: true },
    { id: 'staffSignature', label: 'Staff Witness/QMHP Verification', type: 'text', required: false },
    { id: 'date', label: 'Commitment Timestamp', type: 'date', required: true }
  ]
};
