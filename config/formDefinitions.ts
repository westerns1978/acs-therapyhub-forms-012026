/**
 * form_id → FormDefinition — the ONE lookup for rendering a committed submission
 * (2026-07-28).
 *
 * Before this existed, every surface that displayed a submission invented its own
 * resolution: the client-record View modal looked the title up in the RETIRED
 * dbForms mock (miss → "undefined" → the ': <client>' leading-colon title) and
 * hardcoded two RecoveryPlan field keys as the body for EVERY form type — so any
 * other form rendered its section labels with no values under them.
 *
 * The definitions themselves live with their form components (the live-renderer
 * source of truth); this module only indexes them. FormLibrary derives its list
 * from this map so the pairing cannot drift (the #36 multiple-catalog hazard).
 */
import type { FormDefinition } from '../types';
import { SATOP_INTAKE_DEFINITION } from '../components/forms/SatopClientIntakeForm';
import { RECOVERY_PLAN_DEFINITION } from '../components/forms/ContinuingRecoveryPlanForm';
import { CONSENT_FORM_DEFINITION } from '../components/forms/ConsentForTreatmentForm';
import { MEETING_REPORT_DEFINITION } from '../components/forms/MeetingReportForm';
import { EMERGENCY_CONTACT_DEFINITION } from '../components/forms/EmergencyContactForm';
import { DISCHARGE_SUMMARY_DEFINITION } from '../components/forms/DischargeSummaryForm';
import { TELEHEALTH_FEEDBACK_DEFINITION } from '../components/forms/TelehealthFeedbackForm';
import { SATOP_CHECKLIST_DEFINITION } from '../components/forms/SatopChecklistForm';
import { AUTHORIZATION_RELEASE_DEFINITION } from '../components/forms/AuthorizationForReleaseForm';
import { CHART_CHECKLIST_DEFINITION } from '../components/forms/ChartChecklistForm';
import { SESSION_ATTENDANCE_DEFINITION } from '../components/forms/SessionAttendanceForm';
import { HIPAA_ACK_DEFINITION } from '../components/forms/HipaaAckForm';
import { TELEHEALTH_CONSENT_DEFINITION } from '../components/forms/TelehealthConsentForm';
import { LATE_CANCELLATION_DEFINITION } from '../components/forms/LateCancellationForm';
import { SATOP_REGISTRATION_DEFINITION } from '../components/forms/SatopRegistrationForm';
import { REGISTRATION_DEFINITION } from '../components/forms/RegistrationForm';

export const FORM_DEFINITION_BY_ID: Record<string, FormDefinition<any>> = {
  'satop-registration': SATOP_REGISTRATION_DEFINITION,
  'registration': REGISTRATION_DEFINITION,
  'satop-intake': SATOP_INTAKE_DEFINITION,
  'recovery-plan': RECOVERY_PLAN_DEFINITION,
  'consent-treatment': CONSENT_FORM_DEFINITION,
  'meeting-report': MEETING_REPORT_DEFINITION,
  'emergency-contact': EMERGENCY_CONTACT_DEFINITION,
  'discharge-summary': DISCHARGE_SUMMARY_DEFINITION,
  'telehealth-feedback': TELEHEALTH_FEEDBACK_DEFINITION,
  'satop-checklist': SATOP_CHECKLIST_DEFINITION,
  'authorization-release': AUTHORIZATION_RELEASE_DEFINITION,
  'chart-checklist': CHART_CHECKLIST_DEFINITION,
  'session-attendance': SESSION_ATTENDANCE_DEFINITION,
  'hipaa-ack': HIPAA_ACK_DEFINITION,
  'telehealth-consent': TELEHEALTH_CONSENT_DEFINITION,
  'late-cancellation': LATE_CANCELLATION_DEFINITION,
};

/** Resolve a definition for a stored submission: by form_id first, then by the
 *  stored display name matching a definition title (older rows carry only
 *  form_name). Null when nothing matches — callers fall back to key-based
 *  rendering, never to a mock catalog. */
export const definitionForSubmission = (
  formId?: string | null,
  formName?: string | null,
): FormDefinition<any> | null => {
  if (formId && FORM_DEFINITION_BY_ID[formId]) return FORM_DEFINITION_BY_ID[formId];
  if (formName) {
    const byTitle = Object.values(FORM_DEFINITION_BY_ID).find(d => d.title === formName);
    if (byTitle) return byTitle;
  }
  return null;
};

/** "<Form name> — <client>" with no orphan separator when either side is empty. */
export const submissionTitle = (
  formTitle?: string | null,
  clientName?: string | null,
): string => [formTitle, clientName].filter(Boolean).join(' — ') || 'Form submission';
