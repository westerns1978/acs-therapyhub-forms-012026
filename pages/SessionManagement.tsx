import React, { useState, useMemo, useEffect } from 'react';
import { getAppointments, getClients } from '../services/api';
import { Appointment, Client } from '../types';
import ScheduleSessionModal from '../components/sessions/ScheduleSessionModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Video, MapPin, Clock } from 'lucide-react';

const SessionManagement: React.FC = () => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isScheduleModalOpen, setScheduleModalOpen] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const [apts, cls] = await Promise.all([getAppointments(currentDate), getClients()]);
            setAppointments(apts);
            setClients(cls);
            setIsLoading(false);
        };
        fetchData();
    }, [currentDate]);

    const startOfWeek = useMemo(() => {
        const d = new Date(currentDate);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }, [currentDate]);

    const weekDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            days.push(d);
        }
        return days;
    }, [startOfWeek]);

    const hours = Array.from({ length: 13 }, (_, i) => i + 8);

    const getEventStyle = (apt: Appointment) => {
        const timeParts = apt.startTime.match(/(\d+):(\d+) (AM|PM)/);
        let hour = 9; 
        let minute = 0;
        
        if (timeParts) {
            hour = parseInt(timeParts[1]);
            if (timeParts[3] === 'PM' && hour !== 12) hour += 12;
            if (timeParts[3] === 'AM' && hour === 12) hour = 0;
            minute = parseInt(timeParts[2]);
        }

        const startOffset = (hour - 8) * 60 + minute;
        const duration = 50; 
        
        return {
            top: `${(startOffset / (13 * 60)) * 100}%`,
            height: `${(duration / (13 * 60)) * 100}%`,
        };
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() && 
               date.getMonth() === today.getMonth() && 
               date.getFullYear() === today.getFullYear();
    };

    if (isLoading) return <LoadingSpinner />;

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Header Controls */}
            <div className="flex justify-between items-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-4 rounded-2xl shadow-sm border border-white/40 dark:border-slate-700">
                <div className="flex items-center gap-6">
                    <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-sm font-bold border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Today</button>
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-full">
                        <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }} className="p-1.5 rounded-full hover:bg-white dark:hover:bg-slate-600 shadow-sm transition-all"><ChevronLeft size={18}/></button>
                        <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }} className="p-1.5 rounded-full hover:bg-white dark:hover:bg-slate-600 shadow-sm transition-all"><ChevronRight size={18}/></button>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                        {startOfWeek.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                    </h2>
                </div>
                <button onClick={() => setScheduleModalOpen(true)} className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-focus hover:shadow-primary/40 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                    <CalIcon size={18} /> Schedule Session
                </button>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 dark:border-slate-700 overflow-hidden flex flex-col min-h-[600px]">
                {/* Header Row */}
                <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-700/60">
                    <div className="p-4 border-r border-slate-100 dark:border-slate-700/30 text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center pt-8">GMT-05</div>
                    {weekDays.map(day => (
                        <div key={day.toISOString()} className={`p-4 text-center border-r border-slate-100 dark:border-slate-700/30 last:border-0 ${isToday(day) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                            <p className={`text-[10px] font-bold uppercase mb-2 tracking-wider ${isToday(day) ? 'text-primary' : 'text-slate-400'}`}>{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto text-xl transition-all ${isToday(day) ? 'bg-primary text-white font-bold shadow-lg shadow-primary/30 scale-110' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                                {day.getDate()}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Time Grid */}
                <div className="flex-1 overflow-y-auto relative custom-scrollbar">
                    <div className="grid grid-cols-8 h-[1200px]">
                        {/* Time Column */}
                        <div className="border-r border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/20">
                            {hours.map(hour => (
                                <div key={hour} className="h-[92px] border-b border-slate-100 dark:border-slate-700/30 text-right pr-3 pt-2 relative">
                                    <span className="text-xs font-medium text-slate-400 relative -top-3">{hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}</span>
                                </div>
                            ))}
                        </div>

                        {/* Day Columns */}
                        {weekDays.map(day => {
                            const dayEvents = appointments.filter(a => new Date(a.date).toDateString() === day.toDateString());
                            return (
                                <div key={day.toISOString()} className="relative border-r border-slate-100 dark:border-slate-700/30 last:border-0 group">
                                    {/* Hour Grid Lines */}
                                    {hours.map(h => <div key={h} className="h-[92px] border-b border-slate-50 dark:border-slate-800/30 group-hover:border-slate-100 dark:group-hover:border-slate-700/50 transition-colors"></div>)}
                                    
                                    {/* Events */}
                                    {dayEvents.map(apt => (
                                        <div 
                                            key={apt.id}
                                            className="absolute left-1 right-1 rounded-xl p-2.5 border cursor-pointer hover:scale-[1.03] hover:z-10 transition-all duration-200 shadow-sm hover:shadow-md overflow-hidden bg-blue-50/90 dark:bg-blue-900/40 border-blue-200/50 dark:border-blue-700/50 text-blue-900 dark:text-blue-100 backdrop-blur-sm"
                                            style={getEventStyle(apt)}
                                            title={apt.title}
                                        >
                                            <div className="flex items-start gap-1">
                                                <div className="w-1 h-full absolute left-0 top-0 bottom-0 bg-blue-500"></div>
                                                <div className="pl-2 overflow-hidden">
                                                    <p className="font-bold text-xs truncate leading-tight">{apt.clientName || apt.title}</p>
                                                    <div className="flex items-center gap-1 mt-0.5 text-[10px] opacity-80">
                                                        <Clock size={10} /> {apt.startTime} - {apt.endTime}
                                                    </div>
                                                    {apt.modality.includes('Zoom') && (
                                                        <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                                                            <Video size={10}/> Virtual
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {/* Current Time Indicator */}
                                    {isToday(day) && (
                                        <div 
                                            className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                                            style={{ top: `${((new Date().getHours() - 8) * 60 + new Date().getMinutes()) / (13 * 60) * 100}%` }}
                                        >
                                            <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-1.5 shadow-sm ring-2 ring-white dark:ring-slate-800"></div>
                                            <div className="h-[2px] w-full bg-red-500 shadow-sm"></div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {isScheduleModalOpen && (
                <ScheduleSessionModal
                    isOpen={isScheduleModalOpen}
                    onClose={() => setScheduleModalOpen(false)}
                    onSave={(newApt) => setAppointments(prev => [...prev, newApt])}
                    clients={clients}
                />
            )}
        </div>
    );
};

export default SessionManagement;