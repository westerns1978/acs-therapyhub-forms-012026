
import React, { useState, useEffect, useMemo } from 'react';
import { getVideoSessions, getClients, updateVideoSessionStatus, addVideoSession } from '../services/api';
import { VideoSession, Client, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Header from '../components/ui/Header';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ScheduleVideoSessionModal from '../components/sessions/ScheduleVideoSessionModal';
import SessionWrapUpModal from '../components/sessions/SessionWrapUpModal';
import { Video, CheckCircle, Clock, XCircle, CalendarPlus, Zap, ZapOff, PlayCircle, StopCircle, ArrowRight } from 'lucide-react';

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ElementType }> = ({ title, value, icon: Icon }) => (
    <div className="bg-surface dark:bg-dark-surface-secondary p-4 rounded-lg flex items-center">
        <div className="p-3 bg-primary/10 rounded-lg mr-4">
            <Icon className="w-6 h-6 text-primary" />
        </div>
        <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-surface-secondary-content">{title}</p>
        </div>
    </div>
);

const getStatusPill = (status: VideoSession['status']) => {
    switch(status) {
        case 'scheduled': return 'bg-blue-100 text-blue-800';
        case 'in_progress': return 'bg-green-100 text-green-800';
        case 'completed': return 'bg-green-100 text-green-800';
        case 'missed': return 'bg-yellow-100 text-yellow-800';
        case 'canceled': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const StatusIndicator: React.FC<{ status: VideoSession['status'] }> = ({ status }) => {
    if (status === 'in_progress') {
        return (
            <span className={`flex items-center gap-1.5 px-2 py-1 text-xs leading-5 font-semibold rounded-full ${getStatusPill(status)}`}>
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                In Progress
            </span>
        );
    }
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusPill(status)}`}>{status}</span>;
};


const VideoSessions: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<VideoSession[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isZoomConnected, setIsZoomConnected] = useState(false);
    const [isScheduleModalOpen, setScheduleModalOpen] = useState(false);
    
    const [isWrapUpModalOpen, setWrapUpModalOpen] = useState(false);
    const [sessionToWrapUp, setSessionToWrapUp] = useState<VideoSession | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        const [sessionsData, clientsData] = await Promise.all([getVideoSessions(), getClients()]);
        setSessions(sessionsData);
        setClients(clientsData.filter(c => c.status !== 'Archived' && c.status !== 'Completed'));
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const stats = useMemo(() => {
        const upcoming = sessions.filter(s => new Date(s.startTime) > new Date() && s.status === 'scheduled').length;
        const completed = sessions.filter(s => s.status === 'completed').length;
        const missed = sessions.filter(s => s.status === 'missed').length;
        return { upcoming, completed, missed };
    }, [sessions]);

    const handleStartSession = async (sessionId: string) => {
        await updateVideoSessionStatus(sessionId, 'in_progress');
        // Route to Green Room
        navigate(`/video-sessions/${sessionId}/green-room`);
    };

    const handleEndSession = async (session: VideoSession) => {
        await updateVideoSessionStatus(session.id, 'completed');
        setSessionToWrapUp(session);
        setWrapUpModalOpen(true);
        fetchData();
    };

    const handleCancelSession = async (sessionId: string) => {
        if (window.confirm("Are you sure you want to cancel this session?")) {
            await updateVideoSessionStatus(sessionId, 'canceled');
            fetchData();
        }
    };
    
    const handleSaveSession = async (newSession: VideoSession) => {
        setSessions(prev => [...prev, newSession].sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
    };

    const sortedSessions = useMemo(() => {
        return [...sessions].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    }, [sessions]);
    
    const isJoinable = (session: VideoSession) => {
        const now = new Date();
        const sessionStart = new Date(session.startTime);
        const sessionEnd = new Date(sessionStart.getTime() + session.durationMinutes * 60 * 1000);
        const fifteenMinutesBefore = new Date(sessionStart.getTime() - 15 * 60 * 1000);
        
        return now >= fifteenMinutesBefore && now <= sessionEnd;
    };

    if (isLoading) return <LoadingSpinner />;

    const clientForWrapUp = clients.find(c => c.id === sessionToWrapUp?.clientId);
    const soapNoteTemplate = `SESSION DATE: ${sessionToWrapUp ? new Date(sessionToWrapUp.startTime).toLocaleDateString() : ''}
CLIENT: ${sessionToWrapUp?.clientName || ''}

SUBJECTIVE:
- Client's reported mood and events since last session:
- Progress on goals/assignments:

OBJECTIVE:
- Client's appearance and affect:
- Key points discussed during the session:
- Therapist's observations:

ASSESSMENT:
- Clinical impression of client's progress:
- Risk assessment (if any):

PLAN:
- Interventions for next session:
- Assignments/tasks for the client:
- Follow-up appointment scheduled for:
`;

    return (
        <div>
            <Header title="Video Sessions" subtitle="Schedule, manage, and join telehealth sessions.">
                {isZoomConnected ? (
                    <>
                        <button onClick={() => setScheduleModalOpen(true)} className="flex items-center gap-2 bg-primary text-white font-bold py-2 px-4 rounded-lg">
                            <CalendarPlus size={18} /> Schedule Session
                        </button>
                         <button onClick={() => setIsZoomConnected(false)} className="flex items-center gap-2 bg-red-100 text-red-700 font-bold py-2 px-4 rounded-lg">
                            <ZapOff size={18} /> Disconnect Zoom
                        </button>
                    </>
                ) : (
                    <button onClick={() => setIsZoomConnected(true)} className="flex items-center gap-2 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg">
                        <Zap size={18} /> Connect Zoom Account
                    </button>
                )}
            </Header>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <StatCard title="Upcoming Sessions" value={stats.upcoming} icon={Clock} />
                <StatCard title="Completed This Month" value={stats.completed} icon={CheckCircle} />
                <StatCard title="Missed/Canceled" value={stats.missed} icon={XCircle} />
            </div>

            <Card noPadding>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-surface">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Date & Time</th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Client</th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Therapist</th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Duration</th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-background divide-y divide-border">
                            {sortedSessions.map(session => {
                                let actions;
                                switch (session.status) {
                                    case 'scheduled':
                                        actions = (
                                            <>
                                                <button onClick={() => handleStartSession(session.id)} className="flex items-center gap-1 text-sm bg-green-600 text-white px-3 py-1.5 rounded-md font-semibold hover:bg-green-700 shadow-sm">
                                                    <Video size={14} /> Start / Join
                                                </button>
                                                <button onClick={() => handleCancelSession(session.id)} className="text-sm font-semibold text-red-600 hover:text-red-700 ml-2">Cancel</button>
                                            </>
                                        );
                                        break;
                                    case 'in_progress':
                                        actions = (
                                            <>
                                                <button onClick={() => handleStartSession(session.id)} className="flex items-center gap-1 text-sm bg-green-100 text-green-800 px-3 py-1.5 rounded-md font-semibold hover:bg-green-200">
                                                    <Video size={14} /> Re-Join
                                                </button>
                                                <button onClick={() => handleEndSession(session)} className="flex items-center gap-1 text-sm bg-red-100 text-red-700 px-3 py-1.5 rounded-md font-semibold hover:bg-red-200 ml-2">
                                                    <StopCircle size={14} /> End
                                                </button>
                                            </>
                                        );
                                        break;
                                    default:
                                        actions = <span className="text-sm text-gray-500">No actions available</span>;
                                }
                                return (
                                    <tr key={session.id} className={`hover:bg-surface-secondary/50 ${session.status === 'in_progress' ? 'bg-green-50 dark:bg-green-900/10' : ''}`}>
                                        <td className="px-6 py-4 font-medium">{new Date(session.startTime).toLocaleString()}</td>
                                        <td className="px-6 py-4">{session.clientName}</td>
                                        <td className="px-6 py-4">{session.therapistName}</td>
                                        <td className="px-6 py-4">{session.durationMinutes} min</td>
                                        <td className="px-6 py-4"><StatusIndicator status={session.status} /></td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end">
                                                {actions}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {isScheduleModalOpen && (
                <ScheduleVideoSessionModal
                    isOpen={isScheduleModalOpen}
                    onClose={() => setScheduleModalOpen(false)}
                    onSave={handleSaveSession}
                    clients={clients}
                    therapist={user!}
                />
            )}
            
            {isWrapUpModalOpen && sessionToWrapUp && clientForWrapUp && (
                <SessionWrapUpModal
                    isOpen={isWrapUpModalOpen}
                    onClose={() => {
                        setWrapUpModalOpen(false);
                        setSessionToWrapUp(null);
                        fetchData();
                    }}
                    client={clientForWrapUp}
                    noteContent={soapNoteTemplate}
                    sessionDuration={sessionToWrapUp.durationMinutes}
                />
            )}
        </div>
    );
};

export default VideoSessions;
