import React, { useState } from 'react';
// FIX: Corrected import path to reference services from the root directory.
import { addClient } from './services/api';
import { X, User, Shield, CreditCard, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';

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
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 animate-fade-in-up">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-gray-50 dark:bg-slate-800 p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">New Client Intake</h2>
                        <p className="text-sm text-gray-500">Step {step} of 3</p>
                    </div>
                    <button onClick={onClose}><X className="text-gray-400 hover:text-gray-600" /></button>
                </div>

                <div className="flex w-full h-1 bg-gray-200 dark:bg-slate-700">
                    <div className="bg-primary h-full transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }}></div>
                </div>

                <div className="p-8 overflow-y-auto flex-1">
                    {step === 1 && (
                        <div className="space-y-4 animate-slide-in-up">
                            <h3 className="font-semibold text-lg flex items-center gap-2 mb-4"><User className="text-primary"/> Basic Information</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold uppercase text-gray-500">First Name</label><input className="w-full p-2 border rounded mt-1 dark:bg-slate-800" value={formData.firstName} onChange={e => handleChange('firstName', e.target.value)} /></div>
                                <div><label className="text-xs font-bold uppercase text-gray-500">Last Name</label><input className="w-full p-2 border rounded mt-1 dark:bg-slate-800" value={formData.lastName} onChange={e => handleChange('lastName', e.target.value)} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold uppercase text-gray-500">Phone</label><input className="w-full p-2 border rounded mt-1 dark:bg-slate-800" placeholder="555-123-4567" value={formData.phone} onChange={e => handleChange('phone', e.target.value)} /></div>
                                <div><label className="text-xs font-bold uppercase text-gray-500">Email</label><input className="w-full p-2 border rounded mt-1 dark:bg-slate-800" type="email" value={formData.email} onChange={e => handleChange('email', e.target.value)} /></div>
                            </div>
                            <div><label className="text-xs font-bold uppercase text-gray-500">Date of Birth</label><input type="date" className="w-full p-2 border rounded mt-1 dark:bg-slate-800" value={formData.dob} onChange={e => handleChange('dob', e.target.value)} /></div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4 animate-slide-in-up">
                            <h3 className="font-semibold text-lg flex items-center gap-2 mb-4"><Shield className="text-primary"/> Program Assignment</h3>
                            <div>
                                <label className="text-xs font-bold uppercase text-gray-500">Program Track</label>
                                <select className="w-full p-2 border rounded mt-1 dark:bg-slate-800" value={formData.program} onChange={e => handleChange('program', e.target.value)}>
                                    <option>SROP</option>
                                    <option>SATOP</option>
                                    <option>REACT</option>
                                    <option>Anger Management</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold uppercase text-gray-500">Case Number</label><input className="w-full p-2 border rounded mt-1 dark:bg-slate-800" value={formData.caseNumber} onChange={e => handleChange('caseNumber', e.target.value)} /></div>
                                <div><label className="text-xs font-bold uppercase text-gray-500">County</label><select className="w-full p-2 border rounded mt-1 dark:bg-slate-800" value={formData.county} onChange={e => handleChange('county', e.target.value)}><option>St. Louis</option><option>Jefferson</option></select></div>
                            </div>
                            <div><label className="text-xs font-bold uppercase text-gray-500">Probation Officer</label><input className="w-full p-2 border rounded mt-1 dark:bg-slate-800" value={formData.probationOfficer} onChange={e => handleChange('probationOfficer', e.target.value)} /></div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4 animate-slide-in-up">
                            <h3 className="font-semibold text-lg flex items-center gap-2 mb-4"><CreditCard className="text-primary"/> Billing Setup</h3>
                            <div>
                                <label className="text-xs font-bold uppercase text-gray-500">Payment Source</label>
                                <select className="w-full p-2 border rounded mt-1 dark:bg-slate-800" value={formData.billingType} onChange={e => handleChange('billingType', e.target.value)}>
                                    <option>Self-Pay</option>
                                    <option>Insurance</option>
                                    <option>Court Mandate</option>
                                </select>
                            </div>
                            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-800 dark:text-green-300 flex gap-2">
                                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                                <div>
                                    <p className="font-bold">Ready to Create</p>
                                    <p>An invite email will be sent to {formData.email} for portal access.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex justify-between bg-gray-50 dark:bg-slate-800">
                    {step > 1 ? (
                        <button onClick={() => setStep(s => s - 1)} className="px-4 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 font-medium flex items-center gap-2"><ArrowLeft size={16}/> Back</button>
                    ) : <div></div>}
                    
                    {step < 3 ? (
                        <button onClick={() => setStep(s => s + 1)} className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-focus font-bold flex items-center gap-2">Next <ArrowRight size={16}/></button>
                    ) : (
                        <button onClick={handleSubmit} disabled={isLoading} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold flex items-center gap-2">
                            {isLoading ? 'Creating...' : 'Create Client File'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CreateClientModal;