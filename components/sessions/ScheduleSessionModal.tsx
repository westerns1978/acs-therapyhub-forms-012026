import React, { useState, useEffect } from 'react';
import { Client, Appointment, AppointmentType } from '../../types';
import { addAppointment, analyzeTravelRisk } from '../../services/api';
import { isZoomConnected } from '../../services/integrationService';
import { MapPin, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

interface ScheduleSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newAppointment: Appointment) => void;
    clients: Client[];
    preselectedClient?: Client;
}

const ScheduleSessionModal: React.FC<ScheduleSessionModalProps> = ({ isOpen, onClose, onSave, clients, preselectedClient }) => {
    const [sessionType, setSessionType] = useState<AppointmentType>('SATOP Group');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState('18:00');
    const [endTime, setEndTime] = useState('20:00');
    const [capacity, setCapacity] = useState(15);
    const [selectedClientId, setSelectedClientId] = useState<string | undefined>(clients[0]?.id);
    
    // Smart Scheduling State
    const [travelRisk, setTravelRisk] = useState<'Low' | 'Medium' | 'High' | null>(null);
    const [riskReason, setRiskReason] = useState<string>('');
    const [isAnalyzingRisk, setIsAnalyzingRisk] = useState(false);

    useEffect(() => {
        if (preselectedClient) {
            setSessionType('Individual Counseling');
            setSelectedClientId(preselectedClient.id);
        } else {
            setSessionType('SATOP Group');
            setSelectedClientId(clients[0]?.id);
        }
    }, [preselectedClient, clients]);
    
    // Trigger AI Risk Analysis when date/time/client changes
    useEffect(() => {
        const analyze = async () => {
            if (selectedClientId && date && startTime && !sessionType.includes('Group')) {
                setIsAnalyzingRisk(true);
                setTravelRisk(null);
                try {
                    const analysis = await analyzeTravelRisk(selectedClientId, date, startTime);
                    setTravelRisk(analysis.risk);
                    setRiskReason(analysis.reason);
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsAnalyzingRisk(false);
                }
            } else {
                setTravelRisk(null);
            }
        };
        const debounce = setTimeout(analyze, 800);
        return () => clearTimeout(debounce);
    }, [date, startTime, selectedClientId, sessionType]);

    const isGroup = sessionType.toLowerCase().includes('group');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const client = clients.find(p => p.id === selectedClientId);
        const zoomConnected = isZoomConnected();
        
        const newAppointmentData: Omit<Appointment, 'id'> = {
            title: isGroup ? sessionType : `Individual Counseling - ${client?.name}`,
            type: sessionType,
            date: new Date(date + 'T00:00:00'),
            startTime: new Date(`1970-01-01T${startTime}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            endTime: new Date(`1970-01-01T${endTime}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            modality: 'Virtual (Zoom)',
            therapist: 'Bill Sunderman, MEd, LPC',
            zoomLink: zoomConnected ? `https://zoom.us/j/${Math.floor(1000000000 + Math.random() * 9000000000)}` : undefined,
            status: 'Scheduled',
            ...(isGroup 
                ? { capacity, attendees: [] }
                : { clientId: selectedClientId, clientName: client?.name }
            )
        };
        
        const savedAppointment = await addAppointment(newAppointmentData);
        onSave({...savedAppointment, date: new Date(savedAppointment.date)});
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-lg">
                <form onSubmit={handleSubmit}>
                    <header className="flex justify-between items-center p-4 border-b border-black/10 dark:border-white/10">
                        <h2 className="text-lg font-semibold">{preselectedClient ? `Schedule Makeup for ${preselectedClient.name}` : 'Schedule New Session'}</h2>
                        <button type="button" onClick={onClose} className="text-2xl font-light" aria-label="Close modal">&times;</button>
                    </header>
                    
                    <main className="p-6 space-y-4">
                        <div>
                            <label htmlFor="sessionType" className="block text-sm font-medium mb-1">Session Type</label>
                            <select id="sessionType" value={sessionType} onChange={e => setSessionType(e.target.value as AppointmentType)} className="w-full p-2 border border-border dark:border-slate-600 bg-transparent rounded-md">
                                <option>SATOP Group</option>
                                <option>REACT Group</option>
                                <option>Anger Management Group</option>
                                <option>Gambling Group</option>
                                <option>Individual Counseling</option>
                                <option>DOT Assessment</option>
                                <option>Intake Assessment</option>
                            </select>
                        </div>
                        
                        {!isGroup && (
                             <div>
                                <label htmlFor="client" className="block text-sm font-medium mb-1">Client</label>
                                <select id="client" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="w-full p-2 border border-border dark:border-slate-600 bg-transparent rounded-md" disabled={!!preselectedClient}>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="date" className="block text-sm font-medium mb-1">Date</label>
                                <input type="date" id="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border border-border dark:border-slate-600 bg-transparent rounded-md" />
                            </div>
                            {isGroup && (
                                <div>
                                    <label htmlFor="capacity" className="block text-sm font-medium mb-1">Capacity</label>
                                    <input type="number" id="capacity" value={capacity} onChange={e => setCapacity(parseInt(e.target.value, 10))} className="w-full p-2 border border-border dark:border-slate-600 bg-transparent rounded-md" />
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="startTime" className="block text-sm font-medium mb-1">Start Time</label>
                                <input type="time" id="startTime" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 border border-border dark:border-slate-600 bg-transparent rounded-md" />
                            </div>
                             <div>
                                <label htmlFor="endTime" className="block text-sm font-medium mb-1">End Time</label>
                                <input type="time" id="endTime" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 border border-border dark:border-slate-600 bg-transparent rounded-md" />
                            </div>
                        </div>

                        {/* Smart Scheduling Indicator */}
                        {!isGroup && selectedClientId && (
                            <div className={`mt-2 p-3 rounded-lg border flex items-start gap-3 transition-colors ${
                                isAnalyzingRisk ? 'bg-gray-100 border-gray-200' :
                                travelRisk === 'High' ? 'bg-red-50 border-red-200' :
                                travelRisk === 'Medium' ? 'bg-yellow-50 border-yellow-200' :
                                'bg-green-50 border-green-200'
                            }`}>
                                <div className="mt-0.5">
                                    {isAnalyzingRisk ? <Loader2 size={16} className="animate-spin text-gray-500" /> :
                                     travelRisk === 'High' ? <AlertTriangle size={16} className="text-red-500" /> :
                                     travelRisk === 'Medium' ? <AlertTriangle size={16} className="text-yellow-600" /> :
                                     <CheckCircle size={16} className="text-green-600" />}
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider mb-0.5 text-gray-500">Commute & Care Intelligence</p>
                                    <p className={`text-sm font-semibold ${
                                        isAnalyzingRisk ? 'text-gray-600' :
                                        travelRisk === 'High' ? 'text-red-800' :
                                        travelRisk === 'Medium' ? 'text-yellow-800' :
                                        'text-green-800'
                                    }`}>
                                        {isAnalyzingRisk ? "Analyzing travel conditions..." : riskReason || "Schedule looks good."}
                                    </p>
                                </div>
                            </div>
                        )}

                         <div>
                            <label className="block text-sm font-medium mb-1">Therapist</label>
                            <input type="text" readOnly value="Bill Sunderman, MEd, LPC" className="w-full p-2 border border-border dark:border-slate-600 bg-gray-100 dark:bg-slate-800 rounded-md" />
                        </div>
                    </main>

                    <footer className="p-4 border-t border-black/10 dark:border-white/10 flex justify-end">
                        <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-primary-focus transition">
                            Create Session
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default ScheduleSessionModal;