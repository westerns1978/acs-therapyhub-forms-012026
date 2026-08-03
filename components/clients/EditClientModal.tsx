import React, { useState, useEffect } from 'react';
import { updateClient, getCounselors, getClient, reopenClient } from '../../services/api';
import type { Counselor } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Client, ClientStatus } from '../../types';
import { CLIENT_STATUS_LABELS } from '../../types';
import { normalizeProgram, PROGRAM_LABELS, CANONICAL_PROGRAMS } from '../../config/programVocab';
import { X, User, Shield, CreditCard, CheckCircle, Loader2, AlertTriangle, Lock } from 'lucide-react';

// Canonical program options for the edit dropdown (value = stored vocab; label = friendly).
const PROGRAM_OPTIONS = CANONICAL_PROGRAMS.map(p => ({ value: p, label: PROGRAM_LABELS[p] }));

/** Statuses an EDIT may legitimately set — value = stored lifecycle token, label =
 *  what staff read. 'completed' is absent by design (P0/D1): it is produced only by
 *  complete_client() after the gate passes, and cleared only by reopen_client().
 *  Value and label are separate here precisely because conflating them is what
 *  made a completed client unreachable (P0/D3). */
const EDITABLE_STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
    { value: 'active', label: CLIENT_STATUS_LABELS.active },
    { value: 'archived', label: CLIENT_STATUS_LABELS.archived },
];

interface EditClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client | null;
    onSaved: (updated: Client) => void;
}

// Role split for edit permissions:
//   Admin (Jess)   — contact + billing only
//   Therapist/Dir  — everything below + clinical
// The modal still renders the clinical fields for Admin (so they can see the
// values), but disables them with a Lock badge so it's clear who can change
// what.
const CLINICAL_ROLES: ReadonlyArray<string> = ['Director', 'Therapist'];

