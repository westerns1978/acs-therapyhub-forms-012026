import React, { useEffect, useState } from 'react';
import { Client, SROPProgress, ClientActivity, ComplianceEvent } from '../../types';
import Card from '../ui/Card';
import { FileText, CheckCircle, CheckCircle2, Award, Calendar, AlertTriangle, Clock, CreditCard, FileSignature, Target, HelpCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { getComplianceEvents } from '../../services/api';
import { type ClientProgress } from '../../services/displayProgress';
import { type PacketReadiness, type ReadinessRow, type ReadinessState } from '../../services/packetReadiness';

interface ClientOverviewTabProps {
  client: Client;
  sropData: SROPProgress | null;
  activityFeed: ClientActivity[];
  /** WS-DisplayTruth: authoritative progress composed ONCE in ClientWorkspace (gate's own
   *  accrual + signed determination) — passed in, never re-fetched here. */
  progress: ClientProgress | null;
  /** Build 1 — Packet Readiness: the per-client checklist model, composed ONCE in
   *  ClientWorkspace from the same engine assessment the certificate gate uses. */
  readiness: PacketReadiness;
}

// Therapist UUID -> display name for clinical_note signatures. Kept inline because
// the demo Supabase doesn't have a dedicated therapists table; broaden this when
// post-demo we add proper therapist records.
const THERAPIST_NAMES: Record<string, string> = {
    '44444444-4444-4444-4444-444444444444': 'Karen Ventimiglia, LPC',
    '22222222-2222-2222-2222-222222222222': 'Dr. Anya Sharma',
};

interface PaymentRow {
    id: string;
    amount: number | string;
    payment_date: string | null;
    payment_method: string | null;
    description: string | null;
    status: string | null;
    external_payment_id: string | null;
}

interface NoteRow {
    id: string;
    note_type: string | null;
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
    is_signed: boolean | null;
    created_at: string | null;
    therapist_id: string | null;
}

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ElementType }> = ({ label, value, icon: Icon }) => (
    <div className="bg-surface dark:bg-dark-surface-secondary p-4 rounded-lg">
        <div className="flex items-center">
            <Icon className="w-6 h-6 text-primary mr-3" />
            <div>
                <p className="text-sm text-surface-secondary-content">{label}</p>
                <p className="text-xl font-bold">{value}</p>
            </div>
        </div>
    </div>
);

// ── Build 1: Packet Readiness checklist (the Compliance Scorecard, upgraded) ──
// Three honest visual states — met / action-needed / can't-verify — NEVER merged:
// a `cannot_verify` row means "the system lacks the data to evaluate this yet";
// it must not read as a pass or a failure.
const STATE_META: Record<ReadinessState, { icon: React.ElementType; tone: string; chip: string; chipClass: string }> = {
    met: {
        icon: CheckCircle2,
        tone: 'text-emerald-600 dark:text-emerald-400',
        chip: 'Met',
        chipClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
    },
    action: {
        icon: AlertTriangle,
        tone: 'text-rose-600 dark:text-rose-400',
        chip: 'Action needed',
        chipClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800',
    },
    cannot_verify: {
        icon: HelpCircle,
        tone: 'text-slate-400 dark:text-slate-500',
        chip: "Can't verify yet",
        chipClass: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700',
    },
};

