import React from 'react';
import { FormDefinition, AuthorizationForReleaseData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { Checkbox } from '../Checkbox';

interface ContactInfo {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

const emptyContact: ContactInfo = {
  name: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  phone: '',
};

const initialState: AuthorizationForReleaseData = {
  clientName: '',
  clientEmail: '',
  authorizeDMH: false,
  authorizeRevenue: false,
  courtInfo: { ...emptyContact },
  attorneyInfo: { ...emptyContact },
  probationOfficerInfo: { ...emptyContact },
  otherInfo: { ...emptyContact },
  acknowledgesFederalRegulations: false,
  understandsRevocation: false,
  understandsExpiration: false,
  clientSignature: '',
  ssn: '',
  witnessSignature: '',
  date: '',
};

// Step 1: Client Info & Agencies
const AuthStep1: React.FC<FormSectionProps<AuthorizationForReleaseData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Client Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="clientName" label="Client Full Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
          <FormField id="clientEmail" label="Email Address" type="email" value={formData.clientEmail} onChange={handleChange} error={errors.clientEmail} />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">State Agency Authorizations</h3>

        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 mb-6">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Note:</strong> Select the state agencies you authorize ACS Therapy to share your treatment information with.
          </p>
        </div>

        <Checkbox
          id="authorizeDMH"
          label="I authorize release of information to the Missouri Department of Mental Health (DMH)"
          checked={formData.authorizeDMH}
          onChange={(e) => setFormData({ ...formData, authorizeDMH: e.target.checked })}
          error={errors.authorizeDMH}
        />

        <Checkbox
          id="authorizeRevenue"
          label="I authorize release of information to the Missouri Department of Revenue (DOR)"
          checked={formData.authorizeRevenue}
          onChange={(e) => setFormData({ ...formData, authorizeRevenue: e.target.checked })}
          error={errors.authorizeRevenue}
        />
      </div>
    </div>
  );
};

// Contact Info Component
const ContactInfoFields: React.FC<{
  prefix: string;
  title: string;
  data: ContactInfo;
  onChange: (field: keyof ContactInfo, value: string) => void;
  errors: any;
  required?: boolean;
}> = ({ prefix, title, data, onChange, errors, required = false }) => {
  const formatPhoneNumber = (value: string): string => {
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 mb-6">
      <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4">{title}</h4>
      <FormField
        id={`${prefix}_name`}
        label="Name"
        value={data.name}
        onChange={(e) => onChange('name', e.target.value)}
        error={errors?.[`${prefix}_name`]}
        required={required}
      />
      <FormField
        id={`${prefix}_address`}
        label="Address"
        value={data.address}
        onChange={(e) => onChange('address', e.target.value)}
        error={errors?.[`${prefix}_address`]}
        required={required}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4">
        <div className="col-span-2">
          <FormField
            id={`${prefix}_city`}
            label="City"
            value={data.city}
            onChange={(e) => onChange('city', e.target.value)}
            error={errors?.[`${prefix}_city`]}
            required={required}
          />
        </div>
        <FormField
          id={`${prefix}_state`}
          label="State"
          value={data.state}
          onChange={(e) => onChange('state', e.target.value)}
          error={errors?.[`${prefix}_state`]}
          required={required}
        />
        <FormField
          id={`${prefix}_zip`}
          label="ZIP"
          value={data.zip}
          onChange={(e) => onChange('zip', e.target.value)}
          error={errors?.[`${prefix}_zip`]}
          required={required}
        />
      </div>
      <FormField
        id={`${prefix}_phone`}
        label="Phone"
        type="tel"
        value={data.phone}
        onChange={(e) => onChange('phone', formatPhoneNumber(e.target.value))}
        error={errors?.[`${prefix}_phone`]}
        required={required}
        placeholder="(314) 000-0000"
      />
    </div>
  );
};

// Step 2: Court & Attorney
const AuthStep2: React.FC<FormSectionProps<AuthorizationForReleaseData>> = ({ formData, setFormData, errors }) => {
  const handleCourtChange = (field: keyof ContactInfo, value: string) => {
    setFormData({
      ...formData,
      courtInfo: { ...formData.courtInfo, [field]: value }
    });
  };

  const handleAttorneyChange = (field: keyof ContactInfo, value: string) => {
    setFormData({
      ...formData,
      attorneyInfo: { ...formData.attorneyInfo, [field]: value }
    });
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Court & Legal Representatives</h3>

      <ContactInfoFields
        prefix="court"
        title="Court Information"
        data={formData.courtInfo}
        onChange={handleCourtChange}
        errors={errors}
        required={false}
      />

      <ContactInfoFields
        prefix="attorney"
        title="Attorney Information (Optional)"
        data={formData.attorneyInfo}
        onChange={handleAttorneyChange}
        errors={errors}
        required={false}
      />
    </div>
  );
};

// Step 3: Probation & Other
const AuthStep3: React.FC<FormSectionProps<AuthorizationForReleaseData>> = ({ formData, setFormData, errors }) => {
  const handleProbationChange = (field: keyof ContactInfo, value: string) => {
    setFormData({
      ...formData,
      probationOfficerInfo: { ...formData.probationOfficerInfo, [field]: value }
    });
  };

  const handleOtherChange = (field: keyof ContactInfo, value: string) => {
    setFormData({
      ...formData,
      otherInfo: { ...formData.otherInfo, [field]: value }
    });
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Probation & Other Contacts</h3>

      <ContactInfoFields
        prefix="probation"
        title="Probation/Parole Officer"
        data={formData.probationOfficerInfo}
        onChange={handleProbationChange}
        errors={errors}
        required={false}
      />

      <ContactInfoFields
        prefix="other"
        title="Other (Employer, Treatment Provider, etc.)"
        data={formData.otherInfo}
        onChange={handleOtherChange}
        errors={errors}
        required={false}
      />
    </div>
  );
};

