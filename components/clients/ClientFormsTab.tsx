
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, FormSubmission, Form, RecoveryPlanData } from '../../types';
import Card from '../ui/Card';
import { SignedFileLink, SignedFileFrame } from '../ui/SignedFile';
import { Eye, X, AlertTriangle, CheckCircle, ShieldCheck, FileText, ExternalLink, Loader2, PencilLine, Printer, FilePlus } from 'lucide-react';
import AssignFormsToClientModal from '../forms/AssignFormsToClientModal';
import type { SatopLevel } from '../../config/satopFees';
import { approveFormSubmission } from '../../services/api';
import { normalizeSubmissionStatus, SUBMISSION_STATUS_LABELS } from '../../config/formSubmissionStatus';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../ui/Modal';
import { SubmissionViewer, RecordPrintRoot, printRecord } from '../forms/SubmissionViewer';
import { definitionForSubmission, submissionTitle, FORM_DEFINITION_BY_ID } from '../../config/formDefinitions';
import { FORM_REGISTRY } from '../../config/formRegistry';

interface ClientFormsTabProps {
  client: Client;
  formSubmissions: FormSubmission[];
  onFormAssigned: () => void;
  /** Signed-determination level — drives which forms the assign modal badges as
   *  REQUIRED. null = not established, so nothing is marked required. */
  determinedLevel?: SatopLevel | null;
}

// Status comparisons go through normalizeSubmissionStatus — the DB carries both
// 'completed' and 'Completed' (mixed writers), so raw literals misrender half the rows.
const getStatusPill = (status: FormSubmission['status'], data?: any, dueDate?: Date) => {
    const s = normalizeSubmissionStatus(status);
    const isOverdue = dueDate && new Date(dueDate) < new Date() && s !== 'completed' && s !== 'reviewed';
    // Outline badges, no fill (2026-07-28). "Needs review" is the one ACTIONABLE
    // state here, so it takes brand maroon rather than the blue it used to borrow.
    if (isOverdue) return 'border border-danger-400 text-danger-700 dark:text-danger-400';

    // J4b role separation: BRAND never renders as a status badge - pending-on-staff
    // takes warning ochre.
    if (s === 'completed' && data?.requires_review) {
        return 'border border-warning-600 text-warning-700 dark:border-warning-400 dark:text-warning-400';
    }

    switch(s) {
        case 'reviewed': return 'border border-success-300 text-success-700 dark:text-success-400';
        case 'completed': return 'border border-success-300 text-success-700 dark:text-success-400';
        case 'in_progress': return 'border border-warning-300 text-warning-700 dark:text-warning-400';
        case 'not_started': return 'border border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300';
    }
};

