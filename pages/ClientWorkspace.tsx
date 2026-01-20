import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getClient, getDocumentFilesForClient, getFormSubmissions, getSessionRecords, getSROPData, getClientActivityFeed, generateRelapseRiskPrediction } from '../services/api';
import { Client, DocumentFile, FormSubmission, SessionRecord, SROPProgress, ClientActivity } from '../types';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ClientSelectionGrid from '../components/clients/ClientSelectionGrid';
import ClientProfileHeader from '../components/clients/ClientProfileHeader';
import ClientDocumentsGrid from '../components/clients/ClientDocumentsGrid';
import ClientOverviewTab from '../components/clients/ClientOverviewTab';
import ClientFormsTab from '../components/clients/ClientFormsTab';
import Card from '../components/ui/Card';
import { FileManager } from '../components/ui/FileManager';
import { FileText, ClipboardList, Video, ShieldCheck, AlertTriangle, BrainCircuit, TrendingDown, TrendingUp, HardDrive } from 'lucide-react';

const RelapseRiskCard: React.FC<{ client: Client, history: any[] }> = ({ client, history }) => {
    const [prediction, setPrediction] = useState<{ score: number, reasoning: string } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPrediction = async () => {
            setLoading(true);
            const res = await generateRelapseRiskPrediction(client, history || []);
            setPrediction(res);
            setLoading(false);
        };
        fetchPrediction();
    }, [client.id]);

    const getScoreColor = (score: number) => {
        if (score < 30) return 'text-green-500';
        if (score < 60) return 'text-yellow-500';
        return 'text-red-500';
    };

    return (
        <Card title="AI Relapse Risk Prediction" className="border-l-4 border-indigo-500 bg-gradient-to-br from-indigo-50/20 to-transparent dark:from-indigo-900/10">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-6 text-indigo-400">
                    <BrainCircuit className="animate-spin mb-2" size={32} />
                    <p className="text-xs font-bold uppercase tracking-widest">Reasoning with Gemini 3...</p>
                </div>
            ) : prediction ? (
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Predicted Risk Probability</p>
                            <p className={`text-4xl font-extrabold ${getScoreColor(prediction.score)}`}>{prediction.score}%</p>
                        </div>
                        <div className={`p-2 rounded-lg bg-opacity-10 ${prediction.score > 50 ? 'bg-red-500 text-red-600' : 'bg-green-500 text-green-600'}`}>
                            {prediction.score > 50 ? <TrendingUp size={24}/> : <TrendingDown size={24}/>}
                        </div>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-indigo-100 dark:border-indigo-900/50 shadow-inner">
                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed italic">
                            "{prediction.reasoning}"
                        </p>
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase text-center">Engine: Gemini 3 Pro Deep Reasoning • Thinking Budget: 4k Tokens</p>
                </div>
            ) : null}
        </Card>
    );
};

