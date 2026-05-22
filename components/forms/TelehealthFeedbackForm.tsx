
import React from 'react';
import { FormDefinition, TelehealthFeedbackData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { StarRating } from '../StarRating';
import { RadioGroup } from '../RadioGroup';

const initialState: TelehealthFeedbackData = {
  clientName: '', clientEmail: '',
  phoneClarity: 0, phoneResponsiveness: 0, phoneHelpfulness: 0,
  assessmentConvenience: 0, assessmentCommunication: 0, assessmentConnection: 0,
  groupConvenience: 0, groupParticipation: 0, groupHelpfulness: 0, groupTechnology: 0,
  oneOnOneConvenience: 0, oneOnOneConnection: 0, oneOnOneListening: 0, oneOnOneHelpfulness: 0,
  feltRespected: null, wouldRecommend: null, likelyToRefer: null,
  referralExplanation: '', additionalComments: ''
};

const FeedbackSection: React.FC<FormSectionProps<TelehealthFeedbackData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  return (
    <div className="space-y-10 animate-fade-in-up">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <FormField id="clientName" label="Client name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
        <FormField id="clientEmail" label="Email" type="email" value={formData.clientEmail} onChange={handleChange} error={errors.clientEmail} />
      </div>

      <div className="space-y-6">
        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-8 border-b pb-2">Phone &amp; technology</h3>
        <StarRating id="phoneClarity" label="Audio and video clarity" value={formData.phoneClarity} onChange={(v) => setFormData({...formData, phoneClarity: v})} />
        <StarRating id="groupTechnology" label="Connection quality" value={formData.groupTechnology} onChange={(v) => setFormData({...formData, groupTechnology: v})} />
      </div>

      <div className="space-y-6">
        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-8 border-b pb-2">Clinical experience</h3>
        <StarRating id="groupHelpfulness" label="How helpful were group sessions?" value={formData.groupHelpfulness} onChange={(v) => setFormData({...formData, groupHelpfulness: v})} />
        <StarRating id="oneOnOneListening" label="Therapist listening" value={formData.oneOnOneListening} onChange={(v) => setFormData({...formData, oneOnOneListening: v})} />
      </div>

      <div className="pt-4 border-t border-black/5 dark:border-white/5 space-y-8">
        <RadioGroup id="feltRespected" label="Did you feel respected throughout?" value={formData.feltRespected} onChange={(v) => setFormData({...formData, feltRespected: v})} />
        <RadioGroup id="wouldRecommend" label="Would you recommend ACS TherapyHub?" value={formData.wouldRecommend} onChange={(v) => setFormData({...formData, wouldRecommend: v})} />
      </div>

      <FormField id="additionalComments" label="Additional comments" type="textarea" value={formData.additionalComments} onChange={handleChange} />
    </div>
  );
};

export const TELEHEALTH_FEEDBACK_DEFINITION: FormDefinition<TelehealthFeedbackData> = {
  id: 'telehealth-feedback',
  title: 'Telehealth Experience Feedback',
  description: 'Tell us about your telehealth experience.',
  category: 'Assessment',
  difficulty: 'Simple',
  estimatedTime: '6 min',
  successScreen: { googleReview: true },
  initialState,
  validateStep: (data) => {

    const errs: FormErrors<TelehealthFeedbackData> = {};
    if (!data.clientName) errs.clientName = 'Required.';
    if (data.feltRespected === null) errs.feltRespected = 'Please select an option.';
    return errs;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Client name', type: 'text', required: true },
    { id: 'clientEmail', label: 'Email', type: 'email', required: false },
    { id: 'phoneClarity', label: 'Audio and video clarity', type: 'rating', required: true, min: 1, max: 5 },
    { id: 'phoneResponsiveness', label: 'Phone responsiveness', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'phoneHelpfulness', label: 'Phone helpfulness', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'assessmentConvenience', label: 'Assessment convenience', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'assessmentCommunication', label: 'Assessment communication', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'assessmentConnection', label: 'Assessment connection', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'groupConvenience', label: 'Group convenience', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'groupParticipation', label: 'Group participation', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'groupHelpfulness', label: 'How helpful were group sessions?', type: 'rating', required: true, min: 1, max: 5 },
    { id: 'groupTechnology', label: 'Connection quality', type: 'rating', required: true, min: 1, max: 5 },
    { id: 'oneOnOneConvenience', label: '1:1 convenience', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'oneOnOneConnection', label: '1:1 connection', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'oneOnOneListening', label: 'Therapist listening', type: 'rating', required: true, min: 1, max: 5 },
    { id: 'oneOnOneHelpfulness', label: '1:1 helpfulness', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'feltRespected', label: 'Did you feel respected throughout?', type: 'boolean', required: true },
    { id: 'wouldRecommend', label: 'Would you recommend ACS TherapyHub?', type: 'boolean', required: true },
    { id: 'likelyToRefer', label: 'Likely to refer', type: 'boolean', required: false },
    { id: 'referralExplanation', label: 'Referral explanation', type: 'textarea', required: false },
    { id: 'additionalComments', label: 'Additional comments', type: 'textarea', required: false }
  ]
};
