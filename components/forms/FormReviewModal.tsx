
import React, { useState } from 'react';
import { FormSubmission, RecoveryPlanData } from '../../types';
import { approveFormSubmission } from '../../services/api';
import { X, CheckCircle, AlertCircle, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { dbForms } from '../../data/database';

interface FormReviewModalProps {
    submission: FormSubmission;
    clientName: string;
    onClose: () => void;
    onApproved: () => void;
}

const FormReviewModal: React.FC<FormReviewModalProps> = ({ submission, clientName, onClose, onApproved }) => {
    const [isApproving, setIsApproving] = useState(false);
    const form = dbForms.find(f => f.id === submission.formId);
    const isPaper = submission.data?.is_paper_upload;
    const aiSummary = submission.data?.ai_summary;
    const isSigned = submission.data?.is_signed;

    const handleApprove = async () => {
        setIsApproving(true);
        try {
            await approveFormSubmission(submission.id, 'Dan Western'); // Mock reviewer
            onApproved();
            onClose();
        } catch (error) {
            console.error('Failed to approve:', error);
        } finally {
            setIsApproving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-background dark:bg-dark-surface rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <header className="flex justify-between items-center p-6 border-b">
                    <div>
                        <h3 className="text-xl font-bold">Review Submission: {form?.title}</h3>
                        <p className="text-sm text-slate-500">Client: {clientName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all">
                        <X size={24} />
                    </button>
                </header>
                
                <main className="flex-1 p-6 overflow-y-auto space-y-6">
                    {isPaper ? (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl">
                                <div className="p-3 bg-blue-100 dark:bg-blue-800 rounded-xl">
                                    <FileText className="text-blue-600" size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-blue-900 dark:text-blue-100">AI-Extracted Paper Submission</h4>
                                    <p className="text-xs text-blue-700 dark:text-blue-300">This form was uploaded as a paper copy and processed by Gemini.</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">AI Summary</h4>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 italic text-sm leading-relaxed">
                                    "{aiSummary || 'No summary available.'}"
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    {isSigned ? (
                                        <CheckCircle className="text-green-500" size={20} />
                                    ) : (
                                        <AlertCircle className="text-red-500" size={20} />
                                    )}
                                    <span className="font-bold text-sm">AI Signature Verification</span>
                                </div>
                                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${isSigned ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {isSigned ? 'Verified Signed' : 'No Signature Detected'}
                                </span>
                            </div>

                            {submission.data?.file_url && (
                                <a 
                                    href={submission.data.file_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-500 hover:text-primary hover:border-primary transition-all font-bold"
                                >
                                    <ExternalLink size={18} /> View Original Upload
                                </a>
                            )}
                        </div>
                    ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                            <p><strong>Submitted:</strong> {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : 'N/A'}</p>
                            <hr />
                            {/* Render digital form data here if needed, but usually digital forms are auto-approved or handled differently */}
                            <p>Digital submission review not yet implemented for this view.</p>
                        </div>
                    )}
                </main>

                <footer className="p-6 border-t bg-slate-50 dark:bg-slate-900/50 flex gap-4">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-4 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                        Close
                    </button>
                    <button 
                        onClick={handleApprove}
                        disabled={isApproving}
                        className="flex-3 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isApproving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                        {isApproving ? 'Approving...' : 'Approve & Commit to Record'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default FormReviewModal;
