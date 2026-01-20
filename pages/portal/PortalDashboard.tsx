import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PortalLayout from '../../layouts/PortalLayout';
import Header from '../../components/ui/Header';
import Card from '../../components/ui/Card';
import { getClient, getClientAppointments, getClientActivityFeed, searchCommunityResources } from '../../services/api';
import { Client, Appointment, ClientActivity } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { FileText, DollarSign, BarChart, Calendar, ArrowRight, Video, Award, ClipboardList, MapPin, Search, X, HeartHandshake, Brain } from 'lucide-react';
import Modal from '../../components/ui/Modal';

interface ActionCardProps {
    icon: React.ElementType;
    title: string;
    description: string;
    onClick: () => void;
}

const ActionCard: React.FC<ActionCardProps> = ({ icon: Icon, title, description, onClick }) => (
    <Card noPadding className="overflow-hidden group">
        <button onClick={onClick} className="w-full text-left p-6">
            <div className="flex justify-between items-start">
                <div className="p-3 bg-primary/10 rounded-2xl">
                    <Icon className="w-8 h-8 text-primary" />
                </div>
                <ArrowRight className="w-6 h-6 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300"/>
            </div>
            <h3 className="text-xl font-black mt-4 tracking-tight">{title}</h3>
            <p className="text-sm text-slate-500 mt-1">{description}</p>
        </button>
    </Card>
);

