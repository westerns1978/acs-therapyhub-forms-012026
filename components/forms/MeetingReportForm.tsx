
import React from 'react';
import { FormDefinition, MeetingReportData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { CheckboxGroup } from '../CheckboxGroup';

const initialState: MeetingReportData = {
  clientName: '', groupName: '', location: '', dateAttended: '', timeAttended: '',
  meetingType: { aa: false, na: false, speaker: false, discussion: false, bigBook: false, step: false, open: false, closed: false },
  meetingSubject: '', whatApplied: '', whatLearned: '', chairpersonSignature: ''
};

const ReportSection: React.FC<FormSectionProps<MeetingReportData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <FormField id="clientName" label="Client Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
        <FormField id="groupName" label="Support Group Name" value={formData.groupName} onChange={handleChange} error={errors.groupName} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <FormField id="dateAttended" label="Date Attended" type="date" value={formData.dateAttended} onChange={handleChange} error={errors.dateAttended} />
        <FormField id="location" label="Location/Venue" value={formData.location} onChange={handleChange} error={errors.location} />
      </div>
      
      <div className="pt-4">
        <label className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 block">Meeting Classification</label>
        <CheckboxGroup 
          id="meetingType" label=""
          options={[
            {id: 'aa', label: 'AA'}, {id: 'na', label: 'NA'}, {id: 'speaker', label: 'Speaker'}, {id: 'discussion', label: 'Discussion'},
            {id: 'bigBook', label: 'Big Book'}, {id: 'step', label: 'Step'}, {id: 'open', label: 'Open'}, {id: 'closed', label: 'Closed'}
          ]}
          values={formData.meetingType}
          onChange={(id) => setFormData({...formData, meetingType: { ...formData.meetingType, [id]: !formData.meetingType[id as keyof typeof formData.meetingType] }})}
        />
      </div>

      <FormField id="whatLearned" label="Clinical Takeaways (What did you learn?)" type="textarea" value={formData.whatLearned} onChange={handleChange} error={errors.whatLearned} />
      <FormField id="whatApplied" label="Real-world Application" type="textarea" value={formData.whatApplied} onChange={handleChange} error={errors.whatApplied} />
      <FormField id="chairpersonSignature" label="Chairperson Digital Verification" value={formData.chairpersonSignature} onChange={handleChange} error={errors.chairpersonSignature} />
    </div>
  );
};

export const MEETING_REPORT_DEFINITION: FormDefinition<MeetingReportData> = {
  id: 'meeting-report',
  title: 'Support Group Verification Report',
  description: 'Self-reported documentation for AA/NA or other 12-step module participation.',
  category: 'Treatment',
  tags: ['SATOP'],
  difficulty: 'Simple',
  estimatedTime: '5 min',
  initialState,
  validateStep: (data) => {

    const errs: FormErrors<MeetingReportData> = {};
    if (!data.clientName) errs.clientName = 'Mandatory.';
    if (!data.groupName) errs.groupName = 'Mandatory.';
    if (!data.chairpersonSignature) errs.chairpersonSignature = 'Signature required.';
    return errs;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Client Name', type: 'text', required: true },
    { id: 'groupName', label: 'Support Group Name', type: 'text', required: true },
    { id: 'location', label: 'Location/Venue', type: 'text', required: true },
    { id: 'dateAttended', label: 'Date Attended', type: 'date', required: true },
    { id: 'timeAttended', label: 'Time Attended', type: 'text', required: false },
    { id: 'meetingType', label: 'Meeting Classification', type: 'object', required: true },
    { id: 'meetingSubject', label: 'Meeting Subject', type: 'textarea', required: false },
    { id: 'whatApplied', label: 'Real-world Application', type: 'textarea', required: true },
    { id: 'whatLearned', label: 'Clinical Takeaways (What did you learn?)', type: 'textarea', required: true },
    { id: 'chairpersonSignature', label: 'Chairperson Digital Verification', type: 'text', required: true }
  ]
};
