

import React, { useState, useEffect } from 'react';
import PortalLayout from '../../layouts/PortalLayout';
import Header from '../../components/ui/Header';
import Card from '../../components/ui/Card';
// Fix: Correctly import getClientAppointments
import { getClient, getClientAppointments } from '../../services/api';
import { Client, Appointment } from '../../types';

const VideoIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>;

const PortalAppointments: React.FC = () => {
    const [client, setClient] = useState<Client | null>(null);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const clientId = '1'; // Hardcoded for demo
            const [clientData, aptsData] = await Promise.all([
                getClient(clientId),
                getClientAppointments(clientId)
            ]);
            setClient(clientData);
            setAppointments(aptsData.map(a => ({ ...a, date: new Date(a.date) })));
            setIsLoading(false);
        };
        fetchData();
    }, []);

    if (isLoading || !client) {
        return <PortalLayout><div className="text-center">Loading your appointments...</div></PortalLayout>;
    }
    
    const sortedAppointments = appointments.sort((a,b) => a.date.getTime() - b.date.getTime());

    return (
        <PortalLayout>
            <div className="max-w-4xl mx-auto">
                <Header title="My Appointments" subtitle="Here is your schedule of upcoming sessions." />
                
                <Card>
                    {sortedAppointments.length > 0 ? (
                        <ul className="space-y-4">
                            {sortedAppointments.map(apt => (
                                <li key={apt.id} className="p-4 bg-surface dark:bg-slate-800/50 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="text-center bg-gray-100 dark:bg-slate-700 p-2 rounded-md w-16 flex-shrink-0">
                                            <p className="text-xs font-bold text-primary uppercase">{apt.date.toLocaleString('default', { month: 'short' })}</p>
                                            <p className="text-2xl font-bold">{apt.date.getDate()}</p>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-xl">{apt.title}</h3>
                                            <p className="text-sm text-on-surface-secondary">{apt.startTime} - {apt.endTime}</p>
                                            <p className="text-xs text-on-surface-secondary">Facilitator: {apt.therapist}</p>
                                        </div>
                                    </div>
                                    <a 
                                        href={apt.zoomLink} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition font-semibold"
                                    >
                                        <VideoIcon className="w-5 h-5"/>
                                        Join Session
                                    </a>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-on-surface-secondary py-8">You have no upcoming appointments scheduled.</p>
                    )}
                </Card>
            </div>
        </PortalLayout>
    );
};

export default PortalAppointments;