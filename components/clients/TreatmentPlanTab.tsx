import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTreatmentPlansForClient, archiveTreatmentPlan } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import type { Client, TreatmentPlan } from '../../types';
import Card from '../ui/Card';
import LoadingSpinner from '../ui/LoadingSpinner';
import { ClipboardList, Plus, Target, Clock, Archive, Pencil, ChevronDown, ChevronUp, FileText } from 'lucide-react';

interface TreatmentPlanTabProps {
    client: Client;
}

const TreatmentPlanTab: React.FC<TreatmentPlanTabProps> = ({ client }) => {
    const navigate = useNavigate();
    const { addNotification } = useNotification();
    const [plans, setPlans] = useState<TreatmentPlan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const list = await getTreatmentPlansForClient(client.id);
            setPlans(list);
        } catch (e: any) {
            setError(e?.message || 'Failed to load treatment plans.');
        } finally {
            setIsLoading(false);
        }
    }, [client.id]);

    useEffect(() => { load(); }, [load]);

    // Refresh after a save in the customize modal
    useEffect(() => {
        const handler = (e: any) => {
            const planClientId = e?.detail?.plan?.clientId;
            if (planClientId === client.id) load();
        };
        window.addEventListener('treatment-plan-saved', handler);
        return () => window.removeEventListener('treatment-plan-saved', handler);
    }, [client.id, load]);

    const activePlan = plans.find(p => p.status === 'Active');
    const history = plans.filter(p => p.status !== 'Active');

    const openTemplateLibrary = () => {
        navigate(`/treatment-plan-library?for=${client.id}`);
    };

    const openEditModal = (plan: TreatmentPlan) => {
        window.dispatchEvent(new CustomEvent('open-treatment-plan-modal', {
            detail: { mode: { kind: 'edit-plan', plan } },
        }));
    };

    const handleArchive = async (plan: TreatmentPlan) => {
        if (!window.confirm(`Archive "${plan.title}"? You can start a new plan afterwards.`)) return;
        try {
            await archiveTreatmentPlan(plan.id);
            addNotification(`Archived "${plan.title}".`, 'success');
            load();
        } catch (e: any) {
            addNotification(e?.message || 'Archive failed.', 'error');
        }
    };

    if (isLoading) return <LoadingSpinner />;

    if (error) {
        return (
            <Card title="Treatment Plan">
                <div className="text-sm text-red-600">{error}</div>
                <button onClick={load} className="mt-3 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest">Retry</button>
            </Card>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
            {activePlan ? (
                <ActivePlanCard plan={activePlan} onEdit={() => openEditModal(activePlan)} onArchive={() => handleArchive(activePlan)} onNewPlan={openTemplateLibrary} />
            ) : (
                <EmptyState onStart={openTemplateLibrary} />
            )}

            {history.length > 0 && (
                <Card title={`Plan history (${history.length})`} subtitle="Previous and archived plans for this client.">
                    <div className="space-y-2">
                        {history.map(plan => (
                            <HistoryRow
                                key={plan.id}
                                plan={plan}
                                expanded={expandedHistoryId === plan.id}
                                onToggle={() => setExpandedHistoryId(expandedHistoryId === plan.id ? null : plan.id)}
                            />
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────

const ActivePlanCard: React.FC<{
    plan: TreatmentPlan;
    onEdit: () => void;
    onArchive: () => void;
    onNewPlan: () => void;
}> = ({ plan, onEdit, onArchive, onNewPlan }) => (
    <Card>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Active
                    </span>
                    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {plan.category}
                    </span>
                    {plan.estimatedDuration && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <Clock size={11} /> {plan.estimatedDuration}
                        </span>
                    )}
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{plan.title}</h2>
                <p className="text-[11px] text-slate-400 mt-1">
                    Applied {new Date(plan.createdAt).toLocaleDateString()}
                    {plan.updatedAt !== plan.createdAt && ` · last edited ${new Date(plan.updatedAt).toLocaleDateString()}`}
                </p>
            </div>
            <div className="flex flex-wrap gap-2">
                <button onClick={onEdit} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                    <Pencil size={12} /> Edit
                </button>
                <button onClick={onArchive} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                    <Archive size={12} /> Archive
                </button>
                <button onClick={onNewPlan} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary-focus shadow-sm transition-all">
                    <Plus size={12} /> New plan
                </button>
            </div>
        </div>

        <div className="space-y-4">
            {plan.content.problems.length === 0 && (
                <p className="text-sm text-slate-400 italic">This plan has no problems on it.</p>
            )}
            {plan.content.problems.map((problem, idx) => (
                <div key={idx} className="p-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl">
                    <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                        <Target size={14} className="text-primary" /> #{idx + 1} · {problem.title}
                    </h3>
                    {problem.goals.length > 0 && (
                        <div className="mb-3">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Goals</p>
                            <ul className="space-y-1">
                                {problem.goals.map((g, gi) => (
                                    <li key={gi} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                                        <span className="text-primary mt-0.5">›</span>
                                        <span>{g}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {problem.interventions.length > 0 && (
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Interventions</p>
                            <ul className="space-y-1">
                                {problem.interventions.map((it, ii) => (
                                    <li key={ii} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                                        <span className="text-emerald-600 mt-0.5">•</span>
                                        <span>{it.description}{it.frequency ? <span className="text-slate-400"> · {it.frequency}</span> : null}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            ))}
        </div>

        {plan.notes && (
            <div className="mt-5 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl">
                <p className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <FileText size={11} /> Clinical notes
                </p>
                <p className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed whitespace-pre-wrap">{plan.notes}</p>
            </div>
        )}
    </Card>
);

const EmptyState: React.FC<{ onStart: () => void }> = ({ onStart }) => (
    <Card>
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mb-4">
                <ClipboardList size={28} className="text-primary" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">No treatment plan yet.</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
                Apply a template from the Treatment Plan Library to start, then customize it for this client.
            </p>
            <button onClick={onStart} className="mt-6 px-6 py-3 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary-focus transition-all flex items-center gap-2">
                <Plus size={14} /> Start from a template
            </button>
        </div>
    </Card>
);

const HistoryRow: React.FC<{
    plan: TreatmentPlan;
    expanded: boolean;
    onToggle: () => void;
}> = ({ plan, expanded, onToggle }) => (
    <div className="border border-slate-100 dark:border-slate-800 rounded-2xl">
        <button onClick={onToggle} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition-colors">
            <div className="flex items-center gap-3 text-left">
                <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded ${plan.status === 'Archived' ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                    {plan.status}
                </span>
                <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{plan.title}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                        {plan.category} · {new Date(plan.createdAt).toLocaleDateString()}
                    </p>
                </div>
            </div>
            {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>
        {expanded && (
            <div className="px-4 pb-4 space-y-2">
                {plan.content.problems.map((p, i) => (
                    <div key={i} className="text-xs text-slate-700 dark:text-slate-300">
                        <p className="font-bold">#{i + 1} {p.title}</p>
                        {p.goals.length > 0 && <p className="ml-3 text-slate-500">Goals: {p.goals.join('; ')}</p>}
                        {p.interventions.length > 0 && (
                            <p className="ml-3 text-slate-500">Interventions: {p.interventions.map(it => it.description).join('; ')}</p>
                        )}
                    </div>
                ))}
                {plan.notes && (
                    <p className="text-xs text-slate-500 italic mt-2">Notes: {plan.notes}</p>
                )}
            </div>
        )}
    </div>
);

export default TreatmentPlanTab;
