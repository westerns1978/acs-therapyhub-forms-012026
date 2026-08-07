
import React, { useState } from 'react';
import { Client, Form } from '../../types';
import { assignForm } from '../../services/api';
import { X, Send } from 'lucide-react';
import ModalPortal from '../ui/ModalPortal';

interface AssignFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onFormAssigned: () => void;
    clients: Client[];
    forms?: Form[];
}

const AssignFormModal: React.FC<AssignFormModalProps> = ({ isOpen, onClose, onFormAssigned, clients, forms = [] }) => {
    const [selectedFormId, setSelectedFormId] = useState<string>(forms.length > 0 ? forms[0].id : '');
    const [selectedClientIds, setSelectedClientIds] = useState<string[]>(clients.length === 1 ? [clients[0].id] : []);
    const [dueDate, setDueDate] = useState(() => {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek.toISOString().split('T')[0];
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const isBulkMode = clients.length > 1;

    const handleClientSelection = (clientId: string) => {
        setSelectedClientIds(prev => {
            if (prev.includes(clientId)) {
                return prev.filter(id => id !== clientId);
            } else {
                return [...prev, clientId];
            }
        });
    };
    
    const handleSelectAll = () => {
        if(selectedClientIds.length === clients.length) {
            setSelectedClientIds([]);
        } else {
            setSelectedClientIds(clients.map(c => c.id));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFormId || selectedClientIds.length === 0 || !dueDate) return;

        setIsSubmitting(true);
        setSubmitError(null);
        try {
            await assignForm(selectedFormId, selectedClientIds, new Date(dueDate));
            onFormAssigned();
            onClose();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to assign form';
            setSubmitError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            {/* max-h-[90vh] + the form as a min-h-0 flex column: the client
                checklist in bulk mode can be long, so the middle scrolls and the
                Assign button in the footer is always on screen. */}
            <div className="bg-background dark:bg-dark-surface rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
                <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
                    <header className="flex justify-between items-center p-4 border-b flex-shrink-0">
                        <h3 className="text-lg font-semibold">Assign Form</h3>
                        <button type="button" onClick={onClose}><X size={24} /></button>
                    </header>
                    <main className="p-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                        <div>
                            <label className="block text-sm font-medium mb-1">Form Template</label>
                            <select value={selectedFormId} onChange={e => setSelectedFormId(e.target.value)} className="w-full p-2 border rounded-md">
                                {forms.map(form => <option key={form.id} value={form.id}>{form.title}</option>)}
                            </select>
                        </div>
                        {isBulkMode && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Assign to Clients ({selectedClientIds.length})</label>
                                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                                    <div className="flex items-center gap-2 p-1">
                                        <input type="checkbox" id="select-all-clients" checked={selectedClientIds.length === clients.length} onChange={handleSelectAll} />
                                        <label htmlFor="select-all-clients" className="font-semibold">Select All</label>
                                    </div>
                                    {clients.map(client => (
                                        <div key={client.id} className="flex items-center gap-2 p-1 hover:bg-surface rounded">
                                            <input type="checkbox" id={`client-${client.id}`} checked={selectedClientIds.includes(client.id)} onChange={() => handleClientSelection(client.id)} />
                                            <label htmlFor={`client-${client.id}`}>{client.name}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                         <div>
                            <label className="block text-sm font-medium mb-1">Due Date</label>
                            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required className="w-full p-2 border rounded-md" />
                        </div>
                    </main>
                    {submitError && (
                        <div className="mx-4 mb-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 text-xs text-red-700 dark:text-red-300">
                            {submitError}
                        </div>
                    )}
                    <footer className="p-4 border-t flex justify-end flex-shrink-0">
                        <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-primary text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">
                            <Send size={16} /> {isSubmitting ? 'Assigning...' : `Assign Form to ${selectedClientIds.length} Client(s)`}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
        </ModalPortal>
    );
};

export default AssignFormModal;