const ReviewSubmissionModal: React.FC<{ 
    submission: FormSubmission, 
    clientName: string, 
    onClose: () => void,
    onApproved: () => void
}> = ({ submission, clientName, onClose, onApproved }) => {
    const { user } = useAuth();
    const [isApproving, setIsApproving] = useState(false);
    const [approveError, setApproveError] = useState<string | null>(null);
    // Title from the real catalog (definition first, registry second) — never the
    // retired dbForms mock (2026-07-28).
    const formTitle = definitionForSubmission(submission.formId, submission.formName)?.title
        ?? FORM_REGISTRY.find(f => f.id === submission.formId)?.title
        ?? submission.formName;
    const data = submission.data || {};

    const handleApprove = async () => {
        setIsApproving(true);
        setApproveError(null);
        try {
            // reviewed_by = the acting user's auth uuid. The old hardcoded
            // 'Dan Western' string was rejected by the uuid column on every
            // click and the catch below swallowed it — the modal closed as if
            // approved while nothing was written. On failure we now keep the
            // modal OPEN and show the error; success is only asserted when
            // the write actually happened.
            await approveFormSubmission(submission.id, user?.id ?? null);
            onApproved();
            onClose();
        } catch (err: any) {
            console.error('Failed to approve:', err);
            setApproveError(err?.message || 'Approval failed — the record was NOT updated. Please try again.');
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
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">{submissionTitle(formTitle, clientName)}</p>
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

                            {/* Normalized to the semantic tokens (2026-08-07) — raw
                                green-/red- literals happened to re-tone to the same SAGE/
                                BRICK ramps as success/danger, so this was not visibly wrong,
                                but it could silently drift if the raw Tailwind families are
                                ever unpinned from the status ramps in index.html. */}
                            <div className={`flex items-center gap-3 p-3 rounded-2xl border ${data.is_signed ? 'bg-success-50 border-success-100 text-success-700' : 'bg-danger-50 border-danger-100 text-danger-700'}`}>
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
                            <SignedFileLink filePath={data.file_path} className="flex items-center gap-2 text-xs font-bold text-primary hover:underline">
                                View Full Size <ExternalLink size={14} />
                            </SignedFileLink>
                        </div>
                        <div className="aspect-[3/4] bg-slate-100 dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden relative group">
                            <SignedFileFrame filePath={data.file_path} className="w-full h-full" title="Document Preview" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all pointer-events-none" />
                        </div>
                    </div>
                </main>

                {approveError && (
                    <div className="mx-6 mb-2 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400">
                        <AlertTriangle size={18} className="shrink-0" />
                        <span className="text-xs font-bold leading-relaxed">{approveError}</span>
                    </div>
                )}
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

/**
 * Rebuilt 2026-07-28. The old modal (a) looked the title up in the RETIRED
 * dbForms mock — every real form missed and the header rendered ": <client>"
 * with a leading colon — and (b) hardcoded RecoveryPlan's two field keys as
 * the body for EVERY form type, so other forms showed bare section labels with
 * no values. It now renders through the shared SubmissionViewer (real labels
 * from the form's own definition, "Not answered" for empty fields) with the
 * actions the queue implies: mark reviewed (approveFormSubmission — the same
 * real write the Forms-page queue uses) and Print / Save as PDF (the
 * committed-record layout via RecordPrintRoot).
 */
const ViewSubmissionModal: React.FC<{
    submission: FormSubmission,
    clientName: string,
    onClose: () => void,
    onChanged: () => void,
}> = ({ submission, clientName, onClose, onChanged }) => {
    const { user } = useAuth();
    const [isApproving, setIsApproving] = useState(false);
    const [approveError, setApproveError] = useState<string | null>(null);
    const definition = definitionForSubmission(submission.formId, submission.formName);
    const title = submissionTitle(definition?.title ?? submission.formName, clientName);
    const status = normalizeSubmissionStatus(submission.status);

    const handleMarkReviewed = async () => {
        setIsApproving(true);
        setApproveError(null);
        try {
            await approveFormSubmission(submission.id, user?.id ?? null);
            onChanged();
            onClose();
        } catch (err: any) {
            setApproveError(err?.message || 'Review failed — the record was NOT updated. Please try again.');
        } finally {
            setIsApproving(false);
        }
    };

    return (
        <Modal isOpen onClose={onClose} title={title} maxWidth="max-w-3xl">
            <div className="p-6">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                    {submission.submittedAt
                        ? `Submitted ${new Date(submission.submittedAt).toLocaleString()}`
                        : 'Submission date not recorded'}
                </p>
                <SubmissionViewer formId={submission.formId} formName={submission.formName} data={submission.data} />
            </div>
            {approveError && (
                <div className="mx-6 mb-3 p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl flex items-center gap-2 text-danger-700 dark:text-danger-300 text-xs font-semibold">
                    <AlertTriangle size={14} className="shrink-0" /> {approveError}
                </div>
            )}
            <footer className="px-6 py-4 border-t border-hairline dark:border-slate-700/60 flex justify-end gap-3">
                <button
                    // Wrapped, NOT `onClick={printRecord}` — a bare reference would pass the
                    // MouseEvent as the audit context and the print would silently go unlogged.
                    onClick={() => printRecord({
                        submissionId: submission.id,
                        clientId: submission.clientId,
                        formId: submission.formId,
                        formName: definition?.title ?? submission.formName,
                        committedAt: submission.submittedAt ? String(submission.submittedAt) : null,
                    })}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-sm font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                    <Printer size={15} /> Print / Save as PDF
                </button>
                {status === 'completed' && (
                    <button
                        onClick={handleMarkReviewed}
                        disabled={isApproving}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-focus transition-colors disabled:opacity-50"
                    >
                        {isApproving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                        {isApproving ? 'Saving…' : 'Mark reviewed'}
                    </button>
                )}
            </footer>
            <RecordPrintRoot
                formId={submission.formId}
                formName={definition?.title ?? submission.formName}
                data={submission.data}
                committedAt={submission.submittedAt ? String(submission.submittedAt) : null}
            />
        </Modal>
    );
};

const ClientFormsTab: React.FC<ClientFormsTabProps> = ({ client, formSubmissions, onFormAssigned, determinedLevel = null }) => {
    const [assignOpen, setAssignOpen] = useState(false);
    const navigate = useNavigate();
    const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);
    const [reviewingSubmission, setReviewingSubmission] = useState<FormSubmission | null>(null);
    // The old "Send Reminder" button here was a setTimeout + alert('Reminder sent
    // to client via Push & SMS.') — no push, no SMS, no write. Same class as the
    // messaging guard (Batch F): staff believing a client was nudged when nothing
    // was sent. Removed 2026-07-28; do not reintroduce without a real transport.

    return (
        <Card>
             <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-xl font-bold">Assigned Forms</h3>
                {/* Client-scoped assign. Deliberately NOT the Forms Library's
                    multi-client picker: this one cannot reach another chart. */}
                <button
                    onClick={() => setAssignOpen(true)}
                    className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary-focus transition-colors shadow-sm"
                >
                    <FilePlus size={14} /> Assign forms
                </button>
            </div>

            <div className="overflow-x-auto">
                {/* K5: was `divide-border` with NO dark: sibling, so dark mode painted
                    the light cream border (#DFD9D1) across a charcoal card at 11.3:1 —
                    a glaring stripe, not a rule. Both modes now on the grid tokens. */}
                <table className="min-w-full divide-y divide-grid-line-strong dark:divide-dark-grid-line-strong">
                    <thead className="bg-surface">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Form Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Assigned</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Due Date</th>
                            <th className="px-6 py-3 text-right text-xs font-medium uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-background divide-y divide-grid-line dark:divide-dark-grid-line">
                        {formSubmissions.map(sub => {
                            // Real catalog, not the retired dbForms mock (2026-07-28).
                            const formTitle = FORM_DEFINITION_BY_ID[sub.formId]?.title
                                ?? FORM_REGISTRY.find(f => f.id === sub.formId)?.title
                                ?? sub.formName ?? sub.formId;
                            const status = normalizeSubmissionStatus(sub.status);
                            const isOverdue = sub.dueDate && new Date(sub.dueDate) < new Date() && status !== 'completed' && status !== 'reviewed';
                            const needsReview = sub.data?.requires_review;

                            return (
                                <tr key={sub.id}>
                                    <td className="px-6 py-4 font-medium">
                                        <div className="flex items-center gap-2">
                                            {formTitle}
                                            {sub.data?.is_paper_upload && <FileText size={14} className="text-slate-400" />}
                                            {sub.data?.signed && <CheckCircle size={14} className="text-emerald-500" />}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`flex items-center gap-1.5 px-2.5 py-1 w-fit text-[10px] leading-5 font-black uppercase tracking-widest rounded-lg ${getStatusPill(sub.status, sub.data, sub.dueDate)}`}>
                                            {isOverdue && <AlertTriangle size={12}/>}
                                            {status === 'completed' && sub.data?.requires_review ? 'Requires Review' : (isOverdue ? 'Overdue' : SUBMISSION_STATUS_LABELS[status])}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-medium text-slate-500">{sub.assignedAt ? new Date(sub.assignedAt).toLocaleDateString() : 'N/A'}</td>
                                    <td className="px-6 py-4 text-xs font-medium text-slate-500">{sub.dueDate ? new Date(sub.dueDate).toLocaleDateString() : 'N/A'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {(status === 'not_started' || status === 'in_progress' || isOverdue) && (
                                                <>
                                                    <button
                                                        onClick={() => navigate(`/forms?clientId=${client.id}&open=${sub.formId}`)}
                                                        className="flex items-center gap-2 text-[10px] uppercase tracking-widest bg-primary text-white px-3 py-2 rounded-lg font-black shadow-md hover:bg-primary-focus transition-all"
                                                        title={`Fill out this form for ${client.name}`}
                                                    >
                                                        <PencilLine size={14} /> Fill Out
                                                    </button>
                                                </>
                                            )}
                                            {needsReview && (
                                                <button 
                                                    onClick={() => setReviewingSubmission(sub)} 
                                                    className="flex items-center gap-2 text-[10px] uppercase tracking-widest bg-indigo-600 text-white px-3 py-2 rounded-lg font-black shadow-md shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all"
                                                >
                                                    <ShieldCheck size={14} /> Review
                                                </button>
                                            )}
                                            {(status === 'completed' || status === 'reviewed') && !needsReview && (
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

            {selectedSubmission && (
                <ViewSubmissionModal
                    submission={selectedSubmission}
                    clientName={client.name}
                    onClose={() => setSelectedSubmission(null)}
                    onChanged={onFormAssigned}
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

            <AssignFormsToClientModal
                isOpen={assignOpen}
                onClose={() => setAssignOpen(false)}
                client={client}
                determinedLevel={determinedLevel}
                formSubmissions={formSubmissions}
                onAssigned={onFormAssigned}
            />
        </Card>
    );
};

export default ClientFormsTab;
