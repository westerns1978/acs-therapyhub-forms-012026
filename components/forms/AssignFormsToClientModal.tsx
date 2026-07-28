import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { Client, FormSubmission } from '../../types';
import type { SatopLevel } from '../../config/satopFees';
import { CLIENT_REGISTRY_FORMS, REQUIRED_FORMS_BY_LEVEL } from '../../config/formRegistry';
import { normalizeSubmissionStatus } from '../../config/formSubmissionStatus';
import { assignForm } from '../../services/api';
import { Loader2, Send, ShieldCheck, Check } from 'lucide-react';

/**
 * CLIENT-SCOPED form assignment (2026-07-28).
 *
 * Replaces reaching for the Forms Library's bulk picker when you mean "give THIS
 * client their forms". Two defects that surface drove this:
 *
 *  1. THE ID-VS-TITLE TRAP. `satop-checklist` renders as "Orientation Checklist",
 *     which does not read like a required SATOP form, while "Late Cancellation
 *     Policy" reads exactly like one and is NOT required. A counselor doing real
 *     intake picks by title and silently ships an incomplete packet — the
 *     completion gate then reads "unsigned" forever with no clue which form is
 *     missing. Required forms are now BADGED and sorted first, derived from
 *     REQUIRED_FORMS_BY_LEVEL for the client's signed determination — never from
 *     the title text.
 *  2. BLAST RADIUS. The library picker is multi-client with a "Select All" at the
 *     top of the list. This modal takes ONE client as a prop and has no client
 *     selector at all, so an assignment cannot escape the chart you opened it from.
 *
 * Already-assigned forms are shown as such and cannot be double-assigned (assignForm
 * has no uniqueness constraint behind it — a second click would just write a
 * duplicate row).
 */

interface Props {
    isOpen: boolean;
    onClose: () => void;
    client: Client;
    /** Signed-determination level; null = not established, so no required set exists. */
    determinedLevel: SatopLevel | null;
    /** The client's existing submissions — drives the "already assigned" state. */
    formSubmissions: FormSubmission[];
    onAssigned: () => void;
}

const AssignFormsToClientModal: React.FC<Props> = ({ isOpen, onClose, client, determinedLevel, formSubmissions, onAssigned }) => {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [dueDate, setDueDate] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const requiredIds = useMemo(
        () => new Set(determinedLevel ? (REQUIRED_FORMS_BY_LEVEL[determinedLevel] ?? []) : []),
        [determinedLevel],
    );

    // A form counts as already handled if ANY submission row exists for it —
    // assigned, submitted or reviewed. Re-assigning would duplicate the row.
    const existingByFormId = useMemo(() => {
        const m = new Map<string, string>();
        for (const s of formSubmissions) if (s.formId) m.set(s.formId, normalizeSubmissionStatus(s.status));
        return m;
    }, [formSubmissions]);

    // Required first, then the rest — so the packet reads as a packet.
    const forms = useMemo(() => {
        const list = [...CLIENT_REGISTRY_FORMS];
        list.sort((a, b) => {
            const ra = requiredIds.has(a.id) ? 0 : 1;
            const rb = requiredIds.has(b.id) ? 0 : 1;
            return ra !== rb ? ra - rb : a.title.localeCompare(b.title);
        });
        return list;
    }, [requiredIds]);

    const missingRequired = useMemo(
        () => forms.filter(f => requiredIds.has(f.id) && !existingByFormId.has(f.id)).map(f => f.id),
        [forms, requiredIds, existingByFormId],
    );

    useEffect(() => {
        if (!isOpen) return;
        setSelected(new Set());
        setError(null);
        const d = new Date();
        d.setDate(d.getDate() + 7);
        setDueDate(d.toISOString().split('T')[0]);
    }, [isOpen]);

    const toggle = (id: string) => setSelected(s => {
        const n = new Set(s);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
    });

    const handleSubmit = async () => {
        if (!selected.size) return;
        setSaving(true);
        setError(null);
        try {
            // assignForm takes (formId, clientIds[]) — this modal always passes
            // exactly one client id, by construction.
            for (const formId of selected) {
                await assignForm(formId, [client.id], new Date(dueDate));
            }
            onAssigned();
            onClose();
        } catch (e: any) {
            setError(e?.message || 'Could not assign the selected forms.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Assign forms" maxWidth="max-w-2xl">
            <div className="p-5 space-y-4">
                <p className="text-xs text-slate-500">
                    Assigning to <span className="font-bold text-slate-700 dark:text-slate-200">this client only</span>.
                    {determinedLevel
                        ? <> Required forms are those for <span className="font-bold">SATOP Level {determinedLevel}</span> (from the signed determination).</>
                        : <> No signed determination yet, so no required set is established — nothing is marked required below.</>}
                </p>

                {error && (
                    <p className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-xs font-medium text-red-700 dark:text-red-300">{error}</p>
                )}

                {missingRequired.length > 0 && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5">
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                            {missingRequired.length} required form{missingRequired.length === 1 ? '' : 's'} not yet assigned.
                        </span>
                        <button
                            type="button"
                            onClick={() => setSelected(new Set(missingRequired))}
                            className="shrink-0 text-[11px] font-black uppercase tracking-widest text-amber-900 dark:text-amber-200 underline hover:no-underline"
                        >
                            Select all required
                        </button>
                    </div>
                )}

                <ul className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                    {forms.map(f => {
                        const already = existingByFormId.get(f.id);
                        const isRequired = requiredIds.has(f.id);
                        return (
                            <li key={f.id}>
                                <label className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer ${
                                    already ? 'border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed'
                                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                    <input
                                        type="checkbox"
                                        className="mt-0.5 rounded shrink-0"
                                        disabled={!!already}
                                        checked={selected.has(f.id)}
                                        onChange={() => toggle(f.id)}
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{f.title}</span>
                                            {isRequired && (
                                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-900 dark:text-amber-200">
                                                    <ShieldCheck size={10} /> Required
                                                </span>
                                            )}
                                            {already && (
                                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                                    <Check size={10} /> {already === 'not_started' ? 'Already assigned' : already}
                                                </span>
                                            )}
                                        </span>
                                        {f.description && <span className="block text-[11px] text-slate-500 mt-0.5">{f.description}</span>}
                                    </span>
                                </label>
                            </li>
                        );
                    })}
                </ul>

                <div className="flex items-end justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div>
                        <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">Due date</label>
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                            className="p-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl">Cancel</button>
                        <button
                            onClick={handleSubmit}
                            disabled={saving || selected.size === 0}
                            className="px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-focus font-bold text-sm flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
                            Assign {selected.size || ''} form{selected.size === 1 ? '' : 's'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default AssignFormsToClientModal;
