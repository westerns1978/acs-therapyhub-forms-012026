import React from 'react';
import { FormDefinition, SatopChecklistData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { Checkbox } from '../Checkbox';

const initialState: SatopChecklistData = {
  clientName: '',
  clientEmail: '',
  orientationDate: '',
  checklist: {
    clientRights: false,
    grievanceProcedure: false,
    confidentiality: false,
    hoursAndAppointments: false,
    crisisProcedures: false,
    programRules: false,
    questionsAnswered: false,
    agreesToTreatment: false,
  },
  clientSignature: '',
  staffSignature: '',
  signatureDate: '',
};

const SatopChecklistSection: React.FC<FormSectionProps<SatopChecklistData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleChecklistChange = (field: keyof typeof formData.checklist) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      checklist: {
        ...formData.checklist,
        [field]: e.target.checked
      }
    });
  };

  const checklistItems = [
    { id: 'clientRights', label: 'Client Rights and Responsibilities have been explained and I have received a copy.' },
    { id: 'grievanceProcedure', label: 'Grievance Procedures have been explained and I understand how to file a complaint.' },
    { id: 'confidentiality', label: 'Confidentiality policies have been explained including 42 CFR Part 2 regulations.' },
    { id: 'hoursAndAppointments', label: 'Office hours and appointment procedures have been explained.' },
    { id: 'crisisProcedures', label: 'Crisis and emergency procedures have been explained including after-hours contacts.' },
    { id: 'programRules', label: 'Program rules and expectations have been reviewed including attendance requirements.' },
    { id: 'questionsAnswered', label: 'All my questions about the SATOP program have been answered.' },
    { id: 'agreesToTreatment', label: 'I agree to participate in the SATOP program and follow program guidelines.' },
  ];

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Client Info */}
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Client Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="clientName" label="Client Full Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
          <FormField id="clientEmail" label="Email Address" type="email" value={formData.clientEmail} onChange={handleChange} error={errors.clientEmail} />
        </div>
        <FormField id="orientationDate" label="Orientation Date" type="date" value={formData.orientationDate} onChange={handleChange} error={errors.orientationDate} />
      </div>

      {/* Orientation Checklist */}
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Orientation Checklist</h3>

        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 mb-6">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Instructions:</strong> Please check each item below to confirm that you have received and understand the information provided during your SATOP orientation.
          </p>
        </div>

        <div className="space-y-4">
          {checklistItems.map(item => (
            <Checkbox
              key={item.id}
              id={item.id}
              label={item.label}
              checked={formData.checklist[item.id as keyof typeof formData.checklist]}
              onChange={handleChecklistChange(item.id as keyof typeof formData.checklist)}
              error={errors.checklist}
            />
          ))}
        </div>
      </div>

      {/* Signatures */}
      <div>
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Signatures</h3>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 mb-6">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            By signing below, I acknowledge that I have received the SATOP Client Orientation and understand all information presented.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="clientSignature" label="Client Signature (Type full name)" value={formData.clientSignature} onChange={handleChange} error={errors.clientSignature} />
          <FormField id="staffSignature" label="Staff Signature (Type full name)" value={formData.staffSignature} onChange={handleChange} error={errors.staffSignature} />
        </div>
        <FormField id="signatureDate" label="Date" type="date" value={formData.signatureDate} onChange={handleChange} error={errors.signatureDate} />
      </div>
    </div>
  );
};

const validateStep = (step: number, data: SatopChecklistData): FormErrors<SatopChecklistData> => {
  const errors: FormErrors<SatopChecklistData> = {};

  if (step === 1) {
    if (!data.clientName.trim()) errors.clientName = 'Client name is required';
    if (!data.clientEmail.trim()) errors.clientEmail = 'Email is required';
    if (data.clientEmail && !/\S+@\S+\.\S+/.test(data.clientEmail)) errors.clientEmail = 'Invalid email format';
    if (!data.orientationDate) errors.orientationDate = 'Orientation date is required';

    // All checklist items must be checked
    const allChecked = Object.values(data.checklist).every(v => v);
    if (!allChecked) {
      errors.checklist = 'All orientation items must be acknowledged';
    }

    if (!data.clientSignature.trim()) errors.clientSignature = 'Client signature is required';
    if (!data.staffSignature.trim()) errors.staffSignature = 'Staff signature is required';
    if (!data.signatureDate) errors.signatureDate = 'Date is required';
  }

  return errors;
};

export const SATOP_CHECKLIST_DEFINITION: FormDefinition<SatopChecklistData> = {
  id: 'satop-checklist',
  title: 'SATOP Client Orientation Checklist',
  description: 'Orientation acknowledgment form confirming that the client has received and understands all SATOP program information.',
  category: 'Intake',
  tags: ['Required', 'SATOP'],
  estimatedTime: '3-5 min',
  difficulty: 'Simple',
  initialState,
  steps: [SatopChecklistSection],
  validateStep,
  fieldDefinitions: [
    { key: 'orientationDate', label: 'Orientation Date', type: 'date' },
    { key: 'checklist', label: 'Orientation Checklist', type: 'object' },
    { key: 'clientSignature', label: 'Client Signature' },
    { key: 'staffSignature', label: 'Staff Signature' },
    { key: 'signatureDate', label: 'Date', type: 'date' },
  ]
};
