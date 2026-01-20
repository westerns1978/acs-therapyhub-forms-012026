import React from 'react';
import { FormDefinition, MeetingReportData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { CheckboxGroup } from '../CheckboxGroup';

const initialState: MeetingReportData = {
  clientName: '',
  groupName: '',
  location: '',
  dateAttended: '',
  timeAttended: '',
  meetingType: {
    aa: false,
    na: false,
    speaker: false,
    discussion: false,
    bigBook: false,
    step: false,
    open: false,
    closed: false,
  },
  meetingSubject: '',
  whatApplied: '',
  whatLearned: '',
  chairpersonSignature: '',
};

const meetingTypeOptions = [
  { id: 'aa', label: 'AA' },
  { id: 'na', label: 'NA' },
  { id: 'speaker', label: 'Speaker' },
  { id: 'discussion', label: 'Discussion' },
  { id: 'bigBook', label: 'Big Book' },
  { id: 'step', label: 'Step Meeting' },
  { id: 'open', label: 'Open' },
  { id: 'closed', label: 'Closed' },
];

const MeetingReportSection: React.FC<FormSectionProps<MeetingReportData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleMeetingTypeToggle = (typeId: string) => {
    setFormData({
      ...formData,
      meetingType: {
        ...formData.meetingType,
        [typeId]: !formData.meetingType[typeId as keyof typeof formData.meetingType]
      }
    });
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Client & Meeting Information</h3>
        <FormField id="clientName" label="Your Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
        <FormField id="groupName" label="Meeting/Group Name" value={formData.groupName} onChange={handleChange} error={errors.groupName} placeholder="e.g., Downtown AA, Serenity Group" />
        <FormField id="location" label="Meeting Location" value={formData.location} onChange={handleChange} error={errors.location} placeholder="Address or venue name" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="dateAttended" label="Date Attended" type="date" value={formData.dateAttended} onChange={handleChange} error={errors.dateAttended} />
          <FormField id="timeAttended" label="Time Attended" type="time" value={formData.timeAttended} onChange={handleChange} error={errors.timeAttended} />
        </div>
      </div>

      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Meeting Type</h3>
        <CheckboxGroup
          id="meetingType"
          label="Select all that apply"
          options={meetingTypeOptions}
          values={formData.meetingType}
          onChange={handleMeetingTypeToggle}
          error={errors.meetingType}
        />
      </div>

      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Meeting Reflection</h3>
        <FormField
          id="meetingSubject"
          label="What was the subject/topic of the meeting?"
          type="textarea"
          value={formData.meetingSubject}
          onChange={handleChange}
          error={errors.meetingSubject}
          maxLength={500}
        />
        <FormField
          id="whatLearned"
          label="What did you learn from this meeting?"
          type="textarea"
          value={formData.whatLearned}
          onChange={handleChange}
          error={errors.whatLearned}
          maxLength={600}
        />
        <FormField
          id="whatApplied"
          label="How can you apply what you learned to your recovery?"
          type="textarea"
          value={formData.whatApplied}
          onChange={handleChange}
          error={errors.whatApplied}
          maxLength={600}
        />
      </div>

      <div>
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Verification</h3>
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30 mb-6">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            <strong>Important:</strong> Please have the meeting chairperson or secretary sign below to verify your attendance.
          </p>
        </div>
        <FormField
          id="chairpersonSignature"
          label="Chairperson/Secretary Signature"
          value={formData.chairpersonSignature}
          onChange={handleChange}
          error={errors.chairpersonSignature}
          placeholder="Chairperson types their name here"
        />
      </div>
    </div>
  );
};

const validateStep = (step: number, data: MeetingReportData): FormErrors<MeetingReportData> => {
  const errors: FormErrors<MeetingReportData> = {};

  if (step === 1) {
    if (!data.clientName.trim()) errors.clientName = 'Your name is required';
    if (!data.groupName.trim()) errors.groupName = 'Meeting/group name is required';
    if (!data.location.trim()) errors.location = 'Location is required';
    if (!data.dateAttended) errors.dateAttended = 'Date is required';
    if (!data.timeAttended) errors.timeAttended = 'Time is required';

    const hasSelectedType = Object.values(data.meetingType).some(v => v);
    if (!hasSelectedType) errors.meetingType = 'Please select at least one meeting type';

    if (!data.meetingSubject.trim()) errors.meetingSubject = 'Meeting subject is required';
    if (!data.whatLearned.trim()) errors.whatLearned = 'Please describe what you learned';
    if (!data.whatApplied.trim()) errors.whatApplied = 'Please describe how you can apply what you learned';
    if (!data.chairpersonSignature.trim()) errors.chairpersonSignature = 'Chairperson signature is required for verification';
  }

  return errors;
};

export const MEETING_REPORT_DEFINITION: FormDefinition<MeetingReportData> = {
  id: 'meeting-report',
  title: 'AA/NA Group Meeting Report',
  description: 'Document your attendance at AA, NA, or other support group meetings. Requires chairperson verification.',
  category: 'Treatment',
  tags: ['SATOP'],
  estimatedTime: '5-7 min',
  difficulty: 'Simple',
  initialState,
  steps: [MeetingReportSection],
  validateStep,
  fieldDefinitions: [
    { key: 'groupName', label: 'Meeting/Group Name' },
    { key: 'location', label: 'Location' },
    { key: 'dateAttended', label: 'Date Attended', type: 'date' },
    { key: 'timeAttended', label: 'Time Attended' },
    { key: 'meetingType', label: 'Meeting Type', type: 'object' },
    { key: 'meetingSubject', label: 'Meeting Subject' },
    { key: 'whatLearned', label: 'What I Learned' },
    { key: 'whatApplied', label: 'How to Apply' },
    { key: 'chairpersonSignature', label: 'Chairperson Signature' },
  ]
};
