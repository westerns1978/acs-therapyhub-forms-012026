
import React, { useState } from 'react';
import { Client, FormSubmission, Form, RecoveryPlanData } from '../../types';
import Card from '../ui/Card';
import AssignFormModal from '../forms/AssignFormModal';
import { PlusCircle, Eye, X, AlertTriangle, CheckCircle, ShieldCheck, FileText, ExternalLink, Loader2, Bell } from 'lucide-react';
import { dbForms } from '../../data/database'; // Using mock forms for now
import { approveFormSubmission } from '../../services/api';

interface ClientFormsTabProps {
  client: Client;
  formSubmissions: FormSubmission[];
  onFormAssigned: () => void;
}

const getStatusPill = (status: FormSubmission['status'], data?: any, dueDate?: Date) => {
    const isOverdue = dueDate && new Date(dueDate) < new Date() && status !== 'Completed' && status !== 'Reviewed';
    if (isOverdue) return 'bg-red-100 text-red-800';
    
    if (status === 'Completed' && data?.requires_review) {
        return 'bg-blue-100 text-blue-800 border border-blue-200';
    }
    
    switch(status) {
        case 'Reviewed': return 'bg-emerald-100 text-emerald-800';
        case 'Completed': return 'bg-green-100 text-green-800';
        case 'In Progress': return 'bg-yellow-100 text-yellow-800';
        case 'Not Started': return 'bg-gray-100 text-gray-800';
    }
};

