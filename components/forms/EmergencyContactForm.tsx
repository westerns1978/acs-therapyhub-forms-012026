
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
        <FormField id="clientName" label="Client Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
        <FormField id="clientEmail" label="Secure Email" type="email" value={formData.clientEmail} onChange={handleChange} error={errors.clientEmail} />
      </div>
      <div className="pt-8 border-t border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Designated Contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="contactName" label="Contact Full Name" value={formData.contactName} onChange={handleChange} error={errors.contactName} />
          <FormField id="relationship" label="Relationship to Client" value={formData.relationship} onChange={handleChange} error={errors.relationship} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="primaryPhone" label="Primary Phone" type="tel" value={formData.primaryPhone} onChange={handleChange} error={errors.primaryPhone} />
          <FormField id="secondaryPhone" label="Secondary Phone" type="tel" value={formData.secondaryPhone} onChange={handleChange} error={errors.secondaryPhone} />
        </div>
      </div>

      <RadioGroup id="permissionToContact" label="Permission to Contact in Crisis" value={formData.permissionToContact} onChange={(val) => setFormData({...formData, permissionToContact: val})} error={errors.permissionToContact} />
      
      <RadioGroupString 
        id="disclosureChoice"
        label="Disclosure Protocol"
        options={[
          { value: 'accept', label: 'Authorized for Disclosure' },
          { value: 'deny', label: 'No Disclosure Authorized' }
        ]}
        value={formData.disclosureChoice}
        onChange={(val) => setFormData({...formData, disclosureChoice: val as any})}
        error={errors.disclosureChoice}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <FormField id="clientSignature" label="Client Digital Verification" value={formData.clientSignature} onChange={handleChange} error={errors.clientSignature} />
        <FormField id="date" label="Timestamp" type="date" value={formData.date} onChange={handleChange} error={errors.date} />
      </div>
    </div>
  );
};

export const EMERGENCY_CONTACT_DEFINITION: FormDefinition<EmergencyContactData> = {
  id: 'emergency-contact',
  title: 'Emergency Response Authorization',
  description: 'Designation of emergency contacts and disclosure permissions for clinical safety.',
  category: 'Intake',
  tags: ['Required'],
  difficulty: 'Simple',
  estimatedTime: '4 min',
  initialState,
  validateStep: (data) => {

    const errs: FormErrors<EmergencyContactData> = {};
    if (!data.clientName) errs.clientName = 'Mandatory.';
    if (!data.contactName) errs.contactName = 'Mandatory.';
    if (!data.disclosureChoice) errs.disclosureChoice = 'Selection required.';
    if (!data.clientSignature) errs.clientSignature = 'Signature required.';
    return errs;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Client Name', type: 'text', required: true },
    { id: 'clientEmail', label: 'Secure Email', type: 'email', required: false },
    { id: 'contactName', label: 'Contact Full Name', type: 'text', required: true },
    { id: 'relationship', label: 'Relationship to Client', type: 'text', required: true },
    { id: 'primaryPhone', label: 'Primary Phone', type: 'tel', required: true },
    { id: 'secondaryPhone', label: 'Secondary Phone', type: 'tel', required: false },
    { id: 'permissionToContact', label: 'Permission to Contact in Crisis', type: 'boolean', required: true },
    { id: 'disclosureChoice', label: 'Disclosure Protocol', type: 'text', required: true, options: [{ value: 'accept', label: 'Authorized for Disclosure' }, { value: 'deny', label: 'No Disclosure Authorized' }] },
    { id: 'clientSignature', label: 'Client Digital Verification', type: 'text', required: true },
    { id: 'witnessSignature', label: 'Witness Signature', type: 'text', required: false },
    { id: 'date', label: 'Timestamp', type: 'date', required: true }
  ]
};
