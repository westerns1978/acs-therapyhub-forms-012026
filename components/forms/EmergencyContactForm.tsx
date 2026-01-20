import React from 'react';
import { FormDefinition, EmergencyContactData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { RadioGroup } from '../RadioGroup';
import { RadioGroupString } from '../RadioGroupString';

const initialState: EmergencyContactData = {
  clientName: '',
  clientEmail: '',
  contactName: '',
  relationship: '',
  primaryPhone: '',
  secondaryPhone: '',
  permissionToContact: false,
  disclosureChoice: null,
  clientSignature: '',
  witnessSignature: '',
  date: '',
};

const EmergencyContactSection: React.FC<FormSectionProps<EmergencyContactData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const formatPhoneNumber = (value: string): string => {
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: formatPhoneNumber(e.target.value) });
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

      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Emergency Contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="contactName" label="Emergency Contact Name" value={formData.contactName} onChange={handleChange} error={errors.contactName} />
          <FormField id="relationship" label="Relationship to Client" value={formData.relationship} onChange={handleChange} error={errors.relationship} placeholder="e.g., Spouse, Parent, Sibling" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="primaryPhone" label="Primary Phone" type="tel" value={formData.primaryPhone} onChange={handlePhoneChange} error={errors.primaryPhone} placeholder="(314) 000-0000" />
          <FormField id="secondaryPhone" label="Secondary Phone (Optional)" type="tel" value={formData.secondaryPhone} onChange={handlePhoneChange} error={errors.secondaryPhone} required={false} placeholder="(314) 000-0000" />
        </div>
      </div>

      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Authorization</h3>

        <RadioGroup
          id="permissionToContact"
          label="Do you give ACS Therapy permission to contact this person in case of emergency?"
          value={formData.permissionToContact}
          onChange={(val) => setFormData({ ...formData, permissionToContact: val })}
          error={errors.permissionToContact}
        />

        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            <strong>Information Disclosure:</strong> In case of emergency, would you like us to disclose your treatment information to your emergency contact?
          </p>
          <RadioGroupString
            id="disclosureChoice"
            label="Disclosure Authorization"
            value={formData.disclosureChoice}
            onChange={(val) => setFormData({ ...formData, disclosureChoice: val as 'accept' | 'deny' })}
            error={errors.disclosureChoice}
            options={[
              { value: 'accept', label: 'Yes, I Authorize' },
              { value: 'deny', label: 'No, Do Not Disclose' },
            ]}
          />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Signatures</h3>
        <FormField id="clientSignature" label="Client Signature (Type full legal name)" value={formData.clientSignature} onChange={handleChange} error={errors.clientSignature} />
        <FormField id="witnessSignature" label="Witness/Staff Signature" value={formData.witnessSignature} onChange={handleChange} error={errors.witnessSignature} />
        <FormField id="date" label="Date" type="date" value={formData.date} onChange={handleChange} error={errors.date} />
      </div>
    </div>
  );
};

const validateStep = (step: number, data: EmergencyContactData): FormErrors<EmergencyContactData> => {
  const errors: FormErrors<EmergencyContactData> = {};
  const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;

  if (step === 1) {
    if (!data.clientName.trim()) errors.clientName = 'Client name is required';
    if (!data.clientEmail.trim()) errors.clientEmail = 'Email is required';
    if (data.clientEmail && !/\S+@\S+\.\S+/.test(data.clientEmail)) errors.clientEmail = 'Invalid email format';
    if (!data.contactName.trim()) errors.contactName = 'Emergency contact name is required';
    if (!data.relationship.trim()) errors.relationship = 'Relationship is required';
    if (!data.primaryPhone.trim()) {
      errors.primaryPhone = 'Primary phone is required';
    } else if (!phoneRegex.test(data.primaryPhone)) {
      errors.primaryPhone = 'Phone must be in format (XXX) XXX-XXXX';
    }
    if (data.secondaryPhone && !phoneRegex.test(data.secondaryPhone)) {
      errors.secondaryPhone = 'Phone must be in format (XXX) XXX-XXXX';
    }
    if (data.permissionToContact === false && data.permissionToContact !== true) {
      // permissionToContact is a boolean, but we need to check if it's been answered
    }
    if (data.disclosureChoice === null) errors.disclosureChoice = 'Please select a disclosure option';
    if (!data.clientSignature.trim()) errors.clientSignature = 'Client signature is required';
    if (!data.witnessSignature.trim()) errors.witnessSignature = 'Witness signature is required';
    if (!data.date) errors.date = 'Date is required';
  }

  return errors;
};

export const EMERGENCY_CONTACT_DEFINITION: FormDefinition<EmergencyContactData> = {
  id: 'emergency-contact',
  title: 'Emergency Contact Information',
  description: 'Provide emergency contact details and authorize ACS Therapy to contact them and/or disclose treatment information in case of emergency.',
  category: 'Intake',
  tags: ['Required'],
  estimatedTime: '3-5 min',
  difficulty: 'Simple',
  initialState,
  steps: [EmergencyContactSection],
  validateStep,
  fieldDefinitions: [
    { key: 'contactName', label: 'Emergency Contact Name' },
    { key: 'relationship', label: 'Relationship' },
    { key: 'primaryPhone', label: 'Primary Phone' },
    { key: 'secondaryPhone', label: 'Secondary Phone' },
    { key: 'permissionToContact', label: 'Permission to Contact', type: 'boolean' },
    { key: 'disclosureChoice', label: 'Disclosure Authorization' },
    { key: 'clientSignature', label: 'Client Signature' },
    { key: 'witnessSignature', label: 'Witness Signature' },
    { key: 'date', label: 'Date', type: 'date' },
  ]
};
