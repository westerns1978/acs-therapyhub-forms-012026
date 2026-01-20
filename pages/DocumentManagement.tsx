

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getClient, getDocumentFilesForClient, getFormSubmissions, getSessionRecords, getSROPData } from '../services/api';
import { Client, DocumentFile, FormSubmission, SessionRecord, SROPProgress } from '../types';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ClientSelectionGrid from '../components/clients/ClientSelectionGrid';
import ClientProfileHeader from '../components/clients/ClientProfileHeader';
import ClientDocumentsGrid from '../components/clients/ClientDocumentsGrid';
import Card from '../components/ui/Card';
import { FileText, ClipboardList, Video, ShieldCheck } from 'lucide-react';

const ClientWorkspace: React.FC = () => {
    const { clientId } = useParams<{ clientId: string }>();
    const navigate = useNavigate();
    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    
    // Data for tabs
    const [documents, setDocuments] = useState<DocumentFile[]>([]);
    const [formSubmissions, setFormSubmissions] = useState<FormSubmission[]>([]);
    const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>([]);
    const [sropData, setSropData] = useState<SROPProgress | null>(null);
    

    const loadClientData = useCallback(async (id: string) => {
        setIsLoading(true);
        try {
            const clientData = await getClient(id);
            if (clientData) {
                setClient(clientData);
                // Fetch all related data
                const [docs, forms, sessions, srop] = await Promise.all([
                    getDocumentFilesForClient(id),
                    // FIX: Pass a filter object to getFormSubmissions instead of a raw string.
                    getFormSubmissions({ clientId: id }),
                    getSessionRecords(id),
                    getSROPData(id),
                ]);
                setDocuments(docs);
                setFormSubmissions(forms);
                setSessionRecords(sessions);
                setSropData(srop);
            } else {
                setClient(null);
                navigate('/clients'); // Client not found, redirect
            }
        } catch (error) {
            console.error("Failed to load client data", error);
            setClient(null);
        } finally {
            setIsLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        if (clientId) {
            loadClientData(clientId);
        } else {
            setIsLoading(false);
        }
    }, [clientId, loadClientData]);

    if (!clientId) {
        return <ClientSelectionGrid />;
    }

    if (isLoading) {
        return <LoadingSpinner />;
    }

    if (!client) {
        return <div className="text-center p-8">Client not found.</div>;
    }

    const tabs = [
        { id: 'overview', label: 'Overview', icon: ShieldCheck },
        { id: 'documents', label: 'Documents', icon: FileText },
        { id: 'forms', label: 'Forms', icon: ClipboardList },
        { id: 'sessions', label: 'Sessions', icon: Video },
    ];
    
    const renderTabContent = () => {
        switch (activeTab) {
            case 'documents':
                return <ClientDocumentsGrid client={client} initialDocuments={documents} />;
            case 'forms':
                 return <Card title="Assigned Forms"><p>Forms section for {client.name}. ({formSubmissions.length} found)</p></Card>;
            case 'sessions':
                 return <Card title="Session History"><p>Session history for {client.name}. ({sessionRecords.length} found)</p></Card>;
            case 'overview':
            default:
                return <Card title="Client Overview"><p>Key metrics and recent activity for {client.name}.</p></Card>;
        }
    };

    return (
        <div className="animate-fade-in-up">
            <ClientProfileHeader client={client} />
            
            <div className="mt-6 border-b border-border dark:border-dark-border">
                <nav className="flex -mb-px space-x-6">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-surface-secondary-content hover:text-surface-content'
                            }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>
            
            <div className="mt-6">
                {renderTabContent()}
            </div>
        </div>
    );
};

export default ClientWorkspace;
