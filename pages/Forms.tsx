
import React, { useState, useEffect } from 'react';
import { FormLibrary, View } from '../components/FormLibrary';
import { BaseFormTemplate } from '../components/BaseFormTemplate';

// Definitions
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

const Forms: React.FC = () => {
    const [currentView, setCurrentView] = useState<View>('library');
    
    const handleBack = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setCurrentView('library');
    };

    const renderView = () => {
        switch (currentView) {
            case 'satop-intake':
                return <BaseFormTemplate formDefinition={SATOP_INTAKE_DEFINITION} onBackToLibrary={handleBack} />;
            case 'recovery-plan':
                return <BaseFormTemplate formDefinition={RECOVERY_PLAN_DEFINITION} onBackToLibrary={handleBack} />;
            case 'consent-treatment':
                return <BaseFormTemplate formDefinition={CONSENT_FORM_DEFINITION} onBackToLibrary={handleBack} />;
            case 'meeting-report':
                return <BaseFormTemplate formDefinition={MEETING_REPORT_DEFINITION} onBackToLibrary={handleBack} />;
            case 'emergency-contact':
                return <BaseFormTemplate formDefinition={EMERGENCY_CONTACT_DEFINITION} onBackToLibrary={handleBack} />;
            case 'discharge-summary':
                return <BaseFormTemplate formDefinition={DISCHARGE_SUMMARY_DEFINITION} onBackToLibrary={handleBack} />;
            case 'telehealth-feedback':
                return <BaseFormTemplate formDefinition={TELEHEALTH_FEEDBACK_DEFINITION} onBackToLibrary={handleBack} />;
            case 'satop-checklist':
                return <BaseFormTemplate formDefinition={SATOP_CHECKLIST_DEFINITION} onBackToLibrary={handleBack} />;
            case 'authorization-release':
                return <BaseFormTemplate formDefinition={AUTHORIZATION_RELEASE_DEFINITION} onBackToLibrary={handleBack} />;
            case 'chart-checklist':
                return <BaseFormTemplate formDefinition={CHART_CHECKLIST_DEFINITION} onBackToLibrary={handleBack} />;
            case 'session-attendance':
                return <BaseFormTemplate formDefinition={SESSION_ATTENDANCE_DEFINITION} onBackToLibrary={handleBack} />;
            case 'library':
            default:
                return <FormLibrary onSelectForm={setCurrentView} />;
        }
    };

    return (
        <div className="animate-fade-in-up min-h-screen">
            {renderView()}
        </div>
    );
};

export default Forms;
