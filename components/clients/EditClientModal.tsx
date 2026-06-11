import React, { useState, useEffect } from 'react';
import { updateClient } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Client, ClientStatus } from '../../types';
import { CLIENT_STATUS_LABELS } from '../../types';
import { X, User, Shield, CreditCard, CheckCircle, Loader2, AlertTriangle, Lock } from 'lucide-react';

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
        program: 'SROP',
        status: 'active',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            program: (client.program as string) || 'SROP',
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

                    {/* Billing & Legal */}
                    <section className="space-y-4">
                        <h3 className="flex items-center gap-2 font-semibold text-lg text-slate-800 dark:text-slate-200 border-b pb-2 border-slate-100 dark:border-slate-800">
                            <CreditCard className="text-primary" size={20} /> Billing & Legal
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
                            <Select value={formData.program} onChange={v => setField('program', v)} disabled={!canEditClinical} options={['SROP', 'SATOP', 'SATOP Level IV', 'REACT', 'Anger Management', 'GAMBLING_RECOVERY', 'OPIOID_RECOVERY', 'DOT', 'Individual Counseling']} />
                        </FieldLabel>
                        <FieldLabel label="Status">
                            {/* Lifecycle ONLY (DB CHECK-enforced): active | completed | archived.
                                Compliance standing (compliant/warrant/…) is engine-computed at
                                render and is deliberately NOT a settable value here. */}
                            <Select value={CLIENT_STATUS_LABELS[formData.status as ClientStatus] ?? 'Active'} onChange={v => setField('status', v.toLowerCase())} disabled={!canEditClinical} options={['Active', 'Completed', 'Archived']} />
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
    options: string[];
    disabled?: boolean;
}
const Select: React.FC<SelectProps> = ({ value, onChange, options, disabled }) => (
    <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
    >
        {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
        ))}
    </select>
);

export default EditClientModal;
