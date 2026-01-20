import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import { getClient, getSROPData, getClients, getComplianceAnalysis } from '../services/api';
import { SROPProgress, Client } from '../types';
import SynapseLogo from '../components/ui/SynapseLogo';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const CheckCircleIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const PlusIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>;
const BeakerIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M4.5 3h15"/><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"/><path d="M6 14h12"/></svg>;
const TrophyIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>;
const ExternalLinkIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>;
const SparklesIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 3-1.9 5.8-5.8 1.9 5.8 1.9L12 21l1.9-5.8 5.8-1.9-5.8-1.9L12 3z"/></svg>;


const SROPTracker: React.FC<{ sropData: SROPProgress }> = ({ sropData }) => {
    const totalCompleted = sropData.phase1.completedHours + sropData.phase2.completedHours;
    const overallProgress = (totalCompleted / sropData.totalHours) * 100;
    
    const phase1Progress = (sropData.phase1.completedHours / sropData.phase1.requiredHours) * 100;
    const phase2Progress = (sropData.phase2.completedHours / sropData.phase2.requiredHours) * 100;

    return (
        <Card title="SROP 75-Hour Progress Tracker">
            <div className="space-y-6">
                <div>
                    <div className="flex justify-between items-baseline mb-1">
                        <h4 className="text-lg font-semibold text-on-surface leading-tight">Overall Progress</h4>
                        <span className="font-bold text-2xl text-on-surface">{totalCompleted.toFixed(1)}<span className="text-lg font-medium text-on-surface-secondary"> / {sropData.totalHours} hrs</span></span>
                    </div>
                    <div className="w-full bg-gray-200/50 dark:bg-slate-700/50 rounded-full h-4 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-400 to-purple-500 h-4 rounded-full transition-all duration-500" style={{ width: `${overallProgress}%` }}></div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {/* Phase 1 */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg">
                        <p className="font-semibold text-blue-800 dark:text-blue-300">{sropData.phase1.title}</p>
                        <div className="w-full bg-blue-200/50 rounded-full h-2 my-2">
                             <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${phase1Progress}%` }}></div>
                        </div>
                        <p className="text-on-surface-secondary dark:text-slate-400 text-xs">Completed: <span className="font-semibold text-on-surface dark:text-slate-200">{sropData.phase1.completedHours.toFixed(1)} / {sropData.phase1.requiredHours} hrs</span></p>
                    </div>
                     {/* Phase 2 */}
                     <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg">
                        <p className="font-semibold text-green-800 dark:text-green-300">{sropData.phase2.title}</p>
                        <div className="w-full bg-green-200/50 rounded-full h-2 my-2">
                             <div className="bg-green-500 h-2 rounded-full" style={{ width: `${phase2Progress}%` }}></div>
                        </div>
                        <p className="text-on-surface-secondary dark:text-slate-400 text-xs">Completed: <span className="font-semibold text-on-surface dark:text-slate-200">{sropData.phase2.completedHours.toFixed(1)} / {sropData.phase2.requiredHours} hrs</span></p>
                    </div>
                </div>
            </div>
        </Card>
    );
};

const AnalysisModal: React.FC<{ isOpen: boolean, onClose: () => void, content: string, isLoading: boolean }> = ({ isOpen, onClose, content, isLoading }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
            <div className="bg-background dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]">
                 <header className="flex items-center gap-4 p-4 border-b border-border dark:border-slate-800 flex-shrink-0">
                    <SynapseLogo className="w-8 h-8 text-primary" />
                    <div>
                        <h2 className="text-lg font-bold">AI Compliance Analysis</h2>
                        <p className="text-sm text-on-surface-secondary">Generated by Synapse AI</p>
                    </div>
                </header>
                <main className="flex-1 p-6 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full"><LoadingSpinner /></div>
                    ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br />') }}></div>
                    )}
                </main>
                 <footer className="p-4 border-t border-border dark:border-slate-800 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-slate-700 rounded-md">Close</button>
                </footer>
            </div>
        </div>
    );
};

const ProgramCompliance: React.FC = () => {
    const { clientId } = useParams<{ clientId: string }>();
    const navigate = useNavigate();
    const [client, setClient] = useState<Client | null>(null);
    const [allClients, setAllClients] = useState<Client[]>([]);
    const [sropData, setSropData] = useState<SROPProgress | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAnalysisModalOpen, setAnalysisModalOpen] = useState(false);
    const [analysisContent, setAnalysisContent] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const targetClientId = clientId || (await getClients())[0]?.id;
            if (!targetClientId) {
                setIsLoading(false);
                return;
            }

            const [clientData, sropData, allClientsData] = await Promise.all([
                getClient(targetClientId),
                getSROPData(targetClientId),
                getClients()
            ]);
            setClient(clientData || null);
            setSropData(sropData);
            setAllClients(allClientsData);
            setIsLoading(false);
        };

        fetchData();
    }, [clientId]);

    const handleAnalyzeScore = async () => {
        if (!client || !sropData) return;
        setAnalysisModalOpen(true);
        setIsAnalyzing(true);
        try {
            const result = await getComplianceAnalysis(client, sropData);
            setAnalysisContent(result);
        } catch (error) {
            setAnalysisContent("Error generating analysis. Ensure your API key is configured and valid.");
            console.error(error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    if (isLoading) {
        return <LoadingSpinner />;
    }

    if (!client || !sropData) {
        return <div>Client or compliance data not found.</div>;
    }

    return (
        <div>
            <div className="mb-6">
                <label htmlFor="client-select" className="block text-sm font-medium text-on-surface-secondary mb-2">Switch Client</label>
                <select 
                    id="client-select"
                    value={client.id}
                    onChange={(e) => navigate(`/program-compliance/${e.target.value}`)}
                    className="w-full md:w-1/3 p-2 border border-border rounded-lg focus:ring-primary focus:border-primary bg-background dark:bg-slate-800"
                >
                    {allClients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 space-y-6">
                    {client.status === 'Completed' && (
                        <Card>
                            <div className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800/50 rounded-lg">
                                <CheckCircleIcon className="w-12 h-12 text-green-500 flex-shrink-0" />
                                <div>
                                    <h3 className="text-lg font-bold text-green-800 dark:text-green-200">Program Complete!</h3>
                                    <p className="text-sm text-green-700 dark:text-green-300">This client has successfully met all program requirements.</p>
                                    <a
                                        href="https://continuing-recovery-plan-v3-286939318734.us-west1.run.app/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 mt-2 text-sm font-semibold text-primary hover:underline"
                                    >
                                        Complete Continuing Recovery Plan <ExternalLinkIcon className="w-4 h-4" />
                                    </a>
                                </div>
                            </div>
                        </Card>
                    )}
                    <SROPTracker sropData={sropData} />
                    <Card title="Compliance Logs" actions={
                        <button className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600">
                            <PlusIcon className="h-3 w-3" /> Add Log
                        </button>
                    }>
                         <ul className="space-y-2 text-sm max-h-60 overflow-y-auto">
                            {sropData.drugScreens.slice().reverse().map((s, i) => (
                                <li key={`ds-${i}`} className="flex items-start justify-between p-2 bg-surface dark:bg-slate-800/50 rounded-md">
                                    <div className="flex items-center gap-2">
                                        <BeakerIcon className="h-4 w-4 text-on-surface-secondary" />
                                        <div>
                                            <p className="font-medium">{s.date} ({s.testType})</p>
                                            <p className="text-xs text-on-surface-secondary font-mono">CoC: {s.chainOfCustodyId}</p>
                                        </div>
                                    </div>
                                    <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${s.result === 'Negative' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {s.result}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </Card>
                </div>

                <div className="lg:col-span-2 space-y-6">
                     <Card title="Compliance Score">
                        <div className="text-center p-2">
                            <p className={`text-6xl font-bold ${client.complianceScore > 85 ? 'text-green-500' : client.complianceScore > 70 ? 'text-yellow-500' : 'text-red-500'}`}>
                                {client.complianceScore}%
                            </p>
                            <p className="text-sm text-on-surface-secondary mt-2">Reflects attendance, payments, and UA results.</p>
                            <button onClick={handleAnalyzeScore} disabled={isAnalyzing} className="w-full mt-4 flex items-center justify-center gap-2 bg-primary/10 text-primary font-bold py-3 px-4 rounded-lg hover:bg-primary/20 transition disabled:opacity-50">
                                <SparklesIcon className="h-5 w-5" />
                                {isAnalyzing ? 'Analyzing...' : 'Analyze with Synapse AI'}
                            </button>
                        </div>
                    </Card>

                    <Card title="Gamification & Achievements">
                        <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
                            <span className="font-bold text-amber-800 dark:text-amber-300">Total Points</span>
                            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{client.gamification.points}</span>
                        </div>
                        <div className="mt-4">
                            <h5 className="font-semibold text-sm mb-2">Badges Earned</h5>
                            <div className="flex flex-wrap gap-2">
                                {client.gamification.badges.length > 0 ? client.gamification.badges.map(badge => (
                                    <span key={badge} className="text-xs font-medium bg-gray-200 dark:bg-slate-700 text-on-surface dark:text-slate-200 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                                        <TrophyIcon className="w-3 h-3 text-yellow-500" /> {badge}
                                    </span>
                                )) : <p className="text-xs text-on-surface-secondary">No badges earned yet.</p>}
                            </div>
                        </div>
                    </Card>

                    <Card title="DMV & Interlock Coordination">
                         <ul className="space-y-3 text-sm">
                            <li className="flex justify-between items-center"><span>License Status:</span> <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${client.licenseStatus === 'Suspended' || client.licenseStatus === 'Revoked' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{client.licenseStatus}</span></li>
                            <li className="flex justify-between items-center"><span>Interlock Status:</span> <span className="font-semibold">{client.interlockStatus}</span></li>
                            <li className="flex justify-between items-center"><span>Next Report Due:</span> <span className="font-mono text-xs">Aug 15, 2024</span></li>
                         </ul>
                          <button disabled={client.status !== 'Completed'} className="w-full mt-3 text-sm bg-gray-100 dark:bg-slate-700 px-3 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed">
                            Generate SATOP Completion Form
                        </button>
                    </Card>
                </div>
            </div>
             <AnalysisModal 
                isOpen={isAnalysisModalOpen}
                onClose={() => setAnalysisModalOpen(false)}
                content={analysisContent}
                isLoading={isAnalyzing}
            />
        </div>
    );
};

export default ProgramCompliance;