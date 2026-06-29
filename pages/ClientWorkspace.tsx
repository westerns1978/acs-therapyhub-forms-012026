import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getClient, getDocumentFilesForClient, getFormSubmissions, getSROPData, getClientActivityFeed, generateRelapseRiskPrediction, getLastAppointment, getNextAppointment } from '../services/api';
import { Client, DocumentFile, FormSubmission, SROPProgress, ClientActivity, Appointment, isStaffRole } from '../types';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ClientSelectionGrid from '../components/clients/ClientSelectionGrid';
import ClientProfileHeader from '../components/clients/ClientProfileHeader';
import ClientDocumentsGrid from '../components/clients/ClientDocumentsGrid';
import ClientOverviewTab from '../components/clients/ClientOverviewTab';
import ClientFormsTab from '../components/clients/ClientFormsTab';
import TreatmentPlanTab from '../components/clients/TreatmentPlanTab';
import ClientSessionsTab from '../components/clients/ClientSessionsTab';
import StaffDocumentUpload from '../components/documents/StaffDocumentUpload';
import Card from '../components/ui/Card';
import { FileText, ClipboardList, Video, ShieldCheck, AlertTriangle, BrainCircuit, TrendingDown, TrendingUp, Zap, Upload, Target, Award, Archive, CreditCard, Gauge } from 'lucide-react';
import DispatcherChat from '../components/DispatcherChat';
import { supabase } from '../services/supabase';
import { TRIAL_HIDE_CLIENT_SCHEDULING_TAB } from '../config/trialMode';
import { useAuth } from '../contexts/AuthContext';
import { useClara } from '../contexts/ClaraContext';
import { assessClient, fetchCompletionSignoff, fetchClientAccrual, fetchClientDetermination, fetchClientSignedForms, fetchClientProgramCardState, fetchClientPlan, type AccruedHours, type ProgramCardState } from '../services/complianceEngine';
import type { SatopLevel } from '../config/satopFees';
import { REQUIRED_FORMS_BY_LEVEL } from '../config/formRegistry';
import { normalizeProgram } from '../config/programVocab';
import { buildClientSummaryPrompt } from '../services/claraPrompts';
import { composeProgress } from '../services/displayProgress';
import { composePacketReadiness } from '../services/packetReadiness';
import { downloadClientRecordPacket } from '../services/pdfDocuments';
import DocumentPreviewModal, { PreviewKind } from '../components/clients/DocumentPreviewModal';
import BillingLedger from '../components/billing/BillingLedger';
import AssessmentTab from '../components/clients/AssessmentTab';

const CLINICAL_ROLES: ReadonlyArray<string> = ['Director', 'Therapist'];

// Seeded relapse-risk predictions for the demo clients. Until we have real
// telemetry to feed the model, surfacing realistic content beats a "0% — no
// data" empty state. Lookup falls back to live Gemini for any other client.
const SEEDED_RISK: Record<string, { score: number; reasoning: string } | null> = {
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': {
        score: 21,
        reasoning: 'Moderate risk based on early-program trajectory. Self-reported one near-miss incident May 7 — declined the drink and called sponsor. Compliance score trending positive at 92%. Sober date holding at 167 days.',
    },
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb': null, // Pat — show "insufficient data" state
    'ffffffff-ffff-ffff-ffff-ffffffffffff': {
        score: 15,
        reasoning: 'First 3 weeks complete with strong engagement. Working mother with stable employment and child custody motivation factors. Self-reported zero relapse incidents. Continued vigilance recommended.',
    },
    'dddddddd-dddd-dddd-dddd-dddddddddddd': {
        score: 12,
        reasoning: 'Week 9 of 12 with strong family support system. MAT compliance excellent. Pain management strategy stable. Low-risk profile based on age, motivation, and support network.',
    },
};

