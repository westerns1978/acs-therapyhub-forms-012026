
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
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
import { HIPAA_ACK_DEFINITION } from '../components/forms/HipaaAckForm';
import { TELEHEALTH_CONSENT_DEFINITION } from '../components/forms/TelehealthConsentForm';
import { LATE_CANCELLATION_DEFINITION } from '../components/forms/LateCancellationForm';
import { FileText, Inbox } from 'lucide-react';

type Tab = 'library' | 'submissions';

const Forms: React.FC = () => {
    // Staff "fill on behalf of a client" context arrives via the URL:
    //   /forms?clientId=<uuid>&open=<form-id>
    // clientId is threaded into BaseFormTemplate so the submission lands on the
    // right chart (not the demo client). `open` deep-links straight to a form.
    const [searchParams] = useSearchParams();
    const clientId = searchParams.get('clientId') || undefined;
    const openParam = searchParams.get('open') as View | null;

    const [currentView, setCurrentView] = useState<View>(openParam ?? 'library');
    const [activeTab, setActiveTab] = useState<Tab>('library');
    const [clientName, setClientName] = useState<string | null>(null);

    // Honour ?open=<form-id> even when navigating /forms → /forms (the useState
    // initializer only runs on first mount, so a second "Fill out" deep-link
    // wouldn't switch forms without this). Only drives the view when `open`
    // changes — leaving the library via Back (which sets 'library') is preserved.
    useEffect(() => {
        if (openParam) setCurrentView(openParam);
    }, [openParam]);

    // Resolve the target client's name for the "Filling for …" banner so staff
    // can see at a glance which chart this form will be attached to.
    useEffect(() => {
        if (!clientId) { setClientName(null); return; }
        let cancelled = false;
        supabase.from('clients').select('name').eq('id', clientId).maybeSingle()
            .then(({ data }) => { if (!cancelled) setClientName((data as any)?.name ?? null); });
        return () => { cancelled = true; };
    }, [clientId]);

    const handleBack = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setCurrentView('library');
    };

    const fillingForBanner = clientId ? (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary">
            <span className="inline-block h-2 w-2 rounded-full bg-primary" />
            Filling out for <span className="font-black">{clientName ?? 'selected client'}</span>
            <span className="font-normal text-primary/70">— this form will be saved to their chart.</span>
        </div>
    ) : null;

    // If viewing a specific form, show it fullscreen
    if (currentView !== 'library') {
        const renderForm = () => {
            switch (currentView) {
                case 'satop-intake':
                    return <BaseFormTemplate formDefinition={SATOP_INTAKE_DEFINITION} onBackToLibrary={handleBack} clientId={clientId} />;
                case 'recovery-plan':
                    return <BaseFormTemplate formDefinition={RECOVERY_PLAN_DEFINITION} onBackToLibrary={handleBack} clientId={clientId} />;
                case 'consent-treatment':
                    return <BaseFormTemplate formDefinition={CONSENT_FORM_DEFINITION} onBackToLibrary={handleBack} clientId={clientId} />;
                case 'meeting-report':
                    return <BaseFormTemplate formDefinition={MEETING_REPORT_DEFINITION} onBackToLibrary={handleBack} clientId={clientId} />;
                case 'emergency-contact':
                    return <BaseFormTemplate formDefinition={EMERGENCY_CONTACT_DEFINITION} onBackToLibrary={handleBack} clientId={clientId} />;
                case 'discharge-summary':
                    return <BaseFormTemplate formDefinition={DISCHARGE_SUMMARY_DEFINITION} onBackToLibrary={handleBack} clientId={clientId} />;
                case 'telehealth-feedback':
                    return <BaseFormTemplate formDefinition={TELEHEALTH_FEEDBACK_DEFINITION} onBackToLibrary={handleBack} clientId={clientId} />;
                case 'satop-checklist':
                    return <BaseFormTemplate formDefinition={SATOP_CHECKLIST_DEFINITION} onBackToLibrary={handleBack} clientId={clientId} />;
                case 'authorization-release':
                    return <BaseFormTemplate formDefinition={AUTHORIZATION_RELEASE_DEFINITION} onBackToLibrary={handleBack} clientId={clientId} />;
                case 'chart-checklist':
                    return <BaseFormTemplate formDefinition={CHART_CHECKLIST_DEFINITION} onBackToLibrary={handleBack} clientId={clientId} />;
                case 'session-attendance':
                    return <BaseFormTemplate formDefinition={SESSION_ATTENDANCE_DEFINITION} onBackToLibrary={handleBack} clientId={clientId} />;
                case 'hipaa-ack':
                    return <BaseFormTemplate formDefinition={HIPAA_ACK_DEFINITION} onBackToLibrary={handleBack} clientId={clientId} />;
                case 'telehealth-consent':
                    return <BaseFormTemplate formDefinition={TELEHEALTH_CONSENT_DEFINITION} onBackToLibrary={handleBack} clientId={clientId} />;
                case 'late-cancellation':
                    return <BaseFormTemplate formDefinition={LATE_CANCELLATION_DEFINITION} onBackToLibrary={handleBack} clientId={clientId} />;
                default:
                    return <FormLibrary onSelectForm={setCurrentView} />;
            }
        };
        return (
            <div className="animate-fade-in-up min-h-screen">
                {fillingForBanner && <div className="max-w-4xl mx-auto px-4 sm:px-0 pt-4">{fillingForBanner}</div>}
                {renderForm()}
            </div>
        );
    }

    return (
        <div className="animate-fade-in-up min-h-screen">
            {fillingForBanner}
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
