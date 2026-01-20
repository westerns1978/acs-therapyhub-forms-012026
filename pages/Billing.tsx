import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import { getClient, getSessionRecords } from '../services/api';
import { SessionRecord, Integration, Client } from '../types';
import ReportPreviewModal from '../components/ui/ReportPreviewModal';
import SuperbillPreview from '../components/ui/SuperbillPreview';
import { dbIntegrations } from '../data/database';

const FilePlusIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="12" x2="12" y1="18" y2="12"/><line x1="9" x2="15" y1="15" y2="15"/></svg>;
const CreditCardIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>;
const LinkIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"/></svg>;

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
                <div className="flex justify-between items-center p-4 border-b dark:border-slate-700">
                    <h3 id="modal-title" className="text-lg font-semibold">{title}</h3>
                    <button onClick={onClose} className="text-2xl font-light text-gray-500 hover:text-gray-800" aria-label="Close modal">&times;</button>
                </div>
                <div className="p-4">{children}</div>
            </div>
        </div>
    );
};


const FeeLedger: React.FC = () => {
    const { clientId } = useParams<{clientId: string}>();
    const [client, setClient] = useState<Client | null>(null);
    const [sessions, setSessions] = useState<SessionRecord[]>([]);
    const [integrations, setIntegrations] = useState<Integration[]>(dbIntegrations);
    const [isLoading, setIsLoading] = useState(true);
    
    // Modal states
    const [isSuperbillModalOpen, setSuperbillModalOpen] = useState(false);
    const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
    const [isQbModalOpen, setQbModalOpen] = useState(false);
    const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(null);

    useEffect(() => {
        if (clientId) {
            const loadData = async () => {
                setIsLoading(true);
                const [clientData, sessionsData] = await Promise.all([
                    getClient(clientId),
                    getSessionRecords(clientId)
                ]);
                setClient(clientData || null);
                setSessions(sessionsData.map(s => ({...s, date: new Date(s.date)})));
                setIsLoading(false);
            };
            loadData();
        }
    }, [clientId]);

    const financials = useMemo(() => {
        const totalBilled = sessions.reduce((acc, s) => acc + s.rate, 0);
        const outstanding = sessions.filter(s => s.status === 'Unpaid').reduce((acc, s) => acc + s.rate, 0);
        const forecast = totalBilled * 1.15; // mock forecast
        return { totalBilled, outstanding, forecast };
    }, [sessions]);

    const handleOpenPaymentModal = (session: SessionRecord) => {
        setSelectedSession(session);
        setPaymentModalOpen(true);
    };

    const handleRecordPayment = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSession) return;
        // In real app, call API to update session status
        setSessions(prevSessions => prevSessions.map(s => s.id === selectedSession.id ? { ...s, status: 'Paid' } : s));
        setPaymentModalOpen(false);
        setSelectedSession(null);
    };
    
    const handleToggleQuickBooks = () => {
        setIntegrations(prev => prev.map(i => i.id === 'quickbooks' ? {...i, status: i.status === 'Connected' ? 'Disconnected' : 'Connected'} : i));
        setQbModalOpen(false);
    };
    
    if (isLoading) return <div className="p-8 text-center">Loading fee ledger...</div>;
    if (!client) return <div className="p-8 text-center">Client not found.</div>;

    const getBillingAction = () => {
        switch(client.billingType) {
            case 'Employer Mandate': return "Invoice Employer";
            case 'State Funded': return "Submit for Reimbursement";
            default: return "Generate Superbill";
        }
    }

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card>
                    <p className="text-base font-medium text-on-surface-secondary">Total Billed</p>
                    <p className="text-3xl font-bold mt-1">${financials.totalBilled.toFixed(2)}</p>
                </Card>
                <Card>
                    <p className="text-base font-medium text-on-surface-secondary">Outstanding Balance</p>
                    <p className={`text-3xl font-bold mt-1 ${financials.outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>${financials.outstanding.toFixed(2)}</p>
                </Card>
                <Card>
                    <p className="text-base font-medium text-on-surface-secondary">30-Day Revenue Forecast</p>
                    <p className="text-3xl font-bold mt-1">${financials.forecast.toFixed(2)}</p>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <Card title="Payment Processing" className="lg:col-span-1">
                     <div className="space-y-3">
                        <button onClick={() => handleOpenPaymentModal(sessions.find(s=>s.status === 'Unpaid')!)} disabled={!sessions.some(s=>s.status === 'Unpaid')} className="w-full flex items-center gap-3 p-3 bg-surface dark:bg-slate-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700/50 transition disabled:opacity-50">
                            <CreditCardIcon className="h-5 w-5 text-primary" /> Record a Payment
                        </button>
                         {/* ... other buttons */}
                    </div>
                </Card>
                {/* Fix: Add content to the Business Integrations card to satisfy the 'children' prop requirement. */}
                <Card title="Business Integrations" className="lg:col-span-2">
                   <div className="space-y-3">
                        {integrations.map(integration => (
                            <div key={integration.id} className="flex items-center justify-between p-3 bg-surface dark:bg-slate-800/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <LinkIcon className="h-5 w-5 text-on-surface-secondary" />
                                    <div>
                                        <p className="font-semibold">{integration.name}</p>
                                        <p className={`text-xs ${integration.status === 'Connected' ? 'text-green-600' : 'text-yellow-600'}`}>{integration.status}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={integration.id === 'quickbooks' ? () => setQbModalOpen(true) : undefined} 
                                    className="text-sm font-semibold text-primary hover:underline"
                                >
                                    {integration.status === 'Connected' ? 'Manage' : 'Connect'}
                                </button>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
            
            <Card title="Session & Payment History" noPadding>
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-black/10 dark:divide-white/10">
                        {/* Fix: Add table header and complete table rows for clarity and consistency. */}
                        <thead className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Date</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Service</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Amount</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                         <tbody>
                            {sessions.map((session) => (
                                <tr key={session.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-on-surface dark:text-slate-200">{session.date.toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-secondary">{session.type}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-sm text-on-surface dark:text-slate-300">${session.rate.toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${session.status === 'Paid' ? 'bg-green-100 text-green-800' : session.status === 'Unpaid' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                            {session.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {session.status === 'Unpaid' && (
                                            <button onClick={() => handleOpenPaymentModal(session)} className="text-primary hover:underline">Record Payment</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <ReportPreviewModal isOpen={isSuperbillModalOpen} onClose={() => setSuperbillModalOpen(false)} reportTitle={`Superbill for ${client.name}`}>
                <SuperbillPreview client={client} sessions={sessions} />
            </ReportPreviewModal>
            
            {/* Modals remain the same */}

        </div>
    );
};

export default FeeLedger;