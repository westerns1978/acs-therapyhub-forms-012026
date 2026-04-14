

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PortalLayout from '../../layouts/PortalLayout';
import Header from '../../components/ui/Header';
import Card from '../../components/ui/Card';
import { supabase } from '../../services/supabase';
import { usePortalClient } from '../../hooks/usePortalClient';
import { FileText, CheckCircle2, Clock, ArrowRight, Upload, X, Loader2, FileUp, ExternalLink, Camera } from 'lucide-react';
import { submitPaperForm } from '../../services/api';
import Modal from '../../components/ui/Modal';
import MobileDocumentUpload from '../../components/portal/MobileDocumentUpload';

// All client-facing forms — matches the real definitions in components/forms/
const CLIENT_FORMS = [
  { id: 'satop-intake', name: 'SATOP Client Intake', 
    category: 'Intake', description: 'Primary intake document for your SATOP program enrollment', required: true },
  { id: 'consent-treatment', name: 'Consent for Treatment', 
    category: 'Legal', description: 'Authorization and acknowledgment for program participation', required: true },
  { id: 'emergency-contact', name: 'Emergency Contact Form', 
    category: 'Intake', description: 'Emergency contact and disclosure authorization', required: true },
  { id: 'authorization-release', name: 'Authorization for Release', 
    category: 'Legal', description: 'Permission to share records with designated parties', required: true },
  { id: 'recovery-plan', name: 'Continuing Recovery Plan', 
    category: 'Treatment', description: 'Your personal plan for maintaining long-term sobriety', required: true },
  { id: 'satop-checklist', name: 'SATOP Program Checklist', 
    category: 'Compliance', description: 'Track your program requirements and completion status', required: false },
  { id: 'telehealth-feedback', name: 'Telehealth Session Feedback', 
    category: 'Clinical', description: 'Help us improve your virtual session experience', required: false },
];

