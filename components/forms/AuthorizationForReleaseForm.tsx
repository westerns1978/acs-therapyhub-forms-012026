
import React from 'react';
import { FormDefinition, AuthorizationForReleaseData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { Checkbox } from '../Checkbox';

const initialContact = { name: '', address: '', city: '', state: '', zip: '', phone: '' };

const initialState: AuthorizationForReleaseData = {
  clientName: '', clientEmail: '', authorizeDMH: false, authorizeRevenue: false,
  courtInfo: { ...initialContact }, attorneyInfo: { ...initialContact },
  probationOfficerInfo: { ...initialContact }, otherInfo: { ...initialContact },
  acknowledgesFederalRegulations: false, understandsRevocation: false, understandsExpiration: false,
  clientSignature: '', ssn: '', witnessSignature: '', date: new Date().toISOString().split('T')[0]
};

const Step1: React.FC<FormSectionProps<AuthorizationForReleaseData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Phase 1: Basic Protocol</h3>
      <FormField id="clientName" label="Client Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
      <FormField id="clientEmail" label="Secure Email" type="email" value={formData.clientEmail} onChange={handleChange} error={errors.clientEmail} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
        <Checkbox label="Authorize DMH Release" checked={formData.authorizeDMH} onChange={(v) => setFormData({...formData, authorizeDMH: v})} />
        <Checkbox label="Authorize Department of Revenue" checked={formData.authorizeRevenue} onChange={(v) => setFormData({...formData, authorizeRevenue: v})} />
      </div>
    </div>
  );
};

const ContactFields = ({ label, data, onChange }: { label: string, data: any, onChange: (field: string, val: string) => void }) => (
  <div className="space-y-4 p-6 bg-slate-50 dark:bg-slate-950/30 rounded-3xl border border-black/5 dark:border-white/5">
    <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-4">{label} Infrastructure</h4>
    <FormField id="name" label="Name/Agency" value={data.name} onChange={(e) => onChange('name', e.target.value)} required={false} />
    <FormField id="address" label="Address" value={data.address} onChange={(e) => onChange('address', e.target.value)} required={false} />
    <div className="grid grid-cols-2 gap-4">
      <FormField id="city" label="City" value={data.city} onChange={(e) => onChange('city', e.target.value)} required={false} />
      <FormField id="phone" label="Phone" value={data.phone} onChange={(e) => onChange('phone', e.target.value)} required={false} />
    </div>
  </div>
);

const Step2: React.FC<FormSectionProps<AuthorizationForReleaseData>> = ({ formData, setFormData }) => {
  return (
    <div className="space-y-10 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Phase 2: Legal Transmitters</h3>
      <ContactFields label="Court" data={formData.courtInfo} onChange={(f, v) => setFormData({...formData, courtInfo: { ...formData.courtInfo, [f]: v }})} />
      <ContactFields label="Attorney" data={formData.attorneyInfo} onChange={(f, v) => setFormData({...formData, attorneyInfo: { ...formData.attorneyInfo, [f]: v }})} />
    </div>
  );
};

const Step3: React.FC<FormSectionProps<AuthorizationForReleaseData>> = ({ formData, setFormData }) => {
  return (
    <div className="space-y-10 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Phase 3: Supervision Transmitters</h3>
      <ContactFields label="Probation Officer" data={formData.probationOfficerInfo} onChange={(f, v) => setFormData({...formData, probationOfficerInfo: { ...formData.probationOfficerInfo, [f]: v }})} />
      <ContactFields label="Other Facility" data={formData.otherInfo} onChange={(f, v) => setFormData({...formData, otherInfo: { ...formData.otherInfo, [f]: v }})} />
    </div>
  );
};

