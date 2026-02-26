import React, { useState, useEffect } from 'react';
import PortalLayout from '../../layouts/PortalLayout';
import Header from '../../components/ui/Header';
import Card from '../../components/ui/Card';
import { supabase } from '../../services/supabase';
import { usePortalClient } from '../../hooks/usePortalClient';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Calendar, Clock, MapPin, Video, ChevronRight, Plus } from 'lucide-react';

const PortalAppointments: React.FC = () => {
    const portalClient = usePortalClient();
    const [appointments, setAppointments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!portalClient) return;
        const fetchAppointments = async () => {
            setIsLoading(true);
            try {
                const { data } = await supabase
                    .from('appointments')
                    .select('*')
                    .eq('client_id', portalClient.id)
                    .order('start_time', { ascending: true });
                setAppointments(data || []);
            } catch (err) {
                console.warn('Failed to fetch appointments:', err);
            }
            setIsLoading(false);
        };
        fetchAppointments();
    }, [portalClient]);

    if (isLoading || !portalClient) return <PortalLayout><div className="flex justify-center items-center h-64"><LoadingSpinner /></div></PortalLayout>;

    const upcoming = appointments.filter(a => new Date(a.start_time) >= new Date());
    const past = appointments.filter(a => new Date(a.start_time) < new Date());

    return (
        <PortalLayout>
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
                <div className="flex justify-between items-center">
                    <Header title="Appointments" subtitle="Manage your upcoming sessions and view history." />
                    <button className="bg-primary text-white px-5 py-2.5 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all flex items-center gap-2">
                        <Plus size={18} /> Request New Session
                    </button>
                </div>

                <div className="space-y-6">
                    <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                        <Clock className="text-primary" /> Upcoming Sessions
                    </h3>
                    <div className="grid gap-4">
                        {upcoming.map(appt => (
                            <Card key={appt.id} className="hover:shadow-xl transition-all group">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-primary/10 rounded-2xl">
                                            <Calendar className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black">{appt.appointment_type}</h4>
                                            <p className="text-sm text-slate-500 font-medium">
                                                {new Date(appt.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                            </p>
                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                                                {new Date(appt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(appt.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 w-full sm:w-auto">
                                        {appt.location === 'Telehealth' ? (
                                            <button className="flex-1 sm:flex-none px-6 py-2.5 bg-accent text-white rounded-xl font-black text-xs shadow-lg shadow-accent/20 hover:scale-105 transition-all flex items-center justify-center gap-2">
                                                <Video size={16} /> JOIN VIRTUAL ROOM
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-2 text-slate-500 text-sm font-bold">
                                                <MapPin size={16} /> {appt.location || 'In-Person'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                        {upcoming.length === 0 && (
                            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                                <p className="text-slate-500 font-medium">No upcoming sessions scheduled.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <h3 className="text-xl font-black tracking-tight text-slate-400">Past Sessions</h3>
                    <div className="grid gap-3">
                        {past.map(appt => (
                            <div key={appt.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                        <Calendar className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold">{appt.appointment_type}</p>
                                        <p className="text-[10px] font-black text-slate-400 uppercase">{new Date(appt.start_time).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                                    Completed
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </PortalLayout>
    );
};

export default PortalAppointments;
