import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PortalLayout from '../../layouts/PortalLayout';
import { BaseFormTemplate } from '../../components/BaseFormTemplate';
import { FormDefinition, FormCategory, FormField } from '../../types';
import { usePortalClient } from '../../hooks/usePortalClient';

// Define individual step components
const ConsentTreatmentStep: React.FC<any> = ({ formData, setFormData, errors }) => (
  <div className="space-y-6">
    <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Full Legal Name</label>
    <input
      type="text"
      id="full_name"
      value={formData.full_name}
      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
      className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
    />
    {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name}</p>}

    <label htmlFor="consent_date" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date of Consent</label>
    <input
      type="date"
      id="consent_date"
      value={formData.consent_date}
      onChange={(e) => setFormData({ ...formData, consent_date: e.target.value })}
      className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
    />
    {errors.consent_date && <p className="text-red-500 text-xs mt-1">{errors.consent_date}</p>}

    <label htmlFor="signature" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Electronic Signature</label>
    <input
      type="text"
      id="signature"
      value={formData.signature}
      onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
      className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
    />
    {errors.signature && <p className="text-red-500 text-xs mt-1">{errors.signature}</p>}
  </div>
);

const EmergencyContactStep: React.FC<any> = ({ formData, setFormData, errors }) => (
  <div className="space-y-6">
    <label htmlFor="contact_name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Contact Name</label>
    <input
      type="text"
      id="contact_name"
      value={formData.contact_name}
      onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
      className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
    />
    {errors.contact_name && <p className="text-red-500 text-xs mt-1">{errors.contact_name}</p>}

    <label htmlFor="relationship" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Relationship</label>
    <input
      type="text"
      id="relationship"
      value={formData.relationship}
      onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
      className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
    />
    {errors.relationship && <p className="text-red-500 text-xs mt-1">{errors.relationship}</p>}

    <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number</label>
    <input
      type="tel"
      id="phone"
      value={formData.phone}
      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
      className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
    />
    {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
  </div>
);

const RecoveryPlanStep: React.FC<any> = ({ formData, setFormData, errors }) => (
  <div className="space-y-6">
    <label htmlFor="primary_goal" className="block text-sm font-medium text-slate-700 dark:text-slate-300">What is your primary recovery goal?</label>
    <textarea
      id="primary_goal"
      value={formData.primary_goal}
      onChange={(e) => setFormData({ ...formData, primary_goal: e.target.value })}
      className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
    />
    {errors.primary_goal && <p className="text-red-500 text-xs mt-1">{errors.primary_goal}</p>}

    <label htmlFor="support_system" className="block text-sm font-medium text-slate-700 dark:text-slate-300">List your primary support contacts</label>
    <textarea
      id="support_system"
      value={formData.support_system}
      onChange={(e) => setFormData({ ...formData, support_system: e.target.value })}
      className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
    />
    {errors.support_system && <p className="text-red-500 text-xs mt-1">{errors.support_system}</p>}

    <label htmlFor="triggers" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Identify potential triggers</label>
    <textarea
      id="triggers"
      value={formData.triggers}
      onChange={(e) => setFormData({ ...formData, triggers: e.target.value })}
      className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
    />
    {errors.triggers && <p className="text-red-500 text-xs mt-1">{errors.triggers}</p>}
  </div>
);

const TelehealthFeedbackStep: React.FC<any> = ({ formData, setFormData, errors }) => (
  <div className="space-y-6">
    <label htmlFor="session_date" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date of Session</label>
    <input
      type="date"
      id="session_date"
      value={formData.session_date}
      onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
      className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
    />
    {errors.session_date && <p className="text-red-500 text-xs mt-1">{errors.session_date}</p>}

    <label htmlFor="rating" className="block text-sm font-medium text-slate-700 dark:text-slate-300">How would you rate the session? (1-5)</label>
    <input
      type="number"
      id="rating"
      value={formData.rating}
      onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value) })}
      min="1"
      max="5"
      className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
    />
    {errors.rating && <p className="text-red-500 text-xs mt-1">{errors.rating}</p>}

    <label htmlFor="comments" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Additional Comments</label>
    <textarea
      id="comments"
      value={formData.comments}
      onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
      className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
    />
    {errors.comments && <p className="text-red-500 text-xs mt-1">{errors.comments}</p>}
  </div>
);


