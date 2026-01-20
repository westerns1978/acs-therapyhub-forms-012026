
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getVideoSessionById, getClient } from '../services/api';
import { VideoSession, Client } from '../types';
import Card from '../components/ui/Card';
import { Mic, Video, VideoOff, MicOff, Settings, CheckCircle, ArrowRight, FileText, AlertTriangle } from 'lucide-react';

const VideoGreenRoom: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();
    const [session, setSession] = useState<VideoSession | undefined>(undefined);
    const [client, setClient] = useState<Client | undefined>(undefined);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        const loadData = async () => {
            if (!sessionId) return;
            const sessionData = await getVideoSessionById(sessionId);
            if (sessionData) {
                setSession(sessionData);
                const clientData = await getClient(sessionData.clientId);
                setClient(clientData);
            }
        };
        loadData();
    }, [sessionId]);

    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Camera access denied:", err);
                setIsVideoOn(false);
            }
        };
        startCamera();
        return () => {
            streamRef.current?.getTracks().forEach(track => track.stop());
        };
    }, []);

    const toggleVideo = () => {
        if (streamRef.current) {
            streamRef.current.getVideoTracks().forEach(track => track.enabled = !isVideoOn);
            setIsVideoOn(!isVideoOn);
        }
    };

    const toggleMic = () => {
        if (streamRef.current) {
            streamRef.current.getAudioTracks().forEach(track => track.enabled = !isMicOn);
            setIsMicOn(!isMicOn);
        }
    };

    const handleJoin = () => {
        if (session) {
            window.open(session.zoomJoinUrl, '_blank');
            // Navigate back or to active session view
            navigate('/video-sessions'); 
        }
    };

    if (!session || !client) return <div className="p-8 text-center">Loading Green Room...</div>;

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 h-screen flex flex-col">
            <h1 className="text-2xl font-bold mb-2 text-center">Therapist Green Room</h1>
            <p className="text-center text-gray-500 mb-8">Pre-session check for {client.name}</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
                {/* Left: Tech Check */}
                <div className="flex flex-col gap-4">
                    <Card className="flex-1 flex flex-col p-0 overflow-hidden bg-black relative">
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            muted 
                            playsInline 
                            className={`w-full h-full object-cover transform scale-x-[-1] ${!isVideoOn ? 'hidden' : ''}`} 
                        />
                        {!isVideoOn && (
                            <div className="flex-1 flex items-center justify-center text-gray-500">
                                <VideoOff size={48} />
                            </div>
                        )}
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                            <button onClick={toggleMic} className={`p-4 rounded-full ${isMicOn ? 'bg-gray-800/50 hover:bg-gray-700/50 text-white' : 'bg-red-500 text-white'}`}>
                                {isMicOn ? <Mic /> : <MicOff />}
                            </button>
                            <button onClick={toggleVideo} className={`p-4 rounded-full ${isVideoOn ? 'bg-gray-800/50 hover:bg-gray-700/50 text-white' : 'bg-red-500 text-white'}`}>
                                {isVideoOn ? <Video /> : <VideoOff />}
                            </button>
                            <button className="p-4 rounded-full bg-gray-800/50 hover:bg-gray-700/50 text-white">
                                <Settings />
                            </button>
                        </div>
                    </Card>
                    <div className="bg-green-50 text-green-800 p-3 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold">
                        <CheckCircle size={16} /> System Ready
                    </div>
                </div>

                {/* Right: Client Dossier */}
                <div className="flex flex-col gap-4">
                    <Card title="Session Prep" className="flex-1">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold">Outstanding Balance</p>
                                    <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">$150.00</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 uppercase font-bold">Last Session</p>
                                    <p className="font-medium">July 28, 2024</p>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-bold mb-2 flex items-center gap-2"><FileText size={16} className="text-primary"/> Last Note Summary</h4>
                                <div className="p-3 border rounded-lg bg-white dark:bg-slate-900 text-sm text-gray-600 dark:text-gray-300">
                                    "Client expressed anxiety about court date. Goal for next week is to attend 2 meetings. Mood was stable."
                                </div>
                            </div>

                            <div>
                                <h4 className="font-bold mb-2 flex items-center gap-2 text-amber-600"><AlertTriangle size={16}/> Clinical Alerts</h4>
                                <ul className="space-y-2">
                                    <li className="flex items-center gap-2 text-sm bg-amber-50 text-amber-800 p-2 rounded">
                                        <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                        Interlock violation reported on 8/01.
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </Card>
                    
                    <button 
                        onClick={handleJoin}
                        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white text-xl font-bold rounded-xl shadow-lg flex items-center justify-center gap-3 transition-transform hover:scale-[1.02]"
                    >
                        <Video size={24} /> Join Zoom Session
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VideoGreenRoom;
