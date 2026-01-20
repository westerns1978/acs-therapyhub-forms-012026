import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import { getClient, getProgramPlan } from '../services/api';
import { ProgramGoal, Client, ProgramPlan as ProgramPlanType } from '../types';

const PlusCircleIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="16"/><line x1="8" x2="16" y1="12" y2="12"/></svg>;

const getStatusColor = (status: ProgramGoal['status']) => {
    switch (status) {
        case 'In Progress': return 'bg-blue-100 text-blue-800';
        case 'Completed': return 'bg-green-100 text-green-800';
        case 'On Hold': return 'bg-yellow-100 text-yellow-800';
        case 'Not Started': return 'bg-gray-100 text-gray-800';
    }
};

const ProgramPlan: React.FC = () => {
    const { clientId } = useParams<{ clientId: string }>();
    const [programPlan, setProgramPlan] = useState<ProgramPlanType | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (clientId) {
            const fetchData = async () => {
                setIsLoading(true);
                const [clientData, planData] = await Promise.all([
                    getClient(clientId),
                    getProgramPlan(clientId)
                ]);
                setClient(clientData || null);
                setProgramPlan(planData);
                setIsLoading(false);
            };
            fetchData();
        }
    }, [clientId]);


    if (isLoading) {
        return <div className="p-8 text-center">Loading program plan...</div>;
    }

    if (!client || !programPlan) {
        return <div className="p-8 text-center">Client or program plan not found.</div>;
    }

    return (
        <div>
            <div className="space-y-6">
                {programPlan.goals.map(goal => (
                    <Card key={goal.id} className="p-0 overflow-hidden">
                        <div className="p-4 bg-white/60 dark:bg-slate-800/60">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <h3 className="text-xl font-bold text-on-surface dark:text-slate-100 leading-tight">{goal.description}</h3>
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(goal.status)}`}>
                                    {goal.status}
                                </span>
                            </div>
                            <div className="mt-4">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-medium text-on-surface-secondary">Progress</span>
                                    <span className="text-sm font-semibold">{goal.progress}%</span>
                                </div>
                                <div className="w-full bg-gray-200/50 dark:bg-slate-700/50 rounded-full h-2.5 overflow-hidden">
                                    <div className="bg-primary h-2.5 rounded-full transition-all duration-500" style={{ width: `${goal.progress}%` }}></div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 border-t border-black/10 dark:border-white/10">
                            <div className="p-4">
                                <h4 className="text-lg font-semibold text-on-surface mb-2 leading-tight">Objectives</h4>
                                <ul className="list-disc list-inside space-y-2 text-base text-on-surface-secondary">
                                    {goal.objectives.map((obj, i) => <li key={i}>{obj}</li>)}
                                </ul>
                            </div>
                             <div className="p-4 border-t md:border-t-0 md:border-l border-black/10 dark:border-white/10">
                                <h4 className="text-lg font-semibold text-on-surface mb-2 leading-tight">Interventions</h4>
                                 <div className="flex flex-wrap gap-2">
                                    {goal.interventions.map((int, i) => (
                                        <span key={i} className="text-xs font-medium bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">{int}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default ProgramPlan;