import React from 'react';
import { FormDefinition, TelehealthFeedbackData, FormErrors, FormSectionProps } from '../../types';
import { FormField } from '../FormField';
import { RadioGroup } from '../RadioGroup';
import { StarRating } from '../StarRating';

const initialState: TelehealthFeedbackData = {
  clientName: '',
  clientEmail: '',
  phoneClarity: null,
  phoneResponsiveness: null,
  phoneHelpfulness: null,
  assessmentConvenience: null,
  assessmentCommunication: null,
  assessmentConnection: null,
  groupConvenience: null,
  groupParticipation: null,
  groupHelpfulness: null,
  groupTechnology: null,
  oneOnOneConvenience: null,
  oneOnOneConnection: null,
  oneOnOneListening: null,
  oneOnOneHelpfulness: null,
  feltRespected: null,
  wouldRecommend: null,
  likelyToRefer: null,
  referralExplanation: '',
  additionalComments: '',
};

const TelehealthFeedbackSection: React.FC<FormSectionProps<TelehealthFeedbackData>> = ({ formData, setFormData, errors }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRatingChange = (field: keyof TelehealthFeedbackData) => (value: number) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleBooleanChange = (field: keyof TelehealthFeedbackData) => (value: boolean) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Client Info */}
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Client Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <FormField id="clientName" label="Your Name" value={formData.clientName} onChange={handleChange} error={errors.clientName} />
          <FormField id="clientEmail" label="Email Address" type="email" value={formData.clientEmail} onChange={handleChange} error={errors.clientEmail} />
        </div>
      </div>

      {/* Phone/Telehealth Experience */}
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Phone/Telehealth Experience</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Rate your experience with our phone/telehealth services (1 = Poor, 5 = Excellent)</p>
        <StarRating id="phoneClarity" label="Audio clarity during calls" value={formData.phoneClarity} onChange={handleRatingChange('phoneClarity')} error={errors.phoneClarity} />
        <StarRating id="phoneResponsiveness" label="Staff responsiveness to calls" value={formData.phoneResponsiveness} onChange={handleRatingChange('phoneResponsiveness')} error={errors.phoneResponsiveness} />
        <StarRating id="phoneHelpfulness" label="Helpfulness of phone interactions" value={formData.phoneHelpfulness} onChange={handleRatingChange('phoneHelpfulness')} error={errors.phoneHelpfulness} />
      </div>

      {/* Assessment Experience */}
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Assessment Experience</h3>
        <StarRating id="assessmentConvenience" label="Convenience of telehealth assessment" value={formData.assessmentConvenience} onChange={handleRatingChange('assessmentConvenience')} error={errors.assessmentConvenience} />
        <StarRating id="assessmentCommunication" label="Clear communication during assessment" value={formData.assessmentCommunication} onChange={handleRatingChange('assessmentCommunication')} error={errors.assessmentCommunication} />
        <StarRating id="assessmentConnection" label="Feeling of connection with assessor" value={formData.assessmentConnection} onChange={handleRatingChange('assessmentConnection')} error={errors.assessmentConnection} />
      </div>

      {/* Group Session Experience */}
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Group Session Experience</h3>
        <StarRating id="groupConvenience" label="Convenience of telehealth groups" value={formData.groupConvenience} onChange={handleRatingChange('groupConvenience')} error={errors.groupConvenience} />
        <StarRating id="groupParticipation" label="Ability to participate in group" value={formData.groupParticipation} onChange={handleRatingChange('groupParticipation')} error={errors.groupParticipation} />
        <StarRating id="groupHelpfulness" label="Helpfulness of group content" value={formData.groupHelpfulness} onChange={handleRatingChange('groupHelpfulness')} error={errors.groupHelpfulness} />
        <StarRating id="groupTechnology" label="Ease of using technology" value={formData.groupTechnology} onChange={handleRatingChange('groupTechnology')} error={errors.groupTechnology} />
      </div>

      {/* One-on-One Session Experience */}
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Individual Session Experience</h3>
        <StarRating id="oneOnOneConvenience" label="Convenience of telehealth sessions" value={formData.oneOnOneConvenience} onChange={handleRatingChange('oneOnOneConvenience')} error={errors.oneOnOneConvenience} />
        <StarRating id="oneOnOneConnection" label="Connection with your counselor" value={formData.oneOnOneConnection} onChange={handleRatingChange('oneOnOneConnection')} error={errors.oneOnOneConnection} />
        <StarRating id="oneOnOneListening" label="Counselor listened to your concerns" value={formData.oneOnOneListening} onChange={handleRatingChange('oneOnOneListening')} error={errors.oneOnOneListening} />
        <StarRating id="oneOnOneHelpfulness" label="Helpfulness of individual sessions" value={formData.oneOnOneHelpfulness} onChange={handleRatingChange('oneOnOneHelpfulness')} error={errors.oneOnOneHelpfulness} />
      </div>

      {/* Overall Experience */}
      <div className="pb-6 border-b border-black/5 dark:border-white/5">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Overall Experience</h3>
        <RadioGroup id="feltRespected" label="Did you feel respected during your treatment?" value={formData.feltRespected} onChange={handleBooleanChange('feltRespected')} error={errors.feltRespected} />
        <RadioGroup id="wouldRecommend" label="Would you recommend ACS Therapy to others?" value={formData.wouldRecommend} onChange={handleBooleanChange('wouldRecommend')} error={errors.wouldRecommend} />
        <RadioGroup id="likelyToRefer" label="Are you likely to refer friends or family?" value={formData.likelyToRefer} onChange={handleBooleanChange('likelyToRefer')} error={errors.likelyToRefer} />

        {formData.likelyToRefer === false && (
          <FormField id="referralExplanation" label="Please help us understand why" type="textarea" value={formData.referralExplanation} onChange={handleChange} error={errors.referralExplanation} maxLength={500} required={false} />
        )}
      </div>

      {/* Additional Comments */}
      <div>
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-8">Additional Feedback</h3>
        <FormField id="additionalComments" label="Any additional comments or suggestions?" type="textarea" value={formData.additionalComments} onChange={handleChange} error={errors.additionalComments} maxLength={1000} required={false} />
      </div>
    </div>
  );
};