const EditClientModal: React.FC<EditClientModalProps> = ({ isOpen, onClose, client, onSaved }) => {
    const { user } = useAuth();
    const canEditClinical = !!user && CLINICAL_ROLES.includes(user.role);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        dob: '',
        caseNumber: '',
        county: 'St. Louis',
        probationOfficer: '',
        billingType: 'Self-Pay',
        primaryCounselorId: '',
        program: 'SROP',
        status: 'active',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // P0/D3 — reopening a completed client: an audited event with a required
    // reason, not a status pick.
    const [reopening, setReopening] = useState(false);
    const [reopenReason, setReopenReason] = useState('');
    const [reopenBusy, setReopenBusy] = useState(false);
    const isCompleted = formData.status === 'completed';
    // L4: Primary Counselor picker — the active roster. Empty on failure (honest).
    const [counselors, setCounselors] = useState<Counselor[]>([]);
    useEffect(() => {
        if (isOpen) getCounselors().then(setCounselors).catch(() => setCounselors([]));
    }, [isOpen]);

    // Sync form state with the incoming client whenever the modal opens.
    useEffect(() => {
        if (!isOpen || !client) return;
        setFormData({
            name: client.name || '',
            email: client.email || '',
            phone: client.phone || '',
            dob: (client as any).dob || '',
            caseNumber: client.caseNumber || '',
            county: (client as any).county || 'St. Louis',
            probationOfficer: client.probationOfficer || '',
            billingType: (client.billingType as string) || 'Self-Pay',
            primaryCounselorId: client.primaryCounselorId || '',
            // Normalize so a legacy/free-text value maps onto a canonical option.
            program: normalizeProgram(client.program).canonical || 'SROP',
            status: (client.status as string) || 'active',
        });
        setError(null);
    }, [client, isOpen]);

    // Same body-scroll-lock pattern as CreateClientModal.
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [isOpen]);

    const setField = (field: keyof typeof formData, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value as any }));
    };

    const MIN_REOPEN_REASON = 10; // kept in step with reopen_client()'s own minimum

    const handleReopen = async () => {
        if (!client || reopenReason.trim().length < MIN_REOPEN_REASON) return;
        setReopenBusy(true);
        setError(null);
        try {
            await reopenClient(client.id, reopenReason.trim());
            // Re-read rather than patching local state: completed_at is deliberately
            // preserved on the row, so the caller must see the real post-reopen record.
            const fresh = await getClient(client.id);
            setReopening(false);
            setReopenReason('');
            if (fresh) { onSaved(fresh); onClose(); }
        } catch (e: any) {
            setError(e?.message || 'Could not reopen this client.');
        } finally {
            setReopenBusy(false);
        }
    };

    const handleSubmit = async () => {
        if (!client) return;
        if (!formData.name.trim()) {
            setError('Name is required.');
            return;
        }
        if (!formData.phone.trim()) {
            setError('Phone is required.');
            return;
        }
        setIsSaving(true);
        setError(null);
        try {
            const changes: Record<string, any> = {
                name: formData.name.trim(),
                email: formData.email,
                phone: formData.phone,
                dob: formData.dob,
                caseNumber: formData.caseNumber,
                county: formData.county,
                probationOfficer: formData.probationOfficer,
                billingType: formData.billingType,
                primaryCounselorId: formData.primaryCounselorId,
            };
            // Clinical fields only included when the role allows them. Sending
            // them as Admin would be rejected logically here regardless of
            // whether the inputs were disabled in the DOM.
            if (canEditClinical) {
                changes.program = formData.program;
                // Status only when it actually changed — updateClient stamps
                // archived_at / completed_at on transitions, and a re-save of
                // an already-archived client must not re-bump the timestamp.
                if (formData.status !== client.status) changes.status = formData.status;
            }
            const updated = await updateClient(client.id, changes);
            onSaved(updated);
            onClose();
        } catch (e: any) {
            setError(e?.message || 'Failed to update client. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !client) return null;

    // Same render mechanism as CreateClientModal: mounted from MainLayout (NOT
    // GlobalHeader), no portal needed, fixed inset-0 anchors cleanly because
    // no transform/filter ancestor sits between this and the viewport.
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-client-modal-title"
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

            <div
                onClick={e => e.stopPropagation()}
                className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-white/20 dark:border-slate-700 animate-fade-in-up"
                style={{ maxHeight: 'min(90vh, calc(100dvh - 2rem))', animationDuration: '0.2s' }}
            >
                {/* Header */}
                <div className="flex-shrink-0 bg-gray-50/80 dark:bg-slate-800/80 backdrop-blur-md p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                    <div>
                        <h2 id="edit-client-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">Edit Client</h2>
                        <p className="text-sm text-gray-500">{client.name}</p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Content (scrolls) */}
                <div className="flex-1 min-h-0 overflow-y-auto p-8 space-y-8">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl flex items-start gap-2 text-red-700 dark:text-red-300">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                            <p className="text-xs font-medium leading-relaxed">{error}</p>
                        </div>
                    )}

                    {/* Contact + Demographics */}
                    <section className="space-y-4">
                        <h3 className="flex items-center gap-2 font-semibold text-lg text-slate-800 dark:text-slate-200 border-b pb-2 border-slate-100 dark:border-slate-800">
                            <User className="text-primary" size={20} /> Contact
                        </h3>
                        <FieldLabel label="Full Name">
                            <Input value={formData.name} onChange={v => setField('name', v)} placeholder="First Last" />
                        </FieldLabel>
                        <div className="grid grid-cols-2 gap-6">
                            <FieldLabel label="Phone">
                                <Input value={formData.phone} onChange={v => setField('phone', v)} placeholder="(555) 123-4567" />
                            </FieldLabel>
                            <FieldLabel label="Email">
                                <Input value={formData.email} type="email" onChange={v => setField('email', v)} placeholder="client@example.com" />
                            </FieldLabel>
                        </div>
                        <FieldLabel label="Date of Birth">
                            <Input value={formData.dob} type="date" onChange={v => setField('dob', v)} />
                        </FieldLabel>
                    </section>

                    {/* Fees & Legal — "billing" is reserved for billing the state (David 7/28) */}
                    <section className="space-y-4">
                        <h3 className="flex items-center gap-2 font-semibold text-lg text-slate-800 dark:text-slate-200 border-b pb-2 border-slate-100 dark:border-slate-800">
                            <CreditCard className="text-primary" size={20} /> Fees & Legal
                        </h3>
                        <div className="grid grid-cols-2 gap-6">
                            <FieldLabel label="Case Number">
                                <Input value={formData.caseNumber} onChange={v => setField('caseNumber', v)} />
                            </FieldLabel>
                            <FieldLabel label="County">
                                <Select value={formData.county} onChange={v => setField('county', v)} options={['St. Louis', 'Jefferson', 'St. Charles']} />
                            </FieldLabel>
                        </div>
                        <FieldLabel label="Probation Officer">
                            <Input value={formData.probationOfficer} onChange={v => setField('probationOfficer', v)} />
                        </FieldLabel>
                        <FieldLabel label="Payment Source">
                            <Select value={formData.billingType} onChange={v => setField('billingType', v)} options={['Self-Pay', 'Insurance', 'Court Mandate', 'State Funded', 'Sliding Scale']} />
                        </FieldLabel>
                        <FieldLabel label="Primary Counselor">
                            <select
                                value={formData.primaryCounselorId}
                                onChange={e => setField('primaryCounselorId', e.target.value)}
                                className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            >
                                <option value="">— None assigned —</option>
                                {counselors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </FieldLabel>
                    </section>

                    {/* Clinical — disabled for Admin */}
                    <section className="space-y-4">
                        <h3 className="flex items-center gap-2 font-semibold text-lg text-slate-800 dark:text-slate-200 border-b pb-2 border-slate-100 dark:border-slate-800">
                            <Shield className="text-primary" size={20} /> Clinical
                            {!canEditClinical && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-0.5 ml-2">
                                    <Lock size={10} /> Therapist / Director only
                                </span>
                            )}
                        </h3>
                        <FieldLabel label="Program">
                            <Select value={formData.program} onChange={v => setField('program', v)} disabled={!canEditClinical} options={PROGRAM_OPTIONS} />
                        </FieldLabel>
                        <FieldLabel label="Status">
                            {/* Lifecycle ONLY (DB CHECK-enforced). Compliance standing
                                (compliant/warrant/…) is engine-computed at render and is
                                deliberately NOT a settable value here.

                                P0/D1: "Completed" is GONE from this list. Completion is an
                                event with preconditions and a signer, not an attribute an edit
                                form can set — it goes through the attestation flow
                                (CompleteClientModal → complete_client), which the Postgres
                                gate enforces regardless of what this form sends.

                                P0/D3: driven by the STORED VALUE with value/label pairs, the
                                way the Program Select two rows up already worked. It used to be
                                `value={CLIENT_STATUS_LABELS[status]}` over label-only options —
                                and 'completed' maps to "Successful Dx", which was not an
                                option, so a completed client rendered as "Active", re-picking
                                "Active" fired no change event, and no transition out of
                                completed could ever be written. */}
                            {isCompleted ? (
                                <div className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-100 dark:bg-slate-800/60 flex items-center justify-between gap-3">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                        {CLIENT_STATUS_LABELS.completed}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setReopening(true)}
                                        disabled={!canEditClinical}
                                        className="text-xs font-bold uppercase tracking-wider text-primary hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                                    >
                                        Reopen client
                                    </button>
                                </div>
                            ) : (
                                <Select
                                    value={formData.status}
                                    onChange={v => setField('status', v)}
                                    disabled={!canEditClinical}
                                    options={EDITABLE_STATUS_OPTIONS}
                                />
                            )}
                            {isCompleted && !reopening && (
                                <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                                    Completion is a recorded event, not a field. Reopening is a separate
                                    audited action that requires a reason.
                                </p>
                            )}
                            {isCompleted && reopening && (
                                <div className="mt-3 p-4 rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/15 space-y-3">
                                    <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                                        Reopen {client.name}
                                    </p>
                                    <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
                                        This records an audit entry naming you, your reason and the date the
                                        completion was originally recorded. The completion date and the
                                        clinician&rsquo;s attestation are kept — reopening does not retract them.
                                    </p>
                                    <textarea
                                        value={reopenReason}
                                        onChange={e => setReopenReason(e.target.value)}
                                        disabled={reopenBusy}
                                        rows={3}
                                        placeholder="Why is this completion being reopened?"
                                        className="w-full p-3 text-sm border border-amber-300 dark:border-amber-800/60 rounded-lg bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-amber-400/30 disabled:opacity-60"
                                    />
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => { setReopening(false); setReopenReason(''); }}
                                            disabled={reopenBusy}
                                            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleReopen}
                                            disabled={reopenBusy || reopenReason.trim().length < MIN_REOPEN_REASON}
                                            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {reopenBusy && <Loader2 className="animate-spin" size={12} />}
                                            {reopenBusy ? 'Reopening…' : 'Reopen client'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </FieldLabel>
                    </section>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 p-6 bg-gray-50/80 dark:bg-slate-800/80 backdrop-blur-md border-t border-gray-200 dark:border-slate-700 flex justify-between items-center">
                    <button onClick={onClose} className="px-5 py-2.5 text-gray-600 hover:text-gray-900 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={isSaving} className="px-8 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-focus font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:transform-none">
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- small local presentational helpers — keep the JSX above readable ---

const FieldLabel: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="space-y-1">
        <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">{label}</label>
        {children}
    </div>
);

interface InputProps {
    value: string;
    onChange: (v: string) => void;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
}
const Input: React.FC<InputProps> = ({ value, onChange, type = 'text', placeholder, disabled }) => (
    <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
    />
);

interface SelectProps {
    value: string;
    onChange: (v: string) => void;
    options: (string | { value: string; label: string })[];   // string = value & label
    disabled?: boolean;
}
const Select: React.FC<SelectProps> = ({ value, onChange, options, disabled }) => (
    <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
    >
        {options.map(opt => {
            const o = typeof opt === 'string' ? { value: opt, label: opt } : opt;
            return <option key={o.value} value={o.value}>{o.label}</option>;
        })}
    </select>
);

export default EditClientModal;
