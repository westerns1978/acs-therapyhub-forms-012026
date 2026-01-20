import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Card from '../components/ui/Card';
import { getClients } from '../services/api';
import { Client, SignedDocument } from '../types';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const SearchIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>;
const PlusCircleIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="16"/><line x1="8" x2="16" y1="12" y2="12"/></svg>;
const MoreVerticalIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>;
const FileTextIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>;


const getStatusColor = (status: Client['status']) => {
    switch (status) {
        case 'Compliant': return 'bg-green-100 text-green-800';
        case 'Non-Compliant': return 'bg-yellow-100 text-yellow-800';
        case 'Warrant Issued': return 'bg-red-100 text-red-800';
        case 'Completed': return 'bg-blue-100 text-blue-800';
    }
};

const getProgramColor = (program: Client['program']) => {
    switch (program) {
        case 'SATOP': return 'bg-blue-100 text-blue-800';
        case 'REACT': return 'bg-purple-100 text-purple-800';
        case 'Anger Management': return 'bg-orange-100 text-orange-800';
        case 'Compulsive Gambling': return 'bg-teal-100 text-teal-800';
        case 'DOT': return 'bg-indigo-100 text-indigo-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
                <div className="flex justify-between items-center p-4 border-b dark:border-slate-700">
                    <h3 id="modal-title" className="text-lg font-semibold">{title}</h3>
                    <button onClick={onClose} className="text-2xl font-light text-gray-500 hover:text-gray-800 dark:text-slate-300 dark:hover:text-white" aria-label="Close modal">&times;</button>
                </div>
                <div className="p-4">{children}</div>
            </div>
        </div>
    );
};


