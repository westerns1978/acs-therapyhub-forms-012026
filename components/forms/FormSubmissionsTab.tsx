
import React, { useState, useMemo, useEffect } from 'react';
import Card from '../ui/Card';
import { getClients, getForms, saveFormSubmission } from '../../services/api';
import { Form, Client, FormSubmission } from '../../types';
import { Eye, CheckSquare, AlertTriangle, Search, ArrowUp, ArrowDown } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import SubmissionDetailModal from '../forms/SubmissionDetailModal';

type SortKey = 'clientName' | 'formName' | 'submittedAt' | 'status';

const SortableHeader: React.FC<{
    title: string;
    sortKey: SortKey;
    sortConfig: { key: SortKey; direction: 'asc' | 'desc' };
    setSortConfig: React.Dispatch<React.SetStateAction<{ key: SortKey; direction: 'asc' | 'desc' }>>;
    className?: string;
}> = ({ title, sortKey, sortConfig, setSortConfig, className }) => {
    const isSorting = sortConfig.key === sortKey;
    const direction = isSorting ? sortConfig.direction : 'asc';

    const handleSort = () => {
        const newDirection = isSorting && direction === 'asc' ? 'desc' : 'asc';
        setSortConfig({ key: sortKey, direction: newDirection });
    };

    return (
        <th onClick={handleSort} className={`px-6 py-3 text-left text-xs font-medium uppercase cursor-pointer ${className}`}>
            <div className="flex items-center gap-1">
                {title}
                {isSorting && (direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
            </div>
        </th>
    );
};

interface FormSubmissionsTabProps {
    submissions: FormSubmission[];
    onUpdate: () => void;
}

const FormSubmissionsTab: React.FC<FormSubmissionsTabProps> = ({ submissions: initialSubmissions, onUpdate }) => {
    const [submissions, setSubmissions] = useState<FormSubmission[]>(initialSubmissions);
    const [clients, setClients] = useState<Client[]>([]);
    const [forms, setForms] = useState<Form[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'submittedAt', direction: 'desc' });
    const { user } = useAuth();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const [clientsData, formsData] = await Promise.all([
                getClients(),
                getForms()
            ]);
            setClients(clientsData);
            setForms(formsData);
            setSubmissions(initialSubmissions);
            setIsLoading(false);
        };
        fetchData();
    }, [initialSubmissions]);
    
    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);
    const formMap = useMemo(() => new Map(forms.map(f => [f.id, f.title])), [forms]);

    const getStatusText = (sub: FormSubmission): 'Submitted' | 'Reviewed' | 'Pending' => {
        if (sub.status === 'Reviewed') return 'Reviewed';
        if (sub.status === 'Completed') return 'Submitted';
        return 'Pending';
    }
    
    const getStatusBadge = (status: 'Submitted' | 'Reviewed' | 'Pending') => {
        switch(status) {
            case 'Submitted': return 'bg-red-100 text-red-800';
            case 'Reviewed': return 'bg-green-100 text-green-800';
            case 'Pending': return 'bg-amber-100 text-amber-800';
        }
    };


    const filteredAndSortedSubmissions = useMemo(() => {
        let filtered = submissions.map(s => ({
            ...s,
            clientName: clientMap.get(s.clientId) || 'Unknown Client',
            formName: formMap.get(s.formId) || 'Unknown Form',
            computedStatus: getStatusText(s)
        }));

        if (searchTerm) {
            const lowercasedFilter = searchTerm.toLowerCase();
            filtered = filtered.filter(s => 
                s.clientName.toLowerCase().includes(lowercasedFilter) || 
                s.formName.toLowerCase().includes(lowercasedFilter)
            );
        }
        
        filtered.sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (aValue === undefined || aValue === null) return 1;
            if (bValue === undefined || bValue === null) return -1;
            
            let comparison = 0;
            if (aValue > bValue) {
                comparison = 1;
            } else if (aValue < bValue) {
                comparison = -1;
            }
            
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });

        return filtered;
    }, [submissions, searchTerm, clientMap, formMap, sortConfig]);

    const handleMarkAsReviewed = async (submission: FormSubmission) => {
        const updatedSubmission: FormSubmission = {
            ...submission,
            status: 'Reviewed',
            reviewedAt: new Date(),
            reviewedBy: user?.name || 'System'
        };
        await saveFormSubmission(updatedSubmission);
        onUpdate();
        setSelectedSubmission(null);
    };

    if (isLoading) return <LoadingSpinner />;

    return (
        <Card noPadding>
            <div className="flex justify-between items-center p-4 border-b">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by client or form..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-64 pl-9 pr-3 py-2 text-sm bg-background dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-lg"
                    />
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                    <thead className="bg-surface">
                        <tr>
                            <SortableHeader title="Client" sortKey="clientName" sortConfig={sortConfig} setSortConfig={setSortConfig} />
                            <SortableHeader title="Form" sortKey="formName" sortConfig={sortConfig} setSortConfig={setSortConfig} />
                            <SortableHeader title="Submitted" sortKey="submittedAt" sortConfig={sortConfig} setSortConfig={setSortConfig} />
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-background divide-y divide-border">
                        {filteredAndSortedSubmissions.map(sub => (
                            <tr key={sub.id}>
                                <td className="px-6 py-4 font-medium">{sub.clientName}</td>
                                <td className="px-6 py-4">{sub.formName}</td>
                                <td className="px-6 py-4">{sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'N/A'}</td>
                                <td className="px-6 py-4">
                                    <span className={`flex items-center gap-1.5 px-2 py-1 w-fit text-xs leading-5 font-semibold rounded-full ${getStatusBadge(sub.computedStatus)}`}>
                                        {sub.computedStatus === 'Pending' && sub.dueDate && new Date(sub.dueDate) < new Date() && <AlertTriangle size={12} />}
                                        {sub.computedStatus === 'Pending' && sub.dueDate && new Date(sub.dueDate) < new Date() ? 'Overdue' : sub.computedStatus}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {sub.status === 'Completed' && (
                                        <button onClick={() => setSelectedSubmission(sub)} className="flex items-center gap-2 ml-auto text-sm bg-red-50 text-primary px-3 py-1.5 rounded-md font-semibold hover:bg-red-100">
                                            <Eye size={14} /> View
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedSubmission && (
                <SubmissionDetailModal
                    submission={selectedSubmission}
                    client={clients.find(c => c.id === selectedSubmission.clientId)}
                    form={forms.find(f => f.id === selectedSubmission.formId)}
                    onClose={() => setSelectedSubmission(null)}
                    onMarkReviewed={handleMarkAsReviewed}
                />
            )}
        </Card>
    );
};

export default FormSubmissionsTab;
