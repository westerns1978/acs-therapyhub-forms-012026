
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import DashboardSkeleton from '../components/skeletons/DashboardSkeleton';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { Video, Calendar, DollarSign, AlertTriangle, Activity, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { fetchAlerts, summarizeAlerts, type AlertsSummary, type ClientAlert } from '../services/alertsService';

// No delta shown — we have no historical baseline to compute period-over-period
// change. Showing '—' in the delta slot keeps the visual real-estate but
// doesn't fabricate a direction.
const OperationalInsightCard: React.FC<{ title: string, value: string, icon: any, color: string }> = ({ title, value, icon: Icon, color }) => (
    <div className="p-5 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl transition-all hover:scale-[1.02] group">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-2xl ${color} bg-opacity-10 text-${color.split('-')[1]}-600`}>
                <Icon size={20} />
            </div>
            <div className="text-[10px] font-black text-slate-400 tabular-nums">—</div>
        </div>
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{title}</p>
        <h4 className="text-3xl font-black text-slate-900 dark:text-white mt-1 tracking-tighter">{value}</h4>
    </div>
);

// null = query failed or no data yet, rendered as '—'.
// 0 = honest zero, rendered as '0' / '$0' / '0%'.
interface DashboardMetrics {
    complianceRate: number | null;
    monthlyRevenue: number | null;
    activeClients: number | null;
}

const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState<any[]>([]);
    const [alertSummary, setAlertSummary] = useState<AlertsSummary>({ critical: 0, high: 0, elevated: 0, moderate: 0, total: 0 });
    const [topAlerts, setTopAlerts] = useState<ClientAlert[]>([]);
    const [metrics, setMetrics] = useState<DashboardMetrics>({
        complianceRate: null,
        monthlyRevenue: null,
        activeClients: null,
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                
                // Active clients
                const { count: clientCount } = await supabase
                    .from('clients')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'active');

                // Revenue this month
                const monthStart = new Date(
                    new Date().getFullYear(), 
                    new Date().getMonth(), 1
                ).toISOString();
                const { data: payments } = await supabase
                    .from('payments')
                    .select('amount')
                    .gte('payment_date', monthStart);
                const revenue = payments?.reduce(
                    (sum, p) => sum + Number(p.amount), 0
                ) || 0;

                // Average compliance score
                const { data: clients } = await supabase
                    .from('clients')
                    .select('compliance_score')
                    .eq('status', 'active');
                const avgCompliance = clients?.length
                    ? clients.reduce((sum, c) => sum + (c.compliance_score || 0), 0) / clients.length
                    : 0;

                setMetrics({
                    // null if no active clients — average over zero clients is not a meaningful rate
                    complianceRate: clients && clients.length > 0
                        ? Math.round(avgCompliance * 10) / 10
                        : null,
                    monthlyRevenue: revenue,
                    activeClients: clientCount ?? 0,
                });

                // Today's schedule
                const today = new Date().toISOString().split('T')[0];
                const tomorrow = new Date(Date.now() + 86400000)
                    .toISOString().split('T')[0];
                
                const { data: scheduleData } = await supabase
                    .from('appointments')
                    .select('*, clients(name, program_type)')
                    .gte('start_time', today)
                    .lt('start_time', tomorrow)
                    .order('start_time');
                
                setAppointments(scheduleData || []);

                // Risk alerts (non-blocking — falls back to empty on failure)
                try {
                    const alerts = await fetchAlerts();
                    setAlertSummary(summarizeAlerts(alerts));
                    setTopAlerts(alerts.slice(0, 3));
                } catch (e) {
                    console.warn('[dashboard] fetchAlerts failed:', e);
                }
            } catch (error) {
                console.warn("Failed to fetch dashboard:", error);
                // Failed query → render '—' in each tile. No fabricated fallback numbers.
                setMetrics({ complianceRate: null, monthlyRevenue: null, activeClients: null });
                setAppointments([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [user]);

    if (isLoading || !metrics) return <DashboardSkeleton />;

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
                        Dashboard
                    </h1>
                    {alertSummary.total > 0 && (
                        <button
                            onClick={() => navigate('/risk-monitor')}
                            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition text-xs font-black uppercase tracking-widest"
                        >
                            <AlertTriangle size={14} />
                            Pending Alerts: {alertSummary.total}
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <OperationalInsightCard
                    title="Compliance Rate"
                    value={metrics.complianceRate === null ? '—' : `${metrics.complianceRate}%`}
                    icon={ShieldCheck}
                    color="bg-emerald-500"
                />
                <OperationalInsightCard
                    title="Monthly Revenue"
                    value={metrics.monthlyRevenue === null ? '—' : `$${metrics.monthlyRevenue.toLocaleString()}`}
                    icon={DollarSign}
                    color="bg-blue-500"
                />
                <OperationalInsightCard
                    title="Active Clients"
                    value={metrics.activeClients === null ? '—' : metrics.activeClients.toString()}
                    icon={Activity}
                    color="bg-primary"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <Card title="Today's Schedule" subtitle="Today's clinical sessions.">
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {appointments.length > 0 ? appointments.map((apt) => {
                                const dateObj = new Date(apt.start_time);
                                const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                const [time, period] = timeString.split(' ');
                                return (
                                <div key={apt.id} className="py-6 flex items-center justify-between group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 px-4 rounded-2xl transition-all">
                                    <div className="flex items-center gap-8">
                                        <div className="text-center w-20">
                                            <p className="text-xl font-black text-slate-900 dark:text-white leading-none">{time}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{period}</p>
                                        </div>
                                        <div className="h-10 w-px bg-slate-200 dark:bg-slate-700"></div>
                                        <div>
                                            <h4 className="font-black text-lg text-slate-800 dark:text-white group-hover:text-primary transition-colors">{apt.clients?.name || 'Unknown Client'}</h4>
                                            <div className="flex items-center gap-4 mt-1.5">
                                                <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-500">{apt.appointment_type}</span>
                                                {apt.modality?.includes('Zoom') && <span className="flex items-center gap-1.5 text-[10px] font-bold text-secondary"><Video size={12}/> TELEHEALTH</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <button className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                                        <ArrowUpRight size={18}/>
                                    </button>
                                </div>
                            )}) : (
                                <div className="py-20 text-center text-slate-300">
                                    <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                                    <p className="text-xs font-black uppercase tracking-[0.3em]">No appointments scheduled for today.</p>
                                </div>
                            )}
                        </div>
                    </Card>
                    
                    <Card title="Risk Monitor" subtitle="Actionable alerts from real client activity.">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="p-4 rounded-2xl border-2 border-red-100 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10">
                                <div className="text-3xl font-black tracking-tighter text-red-600">{alertSummary.critical}</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Critical</div>
                            </div>
                            <div className="p-4 rounded-2xl border-2 border-orange-100 dark:border-orange-900/40 bg-orange-50/50 dark:bg-orange-900/10">
                                <div className="text-3xl font-black tracking-tighter text-orange-600">{alertSummary.high}</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">High</div>
                            </div>
                            <div className="p-4 rounded-2xl border-2 border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10">
                                <div className="text-3xl font-black tracking-tighter text-amber-600">{alertSummary.elevated}</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Elevated</div>
                            </div>
                            <div className="p-4 rounded-2xl border-2 border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/10">
                                <div className="text-3xl font-black tracking-tighter text-blue-600">{alertSummary.moderate}</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Moderate</div>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/risk-monitor')}
                            className="mt-4 w-full px-4 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition flex items-center justify-center gap-2"
                        >
                            {alertSummary.total > 0 ? `Review ${alertSummary.total} alert${alertSummary.total === 1 ? '' : 's'}` : 'Open Risk Monitor'}
                            <ArrowUpRight size={14} />
                        </button>
                    </Card>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <Card title="Clinical Guardrails">
                        <div className="space-y-3">
                            {topAlerts.length > 0 ? topAlerts.map(a => (
                                <button
                                    key={a.id}
                                    onClick={() => navigate(`/program-compliance/${a.clientId}`)}
                                    className="w-full text-left flex items-start gap-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl hover:bg-red-100 transition-colors"
                                >
                                    <AlertTriangle className="text-primary shrink-0 mt-1" size={20} />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">{a.tier} · {a.clientName}</p>
                                        <p className="text-sm font-bold text-slate-800 dark:text-red-200 mt-0.5">{a.headline}</p>
                                    </div>
                                </button>
                            )) : (
                                <div className="text-center py-6 text-slate-400 text-xs font-bold uppercase tracking-widest">
                                    No active alerts.
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

        </div>
    );
};

export default Dashboard;