const ReadinessRowItem: React.FC<{ row: ReadinessRow; progress: ClientProgress | null }> = ({ row, progress }) => {
    const meta = STATE_META[row.state];
    const Icon = meta.icon;
    return (
        <li className="p-3 rounded-xl border border-black/5 dark:border-white/5 bg-slate-50/70 dark:bg-slate-800/40">
            <div className="flex items-start gap-3">
                <Icon size={18} className={`shrink-0 mt-0.5 ${meta.tone}`} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{row.label}</p>
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${meta.chipClass}`}>{meta.chip}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{row.detail}</p>
                    {/* The hours gate keeps the progress bar (the old scorecard's survivor) —
                        progressPct is the ONLY percentage on this card (hours-denominated). */}
                    {row.id === 'hours' && progress?.established && (
                        <div className="mt-2">
                            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2"><div className="bg-primary h-2 rounded-full" style={{ width: `${progress.progressPct ?? 0}%` }}></div></div>
                            <p className="text-[10px] text-slate-400 mt-1">{progress.progressPct ?? 0}% of required hours{progress.isSrop ? ` · counseling ${progress.counselingCompleted} / ${progress.counselingRequired} hrs` : ''}</p>
                        </div>
                    )}
                    {row.citation && <p className="text-[10px] font-mono text-slate-400 mt-1">{row.citation}</p>}
                    {row.subRows && row.subRows.length > 0 && (
                        <ul className="mt-2 space-y-1.5 border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                            {row.subRows.map((sub) => {
                                const sMeta = STATE_META[sub.state];
                                const SIcon = sMeta.icon;
                                return (
                                    <li key={sub.id} className="flex items-center gap-2 flex-wrap">
                                        <SIcon size={13} className={`shrink-0 ${sMeta.tone}`} />
                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{sub.label}</span>
                                        <span className="text-[10px] text-slate-400">{sub.detail}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </li>
    );
};

const ActivityIcon: React.FC<{ type: ClientActivity['type'] }> = ({ type }) => {
    const icons = {
        Session: Calendar, Document: FileText, Form: CheckCircle,
        Achievement: Award, Task: CheckCircle, Payment: CheckCircle,
    };
    const Icon = icons[type] || Calendar;
    return <Icon className="w-4 h-4" />;
};

const formatCurrency = (n: number | string) => {
    const num = typeof n === 'string' ? parseFloat(n) : n;
    return `$${num.toFixed(2)}`;
};

const truncatePaymentId = (id: string | null) => {
    if (!id) return '—';
    if (id.length <= 14) return id;
    return `${id.slice(0, 8)}…${id.slice(-4)}`;
};

const computeDaysSince = (raw: any): number => {
    if (!raw) return 0;
    const ms = new Date(raw).getTime();
    if (Number.isNaN(ms)) return 0;
    const diff = Date.now() - ms;
    if (!Number.isFinite(diff) || diff < 0) return 0;
    return Math.floor(diff / 86_400_000);
};

const ClientOverviewTab: React.FC<ClientOverviewTabProps> = ({ client, sropData, activityFeed, progress, readiness }) => {
    const daysInProgram = computeDaysSince(
        client.enrollmentDate || (client as any).created_at || (client as any).enrollment_date
    );

    const timeToDeadline = client.nextDeadline ? Math.max(0, Math.ceil((new Date(client.nextDeadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24))) : null;

    const badgeCount = client?.gamification?.badges?.length || 0;

    const [payments, setPayments] = useState<PaymentRow[]>([]);
    const [notes, setNotes] = useState<NoteRow[]>([]);
    const [csrAlerts, setCsrAlerts] = useState<ComplianceEvent[]>([]);
    // Treatment Plan card — pulled from any form_submission whose data.problems
    // array is populated (Individual Comprehensive Treatment Plan etc.). Renders
    // only when the client has one.
    const [treatmentPlan, setTreatmentPlan] = useState<{
        formName: string;
        date: string | null;
        problems: Array<{ problem: string; goal: string; interventions?: string[] }>;
    } | null>(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const [paymentsRes, notesRes, plansRes, ceList] = await Promise.all([
                    supabase
                        .from('payments')
                        .select('id, amount, payment_date, payment_method, description, status, external_payment_id')
                        .eq('client_id', client.id)
                        .order('payment_date', { ascending: false }),
                    supabase
                        .from('clinical_notes')
                        .select('id, note_type, subjective, objective, assessment, plan, is_signed, created_at, therapist_id')
                        .eq('client_id', client.id)
                        .order('created_at', { ascending: false }),
                    supabase
                        .from('form_submissions')
                        .select('id, form_name, data, submitted_at')
                        .eq('client_id', client.id)
                        .ilike('form_name', '%treatment plan%')
                        .order('submitted_at', { ascending: false }),
                    getComplianceEvents(),
                ]);
                if (!mounted) return;
                setPayments((paymentsRes.data as PaymentRow[]) || []);
                setNotes((notesRes.data as NoteRow[]) || []);
                setCsrAlerts((ceList || []).filter(ce => ce.clientId === client.id));
                const planRow = (plansRes.data || []).find((r: any) => Array.isArray(r?.data?.problems) && r.data.problems.length > 0);
                if (planRow) {
                    setTreatmentPlan({
                        formName: planRow.form_name || 'Treatment Plan',
                        date: planRow.submitted_at,
                        problems: planRow.data.problems,
                    });
                } else {
                    setTreatmentPlan(null);
                }
            } catch (e) {
                console.warn('[ClientOverviewTab] fetch failed:', e);
            }
        })();
        return () => { mounted = false; };
    }, [client.id]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                {csrAlerts.length > 0 && (
                    <Card title="CSR Compliance Alerts" className="border-l-4 border-red-500">
                        <div className="space-y-3">
                            {csrAlerts.map(ce => {
                                const due = new Date(ce.dueDate);
                                const days = Math.ceil((due.getTime() - Date.now()) / (1000 * 3600 * 24));
                                return (
                                    <div key={ce.id} className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 rounded-xl">
                                        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-red-800 dark:text-red-200">
                                                {ce.type === 'Program Plan Review' ? '90-Day Treatment Plan Update Due' : ce.type}
                                            </p>
                                            <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                                                Due {due.toLocaleDateString()} · {days >= 0 ? `${days} day${days === 1 ? '' : 's'}` : `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`}
                                            </p>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-100 text-red-800 border border-red-200">
                                            {ce.status}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                )}

                <Card title="Packet Readiness">
                    <div className="space-y-4">
                        {/* Program + honest count header. "X of N gates met" is a derivable
                            count — never a "% ready" (gates are heterogeneous; a percentage
                            would fabricate linearity the data doesn't have). */}
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-1">{readiness.programLabel}</p>
                            {readiness.kind === 'gates' && (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-widest ${readiness.eligible
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                                    {readiness.eligible ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
                                    {readiness.metCount} of {readiness.totalCount} gates met{readiness.eligible ? ' — eligible' : ''}
                                </span>
                            )}
                        </div>

                        {/* Designed single-state / lead note (not-established · no-gate ·
                            no-pack · timeline-without-plan). Never an empty checklist. */}
                        {readiness.statusNote && (() => {
                            const neutral = readiness.kind === 'no_gate' || readiness.kind === 'no_pack';
                            const headline = readiness.kind === 'not_established' ? 'Completion not established'
                                : readiness.kind === 'no_gate' ? 'No state compliance gate (court-determined)'
                                : readiness.kind === 'no_pack' ? 'No Missouri rule pack mapped'
                                : 'No treatment plan on file';
                            return (
                                <div className={`p-4 rounded-xl border ${neutral
                                    ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                                    : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'}`}>
                                    <div className="flex items-start gap-3">
                                        {neutral
                                            ? <HelpCircle className="text-slate-400 shrink-0 mt-0.5" size={18} />
                                            : <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />}
                                        <div>
                                            <p className={`text-sm font-bold ${neutral ? 'text-slate-700 dark:text-slate-200' : 'text-amber-800 dark:text-amber-200'}`}>{headline}</p>
                                            <p className={`text-xs mt-0.5 leading-relaxed ${neutral ? 'text-slate-500 dark:text-slate-400' : 'text-amber-700 dark:text-amber-300'}`}>{readiness.statusNote}</p>
                                            {readiness.citation && <p className="text-[10px] font-mono text-slate-400 mt-1">{readiness.citation}</p>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* The checklist: certificate gates (SATOP, per-form sub-rows under
                            the forms gate) or the FULL documentation-rule verdicts (timeline
                            programs) — every row individually addressable, cited. */}
                        {readiness.rows.length > 0 && (
                            <ul className="space-y-2">
                                {readiness.rows.map((row) => (
                                    <ReadinessRowItem key={row.id} row={row} progress={progress} />
                                ))}
                            </ul>
                        )}
                    </div>
                </Card>

                {treatmentPlan && (
                    <Card title="Treatment Plan" className="border-l-4 border-violet-500">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{treatmentPlan.formName}</p>
                                {treatmentPlan.date && (
                                    <span className="text-xs text-slate-500">
                                        Signed {new Date(treatmentPlan.date).toLocaleDateString()}
                                    </span>
                                )}
                            </div>
                            <ol className="space-y-3">
                                {treatmentPlan.problems.map((p, i) => (
                                    <li key={i} className="p-3 bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800 rounded-xl">
                                        <div className="flex items-start gap-3">
                                            <span className="shrink-0 w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                                                {i + 1}
                                            </span>
                                            <div className="flex-1 space-y-1">
                                                <div>
                                                    <span className="text-xs font-bold uppercase tracking-widest text-violet-700 dark:text-violet-300">Problem:</span>{' '}
                                                    <span className="text-sm text-slate-800 dark:text-slate-100 font-medium">{p.problem}</span>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <Target className="w-3.5 h-3.5 text-violet-500 mt-1 shrink-0" />
                                                    <div>
                                                        <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Goal:</span>{' '}
                                                        <span className="text-sm text-slate-700 dark:text-slate-200">{p.goal}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </Card>
                )}

                {notes.length > 0 && (
                    <Card title="Clinical Notes">
                        <div className="space-y-4">
                            {notes.map(n => {
                                const therapist = THERAPIST_NAMES[n.therapist_id || ''] || 'Clinician';
                                const noteLabel = (n.note_type || 'Note').toUpperCase();
                                // Format is encoded in note_type (a "(DAP)" marker — see saveClinicalNote).
                                // DAP notes render Data/Assessment/Plan with NO Objective; SOAP notes are
                                // unchanged (subjective + objective shown together under "Data:").
                                const isDap = noteLabel.includes('DAP');
                                return (
                                    <div key={n.id} className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-2xl">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <FileSignature className="w-4 h-4 text-primary" />
                                                <span className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">{noteLabel} Note</span>
                                                {n.is_signed && (
                                                    <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                                        Approved
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-slate-500">
                                                {n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}
                                            </span>
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            {n.subjective && (
                                                <div>
                                                    <span className="font-bold text-slate-700 dark:text-slate-200">Data: </span>
                                                    <span className="text-slate-600 dark:text-slate-300">{n.subjective}{!isDap && n.objective ? ` ${n.objective}` : ''}</span>
                                                </div>
                                            )}
                                            {n.assessment && (
                                                <div>
                                                    <span className="font-bold text-slate-700 dark:text-slate-200">Assessment: </span>
                                                    <span className="text-slate-600 dark:text-slate-300">{n.assessment}</span>
                                                </div>
                                            )}
                                            {n.plan && (
                                                <div>
                                                    <span className="font-bold text-slate-700 dark:text-slate-200">Plan: </span>
                                                    <span className="text-slate-600 dark:text-slate-300">{n.plan}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 italic">
                                            Signed by {therapist}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                )}

                <Card title="Recent Activity">
                     <ul className="space-y-4 max-h-80 overflow-y-auto custom-scrollbar">
                        {activityFeed.map(item => (
                            <li key={item.id} className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                    <ActivityIcon type={item.type} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">{item.description}</p>
                                    <p className="text-xs text-surface-secondary-content">{new Date(item.timestamp).toLocaleString()}</p>
                                </div>
                            </li>
                        ))}
                        {(activityFeed || []).length === 0 && (
                            <div className="text-center py-8 text-slate-400 text-sm">No recent activity detected.</div>
                        )}
                     </ul>
                </Card>
            </div>
            <div className="lg:col-span-1 space-y-6">
                <Card>
                     {timeToDeadline !== null && (
                        <div className={`p-4 rounded-lg mb-4 ${timeToDeadline < 7 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'} border`}>
                            <div className="flex items-center gap-3">
                                <Clock className={`w-6 h-6 ${timeToDeadline < 7 ? 'text-red-600' : 'text-blue-600'}`} />
                                <div>
                                    <p className="font-bold text-2xl">{timeToDeadline} Days</p>
                                    <p className="text-sm font-medium">until next deadline</p>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="space-y-3">
                        <StatCard label="Days in Program" value={daysInProgram} icon={Calendar} />
                        {/* "Missing Documents" StatCard retired (Build 1): it read
                            client.missingDocuments, which no DB column feeds — permanently 0,
                            phantom-shaped reassurance. The Packet Readiness checklist's
                            per-form rows are the real replacement. */}
                        <StatCard label="Achievements" value={badgeCount} icon={Award} />
                    </div>
                </Card>

                <Card title="Payments">
                    {payments.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 text-sm">
                            <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            No payments on file.
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                            {payments.map(p => {
                                const date = p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '—';
                                const statusBadge = (p.status || 'paid').toLowerCase() === 'paid'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800';
                                return (
                                    <li key={p.id} className="py-3 flex items-start gap-3">
                                        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                                            <CreditCard className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-bold text-slate-800 dark:text-white">
                                                    {formatCurrency(p.amount)}
                                                </span>
                                                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${statusBadge}`}>
                                                    {p.status || 'paid'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5 truncate">
                                                {p.description || p.payment_method || 'Payment'}
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-1 font-mono">
                                                {date} · {truncatePaymentId(p.external_payment_id)}
                                            </p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default ClientOverviewTab;