const PortalFormPage: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const portalClient = usePortalClient();
  const navigate = useNavigate();

  if (!portalClient) return null;

  // Map formId to form configuration
  const getFormConfig = (id: string | undefined): FormDefinition<any> | null => {
    switch (id) {
      case 'consent-treatment':
        return {
          id: 'consent-treatment',
          title: 'Consent for Treatment',
          description: 'Please review and sign to authorize program participation.',
          category: 'Legal',
          initialState: { full_name: '', consent_date: '', signature: '' },
          fieldDefinitions: [
            { id: 'full_name', label: 'Full Legal Name', type: 'text', required: true },
            { id: 'consent_date', label: 'Date of Consent', type: 'date', required: true },
            { id: 'signature', label: 'Electronic Signature', type: 'text', required: true },
          ],
          validateStep: (currentData) => {
            const newErrors: any = {};
              if (!currentData.full_name) newErrors.full_name = 'Full Legal Name is required.';
              if (!currentData.consent_date) newErrors.consent_date = 'Date of Consent is required.';
              if (!currentData.signature) newErrors.signature = 'Electronic Signature is required.';
            return newErrors;
          },
        };
      case 'emergency-contact':
        return {
          id: 'emergency-contact',
          title: 'Emergency Contact Form',
          description: 'Provide contact information for emergency situations.',
          category: 'Intake',
          initialState: { contact_name: '', relationship: '', phone: '' },
          fieldDefinitions: [
            { id: 'contact_name', label: 'Contact Name', type: 'text', required: true },
            { id: 'relationship', label: 'Relationship', type: 'text', required: true },
            { id: 'phone', label: 'Phone Number', type: 'tel', required: true },
          ],
          validateStep: (currentData) => {
            const newErrors: any = {};
              if (!currentData.contact_name) newErrors.contact_name = 'Contact Name is required.';
              if (!currentData.relationship) newErrors.relationship = 'Relationship is required.';
              if (!currentData.phone) newErrors.phone = 'Phone Number is required.';
            return newErrors;
          },
        };
      case 'recovery-plan':
        return {
          id: 'recovery-plan',
          title: 'Continuing Recovery Plan',
          description: 'Outline your goals and support system for ongoing recovery.',
          category: 'Treatment',
          initialState: { primary_goal: '', support_system: '', triggers: '' },
          fieldDefinitions: [
            { id: 'primary_goal', label: 'What is your primary recovery goal?', type: 'textarea', required: true },
            { id: 'support_system', label: 'List your primary support contacts', type: 'textarea', required: true },
            { id: 'triggers', label: 'Identify potential triggers', type: 'textarea', required: true },
          ],
          validateStep: (currentData) => {
            const newErrors: any = {};
              if (!currentData.primary_goal) newErrors.primary_goal = 'Primary recovery goal is required.';
              if (!currentData.support_system) newErrors.support_system = 'Support system is required.';
              if (!currentData.triggers) newErrors.triggers = 'Potential triggers are required.';
            return newErrors;
          },
        };
      case 'telehealth-feedback':
        return {
          id: 'telehealth-feedback',
          title: 'Telehealth Session Feedback',
          description: 'Help us improve our virtual care experience.',
          category: 'Assessment',
          initialState: { session_date: '', rating: 0, comments: '' },
          fieldDefinitions: [
            { id: 'session_date', label: 'Date of Session', type: 'date', required: true },
            { id: 'rating', label: 'How would you rate the session? (1-5)', type: 'number', required: true, min: 1, max: 5 },
            { id: 'comments', label: 'Additional Comments', type: 'textarea', required: false },
          ],
          validateStep: (currentData) => {
            const newErrors: any = {};
              if (!currentData.session_date) newErrors.session_date = 'Session Date is required.';
              if (!currentData.rating || currentData.rating < 1 || currentData.rating > 5) newErrors.rating = 'Rating must be between 1 and 5.';
            return newErrors;
          },
        };
      default:
        return null;
    }
  };

  const config = getFormConfig(formId);

  if (!config) {
    return (
      <PortalLayout>
        <div className="text-center p-12">
          <h2 className="text-2xl font-bold">Form Not Found</h2>
          <button onClick={() => navigate('/portal/documents')} className="mt-4 text-primary font-bold">
            Back to Documents
          </button>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-3xl mx-auto">
        <BaseFormTemplate
          formDefinition={config}
          onBackToLibrary={() => navigate('/portal/documents')}
        />
      </div>
    </PortalLayout>
  );
};

export default PortalFormPage;
