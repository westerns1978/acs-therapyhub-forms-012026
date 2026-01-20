
import React, { useState } from 'react';
import { Client, FormSubmission, Form, RecoveryPlanData } from '../../types';
import Card from '../ui/Card';
import AssignFormModal from '../forms/AssignFormModal';
import { PlusCircle, Eye, X, AlertTriangle } from 'lucide-react';
import { dbForms } from '../../data/database'; // Using mock forms for now

interface ClientFormsTabProps {
  client: Client;
  formSubmissions: FormSubmission[];
  onFormAssigned: () => void;
}

const getStatusPill = (status: FormSubmission['status'], dueDate?: Date) => {
    const isOverdue = dueDate && new Date(dueDate) < new Date() && status !== 'Completed';
    if (isOverdue) return 'bg-red-100 text-red-800';
    
    switch(status) {
        case 'Completed': return 'bg-green-100 text-green-800';
        case 'In Progress': return 'bg-yellow-100 text-yellow-800';
        case 'Not Started': return 'bg-gray-100 text-gray-800';
    }
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
                            const isOverdue = sub.dueDate && new Date(sub.dueDate) < new Date() && sub.status !== 'Completed';
                            return (
                                <tr key={sub.id}>
                                    <td className="px-6 py-4 font-medium">{form?.title}</td>
                                    <td className="px-6 py-4">
                                        <span className={`flex items-center gap-1.5 px-2 py-1 w-fit text-xs leading-5 font-semibold rounded-full ${getStatusPill(sub.status, sub.dueDate)}`}>
                                            {isOverdue && <AlertTriangle size={12}/>}
                                            {isOverdue ? 'Overdue' : sub.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">{sub.assignedAt ? new Date(sub.assignedAt).toLocaleDateString() : 'N/A'}</td>
                                    <td className="px-6 py-4">{sub.dueDate ? new Date(sub.dueDate).toLocaleDateString() : 'N/A'}</td>
                                    <td className="px-6 py-4 text-right">
                                        {sub.status === 'Completed' && (
                                            <button onClick={() => setSelectedSubmission(sub)} className="flex items-center gap-2 ml-auto text-sm bg-blue-100 text-blue-800 px-3 py-1.5 rounded-md font-semibold">
                                                <Eye size={14} /> View
                                            </button>
                                        )}
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
        </Card>
    );
};

export default ClientFormsTab;
