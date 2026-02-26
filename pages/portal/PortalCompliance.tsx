import React, { useState, useEffect } from 'react';
import PortalLayout from '../../layouts/PortalLayout';
import Header from '../../components/ui/Header';
import Card from '../../components/ui/Card';
import { supabase } from '../../services/supabase';
import { usePortalClient } from '../../hooks/usePortalClient';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { BarChart, Award, CheckCircle2, Circle, Trophy, Target, Zap } from 'lucide-react';

const PortalCompliance: React.FC = () => {
    const portalClient = usePortalClient();
    const [complianceData, setComplianceData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!portalClient) return;
        const fetchCompliance = async () => {
            setIsLoading(true);
            try {
                // Get client data
                const { data: client } = await supabase
                    .from('clients')
                    .select('*')
                    .eq('id', portalClient.id)
                    .single();

                // Get SROP data
                const { data: srop } = await supabase
                    .from('srop_data')
                    .select('*')
                    .eq('client_id', portalClient.id)
                    .single();

                // Get assigned tasks/milestones
                const { data: tasks } = await supabase
                    .from('client_assignments')
                    .select('*')
                    .eq('client_id', portalClient.id);

                setComplianceData({
                    client,
                    srop,
                    tasks: tasks || []
                });
            } catch (err) {
                console.warn('Failed to fetch compliance:', err);
            }
            setIsLoading(false);
        };
        fetchCompliance();
    }, [portalClient]);

    if (isLoading || !portalClient) return <PortalLayout><div className="flex justify-center items-center h-64"><LoadingSpinner /></div></PortalLayout>;

    const { client, srop, tasks } = complianceData;

    return (
        <PortalLayout>
            <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
                <Header title="My Progress" subtitle="Track your program requirements and achievements." />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <Card title="Program Completion">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Overall Progress</p>
                                <p className="text-4xl font-black text-primary">{client.compliance_score}%</p>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-6 overflow-hidden shadow-inner">
                                <div className="bg-gradient-to-r from-primary via-accent to-indigo-500 h-full transition-all duration-1000" style={{ width: `${client.compliance_score}%` }}></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-8">
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SROP Hours</p>
                                    <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{client.srop_hours_completed || 0} / 75</p>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Days Clean</p>
                                    <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{client.days_clean || 0}</p>
                                </div>
                            </div>
                        </Card>

                        <Card title="Required Tasks">
                            <div className="space-y-4">
                                {tasks.map((task: any) => (
                                    <div key={task.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:shadow-md transition-all">
                                        <div className="flex items-center gap-4">
                                            {task.status === 'completed' ? (
                                                <CheckCircle2 className="text-green-500 w-6 h-6" />
                                            ) : (
                                                <Circle className="text-slate-300 w-6 h-6" />
                                            )}
                                            <div>
                                                <p className={`font-bold ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100'}`}>
                                                    {task.title}
                                                </p>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Due: {new Date(task.due_date).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        {task.status !== 'completed' && (
                                            <button className="text-primary font-black text-xs uppercase tracking-widest hover:underline">Complete</button>
                                        )}
                                    </div>
                                ))}
                                {tasks.length === 0 && (
                                    <p className="text-center py-8 text-slate-500 italic">No pending tasks assigned.</p>
                                )}
                            </div>
                        </Card>
                    </div>

                    <div className="space-y-8">
                        <Card className="bg-gradient-to-br from-amber-400 to-orange-500 text-white border-none shadow-xl shadow-amber-500/20">
                            <div className="flex items-center gap-4">
                                <Trophy size={48} className="opacity-50" />
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Recovery Points</p>
                                    <h3 className="text-4xl font-black">1,250</h3>
                                </div>
                            </div>
                            <div className="mt-6 pt-6 border-t border-white/20">
                                <p className="text-xs font-bold opacity-90">Next Reward: $10 Session Credit</p>
                                <div className="w-full bg-white/20 rounded-full h-2 mt-2">
                                    <div className="bg-white h-full rounded-full" style={{ width: '75%' }}></div>
                                </div>
                            </div>
                        </Card>

                        <Card title="Achievements">
                            <div className="grid grid-cols-3 gap-4">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center group cursor-help relative">
                                        <Award className={`w-8 h-8 ${i <= 3 ? 'text-primary' : 'text-slate-300'}`} />
                                        {i > 3 && <div className="absolute inset-0 bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Zap size={16} className="text-slate-400" />
                                        </div>}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </PortalLayout>
    );
};

export default PortalCompliance;
