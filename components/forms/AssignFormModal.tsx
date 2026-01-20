
import React, { useState } from 'react';
import { Client, Form } from '../../types';
import { assignForm } from '../../services/api';
import { X, Send } from 'lucide-react';

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
        await assignForm(selectedFormId, selectedClientIds, new Date(dueDate));
        setIsSubmitting(false);
        onFormAssigned();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-background dark:bg-dark-surface rounded-lg shadow-xl w-full max-w-lg">
                <form onSubmit={handleSubmit}>
                    <header className="flex justify-between items-center p-4 border-b">
                        <h3 className="text-lg font-semibold">Assign Form</h3>
                        <button type="button" onClick={onClose}><X size={24} /></button>
                    </header>
                    <main className="p-6 space-y-4">
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
                    <footer className="p-4 border-t flex justify-end">
                        <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-primary text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">
                            <Send size={16} /> {isSubmitting ? 'Assigning...' : `Assign Form to ${selectedClientIds.length} Client(s)`}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default AssignFormModal;
