import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { addClient, findDuplicateClients, DuplicateClientMatch } from '../../services/api';
import { X, User, Shield, CreditCard, CheckCircle, ArrowRight, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';

interface CreateClientModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateClientModal: React.FC<CreateClientModalProps> = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [duplicateMatches, setDuplicateMatches] = useState<DuplicateClientMatch[] | null>(null);
    const [formData, setFormData] = useState({
        firstName: '', lastName: '', email: '', phone: '', dob: '',
        program: 'SROP', caseNumber: '', county: 'St. Louis', probationOfficer: '',
        billingType: 'Self-Pay'
    });

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // The actual insert — called directly on a clean submit, or after the
    // duplicate warning is dismissed with "Continue Anyway".
    const createClient = async (name: string) => {
        setIsLoading(true);
        try {
            const newClient = await addClient({
                name,
                email: formData.email,
                phone: formData.phone,
                dob: formData.dob,
                program: formData.program,
                caseNumber: formData.caseNumber,
                billingType: formData.billingType,
                county: formData.county,
                probationOfficer: formData.probationOfficer,
            });
            onClose();
            // Land the user on the new client's workspace so the create is
            // visible immediately without a manual refresh of the clients list.
            navigate(`/clients/${newClient.id}`);
        } catch (e: any) {
            console.error('addClient failed:', e);
            setError(e?.message || 'Failed to create client. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        setError(null);
        const name = `${formData.firstName} ${formData.lastName}`.trim();
        if (!name) {
            setError('First and last name are required.');
            setStep(1);
            return;
        }
        if (!formData.phone) {
            setError('Phone number is required.');
            setStep(1);
            return;
        }
        // DEFERRED #34: soft pre-insert duplicate check — a speed bump, not a
        // wall. Never blocks; only asks staff to confirm before proceeding.
        setIsLoading(true);
        const matches = await findDuplicateClients(name, formData.phone);
        if (matches.length > 0) {
            setIsLoading(false);
            setDuplicateMatches(matches);
            return;
        }
        await createClient(name);
    };

    const handleContinueAnyway = () => {
        const name = `${formData.firstName} ${formData.lastName}`.trim();
        setDuplicateMatches(null);
        createClient(name);
    };

    // Lock body scroll while the modal is open so the page underneath doesn't
    // scroll when the user wheels the modal contents.
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [isOpen]);

    if (!isOpen) return null;

    // This modal is rendered from MainLayout (sibling of GlobalHeader), NOT
    // from inside GlobalHeader. That's deliberate: GlobalHeader sets
    // backdrop-filter: blur(24px), which creates a containing block for any
    // position: fixed descendants. A previous attempt portaled this modal to
    // document.body to escape that trap; the portal call was correct but the
    // bug still reproduced in production, so we changed the mount point in
    // the React tree itself. Render path is now: MainLayout root <div>
    // (no transform/filter) → this <div fixed inset-0>. ScheduleSessionModal
    // uses the same mount-point pattern and works.
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-client-modal-title"
        >
            {/* Backdrop — its own layer so it always covers the viewport. */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

            {/* Panel — clicks inside don't close. flex-col with min-h-0 on the
                scroll child is what actually makes max-height + internal scroll
                work in a flex column (flex-1 alone keeps min-height: auto, which
                lets content push the parent past its max-height cap). */}
            <div
                onClick={e => e.stopPropagation()}
                className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-white/20 dark:border-slate-700 animate-fade-in-up"
                style={{ maxHeight: 'min(90vh, calc(100dvh - 2rem))', animationDuration: '0.2s' }}
            >
                {/* Header — pinned. */}
                <div className="flex-shrink-0 bg-gray-50/80 dark:bg-slate-800/80 backdrop-blur-md p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                    <div>
                        <h2 id="create-client-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">New Client Intake</h2>
                        <p className="text-sm text-gray-500">Step {step} of 3</p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors"><X size={20} className="text-gray-500" /></button>
                </div>

                {/* Progress Bar — pinned. */}
                <div className="flex-shrink-0 w-full h-1 bg-gray-100 dark:bg-slate-800">
                    <div className="bg-primary h-full transition-all duration-500 ease-out" style={{ width: `${(step / 3) * 100}%` }}></div>
                </div>

                {/* Content — only this region scrolls. */}
                <div className="flex-1 min-h-0 overflow-y-auto p-8">
                    {error && (
                        <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl flex items-start gap-2 text-red-700 dark:text-red-300">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                            <p className="text-xs font-medium leading-relaxed">{error}</p>
                        </div>
                    )}
                    {duplicateMatches && (
                        <div className="mb-6 p-5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-2xl flex items-start gap-3">
                            <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h4 className="font-bold text-amber-800 dark:text-amber-300">Possible duplicate client</h4>
                                {duplicateMatches.map(m => (
                                    <p key={m.id} className="text-sm text-amber-700 dark:text-amber-400/90 mt-2 leading-relaxed">
                                        A client named <strong>{m.name}</strong> with phone <strong>{m.phone}</strong> already
                                        exists — created {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : 'an unknown date'}
                                        {m.email ? `, email ${m.email}` : ''}
                                        {m.caseNumber ? `, case #${m.caseNumber}` : ''}.
                                    </p>
                                ))}
                                <p className="text-xs text-amber-600 dark:text-amber-500/80 mt-3">Continue if this is a different person.</p>
                            </div>
                        </div>
                    )}
                    {step === 1 && (
                        <div className="space-y-6 animate-slide-in-up">
                            <h3 className="font-semibold text-lg flex items-center gap-2 text-slate-800 dark:text-slate-200 border-b pb-2 border-slate-100 dark:border-slate-800">
                                <User className="text-primary" size={20} /> Basic Demographics
                            </h3>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">First Name</label>
                                    <input className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={formData.firstName} onChange={e => handleChange('firstName', e.target.value)} placeholder="e.g. John" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Last Name</label>
                                    <input className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={formData.lastName} onChange={e => handleChange('lastName', e.target.value)} placeholder="e.g. Doe" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Phone Number</label>
                                    <input className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" placeholder="(555) 123-4567" value={formData.phone} onChange={e => handleChange('phone', e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Email Address</label>
                                    <input className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" type="email" value={formData.email} onChange={e => handleChange('email', e.target.value)} placeholder="john@example.com" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Date of Birth</label>
                                <input type="date" className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={formData.dob} onChange={e => handleChange('dob', e.target.value)} />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-slide-in-up">
                            <h3 className="font-semibold text-lg flex items-center gap-2 text-slate-800 dark:text-slate-200 border-b pb-2 border-slate-100 dark:border-slate-800">
                                <Shield className="text-primary" size={20}/> Program & Legal
                            </h3>
                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Program Track</label>
                                {/* Values are the CANONICAL program vocabulary (config/programVocab.ts);
                                    the DB CHECK (20260616) rejects anything else. Labels are friendly. */}
                                <select className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={formData.program} onChange={e => handleChange('program', e.target.value)}>
                                    <option value="SROP">SROP — Serious & Repeat Offender Program (Level IV)</option>
                                    <option value="CIP">CIP — Clinical Intervention Program (Level III)</option>
                                    <option value="SATOP">SATOP (level set by determination)</option>
                                    <option value="ANGER_MANAGEMENT">Anger Management</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Case Number</label>
                                    <input className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={formData.caseNumber} onChange={e => handleChange('caseNumber', e.target.value)} placeholder="e.g. 24-CR-00123" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">County</label>
                                    <select className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={formData.county} onChange={e => handleChange('county', e.target.value)}>
                                        <option>St. Louis</option>
                                        <option>Jefferson</option>
                                        <option>St. Charles</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Probation Officer</label>
                                <input className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={formData.probationOfficer} onChange={e => handleChange('probationOfficer', e.target.value)} placeholder="Name of PO" />
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-slide-in-up">
                            <h3 className="font-semibold text-lg flex items-center gap-2 text-slate-800 dark:text-slate-200 border-b pb-2 border-slate-100 dark:border-slate-800">
                                <CreditCard className="text-primary" size={20}/> Billing Setup
                            </h3>
                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Payment Source</label>
                                <select className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={formData.billingType} onChange={e => handleChange('billingType', e.target.value)}>
                                    <option>Self-Pay</option>
                                    <option>Insurance</option>
                                    <option>Court Mandate (State Funded)</option>
                                </select>
                            </div>
                            
                            <div className="mt-8 p-6 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/50 rounded-2xl flex items-start gap-4">
                                <div className="p-2 bg-green-100 dark:bg-green-800/30 rounded-full text-green-600 dark:text-green-400">
                                    <CheckCircle size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-green-800 dark:text-green-300 text-lg">Ready for Intake</h4>
                                    <p className="text-green-700 dark:text-green-400/80 mt-1 text-sm leading-relaxed">
                                        You are about to create a new client file for <strong>{formData.firstName} {formData.lastName}</strong>. 
                                        An automated welcome email with portal access instructions will be sent to <strong>{formData.email}</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer — pinned. */}
                <div className="flex-shrink-0 p-6 bg-gray-50/80 dark:bg-slate-800/80 backdrop-blur-md border-t border-gray-200 dark:border-slate-700 flex justify-between items-center">
                    {duplicateMatches ? (
                        <>
                            {/* Cancel is the default action — autoFocus so Enter dismisses the
                                warning rather than creating the duplicate. This is a speed
                                bump, not a wall: Continue Anyway always remains available. */}
                            <button autoFocus onClick={() => setDuplicateMatches(null)} className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all transform hover:-translate-y-0.5">
                                Cancel
                            </button>
                            <button onClick={handleContinueAnyway} disabled={isLoading} className="px-6 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all disabled:opacity-70">
                                {isLoading ? <Loader2 className="animate-spin" size={18}/> : null}
                                {isLoading ? 'Creating...' : 'Continue Anyway'}
                            </button>
                        </>
                    ) : (
                        <>
                            {step > 1 ? (
                                <button onClick={() => setStep(s => s - 1)} className="px-5 py-2.5 text-gray-600 hover:text-gray-900 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-2">
                                    <ArrowLeft size={18}/> Back
                                </button>
                            ) : <div></div>}

                            {step < 3 ? (
                                <button onClick={() => setStep(s => s + 1)} className="px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-focus font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all transform hover:-translate-y-0.5">
                                    Next <ArrowRight size={18}/>
                                </button>
                            ) : (
                                <button onClick={handleSubmit} disabled={isLoading} className="px-8 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-bold flex items-center gap-2 shadow-lg shadow-green-600/20 hover:shadow-green-600/40 transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:transform-none">
                                    {isLoading ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18} />}
                                    {isLoading ? 'Creating...' : 'Create Client File'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CreateClientModal;