const PaperUploadModal: React.FC<{ 
    isOpen: boolean, 
    onClose: () => void, 
    form: any, 
    clientId: string,
    onSuccess: () => void 
}> = ({ isOpen, onClose, form, clientId, onSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleUpload = async () => {
        if (!file) return;
        setIsUploading(true);
        setError(null);
        try {
            await submitPaperForm(clientId, form.id, form.name, file);
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && (droppedFile.type.startsWith('image/') || droppedFile.type === 'application/pdf')) {
            setFile(droppedFile);
        } else {
            setError('Please upload a PDF or image file.');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Upload Paper Copy: ${form?.name}`}>
            <div className="p-6 space-y-6">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        If you've already filled out a physical copy of this form, you can upload a photo or scan here. 
                        Our AI will process it and update your record automatically.
                    </p>
                </div>

                <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all ${file ? 'border-primary bg-primary/5' : isDragging ? 'border-primary bg-primary/10 scale-[1.02]' : 'border-slate-200 dark:border-slate-700'}`}
                >
                    {file ? (
                        <div className="space-y-4">
                            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm inline-block">
                                <FileUp size={48} className="text-primary mx-auto" />
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white">{file.name}</p>
                                <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                            <button onClick={() => setFile(null)} className="text-xs font-bold text-red-500 uppercase tracking-widest hover:underline">Remove File</button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl inline-block">
                                <Upload size={48} className="text-slate-400" />
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white">
                                    {isDragging ? 'Drop file here' : 'Select a file or take a photo'}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">PDF, JPG, or PNG (Max 10MB)</p>
                            </div>
                            <input 
                                type="file" 
                                id="paper-upload" 
                                className="hidden" 
                                accept="image/*,.pdf" 
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                            />
                            <label 
                                htmlFor="paper-upload" 
                                className="inline-block px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest cursor-pointer hover:scale-105 transition-all"
                            >
                                Choose File
                            </label>
                        </div>
                    )}
                </div>

                {error && <p className="text-sm text-red-500 font-bold text-center">{error}</p>}

                <div className="flex gap-3 pt-4">
                    <button 
                        onClick={onClose} 
                        className="flex-1 px-6 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleUpload}
                        disabled={!file || isUploading}
                        className="flex-1 px-6 py-3 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isUploading ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : 'Upload & Submit'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const PortalDocuments: React.FC = () => {
    const portalClient = usePortalClient();
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploadingForm, setUploadingForm] = useState<any | null>(null);
    const [showMobileScan, setShowMobileScan] = useState(false);
    const navigate = useNavigate();

    const fetchData = async () => {
        if (!portalClient) return;
        setIsLoading(true);
        try {
            const { data } = await supabase
                .from('form_submissions')
                .select('*')
                .eq('client_id', portalClient.id)
                .order('created_at', { ascending: false });
            setSubmissions(data || []);
        } catch (err) {
            console.warn('Failed to load documents:', err);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [portalClient]);

    if (isLoading || !portalClient) {
        return <PortalLayout><div className="text-center p-12">Loading your forms...</div></PortalLayout>;
    }

    const completedFormNames = submissions
        .filter(s => s.status === 'completed' || s.status === 'reviewed')
        .map(s => s.form_name);

    const pendingForms = CLIENT_FORMS.filter(form => !completedFormNames.includes(form.name));
    const completedSubs = submissions.filter(s => s.status === 'completed' || s.status === 'reviewed');
    const requiredPending = pendingForms.filter(f => f.required);
    const optionalPending = pendingForms.filter(f => !f.required);

    return (
        <PortalLayout>
            <div className="max-w-4xl mx-auto space-y-8">
                <Header title="My Forms" subtitle="Complete your required forms online — no paper needed." />

                {/* Scan Document CTA */}
                <button
                    onClick={() => setShowMobileScan(true)}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-primary to-primary-focus text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
                >
                    <Camera size={20} />
                    Scan Paper Document
                </button>

                {/* Progress Summary */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-black text-sm text-slate-800 dark:text-white">Form Completion Progress</h3>
                        <span className="text-sm font-bold text-slate-500">
                            {completedSubs.length} of {CLIENT_FORMS.length} complete
                        </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3">
                        <div 
                            className="bg-gradient-to-r from-green-500 to-emerald-400 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${(completedSubs.length / CLIENT_FORMS.length) * 100}%` }}
                        ></div>
                    </div>
                </div>

                {/* Required Forms */}
                {requiredPending.length > 0 && (
                    <Card title={`Required Forms (${requiredPending.length} remaining)`}>
                        <div className="space-y-3">
                            {requiredPending.map(form => (
                                <div key={form.id} 
                                    className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl hover:shadow-md transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 bg-amber-100 dark:bg-amber-800/30 rounded-xl">
                                            <Clock size={18} className="text-amber-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-amber-900 dark:text-amber-100">{form.name}</h4>
                                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                                                {form.description}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setUploadingForm(form)}
                                            className="p-2.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                                            title="Upload Paper Copy"
                                        >
                                            <Upload size={18} />
                                        </button>
                                        <button
                                            onClick={() => navigate(`/portal/forms/${form.id}`)}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-focus transition-all shadow-md shadow-primary/20 active:scale-95"
                                        >
                                            Start <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {/* Optional Forms */}
                {optionalPending.length > 0 && (
                    <Card title="Optional Forms">
                        <div className="space-y-3">
                            {optionalPending.map(form => (
                                <div key={form.id} 
                                    className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 rounded-xl hover:shadow-md transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                            <FileText size={18} className="text-slate-400" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-slate-200">{form.name}</h4>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {form.description}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setUploadingForm(form)}
                                            className="p-2.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                                            title="Upload Paper Copy"
                                        >
                                            <Upload size={18} />
                                        </button>
                                        <button
                                            onClick={() => navigate(`/portal/forms/${form.id}`)}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                                        >
                                            Start <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {/* All done! */}
                {pendingForms.length === 0 && (
                    <Card>
                        <div className="text-center py-8">
                            <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4" />
                            <h3 className="text-xl font-black text-slate-800 dark:text-white">All Forms Complete!</h3>
                            <p className="text-slate-500 mt-2">You've completed all required and optional forms. Great job!</p>
                        </div>
                    </Card>
                )}

                {/* Completed Submissions */}
                {completedSubs.length > 0 && (
                    <Card title="Completed Forms">
                        <div className="space-y-3">
                            {completedSubs.map(sub => (
                                <div key={sub.id} 
                                    className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 bg-green-100 dark:bg-green-800/30 rounded-xl">
                                            {sub.data?.is_paper_upload ? <FileUp size={18} className="text-green-600" /> : <CheckCircle2 size={18} className="text-green-600" />}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-green-900 dark:text-green-100">
                                                {sub.form_name}
                                                {sub.data?.is_paper_upload && <span className="ml-2 text-[9px] bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded uppercase tracking-widest">Paper Upload</span>}
                                            </h4>
                                            <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                                                Submitted {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'N/A'}
                                                {sub.status === 'reviewed' && ' · Reviewed by counselor'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {sub.data?.file_url && (
                                            <a href={sub.data.file_url} target="_blank" rel="noopener noreferrer" className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-all" title="View Uploaded File">
                                                <ExternalLink size={16} />
                                            </a>
                                        )}
                                        <span className="text-[10px] font-black uppercase tracking-widest text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-800/30 px-3 py-1.5 rounded-lg">
                                            {sub.status === 'reviewed' ? '✓ Reviewed' : '✓ Submitted'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                <PaperUploadModal
                    isOpen={!!uploadingForm}
                    onClose={() => setUploadingForm(null)}
                    form={uploadingForm}
                    clientId={portalClient.id}
                    onSuccess={fetchData}
                />

                {showMobileScan && (
                    <MobileDocumentUpload
                        clientId={portalClient.id}
                        onComplete={fetchData}
                        onClose={() => setShowMobileScan(false)}
                    />
                )}
            </div>
        </PortalLayout>
    );
};

export default PortalDocuments;
