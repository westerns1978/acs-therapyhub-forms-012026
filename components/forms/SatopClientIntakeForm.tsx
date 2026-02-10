import React from 'react';
import { FormDefinition, SatopClientIntakeData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { RadioGroup } from '../RadioGroup';
import { RadioGroupString } from '../RadioGroupString';

const initialState: SatopClientIntakeData = {
  clientName: '', dob: '', clientPhone: '', clientEmail: '',
  caseNumber: '', offenseDate: '', convictionDate: '',
  programType: null, referralSource: '', previousSatop: null, paymentMethod: '',
};

const SatopIntakeSection: React.FC<FormSectionProps<SatopClientIntakeData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <FormField id="clientName" label="Client Full Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
        <FormField id="dob" label="Date of Birth" type="date" value={formData.dob} onChange={handleChange} error={errors.dob} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <FormField id="clientPhone" label="Uplink Mobile" type="tel" value={formData.clientPhone} onChange={handlePhoneChange} error={errors.clientPhone} placeholder="(314) 000-0000" />
        <FormField id="clientEmail" label="Secure Email" type="email" value={formData.clientEmail} onChange={handleChange} error={errors.clientEmail} placeholder="patient@secure.pds" />
      </div>

      <div className="pt-8 border-t border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Legal Record Synchronization</h3>
        <FormField id="caseNumber" label="Court Case Number" value={formData.caseNumber} onChange={handleChange} error={errors.caseNumber} placeholder="24-CR-XXXXX" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <FormField id="offenseDate" label="Offense Date" type="date" value={formData.offenseDate} onChange={handleChange} error={errors.offenseDate} />
            <FormField id="convictionDate" label="Conviction Date" type="date" value={formData.convictionDate} onChange={handleChange} error={errors.convictionDate} />
        </div>
      </div>

      <RadioGroupString
        id="programType"
        label="Program Classification"
        value={formData.programType}
        onChange={(val) => setFormData({ ...formData, programType: val as any })}
        error={errors.programType}
        options={[
          { value: '12-week', label: '12-Week Track' },
          { value: '16-week', label: '16-Week Track' },
        ]}
      />

      <RadioGroup
        id="previousSatop"
        label="Previous SATOP Protocol Commitments"
        value={formData.previousSatop}
        onChange={(val) => setFormData({ ...formData, previousSatop: val })}
        error={errors.previousSatop}
      />

      <FormField id="paymentMethod" label="Fiscal Ledger Category" value={formData.paymentMethod} onChange={handleChange} error={errors.paymentMethod} placeholder="State Funded / Private Insurance" />
    </div>
  );
};

export const SATOP_INTAKE_DEFINITION: FormDefinition<SatopClientIntakeData> = {
  id: 'satop-intake',
  title: 'SATOP Client Intake Protocol',
  description: 'Primary intake document for all SATOP Recidivism Reduction Programs. Mandatory for Level IV certification.',
  category: 'Intake',
  tags: ['Required', 'SATOP'],
  estimatedTime: '6 min',
  difficulty: 'Simple',
  isNew: true,
  isRecommended: true,
  initialState,
  steps: [SatopIntakeSection],
  validateStep: (step, data) => {
    const errs: FormErrors<SatopClientIntakeData> = {};
    if (!data.clientName) errs.clientName = 'Mandatory field missing.';
    if (!data.clientEmail) errs.clientEmail = 'Mandatory field missing.';
    if (!data.caseNumber) errs.caseNumber = 'Mandatory field missing.';
    if (!data.programType) errs.programType = 'Required selection.';
    return errs;
  },
  fieldDefinitions: [
    { key: 'dob', label: "Date of Birth", type: 'date' },
    { key: 'clientPhone', label: "Mobile" },
    { key: 'caseNumber', label: "Case ID" },
    { key: 'programType', label: "Classification" },
    { key: 'previousSatop', label: "Prior Record", type: 'boolean' }
  ]
};