
import React from 'react';
import { FormDefinition, ChartChecklistData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { RadioGroup } from '../RadioGroup';

const initialState: ChartChecklistData = {
  clientName: '', formId: '',
  attendingGroupRegularly: null, attendingGroupRegularlyAction: '',
  attendsOneOnOnes: null, attendsOneOnOnesAction: '',
  UAs: null, UAsAction: '',
  paymentsToDate: null, paymentsToDateAction: '',
  twelveStepMeetings: null, twelveStepMeetingsAction: '',
  poUpdate: null, poUpdateAction: '',
  needToStaff: null, needToStaffAction: '',
  soberDate: null, soberDateAction: '',
  progressNotes: [], therapistSignature: '', signatureDate: new Date().toISOString().split('T')[0]
};

const ChecklistItem = ({ label, value, onChange, action, onActionChange }: { label: string, value: boolean | null, onChange: (v: boolean) => void, action: string, onActionChange: (v: string) => void }) => (
  <div className="p-6 bg-white/5 dark:bg-slate-800/50 rounded-3xl border border-black/5 dark:border-white/5 space-y-4">
    <RadioGroup id={label} label={label} value={value} onChange={onChange} />
    {value === false && (
      <FormField id="action" label="Required Action / Remediation" value={action} onChange={(e) => onActionChange(e.target.value)} />
    )}
  </div>
);

const ChartSection: React.FC<FormSectionProps<ChartChecklistData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const updateField = (key: keyof ChartChecklistData, val: any) => {
    setFormData({ ...formData, [key]: val });
  };

  return (
    <div className="space-y-10 animate-fade-in-up">
      <FormField id="clientName" label="Client/Patient Selector" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChecklistItem label="Clinical Group Attendance" value={formData.attendingGroupRegularly} onChange={(v) => updateField('attendingGroupRegularly', v)} action={formData.attendingGroupRegularlyAction} onActionChange={(v) => updateField('attendingGroupRegularlyAction', v)} />
        <ChecklistItem label="Individual Case Management" value={formData.attendsOneOnOnes} onChange={(v) => updateField('attendsOneOnOnes', v)} action={formData.attendsOneOnOnesAction} onActionChange={(v) => updateField('attendsOneOnOnesAction', v)} />
        <ChecklistItem label="Toxicology Screens (UAs)" value={formData.UAs} onChange={(v) => updateField('UAs', v)} action={formData.UAsAction} onActionChange={(v) => updateField('UAsAction', v)} />
        <ChecklistItem label="Fiscal Ledger Status" value={formData.paymentsToDate} onChange={(v) => updateField('paymentsToDate', v)} action={formData.paymentsToDateAction} onActionChange={(v) => updateField('paymentsToDateAction', v)} />
      </div>

      <div className="pt-8 border-t border-black/5 dark:border-white/5">
        <FormField id="therapistSignature" label="Therapist/QMHP Digital Verification" value={formData.therapistSignature} onChange={handleChange} error={errors.therapistSignature} />
      </div>
    </div>
  );
};

export const CHART_CHECKLIST_DEFINITION: FormDefinition<ChartChecklistData> = {
  id: 'chart-checklist',
  title: 'Operational Chart Review',
  description: 'Internal audit of clinical compliance markers, toxicology status, and fiscal standing. Authorized personnel only.',
  category: 'Clinical',
  tags: ['Internal'],
  difficulty: 'Simple',
  estimatedTime: '8 min',
  initialState,
  validateStep: (data) => {
    const errs: FormErrors<ChartChecklistData> = {};
    if (!data.clientName) errs.clientName = 'Mandatory.';
    if (!data.therapistSignature) errs.therapistSignature = 'Verification required.';
    return errs;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Client/Patient Selector', type: 'text', required: true },
    { id: 'attendingGroupRegularly', label: 'Clinical Group Attendance', type: 'boolean', required: true },
    { id: 'attendingGroupRegularlyAction', label: 'Required Action / Remediation', type: 'textarea', required: false },
    { id: 'attendsOneOnOnes', label: 'Individual Case Management', type: 'boolean', required: true },
    { id: 'attendsOneOnOnesAction', label: 'Required Action / Remediation', type: 'textarea', required: false },
    { id: 'UAs', label: 'Toxicology Screens (UAs)', type: 'boolean', required: true },
    { id: 'UAsAction', label: 'Required Action / Remediation', type: 'textarea', required: false },
    { id: 'paymentsToDate', label: 'Fiscal Ledger Status', type: 'boolean', required: true },
    { id: 'paymentsToDateAction', label: 'Required Action / Remediation', type: 'textarea', required: false },
    { id: 'therapistSignature', label: 'Therapist/QMHP Digital Verification', type: 'text', required: true }
  ]
};
