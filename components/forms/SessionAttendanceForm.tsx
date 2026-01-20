import React from 'react';
import { FormDefinition, SessionAttendanceData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { RadioGroupString } from '../RadioGroupString';

const initialState: SessionAttendanceData = {
  therapistName: '',
  clientName: '',
  clientEmail: '',
  sessionDate: '',
  sessionTime: '',
  sessionNumber: '',
  attendanceStatus: null,
  sessionType: null,
  sessionNotes: '',
};

const SessionAttendanceSection: React.FC<FormSectionProps<SessionAttendanceData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Session Info */}
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Session Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="therapistName" label="Therapist/Facilitator Name" value={formData.therapistName} onChange={handleChange} error={errors.therapistName} />
          <FormField id="sessionNumber" label="Session Number" value={formData.sessionNumber} onChange={handleChange} error={errors.sessionNumber} placeholder="e.g., Session 5 of 12" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="sessionDate" label="Session Date" type="date" value={formData.sessionDate} onChange={handleChange} error={errors.sessionDate} />
          <FormField id="sessionTime" label="Session Time" type="time" value={formData.sessionTime} onChange={handleChange} error={errors.sessionTime} />
        </div>
      </div>

      {/* Client Info */}
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Client Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="clientName" label="Client Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
          <FormField id="clientEmail" label="Client Email" type="email" value={formData.clientEmail} onChange={handleChange} error={errors.clientEmail} />
        </div>
      </div>

      {/* Session Type & Attendance */}
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Session Details</h3>

        <RadioGroupString
          id="sessionType"
          label="Session Type"
          value={formData.sessionType}
          onChange={(val) => setFormData({ ...formData, sessionType: val as 'Group' | 'Individual' })}
          error={errors.sessionType}
          options={[
            { value: 'Group', label: 'Group Session' },
            { value: 'Individual', label: 'Individual Session' },
          ]}
        />

        <RadioGroupString
          id="attendanceStatus"
          label="Attendance Status"
          value={formData.attendanceStatus}
          onChange={(val) => setFormData({ ...formData, attendanceStatus: val as 'Present' | 'Absent' | 'Excused' })}
          error={errors.attendanceStatus}
          options={[
            { value: 'Present', label: 'Present' },
            { value: 'Absent', label: 'Absent' },
            { value: 'Excused', label: 'Excused Absence' },
          ]}
        />
      </div>

      {/* Session Notes */}
      <div>
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Session Notes</h3>

        {formData.attendanceStatus === 'Absent' && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-900/30 mb-6">
            <p className="text-sm text-red-700 dark:text-red-300">
              <strong>Absence Noted:</strong> Please document the reason for absence if known, and any follow-up actions needed.
            </p>
          </div>
        )}

        {formData.attendanceStatus === 'Excused' && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30 mb-6">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              <strong>Excused Absence:</strong> Please document the reason for the excused absence (e.g., medical appointment, court appearance).
            </p>
          </div>
        )}

        <FormField
          id="sessionNotes"
          label="Session Notes"
          type="textarea"
          value={formData.sessionNotes}
          onChange={handleChange}
          error={errors.sessionNotes}
          maxLength={1000}
          required={false}
          placeholder={
            formData.attendanceStatus === 'Present'
              ? "Brief notes on session participation, topics covered, client engagement..."
              : formData.attendanceStatus === 'Absent'
              ? "Reason for absence (if known), contact attempts, follow-up needed..."
              : formData.attendanceStatus === 'Excused'
              ? "Reason for excused absence, documentation received, make-up session arranged..."
              : "Add any relevant notes about this session..."
          }
        />
      </div>
    </div>
  );
};

const validateStep = (step: number, data: SessionAttendanceData): FormErrors<SessionAttendanceData> => {
  const errors: FormErrors<SessionAttendanceData> = {};

  if (step === 1) {
    if (!data.therapistName.trim()) errors.therapistName = 'Therapist name is required';
    if (!data.sessionDate) errors.sessionDate = 'Session date is required';
    if (!data.sessionTime) errors.sessionTime = 'Session time is required';
    if (!data.clientName.trim()) errors.clientName = 'Client name is required';
    if (!data.clientEmail.trim()) errors.clientEmail = 'Client email is required';
    if (data.clientEmail && !/\S+@\S+\.\S+/.test(data.clientEmail)) errors.clientEmail = 'Invalid email format';
    if (!data.sessionType) errors.sessionType = 'Please select a session type';
    if (!data.attendanceStatus) errors.attendanceStatus = 'Please select attendance status';
  }

  return errors;
};

export const SESSION_ATTENDANCE_DEFINITION: FormDefinition<SessionAttendanceData> = {
  id: 'session-attendance',
  title: 'Session Attendance Record',
  description: 'Record client attendance for group or individual therapy sessions. Track present, absent, and excused statuses.',
  category: 'Clinical',
  tags: ['Internal'],
  estimatedTime: '2-3 min',
  difficulty: 'Simple',
  initialState,
  steps: [SessionAttendanceSection],
  validateStep,
  fieldDefinitions: [
    { key: 'therapistName', label: 'Therapist Name' },
    { key: 'sessionDate', label: 'Session Date', type: 'date' },
    { key: 'sessionTime', label: 'Session Time' },
    { key: 'sessionNumber', label: 'Session Number' },
    { key: 'sessionType', label: 'Session Type' },
    { key: 'attendanceStatus', label: 'Attendance Status' },
    { key: 'sessionNotes', label: 'Session Notes' },
  ]
};
