import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getClients, getTreatmentPlansForClient, saveTreatmentPlan, updateTreatmentPlan, archiveTreatmentPlan } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import type { Client, TreatmentPlan, TreatmentPlanContent, TreatmentPlanProblem, TreatmentPlanIntervention } from '../../types';
import type { TreatmentPlanTemplate } from '../../data/treatmentPlanTemplates';
import { CATEGORY_STYLES } from '../../data/treatmentPlanTemplates';
import { X, Plus, Trash2, CheckCircle, Loader2, AlertTriangle, ClipboardList, Target, Clock } from 'lucide-react';

// Two modes — `apply-template` creates a new plan, `edit-plan` updates an
// existing one. Same UI; different save path.
export type CustomizeModalMode =
    | { kind: 'apply-template'; template: TreatmentPlanTemplate; preselectedClientId?: string }
    | { kind: 'edit-plan'; plan: TreatmentPlan };

interface CustomizeTreatmentPlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: CustomizeModalMode | null;
}

interface FormState {
    clientId: string;
    title: string;
    category: string;
    estimatedDuration: string;
    problems: TreatmentPlanProblem[];
    notes: string;
}

const emptyForm: FormState = {
    clientId: '',
    title: '',
    category: '',
    estimatedDuration: '',
    problems: [],
    notes: '',
};

const fromTemplate = (template: TreatmentPlanTemplate, preselectedClientId?: string): FormState => ({
    clientId: preselectedClientId ?? '',
    title: template.title,
    category: template.category,
    estimatedDuration: template.estimatedDuration,
    // Deep-clone — user edits should not mutate the static template export
    problems: template.problems.map(p => ({
        title: p.title,
        goals: [...p.goals],
        interventions: p.interventions.map(i => ({ description: i.description, frequency: i.frequency })),
    })),
    notes: '',
});

const fromPlan = (plan: TreatmentPlan): FormState => ({
    clientId: plan.clientId,
    title: plan.title,
    category: plan.category,
    estimatedDuration: plan.estimatedDuration || '',
    problems: (plan.content?.problems || []).map(p => ({
        title: p.title,
        goals: [...(p.goals || [])],
        interventions: (p.interventions || []).map(i => ({ description: i.description, frequency: i.frequency })),
    })),
    notes: plan.notes || '',
});

