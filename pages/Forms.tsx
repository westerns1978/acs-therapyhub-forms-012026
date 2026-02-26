
import React, { useState } from 'react';
import { FormLibrary, View } from '../components/FormLibrary';
import { BaseFormTemplate } from '../components/BaseFormTemplate';
import ClientSubmissionsPanel from '../components/reports/ClientSubmissionsPanel';

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
import { FileText, Inbox } from 'lucide-react';

type Tab = 'library' | 'submissions';

const Forms: React.FC = () => {
    const [currentView, setCurrentView] = useState<View>('library');
    const [activeTab, setActiveTab] = useState<Tab>('library');
    
    const handleBack = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setCurrentView('library');
    };

    // If viewing a specific form, show it fullscreen
    if (currentView !== 'library') {
        const renderForm = () => {
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
                default:
                    return <FormLibrary onSelectForm={setCurrentView} />;
            }
        };
        return <div className="animate-fade-in-up min-h-screen">{renderForm()}</div>;
    }

    return (
        <div className="animate-fade-in-up min-h-screen">
            {/* Tab Bar */}
            <div className="flex items-center gap-1 mb-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-1.5 border border-slate-100 dark:border-slate-800 shadow-sm w-fit">
                <button
                    onClick={() => setActiveTab('library')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                        activeTab === 'library'
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                    <FileText size={16} /> Form Templates
                </button>
                <button
                    onClick={() => setActiveTab('submissions')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                        activeTab === 'submissions'
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                    <Inbox size={16} /> Client Submissions
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'library' ? (
                <FormLibrary onSelectForm={setCurrentView} />
            ) : (
                <ClientSubmissionsPanel />
            )}
        </div>
    );
};

export default Forms;
