
import React from 'react';
import { FormDefinition, SessionAttendanceData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { RadioGroupString } from '../RadioGroupString';

const initialState: SessionAttendanceData = {
  therapistName: '', clientName: '', clientEmail: '',
  sessionDate: new Date().toISOString().split('T')[0], sessionTime: '',
  sessionNumber: '', attendanceStatus: null, sessionType: null, sessionNotes: ''
};

const AttendanceSection: React.FC<FormSectionProps<SessionAttendanceData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <FormField id="therapistName" label="QMHP/Facilitator" value={formData.therapistName} onChange={handleChange} error={errors.therapistName} />
        <FormField id="clientName" label="Client Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <FormField id="sessionDate" label="Session Timestamp" type="date" value={formData.sessionDate} onChange={handleChange} />
        <FormField id="sessionNumber" label="Session Cycle ID" value={formData.sessionNumber} onChange={handleChange} placeholder="e.g. 1 of 12" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        <RadioGroupString 
          id="sessionType"
          label="Protocol Track"
          options={[{value: 'Group', label: 'Group'}, {value: 'Individual', label: 'Individual'}]}
          value={formData.sessionType}
          onChange={(v) => setFormData({...formData, sessionType: v as any})}
          error={errors.sessionType}
        />
        <RadioGroupString 
          id="attendanceStatus"
          label="Attendance Indicator"
          options={[{value: 'Present', label: 'Present'}, {value: 'Absent', label: 'Absent'}, {value: 'Excused', label: 'Excused'}]}
          value={formData.attendanceStatus}
          onChange={(v) => setFormData({...formData, attendanceStatus: v as any})}
          error={errors.attendanceStatus}
        />
      </div>

      <FormField id="sessionNotes" label="Clinical Summary/Telemetry" type="textarea" value={formData.sessionNotes} onChange={handleChange} />
    </div>
  );
};

export const SESSION_ATTENDANCE_DEFINITION: FormDefinition<SessionAttendanceData> = {
  id: 'session-attendance',
  title: 'Clinical Attendance',
  description: 'Internal logging of session participation and clinical telemetry. Powers compliance scoring engine.',
  category: 'Clinical',
  tags: ['Internal'],
  difficulty: 'Simple',
  estimatedTime: '3 min',
  initialState,
  validateStep: (data) => {

    const errs: FormErrors<SessionAttendanceData> = {};
    if (!data.therapistName) errs.therapistName = 'Mandatory.';
    if (!data.clientName) errs.clientName = 'Mandatory.';
    if (!data.attendanceStatus) errs.attendanceStatus = 'Status required.';
    return errs;
  },
  fieldDefinitions: [
    { id: 'therapistName', label: 'QMHP/Facilitator', type: 'text', required: true },
    { id: 'clientName', label: 'Client Name', type: 'text', required: true },
    { id: 'clientEmail', label: 'Client Email', type: 'email', required: false },
    { id: 'sessionDate', label: 'Session Timestamp', type: 'date', required: true },
    { id: 'sessionTime', label: 'Session Time', type: 'text', required: false },
    { id: 'sessionNumber', label: 'Session Cycle ID', type: 'text', required: false },
    { id: 'attendanceStatus', label: 'Attendance Indicator', type: 'text', required: true, options: [{ value: 'Present', label: 'Present' }, { value: 'Absent', label: 'Absent' }, { value: 'Excused', label: 'Excused' }] },
    { id: 'sessionType', label: 'Protocol Track', type: 'text', required: true, options: [{ value: 'Group', label: 'Group' }, { value: 'Individual', label: 'Individual' }] },
    { id: 'sessionNotes', label: 'Clinical Summary/Telemetry', type: 'textarea', required: false }
  ]
};
