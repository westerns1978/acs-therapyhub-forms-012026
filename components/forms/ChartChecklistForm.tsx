import React from 'react';
import { FormDefinition, ChartChecklistData, FormErrors, FormSectionProps, ProgressNote } from '../../types';
import { FormField } from '../FormField';
import { RadioGroup } from '../RadioGroup';
import { Plus, Trash2 } from 'lucide-react';

const initialState: ChartChecklistData = {
  clientName: '',
  formId: '',
  attendingGroupRegularly: null,
  attendingGroupRegularlyAction: '',
  attendsOneOnOnes: null,
  attendsOneOnOnesAction: '',
  UAs: null,
  UAsAction: '',
  paymentsToDate: null,
  paymentsToDateAction: '',
  twelveStepMeetings: null,
  twelveStepMeetingsAction: '',
  poUpdate: null,
  poUpdateAction: '',
  needToStaff: null,
  needToStaffAction: '',
  soberDate: null,
  soberDateAction: '',
  progressNotes: [],
  therapistSignature: '',
  signatureDate: '',
};

const ChartChecklistSection: React.FC<FormSectionProps<ChartChecklistData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBooleanChange = (field: keyof ChartChecklistData) => (value: boolean) => {
    setFormData({ ...formData, [field]: value });
  };

  const addProgressNote = () => {
    setFormData({
      ...formData,
      progressNotes: [...formData.progressNotes, { date: '', note: '' }]
    });
  };

  const updateProgressNote = (index: number, field: keyof ProgressNote, value: string) => {
    const updatedNotes = [...formData.progressNotes];
    updatedNotes[index] = { ...updatedNotes[index], [field]: value };
    setFormData({ ...formData, progressNotes: updatedNotes });
  };

  const removeProgressNote = (index: number) => {
    const updatedNotes = formData.progressNotes.filter((_, i) => i !== index);
    setFormData({ ...formData, progressNotes: updatedNotes });
  };

  const checklistItems = [
    { id: 'attendingGroupRegularly', actionId: 'attendingGroupRegularlyAction', label: 'Client is attending group regularly' },
    { id: 'attendsOneOnOnes', actionId: 'attendsOneOnOnesAction', label: 'Client attends one-on-one sessions as scheduled' },
    { id: 'UAs', actionId: 'UAsAction', label: 'UA/Drug screens are up to date' },
    { id: 'paymentsToDate', actionId: 'paymentsToDateAction', label: 'Payments are current' },
    { id: 'twelveStepMeetings', actionId: 'twelveStepMeetingsAction', label: 'Attending 12-step/support meetings' },
    { id: 'poUpdate', actionId: 'poUpdateAction', label: 'Probation Officer has been updated' },
    { id: 'needToStaff', actionId: 'needToStaffAction', label: 'Case needs to be staffed' },
    { id: 'soberDate', actionId: 'soberDateAction', label: 'Sober date is verified/updated' },
  ];

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Client Info */}
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Client Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="clientName" label="Client Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
          <FormField id="formId" label="Form/Chart ID" value={formData.formId} onChange={handleChange} error={errors.formId} placeholder="e.g., CHK-2024-001" />
        </div>
      </div>

      {/* Chart Review Checklist */}
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Chart Review Checklist</h3>

        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 mb-6">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Instructions:</strong> For each item, indicate Yes or No. If No, describe the action needed in the text field below.
          </p>
        </div>

        {checklistItems.map(item => (
          <div key={item.id} className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
            <RadioGroup
              id={item.id}
              label={item.label}
              value={formData[item.id as keyof ChartChecklistData] as boolean | null}
              onChange={handleBooleanChange(item.id as keyof ChartChecklistData)}
              error={errors[item.id as keyof ChartChecklistData]}
            />
            {formData[item.id as keyof ChartChecklistData] === false && (
              <div className="mt-4">
                <FormField
                  id={item.actionId}
                  label="Action Needed"
                  type="textarea"
                  value={formData[item.actionId as keyof ChartChecklistData] as string}
                  onChange={handleChange}
                  error={errors[item.actionId as keyof ChartChecklistData]}
                  maxLength={300}
                  required={false}
                  placeholder="Describe the action needed..."
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Progress Notes */}
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Progress Notes</h3>

        {formData.progressNotes.map((note, index) => (
          <div key={index} className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl relative">
            <button
              type="button"
              onClick={() => removeProgressNote(index)}
              className="absolute top-4 right-4 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
            </button>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
              <FormField
                id={`progressNote_${index}_date`}
                label="Date"
                type="date"
                value={note.date}
                onChange={(e) => updateProgressNote(index, 'date', e.target.value)}
                required={false}
              />
              <div className="sm:col-span-2">
                <FormField
                  id={`progressNote_${index}_note`}
                  label="Note"
                  type="textarea"
                  value={note.note}
                  onChange={(e) => updateProgressNote(index, 'note', e.target.value)}
                  required={false}
                  maxLength={500}
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addProgressNote}
          className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl text-slate-500 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          Add Progress Note
        </button>
      </div>

      {/* Therapist Signature */}
      <div>
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Therapist Signature</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="therapistSignature" label="Therapist Signature" value={formData.therapistSignature} onChange={handleChange} error={errors.therapistSignature} />
          <FormField id="signatureDate" label="Date" type="date" value={formData.signatureDate} onChange={handleChange} error={errors.signatureDate} />
        </div>
      </div>
    </div>
  );
};

const validateStep = (step: number, data: ChartChecklistData): FormErrors<ChartChecklistData> => {
  const errors: FormErrors<ChartChecklistData> = {};

  if (step === 1) {
    if (!data.clientName.trim()) errors.clientName = 'Client name is required';

    // At least one checklist item should be answered
    const answeredItems = [
      data.attendingGroupRegularly,
      data.attendsOneOnOnes,
      data.UAs,
      data.paymentsToDate,
      data.twelveStepMeetings,
      data.poUpdate,
      data.needToStaff,
      data.soberDate
    ].filter(item => item !== null);

    if (answeredItems.length === 0) {
      errors.attendingGroupRegularly = 'Please complete at least one checklist item';
    }

    if (!data.therapistSignature.trim()) errors.therapistSignature = 'Therapist signature is required';
    if (!data.signatureDate) errors.signatureDate = 'Date is required';
  }

  return errors;
};

export const CHART_CHECKLIST_DEFINITION: FormDefinition<ChartChecklistData> = {
  id: 'chart-checklist',
  title: 'Chart Review Checklist',
  description: 'Internal clinical chart review checklist to track client compliance, payments, attendance, and progress notes.',
  category: 'Clinical',
  tags: ['Internal'],
  estimatedTime: '5-10 min',
  difficulty: 'Simple',
  initialState,
  steps: [ChartChecklistSection],
  validateStep,
  fieldDefinitions: [
    { key: 'formId', label: 'Form/Chart ID' },
    { key: 'attendingGroupRegularly', label: 'Attending Group', type: 'boolean' },
    { key: 'attendingGroupRegularlyAction', label: 'Group Action Needed' },
    { key: 'attendsOneOnOnes', label: 'Attends 1:1s', type: 'boolean' },
    { key: 'attendsOneOnOnesAction', label: '1:1 Action Needed' },
    { key: 'UAs', label: 'UAs Current', type: 'boolean' },
    { key: 'UAsAction', label: 'UA Action Needed' },
    { key: 'paymentsToDate', label: 'Payments Current', type: 'boolean' },
    { key: 'paymentsToDateAction', label: 'Payment Action Needed' },
    { key: 'twelveStepMeetings', label: '12-Step Meetings', type: 'boolean' },
    { key: 'twelveStepMeetingsAction', label: '12-Step Action Needed' },
    { key: 'poUpdate', label: 'PO Updated', type: 'boolean' },
    { key: 'poUpdateAction', label: 'PO Action Needed' },
    { key: 'needToStaff', label: 'Needs Staffing', type: 'boolean' },
    { key: 'needToStaffAction', label: 'Staffing Notes' },
    { key: 'soberDate', label: 'Sober Date Verified', type: 'boolean' },
    { key: 'soberDateAction', label: 'Sober Date Action' },
    { key: 'progressNotes', label: 'Progress Notes', type: 'object' },
    { key: 'therapistSignature', label: 'Therapist Signature' },
    { key: 'signatureDate', label: 'Date', type: 'date' },
  ]
};
