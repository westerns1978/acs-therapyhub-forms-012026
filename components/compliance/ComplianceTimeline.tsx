import React from 'react';
import { ComplianceEvent } from '../../types';
import Card from '../ui/Card';

const CalendarIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>;
const AlertTriangleIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>;
const CheckCircleIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;

const getStatusStyles = (status: ComplianceEvent['status']) => {
    switch (status) {
        case 'overdue': return { bg: 'bg-red-500', icon: AlertTriangleIcon };
        case 'upcoming': return { bg: 'bg-yellow-500', icon: CalendarIcon };
        case 'complete': return { bg: 'bg-green-500', icon: CheckCircleIcon };
        default: return { bg: 'bg-gray-500', icon: CalendarIcon };
    }
};

interface ComplianceTimelineProps {
    events: ComplianceEvent[];
}

const ComplianceTimeline: React.FC<ComplianceTimelineProps> = ({ events }) => {
    const sortedEvents = [...events].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    return (
        <Card title="Compliance Timeline">
            <div className="relative pl-6">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border dark:bg-slate-700 -translate-x-1/2"></div>
                {sortedEvents.map(event => {
                    const { bg, icon: Icon } = getStatusStyles(event.status);
                    return (
                        <div key={event.id} className="relative mb-8 pl-8">
                            <div className={`absolute left-0 top-1 w-6 h-6 ${bg} rounded-full flex items-center justify-center -translate-x-1/2`}>
                                <Icon className="w-4 h-4 text-white" />
                            </div>
                            <div className="p-4 bg-white/40 dark:bg-slate-700/40 rounded-xl border border-white/20 dark:border-slate-600/50">
                                <p className="font-bold text-on-surface dark:text-slate-100">{event.type}</p>
                                <p className="text-sm text-on-surface-secondary dark:text-slate-300">Client: {event.clientName}</p>
                                <p className="text-xs text-on-surface-secondary dark:text-slate-400 mt-1">Due: {event.dueDate.toLocaleDateString()}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

export default ComplianceTimeline;