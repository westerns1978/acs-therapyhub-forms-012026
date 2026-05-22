
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
      <FormField id="action" label="Action / follow-up" value={action} onChange={(e) => onActionChange(e.target.value)} />
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
      <FormField id="clientName" label="Client" value={formData.clientName} onChange={handleChange} error={errors.clientName} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChecklistItem label="Attending group sessions regularly" value={formData.attendingGroupRegularly} onChange={(v) => updateField('attendingGroupRegularly', v)} action={formData.attendingGroupRegularlyAction} onActionChange={(v) => updateField('attendingGroupRegularlyAction', v)} />
        <ChecklistItem label="Attending 1:1 sessions" value={formData.attendsOneOnOnes} onChange={(v) => updateField('attendsOneOnOnes', v)} action={formData.attendsOneOnOnesAction} onActionChange={(v) => updateField('attendsOneOnOnesAction', v)} />
        <ChecklistItem label="Drug screens (UAs)" value={formData.UAs} onChange={(v) => updateField('UAs', v)} action={formData.UAsAction} onActionChange={(v) => updateField('UAsAction', v)} />
        <ChecklistItem label="Payments up to date" value={formData.paymentsToDate} onChange={(v) => updateField('paymentsToDate', v)} action={formData.paymentsToDateAction} onActionChange={(v) => updateField('paymentsToDateAction', v)} />
      </div>

      <div className="pt-8 border-t border-black/5 dark:border-white/5">
        <FormField id="therapistSignature" label="Therapist/QMHP signature" value={formData.therapistSignature} onChange={handleChange} error={errors.therapistSignature} />
      </div>
    </div>
  );
};

export const CHART_CHECKLIST_DEFINITION: FormDefinition<ChartChecklistData> = {
  id: 'chart-checklist',
  title: 'Chart Review',
  description: 'Quick review of attendance, toxicology, and payment status. Staff use.',
  category: 'Clinical',
  tags: ['Internal'],
  difficulty: 'Simple',
  estimatedTime: '8 min',
  initialState,
  validateStep: (data) => {
    const errs: FormErrors<ChartChecklistData> = {};
    if (!data.clientName) errs.clientName = 'Required.';
    if (!data.therapistSignature) errs.therapistSignature = 'Verification required.';
    return errs;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Client', type: 'text', required: true },
    { id: 'attendingGroupRegularly', label: 'Attending group sessions regularly', type: 'boolean', required: true },
    { id: 'attendingGroupRegularlyAction', label: 'Action / follow-up', type: 'textarea', required: false },
    { id: 'attendsOneOnOnes', label: 'Attending 1:1 sessions', type: 'boolean', required: true },
    { id: 'attendsOneOnOnesAction', label: 'Action / follow-up', type: 'textarea', required: false },
    { id: 'UAs', label: 'Drug screens (UAs)', type: 'boolean', required: true },
    { id: 'UAsAction', label: 'Action / follow-up', type: 'textarea', required: false },
    { id: 'paymentsToDate', label: 'Payments up to date', type: 'boolean', required: true },
    { id: 'paymentsToDateAction', label: 'Action / follow-up', type: 'textarea', required: false },
    { id: 'therapistSignature', label: 'Therapist/QMHP signature', type: 'text', required: true }
  ]
};
