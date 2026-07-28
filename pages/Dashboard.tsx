import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import DashboardSkeleton from '../components/skeletons/DashboardSkeleton';
import { useAuth } from '../contexts/AuthContext';
import { useClara } from '../contexts/ClaraContext';
import { supabase } from '../services/supabase';
import { getAppointments, getClients, getRecentClientCommunications, getProspects, type ClientCommunication, type ProspectRow } from '../services/api';
import { fetchAlerts, summarizeAlerts, type AlertsSummary, type ClientAlert } from '../services/alertsService';
import { fetchComplianceGuardrails, type GuardrailVerdict } from '../services/complianceEngine';
import { buildGuardrailExplainPrompt, CLARA_AVATAR_URL } from '../services/claraPrompts';
import { Appointment } from '../types';
import { Video, Calendar, AlertTriangle, ArrowUpRight, ShieldCheck, MessageSquare, UserPlus, Sparkles, RefreshCw } from 'lucide-react';
import { maybeForceFail } from '../config/failureHarness';
import { plural, pluralNoun } from '../config/format';
import { programLabel } from '../config/programVocab';
import { formatTime12 } from '../config/time';

const greetingFor = (h: number) => (h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening');
// Raw verdict tokens ('violation') must never print — mapped labels only (2026-07-28).
const VERDICT_LABEL: Record<'warning' | 'violation', string> = { warning: 'Warning', violation: 'Violation' };

// Per-card visible error — Financials' SectionError pattern (fail-visibly, 2026-07-28).
// A failed card must never render its reassuring empty state ("No compliance flags." /
// "No new intakes.") — that told staff a queue was clear when nothing was read.
const SectionError: React.FC<{ msg: string; onRetry?: () => void }> = ({ msg, onRetry }) => (
    <div className="flex items-start gap-2 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-300 text-sm">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <span className="flex-1">{msg}</span>
        {onRetry && (
            <button onClick={onRetry} className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest hover:underline">
                <RefreshCw size={12} /> Retry
            </button>
        )}
    </div>
);

const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const clara = useClara();

    // One-tap contextual Clara: open the panel and seed a prompt built ONLY from the
    // verdict already on the card (services/claraPrompts). Clara phrases the real rule —
    // she invents nothing. stopPropagation keeps the row's navigate from also firing.
    const explainFlagWithClara = (g: GuardrailVerdict) => {
        clara.open();
        void clara.sendText(buildGuardrailExplainPrompt({
            staffFirstName: (user?.name || '').split(' ')[0] || 'there',
            clientName: g.clientName,
            program: g.program,
            status: g.status,
            headline: g.headline,
            detail: g.detail,
            citation: g.citation,
        }));
    };

    const role = user?.role;
    const isDirector = role === 'Director';
    const isTherapist = role === 'Therapist';
    const isAdmin = role === 'Admin';
    const isClinical = isDirector || isTherapist;
    // Financial staff (Director/Admin) triage the intake queue — and only they can
    // read payments (RLS), so the "fee paid?" badge is correct only for them.
    const isFinancial = isDirector || isAdmin;

    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [alerts, setAlerts] = useState<ClientAlert[]>([]);
    const [alertSummary, setAlertSummary] = useState<AlertsSummary>({ critical: 0, high: 0, elevated: 0, moderate: 0, total: 0 });
    // Deterministic compliance-engine verdicts (Missouri pack) for the Guardrails card.
    const [guardrails, setGuardrails] = useState<GuardrailVerdict[]>([]);
    const [recentComms, setRecentComms] = useState<ClientCommunication[]>([]);
    // Front-door intake queue (prospects) — financial staff only.
    const [prospects, setProspects] = useState<ProspectRow[]>([]);
    const [clientNames, setClientNames] = useState<Record<string, string>>({});
    // Director aggregate stats. null = query failed / not meaningful → render '—'.
    // Monthly Revenue is intentionally absent until subscription/billing is real
    // (payments is empty / not wired); it returns here once billing persists.
    const [metrics, setMetrics] = useState<{ activeClients: number | null }>({
        activeClients: null,
    });
    const [isLoading, setIsLoading] = useState(true);
    // Fail-visibly (2026-07-28): each fetch that fails flips its flag and the card
    // renders <SectionError> instead of its empty state. Empty must mean empty.
    const [loadErrors, setLoadErrors] = useState({ schedule: false, alerts: false, guardrails: false, comms: false, intake: false });
    const [reloadKey, setReloadKey] = useState(0);
    const retry = () => setReloadKey(k => k + 1);

    useEffect(() => {
        let cancelled = false;
        const fetchData = async () => {
            setIsLoading(true);
            const errs = { schedule: false, alerts: false, guardrails: false, comms: false, intake: false };
            try {
                // Today's schedule + client name map — real (appointments + clients tables).
                try {
                    maybeForceFail('dashboard schedule');
                    const [appts, clientList] = await Promise.all([getAppointments(new Date()), getClients()]);
                    if (cancelled) return;
                    setAppointments(appts);
                    const nameMap: Record<string, string> = {};
                    clientList.forEach(c => { nameMap[c.id] = c.name; });
                    setClientNames(nameMap);
                } catch (e) { console.warn('[dashboard] schedule failed:', e); errs.schedule = true; }

                // Compliance alerts — clinical only. Real, derived from the clients table.
                if (isClinical) {
                    try {
                        const a = await fetchAlerts();
                        if (!cancelled) { setAlerts(a); setAlertSummary(summarizeAlerts(a)); }
                    } catch (e) { console.warn('[dashboard] fetchAlerts failed:', e); errs.alerts = true; }
                    // Deterministic compliance verdicts (no AI) — drives the Guardrails card.
                    try {
                        const g = await fetchComplianceGuardrails();
                        if (!cancelled) setGuardrails(g);
                    } catch (e) { console.warn('[dashboard] compliance guardrails failed:', e); errs.guardrails = true; }
                }

                // Recent client messages — admin only. Real client_communications rows.
                if (isAdmin) {
                    try {
                        const c = await getRecentClientCommunications(6);
                        if (!cancelled) setRecentComms(c);
                    } catch (e) { console.warn('[dashboard] recent comms failed:', e); errs.comms = true; }
                }

                // Front-door intake queue — financial staff (Director/Admin). Real
                // prospect rows + their actually-cleared intake payments.
                if (isFinancial) {
                    try {
                        const p = await getProspects();
                        if (!cancelled) setProspects(p);
                    } catch (e) { console.warn('[dashboard] intake queue failed:', e); errs.intake = true; }
                }

                // Aggregate stats — director only. Real counts off the clients table.
                // supabase-js does NOT throw on query errors — check `error` explicitly,
                // and keep activeClients null (renders '—') when the count wasn't read.
                if (isDirector) {
                    try {
                        maybeForceFail('dashboard active-count');
                        const { count, error } = await supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active');
                        if (error) throw new Error(error.message);
                        if (!cancelled) setMetrics({ activeClients: count ?? 0 });
                    } catch (e) {
                        console.warn('[dashboard] metrics failed:', e);
                        if (!cancelled) setMetrics({ activeClients: null });
                    }
                }
            } finally {
                if (!cancelled) { setLoadErrors(errs); setIsLoading(false); }
            }
        };
        fetchData();
        return () => { cancelled = true; };
    }, [user, reloadKey]);

    if (isLoading) return <DashboardSkeleton />;

    // ---- Briefing line: composed from REAL counts only (rule-based templating).
    // No AI generates these numbers — a hallucinated count in a clinician's morning
    // is unacceptable. (geminiJSON could rephrase tone around the numbers, but the
    // numbers themselves stay deterministic.)
    const firstName = (user?.name || '').split(' ')[0] || 'there';
    const hello = `Good ${greetingFor(new Date().getHours())}, ${firstName}.`;
    const todayCount = appointments.length;
    const flaggedClients = new Set(alerts.map(a => a.clientId)).size;
    const schedPhrase = todayCount === 0
        ? 'No sessions are on today’s schedule'
        : `${plural(todayCount, 'session')} ${todayCount === 1 ? 'is' : 'are'} on today’s schedule`;

    // Fail-visibly: a count whose query failed is never spoken as zero. The line says
    // "unavailable" instead — same deterministic templating, no AI (see comment above).
    let briefingDetail: string;
    const schedLead = loadErrors.schedule ? 'Today’s schedule could not be loaded' : schedPhrase;
    if (isAdmin) {
        briefingDetail = loadErrors.comms
            ? `${schedLead}. Recent client messages are unavailable right now.`
            : recentComms.length === 0
                ? `${schedLead}, and there are no recent client messages.`
                : `${schedLead}, and ${plural(recentComms.length, 'recent client message')} ${recentComms.length === 1 ? 'is' : 'are'} waiting.`;
    } else if (isTherapist) {
        briefingDetail = loadErrors.alerts
            ? `${schedLead}. Alert data is unavailable right now.`
            : flaggedClients === 0
                ? `${schedLead}, and no clients are currently flagged.`
                : `${schedLead}, and ${plural(flaggedClients, 'client')} ${flaggedClients === 1 ? 'has' : 'have'} a compliance flag.`;
    } else {
        // Director (and any other staff fallback): practice-wide.
        const stats = metrics.activeClients != null ? `, and ${plural(metrics.activeClients, 'active client')}` : '';
        briefingDetail = loadErrors.alerts
            ? `${schedLead}. Alert data is unavailable right now${stats}.`
            : `${schedLead}, with ${plural(alertSummary.total, 'open alert')} across the caseload${stats}.`;
    }

    const ScheduleCard = (
        <Card title="Today's Schedule" subtitle={isAdmin ? 'Appointments on the books for today.' : 'Today’s clinical sessions.'}>
            {loadErrors.schedule ? (
                <SectionError msg="Today’s schedule could not be loaded — appointments may exist that aren’t shown here." onRetry={retry} />
            ) : (
            <div className="divide-y divide-hairline dark:divide-slate-800">
                {appointments.length > 0 ? appointments.map(apt => (
                    <button
                        key={apt.id}
                        onClick={() => isClinical
                            ? navigate(`/session/${apt.id}/green-room`)
                            : apt.clientId ? navigate(`/clients/${apt.clientId}`) : navigate('/session-management')}
                        className="w-full py-4 flex items-center justify-between group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 px-4 rounded-2xl transition-all text-left"
                    >
                        <div className="flex items-center gap-8">
                            <div className="text-center w-20">
                                <p className="text-lg font-bold text-slate-900 dark:text-white leading-none">{formatTime12(apt.startTime)}</p>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-1">{formatTime12(apt.endTime)}</p>
                            </div>
                            <div className="h-10 w-px bg-slate-200 dark:bg-slate-700"></div>
                            <div>
                                <h4 className="font-bold text-lg text-slate-800 dark:text-white group-hover:text-primary transition-colors">{apt.clientName || apt.title}</h4>
                                <div className="flex items-center gap-4 mt-1.5">
                                    <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-500">{apt.type}</span>
                                    {apt.modality?.includes('Zoom') && <span className="flex items-center gap-1.5 text-[10px] font-bold text-secondary"><Video size={12}/> Telehealth</span>}
                                </div>
                            </div>
                        </div>
                        <span className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-hairline dark:border-slate-700 text-slate-400 flex items-center justify-center group-hover:bg-primary group-hover:border-primary group-hover:text-white transition-all">
                            <ArrowUpRight size={16}/>
                        </span>
                    </button>
                )) : (
                    <div className="py-20 text-center text-slate-300">
                        <Calendar size={40} className="mx-auto mb-4 opacity-20" />
                        <p className="text-xs font-bold uppercase tracking-[0.3em]">No appointments scheduled for today.</p>
                    </div>
                )}
            </div>
            )}
        </Card>
    );

    // Advisory, not an alarm: calmer heading + neutral cards with a thin status accent (not a
    // wall of red/amber). Same content, same verdicts, same Clara explain action.
    const GuardrailsCard = (
        <Card noPadding>
            <div className="px-6 pt-5 pb-3 flex items-start justify-between gap-3">
                <div>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300 tracking-tight">
                        <ShieldCheck size={15} className="text-slate-400 shrink-0" /> Clinical Guardrails
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Advisory — deterministic Missouri checks (9 CSR).</p>
                </div>
                {guardrails.length > 0 && (
                    <span className="shrink-0 mt-0.5 text-[10px] font-bold tabular-nums text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-full">{guardrails.length}</span>
                )}
            </div>
            <div className="px-6 pb-6 space-y-2.5">
                {loadErrors.guardrails ? (
                    <SectionError msg="Guardrail checks could not be computed — this is a loading failure, not a clean result." onRetry={retry} />
                ) : guardrails.length > 0 ? guardrails.slice(0, 6).map(g => {
                    const isViolation = g.status === 'violation';
                    const accent = isViolation ? 'text-danger-500/90' : 'text-warning-500/90';
                    const bar = isViolation ? 'bg-danger-400/70' : 'bg-warning-400/70';
                    return (
                        <div
                            key={g.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => navigate(`/clients/${g.clientId}`)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/clients/${g.clientId}`); } }}
                            className="relative w-full text-left flex items-start gap-3 p-3.5 pl-4 border border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors cursor-pointer overflow-hidden"
                        >
                            <span className={`absolute left-0 top-0 bottom-0 w-1 ${bar}`}></span>
                            <AlertTriangle className={`shrink-0 mt-0.5 ${accent}`} size={15} />
                            <div className="min-w-0 flex-1">
                                <p className={`text-[10px] font-bold uppercase tracking-widest ${accent}`}>{VERDICT_LABEL[g.status]} · {g.clientName} · {programLabel(g.program)}</p>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">{g.headline}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{g.detail}</p>
                                <p className="text-[10px] font-mono text-slate-400 mt-1.5">{g.citation}</p>
                                {/* Contextual Clara — explains this exact flag, seeded only from the verdict. */}
                                <button
                                    onClick={e => { e.stopPropagation(); explainFlagWithClara(g); }}
                                    className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline"
                                >
                                    <img src={CLARA_AVATAR_URL} alt="" className="w-4 h-4 rounded-full object-cover" />
                                    Ask Clara to explain this flag
                                </button>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="text-center py-6 text-slate-400 text-xs font-bold uppercase tracking-widest">No compliance flags.</div>
                )}
            </div>
        </Card>
    );

    // Front-door intake queue — the "new intakes" surface (in-app, financial staff).
    // Click a prospect to open their workspace, where staff sign the placement
    // determination and then "Place & Activate" (the conversion gate lives there).
    const IntakeQueueCard = (
        <Card
            title={`Intake Queue${prospects.length ? ` · ${prospects.length}` : ''}`}
            subtitle="New self-serve intakes awaiting placement. Click to review and place."
        >
            <div className="space-y-2.5">
                {loadErrors.intake ? (
                    <SectionError msg="The intake queue could not be loaded — new intakes may be waiting that aren’t shown here." onRetry={retry} />
                ) : prospects.length > 0 ? prospects.map(p => (
                    <button
                        key={p.id}
                        onClick={() => navigate(`/clients/${p.id}`)}
                        className="relative w-full text-left flex items-start gap-3 p-3.5 pl-4 border border-hairline dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors cursor-pointer overflow-hidden"
                    >
                        {/* Neutral/maroon accent — this is a queue awaiting a decision, not a violation. */}
                        <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary/70"></span>
                        <UserPlus className="text-primary shrink-0 mt-0.5" size={18} />
                        <div className="min-w-0 flex-1">
                            <div className="flex justify-between items-baseline gap-2">
                                <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{p.name}</p>
                                <span className="text-[10px] font-mono text-slate-400 shrink-0">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ''}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {p.intakeInterest && (
                                    <span className="inline-flex items-center max-w-[60%] truncate text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300">
                                        {p.intakeInterest}
                                    </span>
                                )}
                                <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${p.intakeFeePaid ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                                    {p.intakeFeePaid ? <><ShieldCheck size={11} /> Intake fee paid</> : 'Fee pending'}
                                </span>
                            </div>
                        </div>
                    </button>
                )) : (
                    <div className="text-center py-6 text-slate-400 text-xs font-bold uppercase tracking-widest">No new intakes.</div>
                )}
            </div>
        </Card>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up">
            {/* Briefing line — inline text, no popup. Attributed to Clara (her voice,
                unprompted) with a subtle avatar + tag — never a banner, never auto-open. */}
            <div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">{hello}</h1>
                <div className="flex items-start gap-2.5 mt-3 max-w-3xl">
                    <img src={CLARA_AVATAR_URL} alt="Clara" className="w-6 h-6 rounded-full object-cover mt-0.5 ring-1 ring-primary/20 shrink-0" />
                    <div>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Clara</span>
                        <p className="text-base md:text-lg text-slate-500 dark:text-slate-400 leading-relaxed">{briefingDetail}</p>
                    </div>
                </div>
                {isClinical && alertSummary.total > 0 && (
                    <button
                        onClick={() => navigate('/risk-monitor')}
                        className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-danger-50 border border-danger-200 text-danger-700 hover:bg-danger-100 transition text-xs font-black uppercase tracking-widest"
                    >
                        <AlertTriangle size={14} /> Review {plural(alertSummary.total, 'alert')}
                    </button>
                )}
            </div>

            {/* Director-only stat strip — four compact, severity-tinted stat cards replacing the
                old plain inline line (kills the duplicate treatment). Alerts/Guardrails are
                clickable jump-offs; sessions/active-clients are quiet counts. Clara's prose above
                stays the narrative register — a number appearing once there and once here is fine.
                Monthly Revenue intentionally omitted (billing not wired). */}
            {isDirector && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Sessions today — neutral. '—' when the schedule query failed (never a fake 0). */}
                    <div className="rounded-2xl border border-hairline dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-800/40 px-4 py-3">
                        <div className="text-2xl font-black tabular-nums tracking-tight text-slate-800 dark:text-white leading-none">{loadErrors.schedule ? '—' : todayCount}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1.5">{loadErrors.schedule ? 'Sessions today' : `${pluralNoun(todayCount, 'session')} today`}</div>
                    </div>
                    {/* Open alerts — red, second entry point to the same honest place as the pill */}
                    <button
                        onClick={() => navigate('/risk-monitor')}
                        className="text-left rounded-2xl border border-danger-100 dark:border-danger-900/40 bg-danger-50/60 dark:bg-danger-900/10 px-4 py-3 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                    >
                        <div className="text-2xl font-black tabular-nums tracking-tight text-danger-600 leading-none">{loadErrors.alerts ? '—' : alertSummary.total}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1.5">{loadErrors.alerts ? 'Open alerts' : `Open ${pluralNoun(alertSummary.total, 'alert')}`}</div>
                    </button>
                    {/* Guardrail flags — amber, scrolls to the Guardrails card on this page */}
                    <button
                        onClick={() => document.getElementById('dashboard-guardrails')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className="text-left rounded-2xl border border-warning-100 dark:border-warning-900/40 bg-warning-50/60 dark:bg-warning-900/10 px-4 py-3 hover:bg-warning-50 dark:hover:bg-warning-900/20 transition-colors"
                    >
                        <div className="text-2xl font-black tabular-nums tracking-tight text-warning-600 leading-none">{loadErrors.guardrails ? '—' : guardrails.length}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1.5">{loadErrors.guardrails ? 'Guardrail flags' : `Guardrail ${pluralNoun(guardrails.length, 'flag')}`}</div>
                    </button>
                    {/* Active clients — neutral */}
                    <div className="rounded-2xl border border-hairline dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-800/40 px-4 py-3">
                        <div className="text-2xl font-black tabular-nums tracking-tight text-slate-800 dark:text-white leading-none">{metrics.activeClients === null ? '—' : metrics.activeClients}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1.5">{metrics.activeClients === null ? 'Active clients' : `Active ${pluralNoun(metrics.activeClients, 'client')}`}</div>
                    </div>
                </div>
            )}

            {/* YOUR DAY — role-filtered. */}
            {isAdmin ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">{ScheduleCard}</div>
                    <div className="lg:col-span-1 space-y-6">
                        <Card title="Quick Actions">
                            <button
                                onClick={() => window.dispatchEvent(new CustomEvent('open-create-client-modal'))}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary-focus transition shadow-lg shadow-primary/20"
                            >
                                <UserPlus size={16} /> New Client Intake
                            </button>
                            <button
                                onClick={() => navigate('/session-management')}
                                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
                            >
                                <Calendar size={16} /> Open Schedule
                            </button>
                        </Card>
                        {IntakeQueueCard}
                        <Card title="Recent Client Messages" subtitle="Most recent communications sent.">
                            <div className="space-y-3">
                                {loadErrors.comms ? (
                                    <SectionError msg="Recent messages could not be loaded." onRetry={retry} />
                                ) : recentComms.length > 0 ? recentComms.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => { if (m.clientId) navigate(`/clients/${m.clientId}`); }}
                                        disabled={!m.clientId}
                                        title={m.clientId ? 'Open client' : undefined}
                                        className="w-full text-left flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700 rounded-2xl enabled:hover:bg-slate-100 dark:enabled:hover:bg-slate-700/50 disabled:cursor-default transition-colors"
                                    >
                                        <MessageSquare className="text-primary shrink-0 mt-0.5" size={16} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex justify-between items-baseline gap-2">
                                                <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">{(m.clientId && clientNames[m.clientId]) || 'Client'}</p>
                                                <span className="text-[10px] text-slate-400 shrink-0">{new Date(m.sentAt).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{m.message}</p>
                                        </div>
                                    </button>
                                )) : (
                                    <div className="text-center py-6 text-slate-400 text-xs font-bold uppercase tracking-widest">No recent messages.</div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            ) : isTherapist ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">{ScheduleCard}</div>
                    <div className="lg:col-span-1">{GuardrailsCard}</div>
                </div>
            ) : (
                // Director (and staff fallback): practice-wide view + alerts.
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        {ScheduleCard}
                        {isFinancial && IntakeQueueCard}
                        <Card title="Risk Monitor" subtitle="Actionable alerts from real client activity.">
                            {loadErrors.alerts ? (
                                <SectionError msg="Alerts could not be computed — these tiles are unavailable, not zero." onRetry={retry} />
                            ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="p-4 rounded-2xl border border-danger-100 dark:border-danger-900/40 bg-danger-50/50 dark:bg-danger-900/10 shadow-card dark:shadow-card-dark">
                                    <div className="text-3xl font-black tracking-tighter text-danger-600">{alertSummary.critical}</div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Critical</div>
                                </div>
                                <div className="p-4 rounded-2xl border border-orange-100 dark:border-orange-900/40 bg-orange-50/50 dark:bg-orange-900/10 shadow-card dark:shadow-card-dark">
                                    <div className="text-3xl font-black tracking-tighter text-orange-600">{alertSummary.high}</div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">High</div>
                                </div>
                                <div className="p-4 rounded-2xl border border-warning-100 dark:border-warning-900/40 bg-warning-50/50 dark:bg-warning-900/10 shadow-card dark:shadow-card-dark">
                                    <div className="text-3xl font-black tracking-tighter text-warning-600">{alertSummary.elevated}</div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Elevated</div>
                                </div>
                                <div className="p-4 rounded-2xl border border-info-100 dark:border-info-900/40 bg-info-50/50 dark:bg-info-900/10 shadow-card dark:shadow-card-dark">
                                    <div className="text-3xl font-black tracking-tighter text-info-600">{alertSummary.moderate}</div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Moderate</div>
                                </div>
                            </div>
                            )}
                            <button
                                onClick={() => navigate('/risk-monitor')}
                                className="mt-4 w-full px-4 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition flex items-center justify-center gap-2"
                            >
                                {alertSummary.total > 0 ? `Review ${plural(alertSummary.total, 'alert')}` : 'Open Risk Monitor'}
                                <ArrowUpRight size={14} />
                            </button>
                        </Card>
                    </div>
                    <div id="dashboard-guardrails" className="lg:col-span-1 scroll-mt-6">{GuardrailsCard}</div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
