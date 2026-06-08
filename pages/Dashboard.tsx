import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import DashboardSkeleton from '../components/skeletons/DashboardSkeleton';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { getAppointments, getClients, getRecentClientCommunications, type ClientCommunication } from '../services/api';
import { fetchAlerts, summarizeAlerts, type AlertsSummary, type ClientAlert } from '../services/alertsService';
import { fetchComplianceGuardrails, type GuardrailVerdict } from '../services/complianceEngine';
import { Appointment } from '../types';
import { Video, Calendar, AlertTriangle, Activity, ArrowUpRight, ShieldCheck, MessageSquare, UserPlus } from 'lucide-react';

const greetingFor = (h: number) => (h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening');
const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

// Director-only aggregate stat tile. No delta — no historical baseline to compute one.
// Director-only aggregate stat tile. Shares the app card treatment (warm border +
// layered shadow + 16px radius). `trend` is optional and intentionally NOT fabricated —
// when there's no historical baseline we render nothing (no fake delta), but the slot is
// reserved in the icon row for when a real trend exists.
const StatCard: React.FC<{ title: string; value: string; icon: any; color: string; trend?: { dir: 'up' | 'down' | 'flat'; label: string } | null }> = ({ title, value, icon: Icon, color, trend }) => (
    <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-border dark:border-slate-700 shadow-card dark:shadow-card-dark">
        <div className="flex items-center justify-between min-h-[2.25rem]">
            <div className={`p-2.5 rounded-xl ${color} bg-opacity-10 text-${color.split('-')[1]}-600`}>
                <Icon size={18} />
            </div>
            {trend && (
                <span className={`text-[10px] font-black tabular-nums px-2 py-0.5 rounded-full ${trend.dir === 'up' ? 'text-emerald-600 bg-emerald-500/10' : trend.dir === 'down' ? 'text-primary bg-primary/10' : 'text-slate-400 bg-slate-400/10'}`}>{trend.label}</span>
            )}
        </div>
        <p className="mt-4 text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">{title}</p>
        <p className="mt-1 text-3xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums leading-none">{value}</p>
    </div>
);

const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const role = user?.role;
    const isDirector = role === 'Director';
    const isTherapist = role === 'Therapist';
    const isAdmin = role === 'Admin';
    const isClinical = isDirector || isTherapist;

    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [alerts, setAlerts] = useState<ClientAlert[]>([]);
    const [alertSummary, setAlertSummary] = useState<AlertsSummary>({ critical: 0, high: 0, elevated: 0, moderate: 0, total: 0 });
    // Deterministic compliance-engine verdicts (Missouri pack) for the Guardrails card.
    const [guardrails, setGuardrails] = useState<GuardrailVerdict[]>([]);
    const [recentComms, setRecentComms] = useState<ClientCommunication[]>([]);
    const [clientNames, setClientNames] = useState<Record<string, string>>({});
    // Director aggregate stats. null = query failed / not meaningful → render '—'.
    // Monthly Revenue is intentionally absent until subscription/billing is real
    // (payments is empty / not wired); it returns here once billing persists.
    const [metrics, setMetrics] = useState<{ complianceRate: number | null; activeClients: number | null }>({
        complianceRate: null,
        activeClients: null,
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Today's schedule + client name map — real (appointments + clients tables).
                const [appts, clientList] = await Promise.all([getAppointments(new Date()), getClients()]);
                if (cancelled) return;
                setAppointments(appts);
                const nameMap: Record<string, string> = {};
                clientList.forEach(c => { nameMap[c.id] = c.name; });
                setClientNames(nameMap);

                // Compliance alerts — clinical only. Real, derived from the clients table.
                if (isClinical) {
                    try {
                        const a = await fetchAlerts();
                        if (!cancelled) { setAlerts(a); setAlertSummary(summarizeAlerts(a)); }
                    } catch (e) { console.warn('[dashboard] fetchAlerts failed:', e); }
                    // Deterministic compliance verdicts (no AI) — drives the Guardrails card.
                    try {
                        const g = await fetchComplianceGuardrails();
                        if (!cancelled) setGuardrails(g);
                    } catch (e) { console.warn('[dashboard] compliance guardrails failed:', e); }
                }

                // Recent client messages — admin only. Real client_communications rows.
                if (isAdmin) {
                    try {
                        const c = await getRecentClientCommunications(6);
                        if (!cancelled) setRecentComms(c);
                    } catch (e) { console.warn('[dashboard] recent comms failed:', e); }
                }

                // Aggregate stats — director only. Real counts off the clients table.
                if (isDirector) {
                    try {
                        const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active');
                        const { data: cs } = await supabase.from('clients').select('compliance_score').eq('status', 'active');
                        const avg = cs && cs.length ? cs.reduce((s, r) => s + (r.compliance_score || 0), 0) / cs.length : null;
                        if (!cancelled) setMetrics({ activeClients: count ?? 0, complianceRate: avg === null ? null : Math.round(avg * 10) / 10 });
                    } catch (e) { console.warn('[dashboard] metrics failed:', e); }
                }
            } catch (e) {
                console.warn('[dashboard] load failed:', e);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        fetchData();
        return () => { cancelled = true; };
    }, [user]);

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

    let briefingDetail: string;
    if (isAdmin) {
        briefingDetail = recentComms.length === 0
            ? `${schedPhrase}, and there are no recent client messages.`
            : `${schedPhrase}, and ${plural(recentComms.length, 'recent client message')} ${recentComms.length === 1 ? 'is' : 'are'} waiting.`;
    } else if (isTherapist) {
        briefingDetail = flaggedClients === 0
            ? `${schedPhrase}, and no clients are currently flagged.`
            : `${schedPhrase}, and ${plural(flaggedClients, 'client')} ${flaggedClients === 1 ? 'has' : 'have'} a compliance flag.`;
    } else {
        // Director (and any other staff fallback): practice-wide.
        const stats = metrics.activeClients != null ? `, and ${plural(metrics.activeClients, 'active client')}` : '';
        briefingDetail = `${schedPhrase}, with ${plural(alertSummary.total, 'open alert')} across the caseload${stats}.`;
    }

    const ScheduleCard = (
        <Card title="Today's Schedule" subtitle={isAdmin ? 'Appointments on the books for today.' : 'Today’s clinical sessions.'}>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {appointments.length > 0 ? appointments.map(apt => (
                    <button
                        key={apt.id}
                        onClick={() => isClinical
                            ? navigate(`/session/${apt.id}/green-room`)
                            : apt.clientId ? navigate(`/clients/${apt.clientId}`) : navigate('/session-management')}
                        className="w-full py-6 flex items-center justify-between group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 px-4 rounded-2xl transition-all text-left"
                    >
                        <div className="flex items-center gap-8">
                            <div className="text-center w-20">
                                <p className="text-xl font-black text-slate-900 dark:text-white leading-none">{apt.startTime}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{apt.endTime}</p>
                            </div>
                            <div className="h-10 w-px bg-slate-200 dark:bg-slate-700"></div>
                            <div>
                                <h4 className="font-black text-lg text-slate-800 dark:text-white group-hover:text-primary transition-colors">{apt.clientName || apt.title}</h4>
                                <div className="flex items-center gap-4 mt-1.5">
                                    <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-500">{apt.type}</span>
                                    {apt.modality?.includes('Zoom') && <span className="flex items-center gap-1.5 text-[10px] font-bold text-secondary"><Video size={12}/> TELEHEALTH</span>}
                                </div>
                            </div>
                        </div>
                        <span className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                            <ArrowUpRight size={18}/>
                        </span>
                    </button>
                )) : (
                    <div className="py-20 text-center text-slate-300">
                        <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="text-xs font-black uppercase tracking-[0.3em]">No appointments scheduled for today.</p>
                    </div>
                )}
            </div>
        </Card>
    );

    const GuardrailsCard = (
        <Card title="Clinical Guardrails" subtitle="Deterministic Missouri compliance checks (9 CSR) — engine-computed, advisory.">
            <div className="space-y-3">
                {guardrails.length > 0 ? guardrails.slice(0, 6).map(g => {
                    const isViolation = g.status === 'violation';
                    const accent = isViolation ? 'text-red-600' : 'text-amber-600';
                    const box = isViolation
                        ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/20'
                        : 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/20';
                    return (
                        <button
                            key={g.id}
                            onClick={() => navigate(`/clients/${g.clientId}`)}
                            className={`w-full text-left flex items-start gap-4 p-4 border rounded-2xl transition-colors ${box}`}
                        >
                            <AlertTriangle className={`shrink-0 mt-1 ${accent}`} size={20} />
                            <div className="min-w-0 flex-1">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${accent}`}>{g.status} · {g.clientName} · {g.program}</p>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">{g.headline}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{g.detail}</p>
                                <p className="text-[10px] font-mono text-slate-400 mt-1.5">{g.citation}</p>
                            </div>
                        </button>
                    );
                }) : (
                    <div className="text-center py-6 text-slate-400 text-xs font-bold uppercase tracking-widest">No compliance flags.</div>
                )}
            </div>
        </Card>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            {/* Briefing line — inline text, no popup. */}
            <div>
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter">{hello}</h1>
                <p className="text-base md:text-lg text-slate-500 dark:text-slate-400 mt-3 max-w-3xl">{briefingDetail}</p>
                {isClinical && alertSummary.total > 0 && (
                    <button
                        onClick={() => navigate('/risk-monitor')}
                        className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition text-xs font-black uppercase tracking-widest"
                    >
                        <AlertTriangle size={14} /> Review {plural(alertSummary.total, 'alert')}
                    </button>
                )}
            </div>

            {/* Director-only aggregate stats. Monthly Revenue intentionally omitted. */}
            {isDirector && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <StatCard title="Compliance Rate" value={metrics.complianceRate === null ? '—' : `${metrics.complianceRate}%`} icon={ShieldCheck} color="bg-emerald-500" />
                    <StatCard title="Active Clients" value={metrics.activeClients === null ? '—' : metrics.activeClients.toString()} icon={Activity} color="bg-primary" />
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
                        <Card title="Recent Client Messages" subtitle="Most recent communications sent.">
                            <div className="space-y-3">
                                {recentComms.length > 0 ? recentComms.map(m => (
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
                        <Card title="Risk Monitor" subtitle="Actionable alerts from real client activity.">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="p-4 rounded-2xl border-2 border-red-100 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10 shadow-card dark:shadow-card-dark">
                                    <div className="text-3xl font-black tracking-tighter text-red-600">{alertSummary.critical}</div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Critical</div>
                                </div>
                                <div className="p-4 rounded-2xl border-2 border-orange-100 dark:border-orange-900/40 bg-orange-50/50 dark:bg-orange-900/10 shadow-card dark:shadow-card-dark">
                                    <div className="text-3xl font-black tracking-tighter text-orange-600">{alertSummary.high}</div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">High</div>
                                </div>
                                <div className="p-4 rounded-2xl border-2 border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10 shadow-card dark:shadow-card-dark">
                                    <div className="text-3xl font-black tracking-tighter text-amber-600">{alertSummary.elevated}</div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Elevated</div>
                                </div>
                                <div className="p-4 rounded-2xl border-2 border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/10 shadow-card dark:shadow-card-dark">
                                    <div className="text-3xl font-black tracking-tighter text-blue-600">{alertSummary.moderate}</div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Moderate</div>
                                </div>
                            </div>
                            <button
                                onClick={() => navigate('/risk-monitor')}
                                className="mt-4 w-full px-4 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition flex items-center justify-center gap-2"
                            >
                                {alertSummary.total > 0 ? `Review ${plural(alertSummary.total, 'alert')}` : 'Open Risk Monitor'}
                                <ArrowUpRight size={14} />
                            </button>
                        </Card>
                    </div>
                    <div className="lg:col-span-1">{GuardrailsCard}</div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