const ResourceFinderModal: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<{text: string, chunks: any[]} | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!query.trim()) return;
        setIsLoading(true);
        try {
            const data = await searchCommunityResources(query);
            setResults(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Recovery Intelligence Finder">
            <div className="p-6">
                <form onSubmit={handleSearch} className="relative mb-6">
                    <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search local resources via Google Maps..." className="w-full pl-5 pr-14 py-4 border-none bg-slate-100 dark:bg-slate-800 rounded-2xl focus:ring-2 focus:ring-primary/20 text-sm font-medium" />
                    <button type="submit" disabled={isLoading} className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-primary text-white rounded-xl hover:bg-primary-focus disabled:opacity-50"><Search size={20} /></button>
                </form>
                {isLoading && <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div><p className="text-xs font-black uppercase text-slate-400 mt-4 tracking-widest">Grounding with Google Maps...</p></div>}
                {results && (
                    <div className="space-y-6 animate-fade-in-up">
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{results.text}</p>
                        <div className="grid gap-3">
                            {results.chunks.map((chunk, i) => chunk.maps?.uri || chunk.web?.uri ? (
                                <a key={i} href={chunk.maps?.uri || chunk.web.uri} target="_blank" rel="noopener noreferrer" className="block p-4 border border-slate-100 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm hover:shadow-md">
                                    <h4 className="font-black text-primary text-sm">{chunk.maps?.title || chunk.web?.title || 'Resource Found'}</h4>
                                    <p className="text-[10px] text-slate-400 font-mono mt-1 truncate">{chunk.maps?.uri || chunk.web?.uri}</p>
                                </a>
                            ) : null)}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}

const PortalDashboard: React.FC = () => {
    const [client, setClient] = useState<Client | null>(null);
    const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
    const [activityFeed, setActivityFeed] = useState<ClientActivity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchClientData = async () => {
            const clientId = '1';
            const [clientData, appointmentsData, activityData] = await Promise.all([
                getClient(clientId),
                getClientAppointments(clientId),
                getClientActivityFeed(clientId)
            ]);
            setClient(clientData || null);
            if (appointmentsData && appointmentsData.length > 0) {
                const upcoming = appointmentsData
                    .map(a => ({ ...a, date: new Date(a.date) }))
                    .filter(a => a.date >= new Date())
                    .sort((a, b) => a.date.getTime() - b.date.getTime());
                setNextAppointment(upcoming[0] || null);
            }
            setActivityFeed(activityData.map(act => ({...act, timestamp: new Date(act.timestamp)})));
            setIsLoading(false);
        };
        fetchClientData();
    }, []);

    if (isLoading) return <PortalLayout><div className="flex justify-center items-center h-64"><LoadingSpinner /></div></PortalLayout>;
    if (!client) return <PortalLayout><div className="text-center p-12">Session Expired.</div></PortalLayout>;

    return (
        <PortalLayout>
            <div className="max-w-5xl mx-auto relative space-y-8 animate-fade-in-up">
                <div className="flex justify-between items-center">
                    <Header title={`Hello, ${client.name.split(' ')[0]}!`} subtitle="Your personalized recovery path orchestrated by GeMyndFlow." />
                    <button onClick={() => setIsResourceModalOpen(true)} className="hidden sm:flex items-center gap-2 bg-accent text-white px-5 py-2.5 rounded-2xl font-bold shadow-lg shadow-accent/20 hover:scale-105 transition-all">
                        <MapPin size={18} /> Find Support Near You
                    </button>
                </div>
                
                 {nextAppointment && (
                    <Card className="bg-gradient-to-r from-primary to-accent text-white border-none shadow-2xl shadow-primary/20">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Up Next</p>
                                <h3 className="text-3xl font-black tracking-tight">{nextAppointment.title}</h3>
                                <p className="font-bold flex items-center gap-2 opacity-90 text-sm">
                                    <Calendar size={14} /> {new Date(nextAppointment.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {nextAppointment.startTime}
                                </p>
                            </div>
                            <button className="w-full sm:w-auto px-8 py-3 bg-white text-primary rounded-2xl font-black text-sm shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2">
                                <Video size={18}/> JOIN SESSION
                            </button>
                        </div>
                    </Card>
                )}
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card title="Program Progression">
                        <div className="flex items-center justify-between mb-2">
                             <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Mastery Level</span>
                             <span className="text-4xl font-black text-primary">{client.completionPercentage}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-4 overflow-hidden mb-6">
                            <div className="bg-gradient-to-r from-primary to-accent h-full transition-all duration-1000" style={{ width: `${client.completionPercentage}%` }}></div>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex justify-around">
                            <div className="text-center">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Points</p>
                                <p className="text-2xl font-black text-amber-500">{client.gamification.points}</p>
                            </div>
                            <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
                            <div className="text-center">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Milestones</p>
                                <p className="text-2xl font-black text-slate-700 dark:text-slate-300">{client.gamification.badges.length}</p>
                            </div>
                        </div>
                    </Card>
                    <Card title="Activity Log">
                        <ul className="space-y-4 max-h-64 overflow-y-auto custom-scrollbar">
                           {activityFeed.map(item => (
                               <li key={item.id} className="flex items-start gap-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 rounded-2xl transition-colors">
                                   <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl"><Award size={18} className="text-primary"/></div>
                                   <div>
                                       <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.description}</p>
                                       <p className="text-[10px] font-black text-slate-400 uppercase mt-0.5">{new Date(item.timestamp).toLocaleDateString()}</p>
                                   </div>
                               </li>
                           ))}
                        </ul>
                    </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     <ActionCard icon={ClipboardList} title="Recovery Plan" description="Refine your goals and action steps." onClick={() => navigate('/portal/recovery-plan')} />
                     <ActionCard icon={BarChart} title="Program Compliance" description="Check your SROP progression requirements." onClick={() => navigate('/portal/compliance')} />
                     <ActionCard icon={Calendar} title="Session Schedule" description="Manage your virtual and in-person sessions." onClick={() => navigate('/portal/appointments')} />
                     <ActionCard icon={FileText} title="Document Vault" description="E-sign pending forms and review records." onClick={() => navigate('/portal/documents')} />
                     <ActionCard icon={DollarSign} title="Financial Wallet" description="Manage payments and session ledger." onClick={() => navigate('/portal/billing')} />
                     <ActionCard icon={Brain} title="Platform Support" description="Connect with GeMyndFlow Orchestrator." onClick={() => alert("Connecting to Clara...")} />
                </div>
            </div>
            <ResourceFinderModal isOpen={isResourceModalOpen} onClose={() => setIsResourceModalOpen(false)} />
        </PortalLayout>
    );
};

export default PortalDashboard;