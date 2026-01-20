import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDailyBriefingData } from '../../services/api';
import { DailyBriefingData } from '../../types';
import { AlertTriangle, TrendingUp, Calendar, ShieldAlert, CheckCircle, ArrowRight, DollarSign, Clock } from 'lucide-react';

interface AIBriefingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AIBriefingModal: React.FC<AIBriefingModalProps> = ({ isOpen, onClose }) => {
    const [briefingData, setBriefingData] = useState<DailyBriefingData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (isOpen) {
            const fetchData = async () => {
                setIsLoading(true);
                const data = await getDailyBriefingData();
                setBriefingData(data);
                setIsLoading(false);
            };
            fetchData();
        }
    }, [isOpen]);

    const handleClientClick = (clientId: string) => {
        onClose();
        navigate(`/program-compliance/${clientId}`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 animate-fade-in-up">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                {/* Header */}
                <header className="bg-gradient-to-r from-slate-900 via-primary to-slate-900 p-6 flex justify-between items-center text-white shadow-lg relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                    <div className="flex items-center gap-5 relative z-10">
                        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20 shadow-inner">
                            <img src="https://storage.googleapis.com/westerns1978-digital-assets/ACS%20TherapyHub/clara2-announcement.png" alt="Clara" className="w-12 h-12 rounded-xl" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight">Clinical Command Center</h2>
                            <p className="text-blue-100 text-sm font-medium tracking-wide opacity-80">DAILY INTELLIGENCE BRIEFING • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="relative z-10 text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2.5 rounded-xl text-sm font-bold transition uppercase tracking-wide">
                        Dismiss Briefing
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-slate-950">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary"></div></div>
                    ) : briefingData ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                            
                            {/* Column 1: Critical Compliance (Red Zone) */}
                            <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border-t-4 border-red-500 shadow-sm overflow-hidden">
                                <div className="p-5 bg-red-50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/30 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600"><ShieldAlert size={20} /></div>
                                        <h3 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-sm">Urgent Compliance</h3>
                                    </div>
                                    <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">{(briefingData?.highPriorityAlerts?.length || 0) + (briefingData?.complianceRisks?.length || 0)}</span>
                                </div>
                                <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                                    {(!briefingData?.highPriorityAlerts?.length && !briefingData?.complianceRisks?.length) && (
                                        <div className="h-32 flex flex-col items-center justify-center text-green-600 bg-green-50 rounded-xl border border-green-100 border-dashed">
                                            <CheckCircle size={32} className="mb-2 opacity-50"/>
                                            <span className="font-semibold">All Clear</span>
                                        </div>
                                    )}
                                    {briefingData?.highPriorityAlerts?.map(alert => (
                                        <div key={alert.clientId} onClick={() => handleClientClick(alert.clientId)} className="group p-4 bg-red-50/50 dark:bg-red-900/5 hover:bg-white dark:hover:bg-slate-800 rounded-xl border border-red-100 dark:border-red-900/30 hover:border-red-300 hover:shadow-md transition cursor-pointer">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-red-700 transition-colors">{alert.clientName}</h4>
                                                <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Critical</span>
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug">{alert.alertText}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Column 2: Revenue Opportunities (Green Zone) */}
                            <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border-t-4 border-green-500 shadow-sm overflow-hidden">
                                <div className="p-5 bg-green-50 dark:bg-green-900/10 border-b border-green-100 dark:border-green-900/30 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600"><DollarSign size={20} /></div>
                                        <h3 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-sm">Revenue Ops</h3>
                                    </div>
                                    <TrendingUp size={16} className="text-green-600"/>
                                </div>
                                <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                                    <div className="grid grid-cols-2 gap-3 mb-2">
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                                            <span className="block text-2xl font-bold text-slate-800 dark:text-white">{briefingData?.therapistStats?.caseloadSize || 0}</span>
                                            <span className="text-[10px] uppercase font-bold text-slate-400">Active Cases</span>
                                        </div>
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                                            <span className="block text-2xl font-bold text-green-600">{briefingData?.therapistStats?.thisWeekCompletions || 0}</span>
                                            <span className="text-[10px] uppercase font-bold text-slate-400">Completions</span>
                                        </div>
                                    </div>
                                    
                                    <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Unbilled Sessions</h4>
                                        {/* Mock Data for visual */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="font-medium text-slate-700 dark:text-slate-300">Bob Williams (Intake)</span>
                                                <span className="font-mono font-bold text-slate-900 dark:text-white">$150.00</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="font-medium text-slate-700 dark:text-slate-300">Alice Johnson (Group)</span>
                                                <span className="font-mono font-bold text-slate-900 dark:text-white">$40.00</span>
                                            </div>
                                        </div>
                                        <button className="w-full mt-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg py-1.5 text-xs font-bold text-slate-600 dark:text-slate-200 hover:bg-slate-50 transition">
                                            Create Invoices (2)
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Column 3: Operational Schedule (Blue Zone) */}
                            <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border-t-4 border-blue-500 shadow-sm overflow-hidden">
                                <div className="p-5 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/30 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600"><Calendar size={20} /></div>
                                        <h3 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-sm">Today's Flow</h3>
                                    </div>
                                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">{briefingData?.todaysAppointments?.length || 0} Events</span>
                                </div>
                                <div className="p-0 overflow-y-auto flex-1 custom-scrollbar relative">
                                    {/* Timeline line */}
                                    <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-slate-100 dark:bg-slate-800 z-0"></div>
                                    
                                    {briefingData?.todaysAppointments?.map((apt, idx) => (
                                        <div key={apt.id} className="relative z-10 p-4 pl-0 flex items-start group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                                            <div className="w-16 text-right pr-4 pt-1 flex flex-col items-end">
                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{apt.startTime.split(' ')[0]}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{apt.startTime.split(' ')[1]}</span>
                                            </div>
                                            <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900 mt-1.5 shadow-sm group-hover:scale-125 transition-transform"></div>
                                            <div className="flex-1 pl-4">
                                                <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 rounded-lg shadow-sm group-hover:border-blue-200 dark:group-hover:border-blue-800 transition-colors">
                                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{apt.clientName || apt.title}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{apt.type}</span>
                                                        {apt.modality.includes('Zoom') && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">VIRTUAL</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {(!briefingData?.todaysAppointments || briefingData.todaysAppointments.length === 0) && (
                                        <div className="p-8 text-center text-slate-400 text-sm">
                                            No appointments scheduled for today.
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    ) : null}
                </main>
                
                <footer className="p-5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                        <Clock size={14}/>
                        <span>Updated: Just now</span>
                    </div>
                    <button onClick={onClose} className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                        Let's Get to Work <ArrowRight size={16} />
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default AIBriefingModal;