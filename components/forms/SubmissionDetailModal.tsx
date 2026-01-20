import React from 'react';
import { FormSubmission, Client, Form } from '../../types';
import { X, CheckSquare, HardDrive } from 'lucide-react';

interface SubmissionDetailModalProps {
    submission: FormSubmission;
    client: Client | undefined;
    form: Form | undefined;
    onClose: () => void;
    onMarkReviewed: (submission: FormSubmission) => void;
}

// Helper to convert camelCase to Title Case
const toTitleCase = (str: string) => {
    const result = str.replace(/([A-Z])/g, " $1");
    return result.charAt(0).toUpperCase() + result.slice(1);
};

// Recursive renderer for the form data
const DataRenderer: React.FC<{ data: any }> = ({ data }) => {
    if (typeof data !== 'object' || data === null || typeof data === 'boolean') {
        return <p>{String(data)}</p>;
    }

    if (Array.isArray(data)) {
        return (
            <ul className="list-disc list-inside pl-4 space-y-2">
                {data.map((item, index) => (
                    <li key={index}>
                        <DataRenderer data={item} />
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <div className="space-y-3">
            {Object.entries(data).map(([key, value]) => {
                 if (key === 'signatureDataUrl' && typeof value === 'string') {
                    return (
                        <div key={key}>
                            <p className="font-semibold text-gray-600 dark:text-slate-400">{toTitleCase(key)}</p>
                            <img src={value} alt="Signature" className="h-16 mt-1 border rounded bg-white p-1" />
                        </div>
                    )
                 }
                return (
                    <div key={key}>
                        <p className="font-semibold text-gray-600 dark:text-slate-400">{toTitleCase(key)}</p>
                        <div className="pl-2 border-l-2 ml-1">
                            <DataRenderer data={value} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const SubmissionDetailModal: React.FC<SubmissionDetailModalProps> = ({ submission, client, form, onClose, onMarkReviewed }) => {
    if (!client || !form) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-background dark:bg-dark-surface rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <header className="flex justify-between items-start p-4 border-b">
                    <div>
                        <h3 className="text-lg font-bold">{form.title}</h3>
                        <p className="text-sm text-on-surface-secondary">For: {client.name} | Submitted: {submission.submittedAt?.toLocaleDateString()}</p>
                    </div>
                    <button onClick={onClose}><X size={24} /></button>
                </header>
                <main className="flex-1 p-6 overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
                    {submission.data ? <DataRenderer data={submission.data} /> : <p>No submission data available.</p>}
                </main>
                <footer className="p-4 border-t flex justify-between items-center">
                     {client.folder_link && (
                        <a href={client.folder_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm bg-gray-100 dark:bg-slate-700 px-3 py-1.5 rounded-md font-semibold">
                            <HardDrive size={14} /> View Client's Drive Folder
                        </a>
                     )}
                    {submission.status !== 'Reviewed' && (
                        <button onClick={() => onMarkReviewed(submission)} className="flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-4 rounded-lg">
                            <CheckSquare size={16} /> Mark as Reviewed
                        </button>
                    )}
                </footer>
            </div>
        </div>
    );
};

export default SubmissionDetailModal;