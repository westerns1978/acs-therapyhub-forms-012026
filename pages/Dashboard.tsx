
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import { getAppointments, getPracticeMetrics, getWestFlowExecutiveSummary } from '../services/api';
import { Appointment, PracticeMetrics } from '../types';
import AIBriefingModal from '../components/ai/AIBriefingModal';
import DashboardSkeleton from '../components/skeletons/DashboardSkeleton';
import { useAuth } from '../contexts/AuthContext';
// FIX: Added ShieldCheck to imports
import { Clock, Video, Calendar, CheckCircle, AlertCircle, DollarSign, FileText, AlertTriangle, Zap, Activity, HardDrive, ArrowUpRight, TrendingUp, Sparkles, Brain, ArrowDownRight, ShieldCheck } from 'lucide-react';

const OperationalInsightCard: React.FC<{ title: string, value: string, icon: any, trend: 'up' | 'down', color: string }> = ({ title, value, icon: Icon, trend, color }) => (
    <div className="p-5 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl transition-all hover:scale-[1.02] group">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-2xl ${color} bg-opacity-10 text-${color.split('-')[1]}-600`}>
                <Icon size={20} />
            </div>
            <div className={`flex items-center gap-1 text-[10px] font-black ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                {trend === 'up' ? <TrendingUp size={12}/> : <ArrowDownRight size={12}/>}
                {trend === 'up' ? '+4.2%' : '-1.5%'}
            </div>
        </div>
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{title}</p>
        <h4 className="text-3xl font-black text-slate-900 dark:text-white mt-1 tracking-tighter">{value}</h4>
    </div>
);

const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isBriefingModalOpen, setBriefingModalOpen] = useState(false);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [metrics, setMetrics] = useState<PracticeMetrics | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                const [appointmentsData, metricsData] = await Promise.all([
                    getAppointments(),
                    getPracticeMetrics()
                ]);
                const todayStr = new Date().toDateString();
                const todaysAppts = appointmentsData
                    .filter(a => new Date(a.date).toDateString() === todayStr)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));
                
                setAppointments(todaysAppts);
                setMetrics(metricsData);
            } catch (error) {
                console.error("Failed to fetch dashboard", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

        if (!sessionStorage.getItem('briefingShown')) {
            setBriefingModalOpen(true);
            sessionStorage.setItem('briefingShown', 'true');
        }
    }, [user]);

    if (isLoading || !metrics) return <DashboardSkeleton />;

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="px-3 py-1 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-primary/20">Level III Authorization</div>
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Node ID: PDS-LEX-04</span>
                    </div>
                    <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
                        Command <span className="text-primary">Center</span>
                    </h1>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setBriefingModalOpen(true)} className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-2xl transition-all flex items-center gap-3 border border-white/10 group">
                        <Brain size={18} className="group-hover:scale-110 transition-transform" /> Tactical Briefing
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <OperationalInsightCard title="Practice Integrity" value="98.4%" icon={ShieldCheck} trend="up" color="bg-emerald-500" />
                <OperationalInsightCard title="MTD Yield" value={`$${(metrics.incomeMTD/1000).toFixed(1)}k`} icon={DollarSign} trend="up" color="bg-blue-500" />
                <OperationalInsightCard title="Active Flux" value={metrics.totalActiveClients.toString()} icon={Activity} trend="down" color="bg-primary" />
                <OperationalInsightCard title="Logic Latency" value="14ms" icon={Zap} trend="up" color="bg-amber-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <Card title="Orchestration Timeline" subtitle="Active clinical sessions and upcoming dispatches.">
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {appointments.length > 0 ? appointments.map((apt) => (
                                <div key={apt.id} className="py-6 flex items-center justify-between group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 px-4 rounded-2xl transition-all">
                                    <div className="flex items-center gap-8">
                                        <div className="text-center w-20">
                                            <p className="text-xl font-black text-slate-900 dark:text-white leading-none">{apt.startTime.split(' ')[0]}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{apt.startTime.split(' ')[1]}</p>
                                        </div>
                                        <div className="h-10 w-px bg-slate-200 dark:bg-slate-700"></div>
                                        <div>
                                            <h4 className="font-black text-lg text-slate-800 dark:text-white group-hover:text-primary transition-colors">{apt.clientName || apt.title}</h4>
                                            <div className="flex items-center gap-4 mt-1.5">
                                                <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-500">{apt.type}</span>
                                                {apt.modality.includes('Zoom') && <span className="flex items-center gap-1.5 text-[10px] font-bold text-secondary"><Video size={12}/> VIRTUAL NODE</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <button className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                                        <ArrowUpRight size={18}/>
                                    </button>
                                </div>
                            )) : (
                                <div className="py-20 text-center text-slate-300">
                                    <Brain size={48} className="mx-auto mb-4 opacity-20" />
                                    <p className="text-xs font-black uppercase tracking-[0.3em]">No Synchronized Events</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <Card title="Neural Health" className="border-t-4 border-primary">
                        <div className="space-y-6">
                            <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-[1.5rem] border border-dashed border-slate-200 dark:border-slate-800">
                                <div className="flex items-center gap-3 mb-4">
                                    <Sparkles size={16} className="text-primary animate-pulse" />
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Orchestrator Forecast</span>
                                </div>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                                    "GeMyndFlow predicts a <span className="text-primary font-bold">12% throughput bottleneck</span> in SATOP IV certifications next week. Recommend pre-emptively drafting court reports for 4 high-compliance clients."
                                </p>
                            </div>
                            
                            <ul className="space-y-4">
                                <li className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                    <span className="text-sm font-bold">Compliance Drift</span>
                                    <span className="text-xs font-black text-green-500 font-mono">-2.1% (Stable)</span>
                                </li>
                                <li className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                    <span className="text-sm font-bold">Session Integrity</span>
                                    <span className="text-xs font-black text-primary font-mono">99.1%</span>
                                </li>
                            </ul>
                        </div>
                    </Card>

                    <Card title="Clinical Guardrails">
                        <div className="space-y-3">
                            <div className="flex items-start gap-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl group cursor-pointer hover:bg-red-100 transition-colors">
                                <AlertTriangle className="text-primary shrink-0 mt-1" size={20} />
                                <div>
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Policy Violation</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-red-200 mt-0.5">Missing QAP signature on 3 notes.</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            <AIBriefingModal isOpen={isBriefingModalOpen} onClose={() => setBriefingModalOpen(false)} />
        </div>
    );
};

export default Dashboard;
