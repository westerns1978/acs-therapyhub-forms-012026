import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PortalLayout from '../../layouts/PortalLayout';
import { BaseFormTemplate } from '../../components/BaseFormTemplate';
import { FormDefinition } from '../../types';
import { usePortalClient } from '../../hooks/usePortalClient';

// Import the REAL form definitions (same ones staff uses)
import { CONSENT_FORM_DEFINITION } from '../../components/forms/ConsentForTreatmentForm';
import { EMERGENCY_CONTACT_DEFINITION } from '../../components/forms/EmergencyContactForm';
import { RECOVERY_PLAN_DEFINITION } from '../../components/forms/ContinuingRecoveryPlanForm';
import { TELEHEALTH_FEEDBACK_DEFINITION } from '../../components/forms/TelehealthFeedbackForm';
import { SATOP_INTAKE_DEFINITION } from '../../components/forms/SatopClientIntakeForm';
import { SATOP_CHECKLIST_DEFINITION } from '../../components/forms/SatopChecklistForm';
import { AUTHORIZATION_RELEASE_DEFINITION } from '../../components/forms/AuthorizationForReleaseForm';

const PortalFormPage: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const portalClient = usePortalClient();
  const navigate = useNavigate();

  if (!portalClient) return null;

  // Map formId to the real form definitions
  const formMap: Record<string, FormDefinition<any>> = {
    'consent-treatment': CONSENT_FORM_DEFINITION,
    'emergency-contact': EMERGENCY_CONTACT_DEFINITION,
    'recovery-plan': RECOVERY_PLAN_DEFINITION,
    'telehealth-feedback': TELEHEALTH_FEEDBACK_DEFINITION,
    'satop-intake': SATOP_INTAKE_DEFINITION,
    'satop-checklist': SATOP_CHECKLIST_DEFINITION,
    'authorization-release': AUTHORIZATION_RELEASE_DEFINITION,
  };

  const config = formId ? formMap[formId] : null;

  if (!config) {
    return (
      <PortalLayout>
        <div className="text-center p-12">
          <h2 className="text-2xl font-bold">Form Not Found</h2>
          <p className="text-slate-500 mt-2">The requested form could not be loaded.</p>
          <button onClick={() => navigate('/portal/documents')} className="mt-4 text-primary font-bold">
            Back to My Forms
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