const CustomizeTreatmentPlanModal: React.FC<CustomizeTreatmentPlanModalProps> = ({ isOpen, onClose, mode }) => {
    const navigate = useNavigate();
    const { addNotification } = useNotification();

    const [form, setForm] = useState<FormState>(emptyForm);
    const [clients, setClients] = useState<Client[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // When the chosen client already has an Active plan, holds its id+title
    // so the footer can show the "Archive existing & apply" confirm.
    const [existingActive, setExistingActive] = useState<{ id: string; title: string } | null>(null);

    const isEditMode = mode?.kind === 'edit-plan';

    // Body scroll lock
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [isOpen]);

    // Initialize form when mode changes
    useEffect(() => {
        if (!isOpen || !mode) return;
        if (mode.kind === 'apply-template') {
            setForm(fromTemplate(mode.template, mode.preselectedClientId));
        } else {
            setForm(fromPlan(mode.plan));
        }
        setExistingActive(null);
        setError(null);
    }, [isOpen, mode]);

    // Load real clients (replaces the old hardcoded DEMO_CLIENTS in
    // TreatmentPlanLibrary). Only needed in apply-template mode where the
    // user picks a client; in edit mode the client is fixed.
    useEffect(() => {
        if (!isOpen || isEditMode) return;
        getClients().then(setClients).catch(e => console.warn('[CustomizePlan] getClients failed:', e));
    }, [isOpen, isEditMode]);

    const categoryStyle = useMemo(() => {
        return (CATEGORY_STYLES as any)[form.category] || { badge: 'bg-slate-600 text-white', accent: 'text-slate-700', ring: 'ring-slate-500/20' };
    }, [form.category]);

    // --- mutators ---
    const updateProblem = (idx: number, patch: Partial<TreatmentPlanProblem>) => {
        setForm(f => ({ ...f, problems: f.problems.map((p, i) => i === idx ? { ...p, ...patch } : p) }));
    };
    const addProblem = () => {
        setForm(f => ({ ...f, problems: [...f.problems, { title: '', goals: [], interventions: [] }] }));
    };
    const removeProblem = (idx: number) => {
        setForm(f => ({ ...f, problems: f.problems.filter((_, i) => i !== idx) }));
    };
    const setGoal = (pIdx: number, gIdx: number, value: string) => {
        updateProblem(pIdx, { goals: form.problems[pIdx].goals.map((g, i) => i === gIdx ? value : g) });
    };
    const addGoal = (pIdx: number) => updateProblem(pIdx, { goals: [...form.problems[pIdx].goals, ''] });
    const removeGoal = (pIdx: number, gIdx: number) => {
        updateProblem(pIdx, { goals: form.problems[pIdx].goals.filter((_, i) => i !== gIdx) });
    };
    const setIntervention = (pIdx: number, iIdx: number, patch: Partial<TreatmentPlanIntervention>) => {
        const ints = form.problems[pIdx].interventions.map((it, i) => i === iIdx ? { ...it, ...patch } : it);
        updateProblem(pIdx, { interventions: ints });
    };
    const addIntervention = (pIdx: number) =>
        updateProblem(pIdx, { interventions: [...form.problems[pIdx].interventions, { description: '', frequency: '' }] });
    const removeIntervention = (pIdx: number, iIdx: number) => {
        updateProblem(pIdx, { interventions: form.problems[pIdx].interventions.filter((_, i) => i !== iIdx) });
    };

    // --- save flow ---
    const validate = (): string | null => {
        if (!form.clientId) return 'Select a client.';
        if (!form.title.trim()) return 'Plan title is required.';
        if (form.problems.length === 0) return 'Add at least one problem.';
        for (const p of form.problems) {
            if (!p.title.trim()) return 'Every problem needs a title.';
        }
        return null;
    };

    const buildContent = (): TreatmentPlanContent => ({
        problems: form.problems.map(p => ({
            title: p.title.trim(),
            goals: p.goals.map(g => g.trim()).filter(Boolean),
            interventions: p.interventions
                .filter(i => (i.description || '').trim())
                .map(i => ({ description: i.description.trim(), frequency: (i.frequency || '').trim() || undefined })),
        })),
    });

    const doSave = async () => {
        if (!mode) return;
        setError(null);
        setIsSaving(true);
        try {
            if (mode.kind === 'edit-plan') {
                const updated = await updateTreatmentPlan(mode.plan.id, {
                    title: form.title.trim(),
                    estimatedDuration: form.estimatedDuration.trim(),
                    content: buildContent(),
                    notes: form.notes.trim() || undefined,
                });
                addNotification(`Plan "${updated.title}" updated.`, 'success');
                window.dispatchEvent(new CustomEvent('treatment-plan-saved', { detail: { plan: updated } }));
                onClose();
            } else {
                const created = await saveTreatmentPlan({
                    clientId: form.clientId,
                    templateId: mode.template.id,
                    title: form.title.trim(),
                    category: form.category,
                    estimatedDuration: form.estimatedDuration.trim() || undefined,
                    content: buildContent(),
                    notes: form.notes.trim() || undefined,
                });
                const clientName = clients.find(c => c.id === form.clientId)?.name || 'client';
                addNotification(`Plan saved to ${clientName}.`, 'success');
                window.dispatchEvent(new CustomEvent('treatment-plan-saved', { detail: { plan: created } }));
                onClose();
                navigate(`/clients/${form.clientId}`);
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to save plan.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveClick = async () => {
        const msg = validate();
        if (msg) { setError(msg); return; }

        // Edit mode: no active-plan check, just save.
        if (mode?.kind === 'edit-plan') {
            await doSave();
            return;
        }

        // Apply-template mode: check for an existing Active plan first.
        try {
            const existing = await getTreatmentPlansForClient(form.clientId);
            const active = existing.find(p => p.status === 'Active');
            if (active) {
                setExistingActive({ id: active.id, title: active.title });
                return; // wait for user to confirm in the inline banner
            }
        } catch (e: any) {
            setError(e?.message || 'Could not check for an existing active plan.');
            return;
        }
        await doSave();
    };

    const handleArchiveAndApply = async () => {
        if (!existingActive) return;
        setError(null);
        setIsSaving(true);
        try {
            await archiveTreatmentPlan(existingActive.id);
            setExistingActive(null);
            await doSave();
        } catch (e: any) {
            setError(e?.message || 'Archive failed; new plan not saved.');
            setIsSaving(false);
        }
    };

    if (!isOpen || !mode) return null;

    // Same mount mechanism as the Phase G modals — rendered from MainLayout,
    // not from inside any backdrop-filter ancestor.
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="customize-tp-modal-title"
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

            <div
                onClick={e => e.stopPropagation()}
                className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col border border-white/20 dark:border-slate-700 animate-fade-in-up"
                style={{ maxHeight: 'min(92vh, calc(100dvh - 2rem))', animationDuration: '0.2s' }}
            >
                {/* Header */}
                <div className="flex-shrink-0 bg-gray-50/80 dark:bg-slate-800/80 backdrop-blur-md p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                        <h2 id="customize-tp-modal-title" className="text-xl font-bold text-gray-900 dark:text-white truncate">
                            {isEditMode ? 'Edit Treatment Plan' : 'Customize & Apply Plan'}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded ${categoryStyle.badge}`}>
                                {form.category}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {isEditMode ? 'Editing existing plan' : 'New plan from template'}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl flex items-start gap-2 text-red-700 dark:text-red-300">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                            <p className="text-xs font-medium leading-relaxed">{error}</p>
                        </div>
                    )}

                    {/* Client picker (only in apply-template mode) */}
                    {!isEditMode && (
                        <section className="space-y-1">
                            <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Apply to client</label>
                            <select
                                value={form.clientId}
                                onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                                className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            >
                                <option value="">— Select a client —</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} · {c.program}</option>
                                ))}
                            </select>
                        </section>
                    )}

                    {/* Plan metadata */}
                    <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1 sm:col-span-2">
                            <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Plan title</label>
                            <input
                                value={form.title}
                                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase text-gray-500 tracking-wider flex items-center gap-1">
                                <Clock size={11} /> Estimated duration
                            </label>
                            <input
                                value={form.estimatedDuration}
                                onChange={e => setForm(f => ({ ...f, estimatedDuration: e.target.value }))}
                                placeholder="e.g. 12 weeks"
                                className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            />
                        </div>
                    </section>

                    {/* Problems list */}
                    <section className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                <Target size={14} className={categoryStyle.accent} /> Problems &amp; goals
                            </h3>
                            <button
                                type="button"
                                onClick={addProblem}
                                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary-focus"
                            >
                                <Plus size={12} /> Add problem
                            </button>
                        </div>

                        {form.problems.length === 0 && (
                            <div className="p-6 text-center text-slate-400 text-xs font-bold uppercase tracking-widest border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                                No problems yet. Add one to start.
                            </div>
                        )}

                        {form.problems.map((problem, pIdx) => (
                            <div key={pIdx} className={`p-5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700 rounded-2xl space-y-4 ring-1 ${categoryStyle.ring}`}>
                                <div className="flex items-start gap-3">
                                    <span className={`text-xs font-black mt-3 ${categoryStyle.accent}`}>#{pIdx + 1}</span>
                                    <input
                                        value={problem.title}
                                        onChange={e => updateProblem(pIdx, { title: e.target.value })}
                                        placeholder="Problem title (e.g. Manage alcohol cravings)"
                                        className="flex-1 p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-semibold"
                                    />
                                    <button type="button" onClick={() => removeProblem(pIdx)} aria-label="Remove problem" className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                {/* Goals */}
                                <div className="pl-7 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Goals</span>
                                        <button type="button" onClick={() => addGoal(pIdx)} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary">
                                            <Plus size={11} /> Goal
                                        </button>
                                    </div>
                                    {problem.goals.length === 0 && (
                                        <p className="text-[11px] text-slate-400 italic">No goals.</p>
                                    )}
                                    {problem.goals.map((goal, gIdx) => (
                                        <div key={gIdx} className="flex items-center gap-2">
                                            <input
                                                value={goal}
                                                onChange={e => setGoal(pIdx, gIdx, e.target.value)}
                                                placeholder="Goal description"
                                                className="flex-1 p-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                            />
                                            <button type="button" onClick={() => removeGoal(pIdx, gIdx)} aria-label="Remove goal" className="p-1.5 text-slate-400 hover:text-red-500">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Interventions */}
                                <div className="pl-7 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Interventions</span>
                                        <button type="button" onClick={() => addIntervention(pIdx)} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary">
                                            <Plus size={11} /> Intervention
                                        </button>
                                    </div>
                                    {problem.interventions.length === 0 && (
                                        <p className="text-[11px] text-slate-400 italic">No interventions.</p>
                                    )}
                                    {problem.interventions.map((it, iIdx) => (
                                        <div key={iIdx} className="flex items-center gap-2">
                                            <input
                                                value={it.description}
                                                onChange={e => setIntervention(pIdx, iIdx, { description: e.target.value })}
                                                placeholder="What will be done"
                                                className="flex-1 p-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                            />
                                            <input
                                                value={it.frequency || ''}
                                                onChange={e => setIntervention(pIdx, iIdx, { frequency: e.target.value })}
                                                placeholder="weekly"
                                                className="w-28 p-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                            />
                                            <button type="button" onClick={() => removeIntervention(pIdx, iIdx)} aria-label="Remove intervention" className="p-1.5 text-slate-400 hover:text-red-500">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </section>

                    {/* Notes */}
                    <section className="space-y-1">
                        <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Clinical notes (optional)</label>
                        <textarea
                            value={form.notes}
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                            rows={3}
                            placeholder="Brief context, prognosis, anything else to capture with the plan."
                            className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                        />
                    </section>
                </div>

                {/* Footer — confirm banner replaces buttons when an active plan exists. */}
                <div className="flex-shrink-0 border-t border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-800/80 backdrop-blur-md">
                    {existingActive ? (
                        <div className="p-5 space-y-3">
                            <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
                                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                <p className="text-xs font-medium leading-relaxed">
                                    This client already has an active plan: <strong>{existingActive.title}</strong>.
                                    Applying this new plan will archive the existing one. Continue?
                                </p>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setExistingActive(null)} className="px-5 py-2.5 text-gray-600 hover:text-gray-900 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                    Cancel
                                </button>
                                <button onClick={handleArchiveAndApply} disabled={isSaving} className="px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-focus font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all disabled:opacity-70">
                                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                                    Archive existing &amp; apply
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-5 flex justify-between items-center">
                            <button onClick={onClose} className="px-5 py-2.5 text-gray-600 hover:text-gray-900 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleSaveClick} disabled={isSaving} className="px-7 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-focus font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all disabled:opacity-70">
                                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <ClipboardList size={16} />}
                                {isSaving ? 'Saving...' : (isEditMode ? 'Save changes' : 'Save plan')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CustomizeTreatmentPlanModal;
