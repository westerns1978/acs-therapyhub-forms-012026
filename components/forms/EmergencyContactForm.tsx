
import React from 'react';
import { FormDefinition, EmergencyContactData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { RadioGroup } from '../RadioGroup';

const initialState: EmergencyContactData = {
  clientName: '', contactName: '', relationship: '',
  primaryPhone: '', secondaryPhone: '', permissionToContact: false,
  disclosureChoice: false, clientSignature: '', witnessSignature: '',
  date: new Date().toISOString().split('T')[0]
};

// DEAD — never imported/rendered (BaseFormTemplate + fieldDefinitions is the live
// path; see DEFERRED #40). Kept compiling only. disclosureChoice retargeted from
// the retired accept/deny RadioGroupString to RadioGroup (boolean), matching its
// new type.
const EmergencyContactSection: React.FC<FormSectionProps<EmergencyContactData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-8 animate-fade-in-up">
      <FormField id="clientName" label="Client name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
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

      <RadioGroup id="permissionToContact" label="Permission to contact in a crisis; when unable to reach me or when concerned about my welfare." value={formData.permissionToContact} onChange={(val) => setFormData({...formData, permissionToContact: val})} error={errors.permissionToContact} />

      <RadioGroup
        id="disclosureChoice"
        label="ACS may share with my emergency contact that I am in counseling with ACS. This DOES NOT permit ACS to share information about my participation, progress or any PHI."
        value={formData.disclosureChoice}
        onChange={(val) => setFormData({...formData, disclosureChoice: !!val})}
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
    // Unchanged line, new meaning: disclosureChoice is now a boolean acknowledgment.
    // !false === true, so this already enforces MUST-BE-TRUE (same class as
    // satop-checklist's 8 acknowledgments) — the generic required rule alone
    // (answered-not-true) would let an unchecked box pass, which would make the
    // acknowledgment worthless. No new logic needed; the existing truthiness
    // check does the right thing on the new type. See types.ts for the read.
    if (!data.disclosureChoice) errs.disclosureChoice = 'You must acknowledge this to continue.';
    if (!data.clientSignature) errs.clientSignature = 'Signature is required.';
    return errs;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Client name', type: 'text', required: true },
    { id: 'contactName', label: 'Contact full name', type: 'text', required: true },
    { id: 'relationship', label: 'Relationship to client', type: 'text', required: true },
    { id: 'primaryPhone', label: 'Primary phone', type: 'tel', required: true },
    { id: 'secondaryPhone', label: 'Secondary phone', type: 'tel', required: false },
    { id: 'permissionToContact', label: 'Permission to contact in a crisis; when unable to reach me or when concerned about my welfare.', type: 'boolean', required: true },
    {
      id: 'disclosureChoice',
      label: 'ACS may share with my emergency contact that I am in counseling with ACS. This DOES NOT permit ACS to share information about my participation, progress or any PHI.',
      type: 'boolean', required: true,
      // David X'd the accept/deny construct for a single acknowledgment checkbox.
      // options kept (inert for 'boolean' — BaseFormTemplate/check:forms both
      // ignore them on this type) so a future accept/deny swap is a one-line
      // `type: 'boolean' -> 'select'` change, not a rewrite.
      options: [{ value: 'accept', label: 'Allow disclosure' }, { value: 'deny', label: 'Do not allow disclosure' }],
    },
    { id: 'clientSignature', label: 'Client signature', type: 'text', required: true },
    { id: 'witnessSignature', label: 'Witness signature', type: 'text', required: false },
    { id: 'date', label: 'Date', type: 'date', required: true }
  ]
};