// HIDDEN (2026-06-05): the relapse predictor renders an LLM-shaped risk score on a clinical
// SUD record — including a fabricated default when no telemetry exists — which violates the
// narrate-only rule and is a liability/credibility risk. The card render is gated off below.
// The component AND the client_risk_profiles table are intentionally kept (not deleted)
// pending the remove-vs-rebuild-narrate-only decision (see PRODUCT_BACKLOG.md).
const SHOW_RELAPSE_RISK_CARD = false;

const RelapseRiskCard: React.FC<{ client: Client, history: any[] }> = ({ client, history }) => {
    const seeded = client.id in SEEDED_RISK ? SEEDED_RISK[client.id] : undefined;
    const [prediction, setPrediction] = useState<{ score: number, reasoning: string } | null>(seeded ?? null);
    const [loading, setLoading] = useState(seeded === undefined);
    const [failed, setFailed] = useState(false);
    const noData = seeded === null;

    useEffect(() => {
        // If this client has a seeded value (Marcus or Pat), don't call Gemini.
        if (client.id in SEEDED_RISK) {
            const s = SEEDED_RISK[client.id];
            setPrediction(s);
            setLoading(false);
            return;
        }
        let cancelled = false;
        const fetchPrediction = async () => {
            setLoading(true);
            setFailed(false);
            try {
                const res = await generateRelapseRiskPrediction(client, history || []);
                if (cancelled) return;
                // The real call can fail or return nothing — never render a
                // fabricated 0% in that case; surface the "unavailable" state.
                if (res) setPrediction(res);
                else { setPrediction(null); setFailed(true); }
            } catch (e) {
                if (!cancelled) { setPrediction(null); setFailed(true); }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchPrediction();
        return () => { cancelled = true; };
    }, [client.id]);

    const getScoreColor = (score: number) => {
        if (score < 30) return 'text-green-500';
        if (score < 60) return 'text-yellow-500';
        return 'text-red-500';
    };

    return (
        <Card title="AI Relapse Risk Prediction" className="border-l-4 border-indigo-500 bg-gradient-to-br from-indigo-50/20 to-transparent dark:from-indigo-900/10">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-6 text-indigo-400">
                    <BrainCircuit className="animate-spin mb-2" size={32} />
                    <p className="text-xs font-bold uppercase tracking-widest">Checking risk indicators...</p>
                </div>
            ) : (noData || failed) ? (
                <div className="space-y-3">
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Predicted Risk Probability</p>
                            <p className="text-4xl font-extrabold text-slate-400">—</p>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-100 text-slate-500">
                            <BrainCircuit size={20} />
                        </div>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-indigo-100 dark:border-indigo-900/50 shadow-inner">
                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed italic">
                            {failed
                                ? 'Risk prediction is temporarily unavailable — the model did not return a result. Please retry shortly.'
                                : 'Insufficient program data — new client. Predictions become available after the first two weeks of attendance and self-report logs.'}
                        </p>
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase text-center">Engine: Gemini 3 Pro Deep Reasoning • Thinking Budget: 4k Tokens</p>
                </div>
            ) : prediction ? (
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Predicted Risk Probability</p>
                            <p className={`text-4xl font-extrabold ${getScoreColor(prediction.score)}`}>{prediction.score}%</p>
                        </div>
                        <div className={`p-2 rounded-lg bg-opacity-10 ${prediction.score > 50 ? 'bg-red-500 text-red-600' : 'bg-green-500 text-green-600'}`}>
                            {prediction.score > 50 ? <TrendingUp size={24}/> : <TrendingDown size={24}/>}
                        </div>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-indigo-100 dark:border-indigo-900/50 shadow-inner">
                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed italic">
                            "{prediction.reasoning}"
                        </p>
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase text-center">Engine: Gemini 3 Pro Deep Reasoning • Thinking Budget: 4k Tokens</p>
                </div>
            ) : null}
        </Card>
    );
};

