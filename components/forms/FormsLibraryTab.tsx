
import React, { useState, useEffect } from 'react';
import { getForms, getClients } from '../../services/api';
import { Form, Client } from '../../types';
import Card from '../ui/Card';
import { PlusCircle, Search } from 'lucide-react';
import AssignFormModal from './AssignFormModal';
import LoadingSpinner from '../ui/LoadingSpinner';

interface FormsLibraryTabProps {
    onFormAssigned: () => void;
}

const FormsLibraryTab: React.FC<FormsLibraryTabProps> = ({ onFormAssigned }) => {
    const [forms, setForms] = useState<Form[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedForm, setSelectedForm] = useState<Form | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const [formsData, clientsData] = await Promise.all([getForms(), getClients()]);
            setForms(formsData);
            setClients(clientsData.filter(c => c.status !== 'Archived'));
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const handleAssignClick = (form: Form) => {
        setSelectedForm(form);
        setIsAssignModalOpen(true);
    };

    const filteredForms = forms.filter(f => f.title.toLowerCase().includes(searchTerm.toLowerCase()));

    if (isLoading) return <LoadingSpinner />;

    return (
        <div>
            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search form templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-background dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-lg"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredForms.map(form => (
                    <Card key={form.id}>
                        <h3 className="font-bold text-lg">{form.title}</h3>
                        <p className="text-sm text-surface-secondary-content mt-1 h-10">{form.description}</p>
                        <div className="mt-4 flex justify-between items-center">
                            <span className="text-xs font-semibold bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">{form.category}</span>
                            <button onClick={() => handleAssignClick(form)} className="flex items-center gap-2 text-sm bg-primary text-white px-3 py-1.5 rounded-md font-semibold hover:bg-primary-focus shadow-sm transition-colors">
                                <PlusCircle size={14} /> Assign
                            </button>
                        </div>
                    </Card>
                ))}
            </div>
            
            {isAssignModalOpen && selectedForm && (
                <AssignFormModal
                    isOpen={isAssignModalOpen}
                    onClose={() => setIsAssignModalOpen(false)}
                    onFormAssigned={() => {
                        onFormAssigned();
                    }}
                    clients={clients}
                    forms={[selectedForm]}
                />
            )}
        </div>
    );
};

export default FormsLibraryTab;
