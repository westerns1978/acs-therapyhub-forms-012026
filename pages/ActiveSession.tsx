
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getClient, generateSoapNoteFromTranscript } from '../services/api';
import Card from '../components/ui/Card';
import SessionWrapUpModal from '../components/sessions/SessionWrapUpModal';
import { Client } from '../types';
import { Mic, MicOff, Sparkles, StopCircle, Loader2, AlertTriangle, FileText } from 'lucide-react';

const ActiveSession: React.FC = () => {
    const { clientId } = useParams<{clientId: string}>();
    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState<string>('');
    const [note, setNote] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isWrapUpModalOpen, setWrapUpModalOpen] = useState(false);
    const [recognitionError, setRecognitionError] = useState<string | null>(null);
    
    const recognitionRef = useRef<any>(null);
    const transcriptEndRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        if(clientId) {
            const fetchClientData = async () => {
                setIsLoading(true);
                const data = await getClient(clientId);
                setClient(data || null);
                setIsLoading(false);
            }
            fetchClientData();
        }
    }, [clientId]);
    
    useEffect(() => {
        // Initialize Speech Recognition
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript + ' ';
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                
                setTranscript(prev => prev + finalTranscript);
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                if (event.error === 'not-allowed') {
                    setRecognitionError("Microphone access denied. Please check your browser settings.");
                } else {
                    setRecognitionError(`Speech recognition error: ${event.error}`);
                }
                setIsRecording(false);
            };
            
            recognitionRef.current.onend = () => {
                if (isRecording) {
                    // Attempt to restart if it stopped unexpectedly but we still want to record
                    try {
                        recognitionRef.current.start();
                    } catch (e) {
                        setIsRecording(false);
                    }
                }
            }
        } else {
            setRecognitionError("Browser does not support Speech Recognition.");
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [isRecording]); // Re-run if isRecording changes to ensure proper state management if we needed to restart

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript]);

    const toggleRecording = () => {
        if (isRecording) {
            recognitionRef.current?.stop();
            setIsRecording(false);
        } else {
            setRecognitionError(null);
            try {
                recognitionRef.current?.start();
                setIsRecording(true);
            } catch (e) {
                console.error("Failed to start recording", e);
            }
        }
    };

    const handleGenerateNote = async () => {
        if (!client) return;
        setIsGenerating(true);
        setNote(null);
        
        try {
            const generatedNote = await generateSoapNoteFromTranscript(transcript, client.name);
            setNote(generatedNote);
        } catch (error) {
            console.error("Error generating SOAP note:", error);
            setNote("Error: Could not generate SOAP note. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleSimulateConversation = () => {
        const mockText = "Client reports feeling anxious about upcoming court date. Discussed coping mechanisms including deep breathing and calling sponsor. Client identified 'stress at work' as a trigger. Plan is to attend 2 AA meetings this week.";
        setTranscript(prev => prev + (prev ? " " : "") + mockText);
    }
    
    if (isLoading) return <div>Loading session...</div>
    if (!client) return <div>Client not found.</div>;

    return (
        <div className="animate-fade-in-up">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-surface-content dark:text-dark-surface-content">Active Session: {client.name}</h1>
                    <p className="text-surface-secondary-content dark:text-dark-surface-secondary-content">Capture clinical notes in real-time.</p>
                </div>
                <div className="flex items-center gap-3">
                     <button onClick={handleSimulateConversation} className="text-xs text-gray-500 hover:underline">Simulate Conversation (Demo)</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Transcription */}
                <div className="flex flex-col h-[calc(100vh-12rem)]">
                    <Card className="flex-1 flex flex-col overflow-hidden border-2 border-transparent focus-within:border-primary transition-all">
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-border dark:border-dark-border">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Mic className={`w-5 h-5 ${isRecording ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} />
                                Live Transcript
                            </h3>
                            <button 
                                onClick={toggleRecording}
                                className={`px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition-all ${isRecording ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-primary text-white hover:bg-primary-focus'}`}
                            >
                                {isRecording ? <><MicOff size={16}/> Stop Recording</> : <><Mic size={16}/> Start Recording</>}
                            </button>
                        </div>
                        
                        {recognitionError && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                                <AlertTriangle size={16} /> {recognitionError}
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-border dark:border-dark-border font-mono text-sm leading-relaxed">
                            {transcript ? (
                                <p className="whitespace-pre-wrap">{transcript}</p>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <Mic size={48} className="mb-2 opacity-20" />
                                    <p>Ready to transcribe. Click 'Start Recording' to begin.</p>
                                </div>
                            )}
                            <div ref={transcriptEndRef} />
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-border dark:border-dark-border flex justify-end">
                             <button 
                                onClick={handleGenerateNote}
                                disabled={!transcript || isGenerating}
                                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGenerating ? <Loader2 className="animate-spin"/> : <Sparkles size={18} />}
                                {isGenerating ? 'Analyzing...' : 'Generate SOAP Note'}
                            </button>
                        </div>
                    </Card>
                </div>
                
                {/* Right Column: Generated Note */}
                <div className="flex flex-col h-[calc(100vh-12rem)]">
                    <Card className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-dark-surface shadow-lg">
                        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border dark:border-dark-border">
                            <FileText className="w-5 h-5 text-primary" />
                            <h3 className="text-lg font-bold">Clinical Documentation</h3>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-slate-900 rounded-lg border border-border dark:border-dark-border">
                            {note ? (
                                <textarea 
                                    className="w-full h-full resize-none bg-transparent border-none focus:ring-0 p-0 text-sm leading-relaxed"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center p-8">
                                    <Sparkles size={48} className="mb-4 opacity-20" />
                                    <p>AI-generated SOAP note will appear here.</p>
                                    <p className="text-xs mt-2 opacity-60">Review and edit before finalizing.</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-border dark:border-dark-border">
                            <button
                                onClick={() => setWrapUpModalOpen(true)}
                                disabled={!note}
                                className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <StopCircle className="h-5 w-5" />
                                End Session & Finalize
                            </button>
                        </div>
                    </Card>
                </div>
            </div>

            {isWrapUpModalOpen && (
                <SessionWrapUpModal 
                    isOpen={isWrapUpModalOpen}
                    onClose={() => setWrapUpModalOpen(false)}
                    client={client}
                    noteContent={note || ''}
                    sessionDuration={50}
                />
            )}

        </div>
    );
};

export default ActiveSession;
