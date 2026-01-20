import React, { useState } from 'react';
import { Client, User, VideoSession } from '../../types';
import { addVideoSession } from '../../services/api';
import { X } from 'lucide-react';

interface ScheduleVideoSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newSession: VideoSession) => void;
    clients: Client[];
    therapist: User;
}

const ScheduleVideoSessionModal: React.FC<ScheduleVideoSessionModalProps> = ({ isOpen, onClose, onSave, clients, therapist }) => {
    const [clientId, setClientId] = useState<string>(clients[0]?.id || '');
    const [startTime, setStartTime] = useState<string>(new Date().toISOString().slice(0, 16));
    const [durationMinutes, setDurationMinutes] = useState<number>(50);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientId || !startTime) return;

        setIsSubmitting(true);
        const client = clients.find(c => c.id === clientId);
        if (!client) {
            setIsSubmitting(false);
            return;
        }

        const newSessionData = {
            clientId: client.id,
            clientName: client.name,
            therapistId: therapist.id,
            therapistName: therapist.name,
            startTime: new Date(startTime),
            durationMinutes,
            status: 'scheduled' as const,
        };
        
        try {
            const savedSession = await addVideoSession(newSessionData);
            onSave({...savedSession, startTime: new Date(savedSession.startTime), createdAt: new Date(savedSession.createdAt)});
            onClose();
        } catch (error) {
            console.error("Failed to save session", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-background dark:bg-dark-surface rounded-lg shadow-xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <header className="flex justify-between items-center p-4 border-b">
                        <h3 className="text-lg font-semibold">Schedule Video Session</h3>
                        <button type="button" onClick={onClose}><X size={24} /></button>
                    </header>
                    <main className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Client</label>
                            <select value={clientId} onChange={e => setClientId(e.target.value)} required className="w-full p-2 border rounded-md">
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Start Time</label>
                            <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} required className="w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
                            <input type="number" value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))} required className="w-full p-2 border rounded-md" />
                        </div>
                    </main>
                    <footer className="p-4 border-t flex justify-end">
                        <button type="submit" disabled={isSubmitting} className="bg-primary text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">
                            {isSubmitting ? 'Scheduling...' : 'Schedule Session'}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default ScheduleVideoSessionModal;
