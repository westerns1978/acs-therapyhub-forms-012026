
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
        <FormField id="clientName" label="Client Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
        <FormField id="clientEmail" label="Secure Email" type="email" value={formData.clientEmail} onChange={handleChange} error={errors.clientEmail} />
      </div>

      <div className="space-y-6">
        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-8 border-b pb-2">Phone & Technology</h3>
        <StarRating id="phoneClarity" label="Call Audio/Visual Clarity" value={formData.phoneClarity} onChange={(v) => setFormData({...formData, phoneClarity: v})} />
        <StarRating id="groupTechnology" label="Telehealth Node Stability" value={formData.groupTechnology} onChange={(v) => setFormData({...formData, groupTechnology: v})} />
      </div>

      <div className="space-y-6">
        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-8 border-b pb-2">Clinical Experience</h3>
        <StarRating id="groupHelpfulness" label="Group Logic Effectiveness" value={formData.groupHelpfulness} onChange={(v) => setFormData({...formData, groupHelpfulness: v})} />
        <StarRating id="oneOnOneListening" label="Therapist Neural Tuning (Listening)" value={formData.oneOnOneListening} onChange={(v) => setFormData({...formData, oneOnOneListening: v})} />
      </div>

      <div className="pt-4 border-t border-black/5 dark:border-white/5 space-y-8">
        <RadioGroup id="feltRespected" label="Did you feel clinical respect throughout the process?" value={formData.feltRespected} onChange={(v) => setFormData({...formData, feltRespected: v})} />
        <RadioGroup id="wouldRecommend" label="Would you authorize a recommendation for this node?" value={formData.wouldRecommend} onChange={(v) => setFormData({...formData, wouldRecommend: v})} />
      </div>
      
      <FormField id="additionalComments" label="Signal Analysis (Comments)" type="textarea" value={formData.additionalComments} onChange={handleChange} />
    </div>
  );
};

export const TELEHEALTH_FEEDBACK_DEFINITION: FormDefinition<TelehealthFeedbackData> = {
  id: 'telehealth-feedback',
  title: 'Telehealth Experience Feedback',
  description: 'Digital performance review and satisfaction protocol for telehealth services.',
  category: 'Assessment',
  difficulty: 'Simple',
  estimatedTime: '6 min',
  successScreen: { googleReview: true },
  initialState,
  validateStep: (data) => {

    const errs: FormErrors<TelehealthFeedbackData> = {};
    if (!data.clientName) errs.clientName = 'Mandatory.';
    if (data.feltRespected === null) errs.feltRespected = 'Select response.';
    return errs;
  },
  fieldDefinitions: [
    { id: 'clientName', label: 'Client Name', type: 'text', required: true },
    { id: 'clientEmail', label: 'Secure Email', type: 'email', required: false },
    { id: 'phoneClarity', label: 'Call Audio/Visual Clarity', type: 'rating', required: true, min: 1, max: 5 },
    { id: 'phoneResponsiveness', label: 'Phone Responsiveness', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'phoneHelpfulness', label: 'Phone Helpfulness', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'assessmentConvenience', label: 'Assessment Convenience', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'assessmentCommunication', label: 'Assessment Communication', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'assessmentConnection', label: 'Assessment Connection', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'groupConvenience', label: 'Group Convenience', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'groupParticipation', label: 'Group Participation', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'groupHelpfulness', label: 'Group Logic Effectiveness', type: 'rating', required: true, min: 1, max: 5 },
    { id: 'groupTechnology', label: 'Telehealth Node Stability', type: 'rating', required: true, min: 1, max: 5 },
    { id: 'oneOnOneConvenience', label: 'One On One Convenience', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'oneOnOneConnection', label: 'One On One Connection', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'oneOnOneListening', label: 'Therapist Neural Tuning (Listening)', type: 'rating', required: true, min: 1, max: 5 },
    { id: 'oneOnOneHelpfulness', label: 'One On One Helpfulness', type: 'rating', required: false, min: 1, max: 5 },
    { id: 'feltRespected', label: 'Did you feel clinical respect throughout the process?', type: 'boolean', required: true },
    { id: 'wouldRecommend', label: 'Would you authorize a recommendation for this node?', type: 'boolean', required: true },
    { id: 'likelyToRefer', label: 'Likely To Refer', type: 'boolean', required: false },
    { id: 'referralExplanation', label: 'Referral Explanation', type: 'textarea', required: false },
    { id: 'additionalComments', label: 'Signal Analysis (Comments)', type: 'textarea', required: false }
  ]
};
