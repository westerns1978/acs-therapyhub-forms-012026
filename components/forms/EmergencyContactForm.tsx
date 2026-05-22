
import React from 'react';
import { FormDefinition, EmergencyContactData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { RadioGroupString } from '../RadioGroupString';
import { RadioGroup } from '../RadioGroup';

const initialState: EmergencyContactData = {
  clientName: '', clientEmail: '', contactName: '', relationship: '',
  primaryPhone: '', secondaryPhone: '', permissionToContact: false,
  disclosureChoice: null, clientSignature: '', witnessSignature: '',
  date: new Date().toISOString().split('T')[0]
};

const EmergencyContactSection: React.FC<FormSectionProps<EmergencyContactData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <FormField id="clientName" label="Client name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
        <FormField id="clientEmail" label="Email" type="email" value={formData.clientEmail} onChange={handleChange} error={errors.clientEmail} />
      </div>
      <div className="pt-8 border-t border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Emergency contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="contactName" label="Contact full name" value={formData.contactName} onChange={handleChange} error={errors.contactName} />
          <FormField id="relationship" label="Relationship to client" value={formData.relationship} onChange={handleChange} error={errors.relationship} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="primaryPhone" label="Primary phone" type="tel" value={formData.primaryPhone} onChange={handleChange} error={errors.primaryPhone} />
          <FormField id="secondaryPhone" label="Secondary phone" type="tel" value={formData.secondaryPhone} onChange={handleChange} error={errors.secondaryPhone} />
        </div>
      </div>

      <RadioGroup id="permissionToContact" label="Permission to contact in a crisis" value={formData.permissionToContact} onChange={(val) => setFormData({...formData, permissionToContact: val})} error={errors.permissionToContact} />

      <RadioGroupString
        id="disclosureChoice"
        label="Disclosure"
        options={[
          { value: 'accept', label: 'Allow disclosure' },
          { value: 'deny', label: 'Do not allow disclosure' }
        ]}
        value={formData.disclosureChoice}
        onChange={(val) => setFormData({...formData, disclosureChoice: val as any})}
        error={errors.disclosureChoice}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <FormField id="clientSignature" label="Client signature" value={formData.clientSignature} onChange={handleChange} error={errors.clientSignature} />
        <FormField id="date" label="Date" type="date" value={formData.date} onChange={handleChange} error={errors.date} />
      </div>
    </div>
  );
};

export const EMERGENCY_CONTACT_DEFINITION: FormDefinition<EmergencyContactData> = {
  id: 'emergency-contact',
  title: 'Emergency Contact',
  description: 'Designate emergency contacts and set disclosure permissions.',
  category: 'Intake',
  tags: ['Required'],
  difficulty: 'Simple',
  estimatedTime: '4 min',
  initialState,
  validateStep: (data) => {

    const errs: FormErrors<EmergencyContactData> = {};
    if (!data.clientName) errs.clientName = 'Required.';
    if (!data.contactName) errs.contactName = 'Required.';
    if (!data.disclosureChoice) errs.disclosureChoice = 'Please select an option.';
    if (!data.clientSignature) errs.clientSignature = 'Signature is required.';
    return errs;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Client name', type: 'text', required: true },
    { id: 'clientEmail', label: 'Email', type: 'email', required: false },
    { id: 'contactName', label: 'Contact full name', type: 'text', required: true },
    { id: 'relationship', label: 'Relationship to client', type: 'text', required: true },
    { id: 'primaryPhone', label: 'Primary phone', type: 'tel', required: true },
    { id: 'secondaryPhone', label: 'Secondary phone', type: 'tel', required: false },
    { id: 'permissionToContact', label: 'Permission to contact in a crisis', type: 'boolean', required: true },
    { id: 'disclosureChoice', label: 'Disclosure', type: 'text', required: true, options: [{ value: 'accept', label: 'Allow disclosure' }, { value: 'deny', label: 'Do not allow disclosure' }] },
    { id: 'clientSignature', label: 'Client signature', type: 'text', required: true },
    { id: 'witnessSignature', label: 'Witness signature', type: 'text', required: false },
    { id: 'date', label: 'Date', type: 'date', required: true }
  ]
};
