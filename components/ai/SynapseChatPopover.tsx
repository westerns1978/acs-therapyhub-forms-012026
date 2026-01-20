
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI, LiveServerMessage, Modality, Blob, Type, Tool } from '@google/genai';
import { ChatMessage } from '../../types';
import { callMcpOrchestrator, callWestFlowOrchestrator } from '../../services/api';
import { Send, Mic, MicOff, Zap, Globe, Search, Brain, Shield, ShieldCheck, Info, ExternalLink, User, Lock, Camera, Eye } from 'lucide-react';
import VisualAuditPanel from './VisualAuditPanel';

// --- Audio Utility Functions ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

interface SynapseChatPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'staff' | 'client';
}

const SynapseChatPopover: React.FC<SynapseChatPopoverProps> = ({ isOpen, onClose, mode = 'staff' }) => {
    const navigate = useNavigate();
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'model', parts: [{ text: mode === 'staff' 
            ? "I'm ACS TherapyHub Orchestrator. I'm connected to the WestFlow MCP and can assist with patient session summaries, compliance tracking, and billing status. How can I assist your practice management today?" 
            : "Hello, I'm GeMyndFlow Recovery Guide. I'm here to support your path and help you stay on track with your SATOP/SROP goals. How are you feeling today?" }] }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    // --- Vision/Audio Mode State ---
    const [isVoiceMode, setIsVoiceMode] = useState(false);
    const [isVisionMode, setIsVisionMode] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [auditStatus, setAuditStatus] = useState<'IDLE' | 'LINK_ACTIVE' | 'RECORDING' | 'ANALYZING'>('IDLE');
    
    const [toolUseState, setToolUseState] = useState<string | null>(null);
    const [groundingLinks, setGroundingLinks] = useState<any[]>([]);
    
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const frameIntervalRef = useRef<number | null>(null);
    const audioRefs = useRef<{
      inputCtx: AudioContext | null;
      outputCtx: AudioContext | null;
      stream: MediaStream | null;
      processor: ScriptProcessorNode | null;
      source: MediaStreamAudioSourceNode | null;
      nextStartTime: number;
      sources: Set<AudioBufferSourceNode>;
    }>({ inputCtx: null, outputCtx: null, stream: null, processor: null, source: null, nextStartTime: 0, sources: new Set() });

    useEffect(() => {
        setMessages([
            { role: 'model', parts: [{ text: mode === 'staff' 
                ? "I'm ACS TherapyHub Orchestrator. I'm connected to the WestFlow MCP and can assist with patient session summaries, compliance tracking, and billing status. How can I assist your practice management today?" 
                : "Hello, I'm GeMyndFlow Recovery Guide. I'm here to support your path and help you stay on track with your SATOP/SROP goals. How are you feeling today?" }] }
        ]);
    }, [mode]);

    // --- TOOL DEFINITIONS ---
    const getTools = (): Tool[] => {
        const baseTools: any[] = [
            { name: "navigate_to_page", description: "Navigate to a specific system page (e.g. /dashboard, /clients).", parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING } }, required: ["path"] } },
            { googleSearch: {} }
        ];

        if (mode === 'staff') {
            baseTools.push(
                { name: "patient_session_summary", description: "Get session status and compliance tracking for a client.", parameters: { type: Type.OBJECT, properties: { patient_id: { type: Type.STRING }, program: { type: Type.STRING, enum: ["SATOP", "SROP", "REACT"] } }, required: ["patient_id"] } },
                { name: "billing_status", description: "Check billing and insurance claims for the practice.", parameters: { type: Type.OBJECT, properties: { practice_id: { type: Type.STRING }, period: { type: Type.STRING } } } },
                { name: "compliance_check", description: "Verify program compliance requirements for a specific patient.", parameters: { type: Type.OBJECT, properties: { patient_id: { type: Type.STRING }, program: { type: Type.STRING } }, required: ["patient_id"] } }
            );
        }
        return baseTools;
    };

    const SYSTEM_INSTRUCTION = mode === 'staff' 
        ? `You are ACS TherapyHub Superintendent, the HIPAA-compliant AI orchestrator for SATOP programs. 
           Professional, clinical, and high-stakes. Address the user as Lead Technician.
           Enforce the Infrastructure of Trust. Firmly believe that best effort is a liability that leads to catastrophic failure.
           Reference the Zero-Footprint Paradox: driverless architecture means firmware/clinical data must be perfect from the source.
           NEVER display full names, SSNs, or DOBs. Always use Patient IDs when referencing PHI.
           You have tools to check patient summaries and billing via the MCP orchestrator.`
        : "You are the GeMyndFlow Recovery Guide. Provide supportive, empathetic guidance for clients in recovery.";

    const handleTextSend = async () => {
        if (!input.trim() || loading) return;
        const userMsgText = input;
        setMessages(prev => [...prev, { role: 'user', parts: [{ text: userMsgText }] }]);
        setInput(''); setLoading(true); setGroundingLinks([]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: userMsgText,
                config: { systemInstruction: SYSTEM_INSTRUCTION, tools: getTools() }
            });

            if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
                setGroundingLinks(response.candidates[0].groundingMetadata.groundingChunks);
            }

            const functionCalls = response.functionCalls || [];
            if (functionCalls.length > 0) {
                 for (const fc of functionCalls) {
                     setToolUseState(`Orchestrating ${fc.name}...`);
                     if (fc.name === 'navigate_to_page') navigate((fc.args as any).path);
                     else {
                        const mcpResult = await callMcpOrchestrator(fc.name, fc.args);
                        setMessages(prev => [...prev, { role: 'model', parts: [{ text: `[MCP TRANSMISSION]: ${JSON.stringify(mcpResult)}`}] }]);
                     }
                 }
                 setToolUseState(null);
            } else {
                setMessages(prev => [...prev, { role: 'model', parts: [{ text: response.text || "I've processed your request." }] }]);
            }
        } catch(error) {
            setMessages(prev => [...prev, { role: 'model', parts: [{ text: "Platform connection failure. Please verify uplink status."}] }]);
        } finally {
            setLoading(false);
        }
    };

    const handleCaptureStill = (base64: string) => {
        setAuditStatus('ANALYZING');
        sessionPromiseRef.current?.then((session) => {
            session.sendRealtimeInput({
                media: { data: base64, mimeType: 'image/jpeg' }
            });
            setTimeout(() => setAuditStatus('LINK_ACTIVE'), 1500);
        });
    };

    // --- Voice/Vision Mode (Live API) ---
    const handleStartLiveMode = useCallback(async (withVision: boolean = false) => {
        try {
            const constraints = { 
                audio: true, 
                video: withVision ? { width: 640, height: 480 } : false 
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            audioRefs.current.stream = stream;
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: SYSTEM_INSTRUCTION,
                    tools: getTools(),
                },
                callbacks: {
                    onopen: () => {
                        setIsListening(true);
                        setAuditStatus('LINK_ACTIVE');
                        audioRefs.current.inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                        audioRefs.current.outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                        audioRefs.current.source = audioRefs.current.inputCtx.createMediaStreamSource(stream);
                        audioRefs.current.processor = audioRefs.current.inputCtx.createScriptProcessor(4096, 1, 1);
                        
                        audioRefs.current.processor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            sessionPromiseRef.current?.then((session) => session.sendRealtimeInput({ media: createBlob(inputData) }));
                        };
                        audioRefs.current.source.connect(audioRefs.current.processor);
                        audioRefs.current.processor.connect(audioRefs.current.inputCtx.destination);

                        // If Vision is active, start frame pulse
                        if (withVision) {
                           const videoTrack = stream.getVideoTracks()[0];
                           if (videoTrack) {
                              const imageCapture = new (window as any).ImageCapture(videoTrack);
                              frameIntervalRef.current = window.setInterval(async () => {
                                 try {
                                    const blob = await imageCapture.takePhoto();
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                        const base64 = (reader.result as string).split(',')[1];
                                        sessionPromiseRef.current?.then(s => s.sendRealtimeInput({ media: { data: base64, mimeType: 'image/jpeg' } }));
                                    };
                                    reader.readAsDataURL(blob);
                                 } catch(e) {}
                              }, 2000); // 2 second interval for background vision
                           }
                        }
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        if (msg.toolCall) {
                            for (const fc of msg.toolCall.functionCalls) {
                                let result: any = { status: "OK" };
                                if (fc.name === 'navigate_to_page') navigate((fc.args as any).path);
                                else result = await callMcpOrchestrator(fc.name, fc.args);
                                sessionPromiseRef.current?.then((session) => session.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: result }] }));
                            }
                        }
                        if (msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
                            setIsSpeaking(true);
                            const base64Audio = msg.serverContent.modelTurn.parts[0].inlineData.data;
                            const outputCtx = audioRefs.current.outputCtx!;
                            if (outputCtx.state !== 'closed') {
                                audioRefs.current.nextStartTime = Math.max(audioRefs.current.nextStartTime, outputCtx.currentTime);
                                const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                                const source = outputCtx.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(outputCtx.destination);
                                source.addEventListener('ended', () => {
                                    audioRefs.current.sources.delete(source);
                                    if (audioRefs.current.sources.size === 0) setIsSpeaking(false);
                                });
                                source.start(audioRefs.current.nextStartTime);
                                audioRefs.current.nextStartTime += audioBuffer.duration;
                                audioRefs.current.sources.add(source);
                            }
                        }
                    },
                    onclose: () => {
                       setIsListening(false);
                       setAuditStatus('IDLE');
                    },
                    onerror: () => {
                       setIsListening(false);
                       setAuditStatus('IDLE');
                    },
                }
            });
        } catch (e) {
            setIsVoiceMode(false);
            setIsVisionMode(false);
        }
    }, [navigate, SYSTEM_INSTRUCTION]);

    const handleStopLiveMode = useCallback(() => {
        setIsListening(false); setIsSpeaking(false);
        setAuditStatus('IDLE');
        if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
        }
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(s => { try { s.close(); } catch(e) {} });
            sessionPromiseRef.current = null;
        }
        const { stream, inputCtx, outputCtx, processor, source, sources } = audioRefs.current;
        if (stream) stream.getTracks().forEach(t => t.stop());
        sources.forEach(s => { try { s.stop(); } catch (e) {} });
        sources.clear();
        if (processor) { processor.onaudioprocess = null; processor.disconnect(); }
        if (source) source.disconnect();
        if (inputCtx) inputCtx.close();
        if (outputCtx) outputCtx.close();
        Object.assign(audioRefs.current, { inputCtx: null, outputCtx: null, stream: null, processor: null, source: null, nextStartTime: 0, sources: new Set() });
    }, []);

    useEffect(() => {
        if (isVoiceMode || isVisionMode) handleStartLiveMode(isVisionMode);
        else handleStopLiveMode();
        return () => handleStopLiveMode();
    }, [isVoiceMode, isVisionMode, handleStartLiveMode, handleStopLiveMode]);

    if (!isOpen) return null;
    
    return (
        <div ref={popoverRef} className="fixed bottom-28 right-8 w-full max-w-sm h-[70vh] flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/20 dark:border-slate-800 rounded-[2.5rem] shadow-2xl z-50 animate-fade-in-up overflow-hidden ring-1 ring-black/5">
            <header className="flex items-center justify-between p-6 bg-gradient-to-br from-primary/10 to-transparent border-b border-border dark:border-slate-800">
                <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-2.5 rounded-2xl">
                        <ShieldCheck className="text-primary w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-black text-sm tracking-tighter">THERAPYHUB <span className="text-primary tracking-widest text-[9px]">SUPERINTENDENT</span></h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mt-0.5">
                            <span className={`w-1.5 h-1.5 ${isVisionMode ? 'bg-red-500' : 'bg-green-500'} rounded-full animate-pulse`}></span> 
                            {isVisionMode ? 'VISUAL AUDIT ACTIVE' : 'MCP ORCHESTRATOR 3.1'}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><Lock className="w-4 h-4 text-slate-400"/></button>
            </header>

            <div ref={chatContainerRef} className="flex-1 p-6 overflow-y-auto space-y-5 custom-scrollbar relative">
                <VisualAuditPanel 
                  isActive={isVisionMode} 
                  onClose={() => setIsVisionMode(false)}
                  onCaptureStill={handleCaptureStill}
                  stream={audioRefs.current.stream}
                  status={auditStatus}
                />

                {messages.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed shadow-sm transition-all ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-tl-none text-slate-800 dark:text-slate-200'}`}>
                            {msg.parts.map((part, i) => 'text' in part ? <div key={i} className="whitespace-pre-wrap">{part.text}</div> : null)}
                        </div>
                    </div>
                ))}
                
                {groundingLinks.length > 0 && (
                    <div className="space-y-2 animate-fade-in-up mt-4">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Clinical Grounding:</p>
                         <div className="grid gap-2">
                             {groundingLinks.map((chunk, i) => chunk.web && (
                                 <a key={i} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl hover:border-primary/30 transition-all shadow-sm group">
                                     <Globe size={14} className="text-primary group-hover:scale-110 transition-transform" />
                                     <span className="text-[11px] font-bold truncate flex-1 dark:text-slate-300">{chunk.web.title}</span>
                                     <ExternalLink size={12} className="text-slate-400" />
                                 </a>
                             ))}
                         </div>
                    </div>
                )}
                
                {toolUseState && (
                    <div className="flex items-center gap-3 p-4 bg-primary/5 text-primary rounded-2xl text-[10px] font-black uppercase tracking-widest border border-primary/10 animate-pulse">
                         <Zap size={14} className="fill-current"/> {toolUseState}
                    </div>
                )}
            </div>
            
            <div className="p-5 border-t border-border dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                {isVoiceMode || isVisionMode ? (
                    <div className="flex items-center justify-between gap-6 h-14 px-4 bg-white dark:bg-slate-800 rounded-3xl border border-border dark:border-slate-700 shadow-inner">
                        <button onClick={() => { setIsVoiceMode(false); setIsVisionMode(false); }} className="p-3 rounded-2xl bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"><MicOff className="w-5 h-5" /></button>
                        <div className="flex-1 flex justify-center gap-1.5">
                            {[1,2,3,4,5].map(i => <div key={i} className={`w-1 h-6 bg-primary rounded-full transition-all duration-300 ${isSpeaking ? 'animate-bounce' : 'opacity-20'}`} style={{ animationDelay: `${i*0.1}s` }}></div>)}
                        </div>
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20"><Mic className={`text-primary w-6 h-6 ${isSpeaking ? '' : 'animate-pulse'}`} /></div>
                    </div>
                ) : (
                    <div className="relative group">
                        <input type="text" placeholder="Orchestrate practice data..." value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleTextSend()} disabled={loading} className="w-full pr-24 pl-6 py-5 border-none bg-white dark:bg-slate-800 rounded-3xl shadow-xl focus:ring-2 focus:ring-primary/20 text-sm font-medium transition-all group-focus-within:shadow-2xl ring-1 ring-black/5" />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                            <button onClick={() => setIsVisionMode(true)} className="p-2.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-2xl transition-all" title="Toggle Visual Audit"><Camera size={20} /></button>
                            <button onClick={() => setIsVoiceMode(true)} className="p-2.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-2xl transition-all" title="Toggle Voice Mode"><Mic size={20} /></button>
                            <button onClick={handleTextSend} disabled={loading || !input.trim()} className="bg-primary text-white p-3 rounded-2xl hover:bg-primary-focus transition-all disabled:opacity-50 shadow-lg shadow-primary/20 active:scale-95"><Send size={18} /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SynapseChatPopover;