const ClientWorkspace: React.FC = () => {
    const { clientId } = useParams<{ clientId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const clara = useClara();
    const canSeeClinical = !!user && CLINICAL_ROLES.includes(user.role);
    // Billing is an operational surface: all staff (Director/Therapist/Admin), mirroring
    // payments/charges RLS (private.is_staff()). isStaffRole() is exactly is_staff()'s set,
    // so the UI gate and the RLS gate match; a Client never sees the Billing tab.
    const canRecordPayment = !!user && isStaffRole(user.role);
    // Assessment (placement engine) is a staff surface — all three staff roles
    // (is_staff), matching the assessment_inputs RLS. A Client never sees it.
    const canAssess = !!user && isStaffRole(user.role);
    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    
    const [documents, setDocuments] = useState<DocumentFile[]>([]);
    const [formSubmissions, setFormSubmissions] = useState<FormSubmission[]>([]);
    const [sropData, setSropData] = useState<SROPProgress | null>(null);
    const [activityFeed, setActivityFeed] = useState<ClientActivity[]>([]);
    const [loadErrors, setLoadErrors] = useState<Record<string, boolean>>({});

    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isCompiling, setIsCompiling] = useState(false);
    // Completion sign-off is a separate clinical_notes event (note_type=
    // 'completion_signoff'); it's one of the three real certificate gates.
    const [completionSignedOff, setCompletionSignedOff] = useState(false);
    // WS3: categorized accrued hours (derived from Completed appointments) — the gate's hours source.
    const [clientAccrual, setClientAccrual] = useState<AccruedHours | undefined>(undefined);
    // WS4: the current signed determination level — the gate's level source (+ the header badge).
    const [clientDeterminedLevel, setClientDeterminedLevel] = useState<SatopLevel | null>(null);
    // WS5: ids of the client's completed/reviewed forms — the required-forms gate input.
    const [clientSignedForms, setClientSignedForms] = useState<Set<string> | null>(null);
    // Program-aware: timeline-program (non-SATOP) compliance state — null for SATOP (which keeps
    // its hours-% path). Fetched ONCE here and fed to the header (the overview now renders the
    // full Packet Readiness checklist instead of this collapsed card state).
    const [clientTimelineState, setClientTimelineState] = useState<ProgramCardState | null>(null);
    // Treatment-plan execution anchor (latest plan's created_at) — the facts input the
    // timeline rules (plan-review cadence) evaluate against. Without it, assessClient
    // reads "no plan on file" even when a plan exists.
    const [clientPlanDate, setClientPlanDate] = useState<string | null>(null);
    // Booking glance: most-recent past + next upcoming appointment for the header line.
    const [lastBooked, setLastBooked] = useState<Appointment | null>(null);
    const [nextBooked, setNextBooked] = useState<Appointment | null>(null);
    const [preview, setPreview] = useState<PreviewKind | null>(null);

    const loadClientData = useCallback(async (id: string) => {
        setIsLoading(true);
        setLoadErrors({});
        try {
            const clientData = await getClient(id);
            if (clientData) {
                setClient(clientData);
                // Sessions tab now loads its own real data (ClientSessionsTab);
                // getSessionRecords (mock dbSessionRecords) is no longer fetched here.
                const results = await Promise.allSettled([
                    getDocumentFilesForClient(id),
                    getFormSubmissions({ clientId: id }),
                    getSROPData(id),
                    getClientActivityFeed(id),
                    fetchCompletionSignoff(id),
                    fetchClientAccrual(id),
                    fetchClientDetermination(id),
                    fetchClientSignedForms(id),
                    fetchClientProgramCardState(id),
                    fetchClientPlan(id),
                    getLastAppointment(id),
                    getNextAppointment(id),
                ]);

                if (results[0].status === 'fulfilled') setDocuments(results[0].value as DocumentFile[] || []);
                else setLoadErrors(prev => ({...prev, documents: true}));
                if (results[1].status === 'fulfilled') setFormSubmissions(results[1].value as FormSubmission[] || []);
                else setLoadErrors(prev => ({...prev, forms: true}));
                if (results[2].status === 'fulfilled') setSropData(results[2].value as SROPProgress || null);
                else setLoadErrors(prev => ({...prev, srop: true}));
                if (results[3].status === 'fulfilled') setActivityFeed(results[3].value as ClientActivity[] || []);
                else setLoadErrors(prev => ({...prev, activity: true}));
                setCompletionSignedOff(results[4].status === 'fulfilled' ? !!results[4].value : false);
                setClientAccrual(results[5].status === 'fulfilled' ? (results[5].value as AccruedHours) : undefined);
                setClientDeterminedLevel(results[6].status === 'fulfilled' ? (results[6].value as SatopLevel | null) : null);
                setClientSignedForms(results[7].status === 'fulfilled' ? (results[7].value as Set<string>) : null);
                setClientTimelineState(results[8].status === 'fulfilled' ? (results[8].value as ProgramCardState | null) : null);
                setClientPlanDate(results[9].status === 'fulfilled' ? (results[9].value as string | null) : null);
                setLastBooked(results[10].status === 'fulfilled' ? (results[10].value as Appointment | null) : null);
                setNextBooked(results[11].status === 'fulfilled' ? (results[11].value as Appointment | null) : null);
            } else {
                setClient(null);
                navigate('/clients');
            }
        } catch (error) {
            console.error("Critical failure loading client", error);
            setClient(null);
        } finally {
            setIsLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        if (clientId) loadClientData(clientId);
        else setIsLoading(false);
    }, [clientId, loadClientData]);

    // Refresh after an edit lands so the workspace shows the updated values
    // without a manual reload. EditClientModal dispatches this from MainLayout.
    useEffect(() => {
        const handler = (e: any) => {
            const updatedId = e?.detail?.client?.id;
            if (updatedId && updatedId === clientId) loadClientData(clientId);
        };
        window.addEventListener('client-updated', handler);
        return () => window.removeEventListener('client-updated', handler);
    }, [clientId, loadClientData]);

    const handleFormAssigned = () => { if(clientId) loadClientData(clientId); }

    if (!clientId) return <ClientSelectionGrid />;
    if (isLoading) return <LoadingSpinner />;
    if (!client) return <div className="text-center p-8">Client not found.</div>;

    // Deterministic compliance assessment for this client. The engine — not the
    // UI — decides whether the completion certificate may be generated. Sign-off
    // (a separate clinical_notes event) is injected as one of the three gates.
    const assessment = assessClient(client, { completionSignedOff, accrual: clientAccrual, determinedLevel: clientDeterminedLevel, signedFormIds: clientSignedForms, planExecutionDate: clientPlanDate });

    // WS-DisplayTruth: compose program progress ONCE from the gate's own level + accrual
    // (already fetched above) and feed BOTH the header and the overview — single source,
    // no extra fetch, never the neutralized client.completionPercentage.
    const clientProgress = composeProgress(clientDeterminedLevel, clientAccrual);

    // Contextual Clara — the one high-value, one-tap action: open Clara and seed a summary
    // built ONLY from the facts already on this page (services/claraPrompts). She phrases
    // real data; she invents nothing. No new query, no auto-open. Clinical staff only.
    const summarizeWithClara = () => {
        const norm = normalizeProgram(client.program);
        const programLabel = clientDeterminedLevel ? `SATOP Level ${clientDeterminedLevel}` : norm.canonical;
        const requiredFormsCount = clientDeterminedLevel
            ? (REQUIRED_FORMS_BY_LEVEL[clientDeterminedLevel]?.length ?? null)
            : null;
        clara.open();
        void clara.sendText(buildClientSummaryPrompt({
            staffFirstName: (user?.name || '').split(' ')[0] || 'there',
            name: client.name,
            programLabel,
            lifecycle: client.status,
            established: clientProgress.established,
            completedTotal: clientProgress.completedTotal,
            requiredTotal: clientProgress.requiredTotal,
            progressPct: clientProgress.progressPct,
            isSrop: clientProgress.isSrop,
            counselingCompleted: clientProgress.counselingCompleted,
            counselingRequired: clientProgress.counselingRequired,
            signedFormsCount: clientSignedForms ? clientSignedForms.size : null,
            requiredFormsCount,
            outstandingBalance: assessment.facts.outstandingBalance,
            timelineReview: clientTimelineState ? clientTimelineState.label : null,
        }));
    };

    // Build 1 — Packet Readiness: the per-client checklist model, composed from the SAME
    // assessment/gate inputs above (pure adapter, no extra fetch). Fed to the overview tab.
    const packetReadiness = composePacketReadiness({
        program: assessment.facts.program,
        completion: assessment.completion,
        verdicts: assessment.verdicts,
        determinedLevel: clientDeterminedLevel,
        signedFormIds: clientSignedForms,
        planExecutionDate: clientPlanDate,
    });

    const tabs = [
        { id: 'overview', label: 'Overview', icon: ShieldCheck },
        { id: 'documents', label: 'Documents', icon: FileText },
        { id: 'forms', label: 'Forms', icon: ClipboardList },
        { id: 'sessions', label: 'Sessions', icon: Video },
        // Assessment (placement engine) — all staff (is_staff), mirrors assessment_inputs RLS.
        ...(canAssess ? [{ id: 'assessment', label: 'Assessment', icon: Gauge }] : []),
        // Billing is a staff surface — all staff (is_staff: Director/Therapist/Admin), mirrors the
        // wsrp_2 payments/charges RLS. A Client never sees it.
        ...(canRecordPayment ? [{ id: 'billing', label: 'Billing', icon: CreditCard }] : []),
        // Treatment Plan is clinical surface — hidden from Admin (Jess).
        ...(canSeeClinical ? [{ id: 'treatment-plan', label: 'Treatment Plan', icon: Target }] : []),
        ...(TRIAL_HIDE_CLIENT_SCHEDULING_TAB ? [] : [{ id: 'scheduling', label: 'Scheduling', icon: Zap }]),
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'treatment-plan':
                // Defensive: same role guard as the tab strip, in case activeTab
                // somehow lands here (no URL drives it today, but persisted state
                // could). Falls through to overview when the role isn't allowed.
                if (!canSeeClinical) return null;
                return <TreatmentPlanTab client={client} />;
            case 'scheduling':
                // Defensive: even if activeTab somehow gets set to 'scheduling' (no
                // URL path drives it today, but persisted state could), fall through
                // to the overview while the trial flag is on.
                if (TRIAL_HIDE_CLIENT_SCHEDULING_TAB) return null;
                return <DispatcherChat clientId={client.id} clientName={client.name} supabase={supabase as any} onAppointmentChanged={() => loadClientData(clientId)} />;
            case 'documents':
                if (loadErrors.documents) return <ErrorFallback message="Failed to load documents." onRetry={() => loadClientData(clientId)} />;
                return <ClientDocumentsGrid client={client} initialDocuments={documents || []} onDocumentsChanged={() => loadClientData(clientId)} />;
            case 'forms': 
                if (loadErrors.forms) return <ErrorFallback message="Failed to load forms." onRetry={() => loadClientData(clientId)} />;
                return <ClientFormsTab client={client} formSubmissions={formSubmissions || []} onFormAssigned={handleFormAssigned}/>;
            case 'sessions':
                return <ClientSessionsTab client={client} />;
            case 'assessment':
                // Defensive: same gate as the tab strip (persisted activeTab could land here).
                if (!canAssess) return null;
                return <AssessmentTab client={client} />;
            case 'billing':
                // Defensive: same gate as the tab strip (persisted activeTab could land here).
                if (!canRecordPayment) return null;
                return <BillingLedger clientId={client.id} canRecord showSummary />;
            case 'overview': 
            default: 
                return SHOW_RELAPSE_RISK_CARD ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                             <ClientOverviewTab client={client} sropData={sropData} activityFeed={activityFeed || []} progress={clientProgress} readiness={packetReadiness} />
                        </div>
                        <div className="lg:col-span-1">
                             <RelapseRiskCard client={client} history={activityFeed || []} />
                        </div>
                    </div>
                ) : (
                    <ClientOverviewTab client={client} sropData={sropData} activityFeed={activityFeed || []} progress={clientProgress} readiness={packetReadiness} />
                );
        }
    };

    return (
        <div className="animate-fade-in-up space-y-6">
            <ClientProfileHeader client={client} determinedLevel={clientDeterminedLevel} progress={clientProgress} timelineState={clientTimelineState} lastBooked={lastBooked} nextBooked={nextBooked} onAskClara={canSeeClinical ? summarizeWithClara : undefined} />

            <div className="flex items-center justify-between border-b border-border dark:border-dark-border gap-3 flex-wrap">
                <nav className="flex -mb-px space-x-8 overflow-x-auto">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-1 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                            <tab.icon size={18} /> {tab.label.toUpperCase()}
                        </button>
                    ))}
                </nav>
                <div className="my-2 flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setPreview('status')}
                        title="Preview the compliance status report, then create the PDF"
                        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-border dark:border-dark-border text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-widest rounded-2xl shadow-sm transition-all hover:scale-[1.02] active:scale-95"
                    >
                        <FileText size={14} /> Status Report
                    </button>
                    <button
                        onClick={() => setPreview('certificate')}
                        title={assessment.completion.eligible
                            ? 'Preview the SATOP completion certificate, then create the PDF'
                            : `Preview the completion gates — ${assessment.completion.unmetReasons[0] || 'criteria not yet met'}`}
                        className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-widest rounded-2xl shadow-sm transition-all hover:scale-[1.02] active:scale-95 ${assessment.completion.eligible
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-border dark:border-dark-border hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                    >
                        <Award size={14} /> Completion Certificate
                    </button>
                    <button
                        onClick={async () => {
                            if (isCompiling) return;
                            setIsCompiling(true);
                            try {
                                await downloadClientRecordPacket(client, assessment.verdicts, assessment.completion, documents, clientProgress);
                            } catch (e) {
                                alert('Could not compile the record packet: ' + (e as Error).message);
                            } finally {
                                setIsCompiling(false);
                            }
                        }}
                        disabled={isCompiling}
                        title="Compile a downloadable record packet (ZIP): summary, completion certificate if eligible, and the client's documents by category"
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-widest rounded-2xl shadow-sm transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                    >
                        <Archive size={14} /> {isCompiling ? 'Compiling…' : 'Record Packet'}
                    </button>
                    <button
                        onClick={() => setIsUploadOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-focus text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                    >
                        <Upload size={14} /> Upload Document
                    </button>
                </div>
            </div>
            <div>{renderTabContent()}</div>

            {preview && (
                <DocumentPreviewModal
                    isOpen={!!preview}
                    onClose={() => setPreview(null)}
                    kind={preview}
                    client={client}
                    verdicts={assessment.verdicts}
                    completion={assessment.completion}
                    progress={clientProgress}
                />
            )}

            <StaffDocumentUpload
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                onComplete={() => clientId && loadClientData(clientId)}
                presetClientId={client.id}
                presetClientName={client.name}
            />
        </div>
    );
};

const ErrorFallback = ({ message, onRetry }: { message: string, onRetry: () => void }) => (
    <div className="p-8 border border-red-200 bg-red-50 dark:bg-red-900/10 rounded-xl text-center">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-2" />
        <p className="text-red-700 font-medium mb-4">{message}</p>
        <button onClick={onRetry} className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 text-sm font-semibold">
            Retry Loading
        </button>
    </div>
);

export default ClientWorkspace;