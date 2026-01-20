

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PortalLayout from '../../layouts/PortalLayout';
import Header from '../../components/ui/Header';
import Card from '../../components/ui/Card';
// Fix: Correctly import getClientDocuments from the services API.
import { getClientDocuments, getClient } from '../../services/api';
import { ClientDocument, Client } from '../../types';

const EditIcon = (props: React.ComponentProps<'svg'>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const CheckCircleIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;


const PortalDocuments: React.FC = () => {
    const [client, setClient] = useState<Client | null>(null);
    const [documents, setDocuments] = useState<ClientDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const [clientData, docsData] = await Promise.all([
                getClient('1'),
                getClientDocuments('1')
            ]);
            setClient(clientData);
            setDocuments(docsData);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    if (isLoading || !client) {
        return <PortalLayout><div className="text-center">Loading documents...</div></PortalLayout>;
    }

    return (
        <PortalLayout>
            <div className="max-w-4xl mx-auto">
                <Header title="My Documents" subtitle="Please review and sign any pending documents." />
                
                <Card noPadding>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border">
                            <thead className="bg-surface">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase">Document Title</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase">Last Updated</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-on-surface-secondary uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-background divide-y divide-border">
                                {documents.map(doc => (
                                    <tr key={doc.id}>
                                        <td className="px-6 py-4 font-medium">{doc.title}</td>
                                        <td className="px-6 py-4">
                                            {doc.status === 'Pending Signature' ? (
                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span>
                                            ) : (
                                                 <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 flex items-center gap-1 w-fit">
                                                    <CheckCircleIcon className="w-4 h-4" /> Completed
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">{doc.lastModified}</td>
                                        <td className="px-6 py-4 text-right">
                                            {doc.status === 'Pending Signature' && (
                                                <button 
                                                    onClick={() => navigate(`/portal/documents/sign/${doc.id}`)}
                                                    className="flex items-center gap-2 bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary-focus transition text-sm font-semibold ml-auto"
                                                >
                                                    <EditIcon className="w-4 h-4" />
                                                    Sign Now
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </PortalLayout>
    );
};

export default PortalDocuments;