const ClientList: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [activeModal, setActiveModal] = useState<string | null>(null);
    const [actionMenuClientId, setActionMenuClientId] = useState<string | null>(null);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const fetchClients = async () => {
            setIsLoading(true);
            const clientsData = await getClients();
            setClients(clientsData);
            setIsLoading(false);
        };
        fetchClients();
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const search = params.get('search');
        if (search) {
            setSearchTerm(search);
        }
    }, [location.search]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
                setActionMenuClientId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const filteredClients = useMemo(() => {
        return clients
            .filter(client => client.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .filter(client => statusFilter === 'All' || client.status === statusFilter);
    }, [clients, searchTerm, statusFilter]);

    const handleOpenModal = (modalName: string, client: Client) => {
        setSelectedClient(client);
        setActiveModal(modalName);
        setActionMenuClientId(null);
    };

    const handleCloseModal = () => {
        setActiveModal(null);
        setSelectedClient(null);
    };

    const handleFormSubmit = (e: React.FormEvent, action: string) => {
        e.preventDefault();
        console.log(`${action} for ${selectedClient?.name}`);
        handleCloseModal();
    };

    const renderModalContent = () => {
        if (!selectedClient) return null;

        switch (activeModal) {
            case 'dmvReport':
                return (
                    <form onSubmit={(e) => handleFormSubmit(e, 'Generating DMV Report')}>
                        <p className="mb-4">You are about to generate a DMV SATOP Completion Form for <strong>{selectedClient.name}</strong>. This will be securely transmitted to the Missouri Department of Revenue.</p>
                        <button type="submit" className="w-full bg-primary text-white py-2 rounded-md hover:bg-primary-focus">Generate & Send</button>
                    </form>
                );
            case 'makeupSession':
                return (
                    <form onSubmit={(e) => handleFormSubmit(e, 'Scheduling Makeup Session')} className="space-y-4">
                        <p>Schedule a makeup session for <strong>{selectedClient.name}</strong>.</p>
                        <div>
                            <label className="block text-sm font-medium">Date</label>
                            <input type="date" className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600" defaultValue={new Date().toISOString().split('T')[0]} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Time</label>
                            <input type="time" className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600" defaultValue="10:00" />
                        </div>
                        <button type="submit" className="w-full bg-primary text-white py-2 rounded-md hover:bg-primary-focus">Schedule Session</button>
                    </form>
                );
            case 'complianceAlert':
                 return (
                    <form onSubmit={(e) => handleFormSubmit(e, 'Sending Compliance Alert')} className="space-y-4">
                        <p>Send a compliance alert regarding <strong>{selectedClient.name}</strong>.</p>
                        <div>
                            <label className="block text-sm font-medium">Recipient</label>
                            <select className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600">
                                <option>Client ({selectedClient.name})</option>
                                <option>Probation Officer ({selectedClient.probationOfficer})</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Message</label>
                            <textarea rows={4} className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600" defaultValue={`This is a formal alert regarding non-compliance for case #${selectedClient.caseNumber}. Please contact our office at your earliest convenience.`}></textarea>
                        </div>
                        <button type="submit" className="w-full bg-yellow-500 text-white py-2 rounded-md hover:bg-yellow-600">Send Alert</button>
                    </form>
                );
            case 'courtStatus':
                return (
                    <form onSubmit={(e) => handleFormSubmit(e, 'Updating Court Status')} className="space-y-4">
                        <p>Update court status for <strong>{selectedClient.name}</strong>.</p>
                        <div>
                            <label className="block text-sm font-medium">New Status</label>
                            <select className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600" defaultValue={selectedClient.status}>
                                <option>Compliant</option>
                                <option>Non-Compliant</option>
                                <option>Warrant Requested</option>
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium">Notes for Court Record</label>
                            <textarea rows={3} className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600" placeholder="e.g., Client failed to appear for session on..."></textarea>
                        </div>
                        <button type="submit" className="w-full bg-primary text-white py-2 rounded-md hover:bg-primary-focus">Update Status</button>
                    </form>
                );
            case 'completionCertificate':
                return (
                    <form onSubmit={(e) => handleFormSubmit(e, 'Processing Completion Certificate')}>
                        <p className="mb-4">You are about to process the official Program Completion Certificate for <strong>{selectedClient.name}</strong>. This will finalize their record.</p>
                        <button type="submit" className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700">Process & Issue Certificate</button>
                    </form>
                );
            default: return null;
        }
    };
    
    const getModalTitle = () => {
        switch (activeModal) {
            case 'dmvReport': return 'Generate DMV Report';
            case 'makeupSession': return 'Schedule Makeup Session';
            case 'complianceAlert': return 'Send Compliance Alert';
            case 'courtStatus': return 'Update Court Status';
            case 'completionCertificate': return 'Process Completion';
            default: return 'Action';
        }
    };

    if (isLoading) {
        return <LoadingSpinner />;
    }

    return (
        <div>
            <Card>
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                    <div className="relative w-full sm:w-auto">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-secondary"><SearchIcon className="h-5 w-5"/></span>
                        <input
                            type="text"
                            placeholder="Search clients..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-border rounded-lg w-full sm:w-64 focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Status:</span>
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="border border-border rounded-lg py-2 px-3 focus:ring-2 focus:ring-primary focus:border-primary"
                        >
                            <option>All</option>
                            <option>Compliant</option>
                            <option>Non-Compliant</option>
                            <option>Warrant Issued</option>
                            <option>Completed</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-surface">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Program</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">County</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Billing Type</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-background divide-y divide-border">
                            {filteredClients.map(client => (
                                <tr key={client.id} className="hover:bg-surface transition">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <img className="h-10 w-10 rounded-full" src={client.avatarUrl} alt={client.name} />
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-on-surface">{client.name}</div>
                                                <div className="text-sm text-on-surface-secondary">Case #: {client.caseNumber}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getProgramColor(client.program)}`}>
                                            {client.program}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-secondary">{client.county}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-secondary">{client.billingType}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(client.status)}`}>
                                            {client.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => navigate(`/program-compliance/${client.id}`)} className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 font-semibold">
                                                View
                                            </button>
                                            <div className="relative" ref={actionMenuRef}>
                                                <button onClick={() => setActionMenuClientId(actionMenuClientId === client.id ? null : client.id)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700">
                                                    <MoreVerticalIcon className="h-5 w-5" />
                                                </button>
                                                {actionMenuClientId === client.id && (
                                                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-md shadow-lg border dark:border-slate-700 z-10">
                                                        <button onClick={() => handleOpenModal('dmvReport', client)} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700">Generate DMV Report</button>
                                                        <button onClick={() => handleOpenModal('makeupSession', client)} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700">Schedule Makeup Session</button>
                                                        <button onClick={() => handleOpenModal('complianceAlert', client)} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700">Send Compliance Alert</button>
                                                        <button onClick={() => handleOpenModal('courtStatus', client)} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700">Update Court Status</button>
                                                        <button onClick={() => handleOpenModal('completionCertificate', client)} disabled={client.status !== 'Completed'} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">Process Completion Certificate</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal
                isOpen={!!activeModal}
                onClose={handleCloseModal}
                title={getModalTitle()}
            >
                {renderModalContent()}
            </Modal>

        </div>
    );
};

export default ClientList;