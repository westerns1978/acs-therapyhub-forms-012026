import React, { useMemo } from 'react';
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

  // Pre-fill PII from the portal client's record so they don't re-type
  // name/email/dob on every form (especially SATOP Intake + Checklist).
  // Only overrides empty fields — doesn't stomp user-entered values or drafts.
  const prefilledConfig = useMemo(() => {
    if (!config || !portalClient) return config;
    const pii: Record<string, any> = {
      clientName: portalClient.name || '',
      clientEmail: portalClient.email || '',
      clientPhone: portalClient.phone || '',
      dob: portalClient.dob || portalClient.date_of_birth || '',
      caseNumber: portalClient.caseNumber || portalClient.case_number || '',
    };
    const merged: Record<string, any> = { ...config.initialState };
    for (const [key, val] of Object.entries(pii)) {
      if (val && key in merged && !merged[key]) merged[key] = val;
    }
    return { ...config, initialState: merged as typeof config.initialState };
  }, [config, portalClient]);

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
          formDefinition={prefilledConfig || config}
          onBackToLibrary={() => navigate('/portal/documents')}
        />
      </div>
    </PortalLayout>
  );
};

export default PortalFormPage;
