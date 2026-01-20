import React, { useState } from 'react';
import { addClient } from '../../services/api';
import { X, User, Shield, CreditCard, CheckCircle, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';

interface CreateClientModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateClientModal: React.FC<CreateClientModalProps> = ({ isOpen, onClose }) => {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '', lastName: '', email: '', phone: '', dob: '',
        program: 'SROP', caseNumber: '', county: 'St. Louis', probationOfficer: '',
        billingType: 'Self-Pay'
    });

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        try {
            await addClient({
                name: `${formData.firstName} ${formData.lastName}`,
                email: formData.email,
                phone: formData.phone,
                program: formData.program as any,
                caseNumber: formData.caseNumber,
                status: 'Non-Compliant',
                enrollmentDate: new Date().toISOString(),
                complianceScore: 100,
                completionPercentage: 0,
                billingType: formData.billingType as any,
                county: formData.county as any,
                probationOfficer: formData.probationOfficer
            });
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in-up" style={{ animationDuration: '0.2s' }}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20 dark:border-slate-700">
                {/* Header */}
                <div className="bg-gray-50/80 dark:bg-slate-800/80 backdrop-blur-md p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">New Client Intake</h2>
                        <p className="text-sm text-gray-500">Step {step} of 3</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors"><X size={20} className="text-gray-500" /></button>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1 bg-gray-100 dark:bg-slate-800">
                    <div className="bg-primary h-full transition-all duration-500 ease-out" style={{ width: `${(step / 3) * 100}%` }}></div>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto flex-1">
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
                                <select className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={formData.program} onChange={e => handleChange('program', e.target.value)}>
                                    <option>SROP (SATOP Recidivism Reduction)</option>
                                    <option>SATOP Level IV</option>
                                    <option>REACT</option>
                                    <option>Anger Management</option>
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

                {/* Footer */}
                <div className="p-6 bg-gray-50/80 dark:bg-slate-800/80 backdrop-blur-md border-t border-gray-200 dark:border-slate-700 flex justify-between items-center">
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
                </div>
            </div>
        </div>
    );
};

export default CreateClientModal;