const validateStep = (step: number, data: TelehealthFeedbackData): FormErrors<TelehealthFeedbackData> => {
  const errors: FormErrors<TelehealthFeedbackData> = {};

  if (step === 1) {
    if (!data.clientName.trim()) errors.clientName = 'Your name is required';
    if (!data.clientEmail.trim()) errors.clientEmail = 'Email is required';
    if (data.clientEmail && !/\S+@\S+\.\S+/.test(data.clientEmail)) errors.clientEmail = 'Invalid email format';

    // At least some ratings should be filled
    const hasPhoneRatings = data.phoneClarity !== null || data.phoneResponsiveness !== null || data.phoneHelpfulness !== null;
    const hasGroupRatings = data.groupConvenience !== null || data.groupParticipation !== null;
    const hasIndividualRatings = data.oneOnOneConvenience !== null || data.oneOnOneConnection !== null;

    if (!hasPhoneRatings && !hasGroupRatings && !hasIndividualRatings) {
      errors.phoneClarity = 'Please provide at least some feedback ratings';
    }

    if (data.feltRespected === null) errors.feltRespected = 'Please answer this question';
    if (data.wouldRecommend === null) errors.wouldRecommend = 'Please answer this question';
  }

  return errors;
};

export const TELEHEALTH_FEEDBACK_DEFINITION: FormDefinition<TelehealthFeedbackData> = {
  id: 'telehealth-feedback',
  title: 'Telehealth Feedback Survey',
  description: 'Share your experience with our telehealth services including phone calls, assessments, group sessions, and individual counseling.',
  category: 'Assessment',
  tags: [],
  estimatedTime: '5-8 min',
  difficulty: 'Simple',
  successScreen: { googleReview: true },
  initialState,
  steps: [TelehealthFeedbackSection],
  validateStep,
  fieldDefinitions: [
    { key: 'phoneClarity', label: 'Phone Clarity', type: 'rating' },
    { key: 'phoneResponsiveness', label: 'Phone Responsiveness', type: 'rating' },
    { key: 'phoneHelpfulness', label: 'Phone Helpfulness', type: 'rating' },
    { key: 'assessmentConvenience', label: 'Assessment Convenience', type: 'rating' },
    { key: 'assessmentCommunication', label: 'Assessment Communication', type: 'rating' },
    { key: 'assessmentConnection', label: 'Assessment Connection', type: 'rating' },
    { key: 'groupConvenience', label: 'Group Convenience', type: 'rating' },
    { key: 'groupParticipation', label: 'Group Participation', type: 'rating' },
    { key: 'groupHelpfulness', label: 'Group Helpfulness', type: 'rating' },
    { key: 'groupTechnology', label: 'Group Technology', type: 'rating' },
    { key: 'oneOnOneConvenience', label: 'Individual Convenience', type: 'rating' },
    { key: 'oneOnOneConnection', label: 'Individual Connection', type: 'rating' },
    { key: 'oneOnOneListening', label: 'Counselor Listening', type: 'rating' },
    { key: 'oneOnOneHelpfulness', label: 'Individual Helpfulness', type: 'rating' },
    { key: 'feltRespected', label: 'Felt Respected', type: 'boolean' },
    { key: 'wouldRecommend', label: 'Would Recommend', type: 'boolean' },
    { key: 'likelyToRefer', label: 'Likely to Refer', type: 'boolean' },
    { key: 'referralExplanation', label: 'Referral Explanation' },
    { key: 'additionalComments', label: 'Additional Comments' },
  ]
};
