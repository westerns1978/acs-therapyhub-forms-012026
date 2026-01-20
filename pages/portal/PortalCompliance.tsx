
import React, { useState, useEffect } from 'react';
import PortalLayout from '../../layouts/PortalLayout';
import Header from '../../components/ui/Header';
import Card from '../../components/ui/Card';
// Fix: Correctly import getClientAssignments from the services API.
import { getClient, getSROPData, getClientAssignments } from '../../services/api';
import { Client, SROPProgress, ClientAssignment } from '../../types';

const TrophyIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>;
const CheckSquareIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>;

const PortalCompliance: React.FC = () => {
    const [client, setClient] = useState<Client | null>(null);
    const [sropData, setSropData] = useState<SROPProgress | null>(null);
    const [assignments, setAssignments] = useState<ClientAssignment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const clientId = '1'; // Hardcoded for demo
            const [clientData, srop, userAssignments] = await Promise.all([
                getClient(clientId),
                getSROPData(clientId),
                getClientAssignments(clientId),
            ]);
            setClient(clientData);
            setSropData(srop);
            setAssignments(userAssignments);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    if (isLoading || !client || !sropData) {
        return <PortalLayout><div className="text-center">Loading your compliance dashboard...</div></PortalLayout>;
    }
    
    const totalCompleted = sropData.phase1.completedHours + sropData.phase2.completedHours;
    const overallProgress = (totalCompleted / sropData.totalHours) * 100;

    return (
        <PortalLayout>
            <div className="max-w-4xl mx-auto">
                <Header title="My Compliance Dashboard" subtitle="Track your progress and stay on top of your requirements." />
                
                <Card title="SROP 75-Hour Program Progress" className="mb-6">
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between items-baseline mb-1">
                                <h4 className="font-semibold text-on-surface">Overall Progress</h4>
                                <span className="font-bold text-2xl text-on-surface">{totalCompleted.toFixed(1)}<span className="text-lg font-medium text-on-surface-secondary"> / {sropData.totalHours} hrs</span></span>
                            </div>
                            <div className="w-full bg-gray-200/50 dark:bg-slate-700/50 rounded-full h-4 overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-400 to-purple-500 h-4 rounded-full transition-all duration-500" style={{ width: `${overallProgress}%` }}></div>
                            </div>
                        </div>
                    </div>
                </Card>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    
                    <Card title="Assigned Tasks">
                        <ul className="space-y-3">
                            {assignments.map(task => (
                                <li key={task.id} className={`p-3 rounded-lg flex items-start gap-3 ${task.isComplete ? 'bg-green-50 dark:bg-green-900/20' : 'bg-surface dark:bg-slate-800/50'}`}>
                                    <CheckSquareIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${task.isComplete ? 'text-green-500' : 'text-on-surface-secondary'}`} />
                                    <div>
                                        <p className={`text-sm ${task.isComplete ? 'line-through text-on-surface-secondary' : 'font-medium'}`}>{task.task}</p>
                                        {!task.isComplete && <p className="text-xs text-on-surface-secondary">Due: {new Date(task.dueDate).toLocaleDateString()}</p>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </Card>
                </div>

            </div>
        </PortalLayout>
    );
};

export default PortalCompliance;