const ClientWorkspace: React.FC = () => {
    const { clientId } = useParams<{ clientId: string }>();
    const navigate = useNavigate();
    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    
    const [documents, setDocuments] = useState<DocumentFile[]>([]);
    const [formSubmissions, setFormSubmissions] = useState<FormSubmission[]>([]);
    const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>([]);
    const [sropData, setSropData] = useState<SROPProgress | null>(null);
    const [activityFeed, setActivityFeed] = useState<ClientActivity[]>([]);
    const [loadErrors, setLoadErrors] = useState<Record<string, boolean>>({});

    const loadClientData = useCallback(async (id: string) => {
        setIsLoading(true);
        setLoadErrors({});
        try {
            const clientData = await getClient(id);
            if (clientData) {
                setClient(clientData);
                const results = await Promise.allSettled([
                    getDocumentFilesForClient(id),
                    getFormSubmissions({ clientId: id }),
                    getSessionRecords(id),
                    getSROPData(id),
                    getClientActivityFeed(id)
                ]);

                if (results[0].status === 'fulfilled') setDocuments(results[0].value || []);
                else setLoadErrors(prev => ({...prev, documents: true}));
                if (results[1].status === 'fulfilled') setFormSubmissions(results[1].value || []);
                else setLoadErrors(prev => ({...prev, forms: true}));
                if (results[2].status === 'fulfilled') setSessionRecords(results[2].value || []);
                else setLoadErrors(prev => ({...prev, sessions: true}));
                if (results[3].status === 'fulfilled') setSropData(results[3].value || null);
                else setLoadErrors(prev => ({...prev, srop: true}));
                if (results[4].status === 'fulfilled') setActivityFeed(results[4].value || []);
                else setLoadErrors(prev => ({...prev, activity: true}));
            } else {
                setClient(null);
                navigate('/clients');
            }
        } catch (error) {
            console.error("Critical failure loading client", error);
            setClient(null);
        } finally {
            setIsLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        if (clientId) loadClientData(clientId);
        else setIsLoading(false);
    }, [clientId, loadClientData]);
    
    const handleFormAssigned = () => { if(clientId) loadClientData(clientId); }

    if (!clientId) return <ClientSelectionGrid />;
    if (isLoading) return <LoadingSpinner />;
    if (!client) return <div className="text-center p-8">Client not found.</div>;

    const tabs = [
        { id: 'overview', label: 'Overview', icon: ShieldCheck },
        { id: 'documents', label: 'Documents', icon: FileText },
        { id: 'vault', label: 'Storage Vault', icon: HardDrive },
        { id: 'forms', label: 'Forms', icon: ClipboardList },
        { id: 'sessions', label: 'Sessions', icon: Video },
    ];
    
    const renderTabContent = () => {
        switch (activeTab) {
            case 'documents': 
                if (loadErrors.documents) return <ErrorFallback message="Failed to load documents." onRetry={() => loadClientData(clientId)} />;
                return <ClientDocumentsGrid client={client} initialDocuments={documents || []} />;
            case 'vault':
                return (
                    <Card title="Patient Storage Vault" subtitle="Direct binary synchronization with PDS-LEXINGTON.">
                        <FileManager bucketName="therapyhub-patient-files" clientId={client.id} onUploadSuccess={() => loadClientData(clientId)} />
                    </Card>
                );
            case 'forms': 
                if (loadErrors.forms) return <ErrorFallback message="Failed to load forms." onRetry={() => loadClientData(clientId)} />;
                return <ClientFormsTab client={client} formSubmissions={formSubmissions || []} onFormAssigned={handleFormAssigned}/>;
            case 'sessions': 
                if (loadErrors.sessions) return <ErrorFallback message="Failed to load session history." onRetry={() => loadClientData(clientId)} />;
                return <Card title="Session History"><p>Session history for {client.name}. ({ (sessionRecords || []).length } found)</p></Card>;
            case 'overview': 
            default: 
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                             <ClientOverviewTab client={client} sropData={sropData} activityFeed={activityFeed || []} />
                        </div>
                        <div className="lg:col-span-1">
                             <RelapseRiskCard client={client} history={activityFeed || []} />
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="animate-fade-in-up space-y-6">
            <ClientProfileHeader client={client} />
            
            <div className="border-b border-border dark:border-dark-border">
                <nav className="flex -mb-px space-x-8 overflow-x-auto">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-1 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                            <tab.icon size={18} /> {tab.label.toUpperCase()}
                        </button>
                    ))}
                </nav>
            </div>
            <div>{renderTabContent()}</div>
        </div>
    );
};

const ErrorFallback = ({ message, onRetry }: { message: string, onRetry: () => void }) => (
    <div className="p-8 border border-red-200 bg-red-50 dark:bg-red-900/10 rounded-xl text-center">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-2" />
        <p className="text-red-700 font-medium mb-4">{message}</p>
        <button onClick={onRetry} className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 text-sm font-semibold">
            Retry Loading
        </button>
    </div>
);

export default ClientWorkspace;