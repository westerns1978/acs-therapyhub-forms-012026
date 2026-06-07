
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
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Client information</h3>
      <FormField id="clientName" label="Client name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
      <FormField id="clientEmail" label="Email" type="email" value={formData.clientEmail} onChange={handleChange} error={errors.clientEmail} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
        <Checkbox label="Authorize completion notice to Missouri DMH" checked={formData.authorizeDMH} onChange={(v) => setFormData({...formData, authorizeDMH: v})} error={errors.authorizeDMH} />
        <Checkbox label="Authorize completion notice to Missouri DOR (reinstates driving privileges)" checked={formData.authorizeRevenue} onChange={(v) => setFormData({...formData, authorizeRevenue: v})} error={errors.authorizeRevenue} />
      </div>
    </div>
  );
};

const ContactFields = ({ label, data, onChange }: { label: string, data: any, onChange: (field: string, val: string) => void }) => (
  <div className="space-y-4 p-6 bg-slate-50 dark:bg-slate-950/30 rounded-3xl border border-black/5 dark:border-white/5">
    <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-4">{label} contact</h4>
    <FormField id="name" label="Name/agency" value={data.name} onChange={(e) => onChange('name', e.target.value)} required={false} />
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
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Court and attorney</h3>
      <ContactFields label="Court" data={formData.courtInfo} onChange={(f, v) => setFormData({...formData, courtInfo: { ...formData.courtInfo, [f]: v }})} />
      <ContactFields label="Attorney" data={formData.attorneyInfo} onChange={(f, v) => setFormData({...formData, attorneyInfo: { ...formData.attorneyInfo, [f]: v }})} />
    </div>
  );
};

const Step3: React.FC<FormSectionProps<AuthorizationForReleaseData>> = ({ formData, setFormData }) => {
  return (
    <div className="space-y-10 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Probation officer and other</h3>
      <ContactFields label="Probation officer" data={formData.probationOfficerInfo} onChange={(f, v) => setFormData({...formData, probationOfficerInfo: { ...formData.probationOfficerInfo, [f]: v }})} />
      <ContactFields label="Other facility" data={formData.otherInfo} onChange={(f, v) => setFormData({...formData, otherInfo: { ...formData.otherInfo, [f]: v }})} />
    </div>
  );
};

const Step4: React.FC<FormSectionProps<AuthorizationForReleaseData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Authorization</h3>
      <div className="p-6 bg-blue-500/5 dark:bg-blue-500/10 rounded-3xl border border-blue-500/20 space-y-4">
        <Checkbox label="I authorize according to 42 CFR Part 2 federal regulations." checked={formData.acknowledgesFederalRegulations} onChange={(v) => setFormData({...formData, acknowledgesFederalRegulations: v})} error={errors.acknowledgesFederalRegulations} />
        <Checkbox label="I understand I can revoke this authorization at any time." checked={formData.understandsRevocation} onChange={(v) => setFormData({...formData, understandsRevocation: v})} error={errors.understandsRevocation} />
        <Checkbox label="This authorization expires in one year from the date below." checked={formData.understandsExpiration} onChange={(v) => setFormData({...formData, understandsExpiration: v})} error={errors.understandsExpiration} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 pt-4">
        <FormField id="clientSignature" label="Client signature" value={formData.clientSignature} onChange={handleChange} error={errors.clientSignature} />
        <FormField id="ssn" label="SSN (last 4 digits)" maxLength={4} value={formData.ssn} onChange={handleChange} error={errors.ssn} />
      </div>
    </div>
  );
};

export const AUTHORIZATION_RELEASE_DEFINITION: FormDefinition<AuthorizationForReleaseData> = {
  id: 'authorization-release',
  title: 'Authorization for Release of Information',
  description: 'Authorizes ACS to send the program completion notice to the Missouri DMH + Department of Revenue (the basis for reinstating driving privileges) and to disclose screening/participation/completion to the court, attorney, or probation officer. 42 CFR Part 2; expires 12 months from screening.',
  category: 'Legal',
  tags: ['Required', 'SATOP'],
  difficulty: 'Moderate',
  estimatedTime: '8 min',
  initialState,
  validateStep: (data) => {

    const errs: FormErrors<AuthorizationForReleaseData> = {};
    if (!data.clientName) errs.clientName = 'Required.';
    if (!data.authorizeDMH) errs.authorizeDMH = 'Required — authorizes the DMH completion notice.';
    if (!data.authorizeRevenue) errs.authorizeRevenue = 'Required — authorizes the DOR completion notice (driving privileges).';
    if (!data.acknowledgesFederalRegulations) errs.acknowledgesFederalRegulations = 'Please acknowledge.';
    if (!data.clientSignature) errs.clientSignature = 'Signature is required.';
    if (!data.ssn || data.ssn.length < 4) errs.ssn = 'Last 4 digits of SSN required.';

    return errs;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Client name', type: 'text', required: true },
    { id: 'clientEmail', label: 'Email', type: 'email', required: true },
    { id: 'authorizeDMH', label: 'I authorize ACS to send my program completion notice to the Missouri Department of Mental Health (DMH).', type: 'boolean', required: true },
    { id: 'authorizeRevenue', label: 'I authorize ACS to send my program completion notice to the Missouri Department of Revenue (DOR) — the basis for reinstating my driving privileges.', type: 'boolean', required: true },
    { id: 'courtInfo.name', label: 'Court name/agency', type: 'text', required: false },
    { id: 'courtInfo.address', label: 'Court address', type: 'text', required: false },
    { id: 'courtInfo.city', label: 'Court city', type: 'text', required: false },
    { id: 'courtInfo.phone', label: 'Court phone', type: 'tel', required: false },
    { id: 'attorneyInfo.name', label: 'Attorney name/agency', type: 'text', required: false },
    { id: 'attorneyInfo.address', label: 'Attorney address', type: 'text', required: false },
    { id: 'attorneyInfo.city', label: 'Attorney city', type: 'text', required: false },
    { id: 'attorneyInfo.phone', label: 'Attorney phone', type: 'tel', required: false },
    { id: 'probationOfficerInfo.name', label: 'Probation officer name/agency', type: 'text', required: false },
    { id: 'probationOfficerInfo.address', label: 'Probation officer address', type: 'text', required: false },
    { id: 'probationOfficerInfo.city', label: 'Probation officer city', type: 'text', required: false },
    { id: 'probationOfficerInfo.phone', label: 'Probation officer phone', type: 'tel', required: false },
    { id: 'otherInfo.name', label: 'Other facility name/agency', type: 'text', required: false },
    { id: 'otherInfo.address', label: 'Other facility address', type: 'text', required: false },
    { id: 'otherInfo.city', label: 'Other facility city', type: 'text', required: false },
    { id: 'otherInfo.phone', label: 'Other facility phone', type: 'tel', required: false },
    { id: 'acknowledgesFederalRegulations', label: 'I authorize according to 42 CFR Part 2 federal regulations.', type: 'boolean', required: true },
    { id: 'understandsRevocation', label: 'I understand I can revoke this authorization at any time.', type: 'boolean', required: true },
    { id: 'understandsExpiration', label: 'This authorization expires in one year from the date below.', type: 'boolean', required: true },
    { id: 'clientSignature', label: 'Client signature', type: 'text', required: true },
    { id: 'ssn', label: 'SSN (last 4 digits)', type: 'text', required: true, min: 4, max: 4 }
  ]
};
