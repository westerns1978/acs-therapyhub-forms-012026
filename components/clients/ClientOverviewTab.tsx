import React from 'react';
import { Client, SROPProgress, ClientActivity } from '../../types';
import Card from '../ui/Card';
import { FileText, CheckCircle, Award, Calendar, AlertTriangle, Clock } from 'lucide-react';

interface ClientOverviewTabProps {
  client: Client;
  sropData: SROPProgress | null;
  activityFeed: ClientActivity[];
}

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ElementType }> = ({ label, value, icon: Icon }) => (
    <div className="bg-surface dark:bg-dark-surface-secondary p-4 rounded-lg">
        <div className="flex items-center">
            <Icon className="w-6 h-6 text-primary mr-3" />
            <div>
                <p className="text-sm text-surface-secondary-content">{label}</p>
                <p className="text-xl font-bold">{value}</p>
            </div>
        </div>
    </div>
);

const ActivityIcon: React.FC<{ type: ClientActivity['type'] }> = ({ type }) => {
    const icons = {
        Session: Calendar, Document: FileText, Form: CheckCircle,
        Achievement: Award, Task: CheckCircle, Payment: CheckCircle,
    };
    const Icon = icons[type] || Calendar;
    return <Icon className="w-4 h-4" />;
};

const ClientOverviewTab: React.FC<ClientOverviewTabProps> = ({ client, sropData, activityFeed }) => {
    const daysInProgram = Math.floor((new Date().getTime() - new Date(client.enrollmentDate).getTime()) / (1000 * 3600 * 24));
    
    const timeToDeadline = client.nextDeadline ? Math.max(0, Math.ceil((new Date(client.nextDeadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24))) : null;

    // FIX: Added defensive checks for arrays to avoid "length of undefined" errors.
    const missingDocsCount = client?.missingDocuments?.length || 0;
    const badgeCount = client?.gamification?.badges?.length || 0;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <Card title="Compliance Scorecard">
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between items-baseline mb-1">
                                <h4 className="font-semibold">SROP Program Completion</h4>
                                <span className="font-bold text-lg">{client.completionPercentage}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3"><div className="bg-primary h-3 rounded-full" style={{ width: `${client.completionPercentage}%` }}></div></div>
                        </div>
                        <div>
                            <div className="flex justify-between items-baseline mb-1">
                                <h4 className="font-semibold">Compliance Score</h4>
                                <span className="font-bold text-lg">{client.complianceScore}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3"><div className={`h-3 rounded-full ${client.complianceScore > 85 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ width: `${client.complianceScore}%` }}></div></div>
                        </div>
                    </div>
                </Card>
                <Card title="Recent Activity">
                     <ul className="space-y-4 max-h-80 overflow-y-auto custom-scrollbar">
                        {activityFeed.map(item => (
                            <li key={item.id} className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                    <ActivityIcon type={item.type} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">{item.description}</p>
                                    <p className="text-xs text-surface-secondary-content">{new Date(item.timestamp).toLocaleString()}</p>
                                </div>
                            </li>
                        ))}
                        {(activityFeed || []).length === 0 && (
                            <div className="text-center py-8 text-slate-400 text-sm">No recent activity detected.</div>
                        )}
                     </ul>
                </Card>
            </div>
            <div className="lg:col-span-1 space-y-6">
                <Card>
                     {timeToDeadline !== null && (
                        <div className={`p-4 rounded-lg mb-4 ${timeToDeadline < 7 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'} border`}>
                            <div className="flex items-center gap-3">
                                <Clock className={`w-6 h-6 ${timeToDeadline < 7 ? 'text-red-600' : 'text-blue-600'}`} />
                                <div>
                                    <p className="font-bold text-2xl">{timeToDeadline} Days</p>
                                    <p className="text-sm font-medium">until next deadline</p>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="space-y-3">
                        <StatCard label="Days in Program" value={daysInProgram} icon={Calendar} />
                        <StatCard label="Missing Documents" value={missingDocsCount} icon={AlertTriangle} />
                        <StatCard label="Achievements" value={badgeCount} icon={Award} />
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default ClientOverviewTab;