const Step4: React.FC<FormSectionProps<AuthorizationForReleaseData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Phase 4: Regulatory Authorization</h3>
      <div className="p-6 bg-blue-500/5 dark:bg-blue-500/10 rounded-3xl border border-blue-500/20 space-y-4">
        <Checkbox label="I authorize according to 42 CFR Part 2 federal regulations." checked={formData.acknowledgesFederalRegulations} onChange={(v) => setFormData({...formData, acknowledgesFederalRegulations: v})} error={errors.acknowledgesFederalRegulations} />
        <Checkbox label="I understand I can revoke this authorization at any time." checked={formData.understandsRevocation} onChange={(v) => setFormData({...formData, understandsRevocation: v})} error={errors.understandsRevocation} />
        <Checkbox label="This authorization expires in one year from the date below." checked={formData.understandsExpiration} onChange={(v) => setFormData({...formData, understandsExpiration: v})} error={errors.understandsExpiration} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 pt-4">
        <FormField id="clientSignature" label="Client Digital Signature" value={formData.clientSignature} onChange={handleChange} error={errors.clientSignature} />
        <FormField id="ssn" label="SSN Verification (Last 4)" maxLength={4} value={formData.ssn} onChange={handleChange} error={errors.ssn} />
      </div>
    </div>
  );
};

export const AUTHORIZATION_RELEASE_DEFINITION: FormDefinition<AuthorizationForReleaseData> = {
  id: 'authorization-release',
  title: 'Authorization for Release of Information',
  description: 'Legal authorization for clinical node data sharing with courts and legal entities. 42 CFR Part 2 compliant.',
  category: 'Legal',
  tags: ['Required', 'SATOP'],
  difficulty: 'Moderate',
  estimatedTime: '8 min',
  initialState,
  validateStep: (data) => {

    const errs: FormErrors<AuthorizationForReleaseData> = {};
    if (!data.clientName) errs.clientName = 'Mandatory.';
    if (!data.acknowledgesFederalRegulations) errs.acknowledgesFederalRegulations = 'Acknowledgment required.';
    if (!data.clientSignature) errs.clientSignature = 'Signature required.';
    if (!data.ssn || data.ssn.length < 4) errs.ssn = 'SSN digits required.';

    return errs;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Client Name', type: 'text', required: true },
    { id: 'clientEmail', label: 'Secure Email', type: 'email', required: true },
    { id: 'authorizeDMH', label: 'Authorize DMH Release', type: 'boolean', required: false },
    { id: 'authorizeRevenue', label: 'Authorize Department of Revenue', type: 'boolean', required: false },
    { id: 'courtInfo.name', label: 'Court Name/Agency', type: 'text', required: false },
    { id: 'courtInfo.address', label: 'Court Address', type: 'text', required: false },
    { id: 'courtInfo.city', label: 'Court City', type: 'text', required: false },
    { id: 'courtInfo.phone', label: 'Court Phone', type: 'tel', required: false },
    { id: 'attorneyInfo.name', label: 'Attorney Name/Agency', type: 'text', required: false },
    { id: 'attorneyInfo.address', label: 'Attorney Address', type: 'text', required: false },
    { id: 'attorneyInfo.city', label: 'Attorney City', type: 'text', required: false },
    { id: 'attorneyInfo.phone', label: 'Attorney Phone', type: 'tel', required: false },
    { id: 'probationOfficerInfo.name', label: 'Probation Officer Name/Agency', type: 'text', required: false },
    { id: 'probationOfficerInfo.address', label: 'Probation Officer Address', type: 'text', required: false },
    { id: 'probationOfficerInfo.city', label: 'Probation Officer City', type: 'text', required: false },
    { id: 'probationOfficerInfo.phone', label: 'Probation Officer Phone', type: 'tel', required: false },
    { id: 'otherInfo.name', label: 'Other Facility Name/Agency', type: 'text', required: false },
    { id: 'otherInfo.address', label: 'Other Facility Address', type: 'text', required: false },
    { id: 'otherInfo.city', label: 'Other Facility City', type: 'text', required: false },
    { id: 'otherInfo.phone', label: 'Other Facility Phone', type: 'tel', required: false },
    { id: 'acknowledgesFederalRegulations', label: 'I authorize according to 42 CFR Part 2 federal regulations.', type: 'boolean', required: true },
    { id: 'understandsRevocation', label: 'I understand I can revoke this authorization at any time.', type: 'boolean', required: true },
    { id: 'understandsExpiration', label: 'This authorization expires in one year from the date below.', type: 'boolean', required: true },
    { id: 'clientSignature', label: 'Client Digital Signature', type: 'text', required: true },
    { id: 'ssn', label: 'SSN Verification (Last 4)', type: 'text', required: true, min: 4, max: 4 } 
  ]
};