// Step 4: Acknowledgments & Signatures
const AuthStep4: React.FC<FormSectionProps<AuthorizationForReleaseData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Federal Regulations Acknowledgment</h3>

        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30 mb-6">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            <strong>Important:</strong> This authorization is governed by 42 CFR Part 2, which protects the confidentiality of alcohol and drug abuse patient records.
          </p>
        </div>

        <Checkbox
          id="acknowledgesFederalRegulations"
          label="I acknowledge that this consent is made in compliance with Federal Regulations 42 CFR Part 2 governing confidentiality of alcohol and drug abuse patient records."
          checked={formData.acknowledgesFederalRegulations}
          onChange={(e) => setFormData({ ...formData, acknowledgesFederalRegulations: e.target.checked })}
          error={errors.acknowledgesFederalRegulations}
        />

        <Checkbox
          id="understandsRevocation"
          label="I understand that I may revoke this authorization at any time by providing written notice to ACS Therapy, except to the extent that action has already been taken based on this authorization."
          checked={formData.understandsRevocation}
          onChange={(e) => setFormData({ ...formData, understandsRevocation: e.target.checked })}
          error={errors.understandsRevocation}
        />

        <Checkbox
          id="understandsExpiration"
          label="I understand this authorization expires one year from the date signed unless otherwise specified or upon completion of treatment."
          checked={formData.understandsExpiration}
          onChange={(e) => setFormData({ ...formData, understandsExpiration: e.target.checked })}
          error={errors.understandsExpiration}
        />
      </div>

      <div>
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Signatures</h3>
        <FormField id="clientSignature" label="Client Signature (Type full legal name)" value={formData.clientSignature} onChange={handleChange} error={errors.clientSignature} />
        <FormField id="ssn" label="Last 4 digits of SSN (for verification)" value={formData.ssn} onChange={handleChange} error={errors.ssn} maxLength={4} placeholder="XXXX" />
        <FormField id="witnessSignature" label="Witness Signature" value={formData.witnessSignature} onChange={handleChange} error={errors.witnessSignature} />
        <FormField id="date" label="Date" type="date" value={formData.date} onChange={handleChange} error={errors.date} />
      </div>
    </div>
  );
};

const validateStep = (step: number, data: AuthorizationForReleaseData): FormErrors<AuthorizationForReleaseData> => {
  const errors: FormErrors<AuthorizationForReleaseData> = {};

  if (step === 1) {
    if (!data.clientName.trim()) errors.clientName = 'Client name is required';
    if (!data.clientEmail.trim()) errors.clientEmail = 'Email is required';
    if (data.clientEmail && !/\S+@\S+\.\S+/.test(data.clientEmail)) errors.clientEmail = 'Invalid email format';
  }

  // Steps 2 and 3 have optional fields

  if (step === 4) {
    if (!data.acknowledgesFederalRegulations) errors.acknowledgesFederalRegulations = 'You must acknowledge the federal regulations';
    if (!data.understandsRevocation) errors.understandsRevocation = 'You must acknowledge the revocation policy';
    if (!data.understandsExpiration) errors.understandsExpiration = 'You must acknowledge the expiration policy';
    if (!data.clientSignature.trim()) errors.clientSignature = 'Client signature is required';
    if (!data.ssn.trim()) errors.ssn = 'Last 4 digits of SSN required';
    if (data.ssn && !/^\d{4}$/.test(data.ssn)) errors.ssn = 'Must be exactly 4 digits';
    if (!data.witnessSignature.trim()) errors.witnessSignature = 'Witness signature is required';
    if (!data.date) errors.date = 'Date is required';
  }

  return errors;
};

export const AUTHORIZATION_RELEASE_DEFINITION: FormDefinition<AuthorizationForReleaseData> = {
  id: 'authorization-release',
  title: 'Authorization for Release of Information',
  description: 'Authorize ACS Therapy to release your treatment information to specified parties including courts, attorneys, probation officers, and state agencies.',
  category: 'Legal',
  tags: ['Required', 'SATOP'],
  estimatedTime: '8-12 min',
  difficulty: 'Moderate',
  initialState,
  steps: [AuthStep1, AuthStep2, AuthStep3, AuthStep4],
  validateStep,
  fieldDefinitions: [
    { key: 'authorizeDMH', label: 'Authorize DMH', type: 'boolean' },
    { key: 'authorizeRevenue', label: 'Authorize DOR', type: 'boolean' },
    { key: 'courtInfo', label: 'Court Information', type: 'object' },
    { key: 'attorneyInfo', label: 'Attorney Information', type: 'object' },
    { key: 'probationOfficerInfo', label: 'Probation Officer', type: 'object' },
    { key: 'otherInfo', label: 'Other Contact', type: 'object' },
    { key: 'acknowledgesFederalRegulations', label: 'Acknowledges 42 CFR Part 2', type: 'boolean' },
    { key: 'understandsRevocation', label: 'Understands Revocation', type: 'boolean' },
    { key: 'understandsExpiration', label: 'Understands Expiration', type: 'boolean' },
    { key: 'clientSignature', label: 'Client Signature' },
    { key: 'ssn', label: 'SSN (Last 4)' },
    { key: 'witnessSignature', label: 'Witness Signature' },
    { key: 'date', label: 'Date', type: 'date' },
  ]
};
