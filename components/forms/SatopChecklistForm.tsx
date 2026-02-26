
import React from 'react';
import { FormDefinition, SatopChecklistData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { Checkbox } from '../Checkbox';

const initialState: SatopChecklistData = {
  clientName: '', clientEmail: '', orientationDate: new Date().toISOString().split('T')[0],
  checklist: {
    clientRights: false, grievanceProcedure: false, confidentiality: false,
    hoursAndAppointments: false, crisisProcedures: false, programRules: false,
    questionsAnswered: false, agreesToTreatment: false
  },
  clientSignature: '', staffSignature: '', signatureDate: new Date().toISOString().split('T')[0]
};

const ChecklistSection: React.FC<FormSectionProps<SatopChecklistData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const toggleCheck = (id: keyof SatopChecklistData['checklist']) => {
    setFormData({
      ...formData,
      checklist: { ...formData.checklist, [id]: !formData.checklist[id] }
    });
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <FormField id="clientName" label="Client Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
        <FormField id="orientationDate" label="Orientation Date" type="date" value={formData.orientationDate} onChange={handleChange} />
      </div>
      
      <div className="p-8 bg-slate-50 dark:bg-slate-950/50 rounded-[2.5rem] border border-black/5 dark:border-white/5 space-y-4 shadow-inner">
        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-6">Orientation Acknowledgments</h3>
        <Checkbox label="Client Bill of Rights received and reviewed." checked={formData.checklist.clientRights} onChange={() => toggleCheck('clientRights')} />
        <Checkbox label="Grievance protocol and procedures established." checked={formData.checklist.grievanceProcedure} onChange={() => toggleCheck('grievanceProcedure')} />
        <Checkbox label="Confidentiality and HIPAA regulations authorized." checked={formData.checklist.confidentiality} onChange={() => toggleCheck('confidentiality')} />
        <Checkbox label="Program schedule and attendance logic accepted." checked={formData.checklist.hoursAndAppointments} onChange={() => toggleCheck('hoursAndAppointments')} />
        <Checkbox label="Crisis response and emergency uplinks verified." checked={formData.checklist.crisisProcedures} onChange={() => toggleCheck('crisisProcedures')} />
        <Checkbox label="Standard program rules and behavioral rules signed." checked={formData.checklist.programRules} onChange={() => toggleCheck('programRules')} />
        <Checkbox label="All clinical and procedural questions answered." checked={formData.checklist.questionsAnswered} onChange={() => toggleCheck('questionsAnswered')} />
        <Checkbox label="I authorize the initiation of treatment services." checked={formData.checklist.agreesToTreatment} onChange={() => toggleCheck('agreesToTreatment')} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 pt-4">
        <FormField id="clientSignature" label="Client Digital Handshake" value={formData.clientSignature} onChange={handleChange} error={errors.clientSignature} />
        <FormField id="staffSignature" label="Staff/QMHP Verification" value={formData.staffSignature} onChange={handleChange} error={errors.staffSignature} />
      </div>
    </div>
  );
};

export const SATOP_CHECKLIST_DEFINITION: FormDefinition<SatopChecklistData> = {
  id: 'satop-checklist',
  title: 'Orientation Checklist',
  description: 'Verification of policy review and program orientation. Mandatory for initial SATOP certification.',
  category: 'Intake',
  tags: ['Required', 'SATOP'],
  difficulty: 'Simple',
  estimatedTime: '5 min',
  initialState,
  validateStep: (data) => {

    const errs: FormErrors<SatopChecklistData> = {};
    if (!data.clientName) errs.clientName = 'Mandatory.';
    if (!data.clientSignature) errs.clientSignature = 'Signature required.';
    Object.keys(data.checklist).forEach(key => {
      if (!data.checklist[key as keyof typeof data.checklist]) {
        errs[key as keyof SatopChecklistData] = 'All checklist items must be verified.';
      }
    });
    return errs;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Client Name', type: 'text', required: true },
    { id: 'clientEmail', label: 'Client Email', type: 'email', required: false },
    { id: 'orientationDate', label: 'Orientation Date', type: 'date', required: true },
    { id: 'checklist.clientRights', label: 'Client Bill of Rights received and reviewed.', type: 'boolean', required: true },
    { id: 'checklist.grievanceProcedure', label: 'Grievance protocol and procedures established.', type: 'boolean', required: true },
    { id: 'checklist.confidentiality', label: 'Confidentiality and HIPAA regulations authorized.', type: 'boolean', required: true },
    { id: 'checklist.hoursAndAppointments', label: 'Program schedule and attendance logic accepted.', type: 'boolean', required: true },
    { id: 'checklist.crisisProcedures', label: 'Crisis response and emergency uplinks verified.', type: 'boolean', required: true },
    { id: 'checklist.programRules', label: 'Standard program rules and behavioral rules signed.', type: 'boolean', required: true },
    { id: 'checklist.questionsAnswered', label: 'All clinical and procedural questions answered.', type: 'boolean', required: true },
    { id: 'checklist.agreesToTreatment', label: 'I authorize the initiation of treatment services.', type: 'boolean', required: true },
    { id: 'clientSignature', label: 'Client Digital Handshake', type: 'text', required: true },
    { id: 'staffSignature', label: 'Staff/QMHP Verification', type: 'text', required: false },
    { id: 'signatureDate', label: 'Signature Date', type: 'date', required: false }
  ]
};