const ReviewSubmissionModal: React.FC<{ 
    submission: FormSubmission, 
    clientName: string, 
    onClose: () => void,
    onApproved: () => void
}> = ({ submission, clientName, onClose, onApproved }) => {
    const [isApproving, setIsApproving] = useState(false);
    const form = dbForms.find(f => f.id === submission.formId);
    const data = submission.data || {};

    const handleApprove = async () => {
        setIsApproving(true);
        try {
            await approveFormSubmission(submission.id, 'Dan Western'); // Mocking current user
            onApproved();
            onClose();
        } catch (err) {
            console.error('Failed to approve:', err);
        } finally {
            setIsApproving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-background dark:bg-dark-surface rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
                <header className="flex justify-between items-center p-6 border-b bg-slate-50 dark:bg-slate-900/50">
                    <div>
                        <h3 className="text-xl font-black tracking-tight">Review Paper Submission</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">{form?.title} • {clientName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-all"><X size={24} /></button>
                </header>
                
                <main className="flex-1 p-8 overflow-y-auto space-y-8">
                    {/* AI Analysis Section */}
                    <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-3xl space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-800 rounded-xl">
                                <ShieldCheck className="text-indigo-600" size={20} />
                            </div>
                            <h4 className="font-black text-indigo-900 dark:text-indigo-100 uppercase text-xs tracking-widest">AI Neural Analysis (Gemini 3)</h4>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Extracted Summary</p>
                                <p className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed italic">"{data.ai_summary}"</p>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                                {data.ai_tags?.map((tag: string) => (
                                    <span key={tag} className="px-3 py-1 bg-white dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold rounded-lg border border-indigo-100 dark:border-indigo-800">
                                        #{tag}
                                    </span>
                                ))}
                            </div>

                            <div className={`flex items-center gap-3 p-3 rounded-2xl border ${data.is_signed ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                                {data.is_signed ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                                <span className="text-xs font-bold">
                                    {data.is_signed ? 'AI Verified: Signature Detected' : 'AI Warning: No Signature Detected'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Document Preview */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-black text-slate-800 dark:text-white uppercase text-xs tracking-widest">Original Document</h4>
                            <a href={data.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-bold text-primary hover:underline">
                                View Full Size <ExternalLink size={14} />
                            </a>
                        </div>
                        <div className="aspect-[3/4] bg-slate-100 dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden relative group">
                            <iframe src={data.file_url} className="w-full h-full" title="Document Preview" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all pointer-events-none" />
                        </div>
                    </div>
                </main>

                <footer className="p-6 border-t bg-slate-50 dark:bg-slate-900/50 flex gap-4">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-4 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all"
                    >
                        Close
                    </button>
                    <button 
                        onClick={handleApprove}
                        disabled={isApproving}
                        className="flex-[2] py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {isApproving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                        {isApproving ? 'Approving...' : 'Approve & Commit to Record'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

const ViewSubmissionModal: React.FC<{ submission: FormSubmission, clientName: string, onClose: () => void }> = ({ submission, clientName, onClose }) => {
    const data = submission.data as RecoveryPlanData;
    const form = dbForms.find(f => f.id === submission.formId);
    if (!data) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-background dark:bg-dark-surface rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <header className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-bold">{form?.title}: {clientName}</h3>
                    <button onClick={onClose}><X size={24} /></button>
                </header>
                <main className="flex-1 p-6 overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
                    <p><strong>Submitted:</strong> {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : 'N/A'}</p>
                    <hr />
                    <h4>Recovery Goals</h4><p>{data.primaryGoals}</p>
                    <h4>Coping Strategies</h4><p>{data.copingSkills}</p>
                    {data.signatureDataUrl && <><h4>Signature</h4><img src={data.signatureDataUrl} alt="Signature" className="h-16 border rounded bg-white p-1" /></>}
                </main>
            </div>
        </div>
    );
};

const ClientFormsTab: React.FC<ClientFormsTabProps> = ({ client, formSubmissions, onFormAssigned }) => {
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);
    const [reviewingSubmission, setReviewingSubmission] = useState<FormSubmission | null>(null);
    const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);

    const handleSendReminder = async (subId: string) => {
        setSendingReminderId(subId);
        // Simulate API call
        await new Promise(r => setTimeout(r, 1000));
        setSendingReminderId(null);
        alert('Reminder sent to client via Push & SMS.');
    };

    return (
        <Card>
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Assigned Forms</h3>
                <button onClick={() => setIsAssignModalOpen(true)} className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-primary-focus">
                    <PlusCircle size={16} /> Assign New Form
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                    <thead className="bg-surface">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Form Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Assigned</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Due Date</th>
                            <th className="px-6 py-3 text-right text-xs font-medium uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-background divide-y divide-border">
                        {formSubmissions.map(sub => {
                            const form = dbForms.find(f => f.id === sub.formId);
                            const isOverdue = sub.dueDate && new Date(sub.dueDate) < new Date() && sub.status !== 'Completed' && sub.status !== 'Reviewed';
                            const needsReview = sub.data?.requires_review;

                            return (
                                <tr key={sub.id}>
                                    <td className="px-6 py-4 font-medium">
                                        <div className="flex items-center gap-2">
                                            {form?.title}
                                            {sub.data?.is_paper_upload && <FileText size={14} className="text-slate-400" />}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`flex items-center gap-1.5 px-2.5 py-1 w-fit text-[10px] leading-5 font-black uppercase tracking-widest rounded-lg ${getStatusPill(sub.status, sub.data, sub.dueDate)}`}>
                                            {isOverdue && <AlertTriangle size={12}/>}
                                            {sub.status === 'Completed' && sub.data?.requires_review ? 'Requires Review' : (isOverdue ? 'Overdue' : sub.status)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-medium text-slate-500">{sub.assignedAt ? new Date(sub.assignedAt).toLocaleDateString() : 'N/A'}</td>
                                    <td className="px-6 py-4 text-xs font-medium text-slate-500">{sub.dueDate ? new Date(sub.dueDate).toLocaleDateString() : 'N/A'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {(sub.status === 'Not Started' || sub.status === 'In Progress' || isOverdue) && (
                                                <button 
                                                    onClick={() => handleSendReminder(sub.id)}
                                                    disabled={sendingReminderId === sub.id}
                                                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                                    title="Send Reminder"
                                                >
                                                    {sendingReminderId === sub.id ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
                                                </button>
                                            )}
                                            {needsReview && (
                                                <button 
                                                    onClick={() => setReviewingSubmission(sub)} 
                                                    className="flex items-center gap-2 text-[10px] uppercase tracking-widest bg-indigo-600 text-white px-3 py-2 rounded-lg font-black shadow-md shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all"
                                                >
                                                    <ShieldCheck size={14} /> Review
                                                </button>
                                            )}
                                            {(sub.status === 'Completed' || sub.status === 'Reviewed') && !needsReview && (
                                                <button 
                                                    onClick={() => setSelectedSubmission(sub)} 
                                                    className="flex items-center gap-2 text-[10px] uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                                >
                                                    <Eye size={14} /> View
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {isAssignModalOpen && (
                <AssignFormModal
                    isOpen={isAssignModalOpen}
                    onClose={() => setIsAssignModalOpen(false)}
                    onFormAssigned={onFormAssigned}
                    clients={[client]}
                />
            )}
            {selectedSubmission && (
                <ViewSubmissionModal 
                    submission={selectedSubmission}
                    clientName={client.name}
                    onClose={() => setSelectedSubmission(null)}
                />
            )}
            {reviewingSubmission && (
                <ReviewSubmissionModal 
                    submission={reviewingSubmission}
                    clientName={client.name}
                    onClose={() => setReviewingSubmission(null)}
                    onApproved={onFormAssigned}
                />
            )}
        </Card>
    );
};

export default ClientFormsTab;
