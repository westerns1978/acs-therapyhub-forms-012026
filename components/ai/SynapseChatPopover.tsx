import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatMessage } from '../../types';
import { callMcpOrchestrator } from '../../services/api';
import { Send, Mic, MicOff, Zap, Globe, ShieldCheck, Lock, Camera, ExternalLink, Heart } from 'lucide-react';
import VisualAuditPanel from './VisualAuditPanel';

const GEMINI_API_KEY = 'PASTE_YOUR_API_KEY_HERE';
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-dialog-preview-12-2025';
const TEXT_MODEL = 'gemini-2.5-flash';

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

function createBlob(data: Float32Array): { data: string; mimeType: string } {
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
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // --- Vision/Audio Mode State ---
    const [isVoiceMode, setIsVoiceMode] = useState(false);
    const [isVisionMode, setIsVisionMode] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [auditStatus, setAuditStatus] = useState<'IDLE' | 'LINK_ACTIVE' | 'RECORDING' | 'ANALYZING'>('IDLE');
    
    const [toolUseState, setToolUseState] = useState<string | null>(null);
    const [groundingLinks, setGroundingLinks] = useState<any[]>([]);
    
    const sessionRef = useRef<any>(null);
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
                ? "ACS TherapyHub Orchestrator Online. Connected to PDS-LEXINGTON. I'm utilizing Gemini 2.5 Native Audio for real-time clinical auditing. How can I assist with your caseload today?" 
                : "Hi there! I'm Clara, your personal recovery assistant. I'm here to help you with questions about your program, appointments, forms, or anything else you need. How can I help you today?" }] }
        ]);
    }, [mode]);

    const getTools = () => {
        const baseTools: any[] = [
            { function_declarations: [{ name: "navigate_to_page", description: "Navigate to a specific system page (e.g. /dashboard, /clients).", parameters: { type: "OBJECT", properties: { path: { type: "STRING" } }, required: ["path"] } }] },
            { google_search: {} }
        ];
        if (mode === 'staff') {
            baseTools[0].function_declarations.push(
                { name: "patient_session_summary", description: "Get session status and compliance tracking for a client.", parameters: { type: "OBJECT", properties: { patient_id: { type: "STRING" } }, required: ["patient_id"] } },
                { name: "billing_status", description: "Check billing and insurance claims for the practice.", parameters: { type: "OBJECT", properties: { practice_id: { type: "STRING" } } } }
            );
        }
        return baseTools;
    };

    const SYSTEM_INSTRUCTION = mode === 'staff' 
        ? `You are ACS TherapyHub Superintendent. You are a highly advanced, real-time clinical AI. 
           Be concise, professional, and objective. Address user as Lead Technician.
           Firmly adhere to the Infrastructure of Trust. You can navigate the UI and check MCP records.`
        : `You are Clara, a warm and supportive recovery assistant for clients at Assessment & Counseling Solutions (ACS) in St. Louis, Missouri.
           You help clients with questions about their SATOP program, REACT program, DWI Court requirements, appointment scheduling, form completion, payment information, and general recovery support.
           Be empathetic, encouraging, and use simple language. Never use clinical jargon or technical terms.
           If someone seems distressed, gently encourage them to reach out to their counselor or call the office at 314-849-2800.
           You can help navigate them to different pages in the portal like their forms, appointments, billing, or progress tracking.
           Always be positive and remind them that completing their program is achievable.`;

    const handleTextSend = async () => {
        if (!input.trim() || loading) return;
        const userMsgText = input;
        setMessages(prev => [...prev, { role: 'user', parts: [{ text: userMsgText }] }]);
        setInput(''); setLoading(true); setGroundingLinks([]);

        try {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
                        contents: [{ role: 'user', parts: [{ text: userMsgText }] }],
                        tools: getTools(),
                    }),
                }
            );
            const json = await res.json();
            const candidate = json.candidates?.[0];

            if (candidate?.groundingMetadata?.groundingChunks) {
                setGroundingLinks(candidate.groundingMetadata.groundingChunks);
            }

            const parts = candidate?.content?.parts || [];
            const functionCalls = parts.filter((p: any) => p.functionCall);
            if (functionCalls.length > 0) {
                 for (const part of functionCalls) {
                     const fc = part.functionCall;
                     setToolUseState(mode === 'staff' ? `Orchestrating ${fc.name}...` : `Looking that up for you...`);
                     if (fc.name === 'navigate_to_page') navigate(fc.args?.path);
                     else {
                        const mcpResult = await callMcpOrchestrator(fc.name, fc.args);
                        setMessages(prev => [...prev, { role: 'model', parts: [{ text: mode === 'staff' ? `[MCP TRANSMISSION]: ${JSON.stringify(mcpResult)}` : `Here's what I found: ${JSON.stringify(mcpResult)}`}] }]);
                     }
                 }
                 setToolUseState(null);
            } else {
                const text = parts.map((p: any) => p.text || '').join('');
                setMessages(prev => [...prev, { role: 'model', parts: [{ text }] }]);
            }
        } catch(error) {
            setMessages(prev => [...prev, { role: 'model', parts: [{ text: mode === 'staff'
                ? "Communication disruption. Verify API uplink."
                : "I'm sorry, I'm having trouble connecting right now. Please try again in a moment, or call our office at 314-849-2800 for immediate help."}] }]);
        } finally {
            setLoading(false);
        }
    };

    const handleStartLiveMode = useCallback(async (_withVision: boolean = false) => {
        let audioChunkCount = 0;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioRefs.current.stream = stream;
            console.log('✅ mic stream:', stream.getAudioTracks()[0]?.label);

            // Create AudioContexts NOW while we still have user-gesture context
            const inputCtx = new AudioContext({ sampleRate: 16000 });
            const outputCtx = new AudioContext({ sampleRate: 24000 });
            audioRefs.current.inputCtx = inputCtx;
            audioRefs.current.outputCtx = outputCtx;
            if (inputCtx.state === 'suspended') await inputCtx.resume();
            if (outputCtx.state === 'suspended') await outputCtx.resume();
            console.log('✅ AudioContexts created — input:', inputCtx.state, 'output:', outputCtx.state);

            // Dynamic import — only loads SDK when voice mode is activated
            const { GoogleGenAI, Modality } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
            console.log('✅ GoogleGenAI SDK loaded');

            const session = await ai.live.connect({
                model: LIVE_MODEL,
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
                    },
                    systemInstruction: SYSTEM_INSTRUCTION,
                },
                callbacks: {
                    onopen: () => {
                        console.log('✅ Live session open');
                        setIsListening(true);
                        setAuditStatus('LINK_ACTIVE');
                    },
                    onmessage: async (msg: any) => {
                        if (msg.serverContent?.interrupted) {
                            audioRefs.current.sources.forEach(s => { try { s.stop(); } catch (_) {} });
                            audioRefs.current.sources.clear();
                            audioRefs.current.nextStartTime = outputCtx.currentTime;
                            setIsSpeaking(false);
                            return;
                        }

                        if (msg.toolCall) {
                            for (const fc of msg.toolCall.functionCalls) {
                                let result: any = { status: "OK" };
                                if (fc.name === 'navigate_to_page') navigate((fc.args as any).path);
                                else result = await callMcpOrchestrator(fc.name, fc.args);
                                sessionRef.current?.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: result }] });
                            }
                        }

                        const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audioData) {
                            console.log('🔊 playing audio, length:', audioData.length);
                            setIsSpeaking(true);
                            if (outputCtx.state === 'suspended') await outputCtx.resume();
                            audioRefs.current.nextStartTime = Math.max(audioRefs.current.nextStartTime, outputCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
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
                    },
                    onclose: (e: any) => { console.log('⚠️ session closed reason:', e); setIsListening(false); setAuditStatus('IDLE'); },
                    onerror: (e: any) => { console.error('❌ Live session error:', e); setIsListening(false); setAuditStatus('IDLE'); },
                }
            });

            // Set sessionRef BEFORE starting audio pipeline
            // (onopen fires before connect() resolves, so sessionRef was null during onaudioprocess)
            sessionRef.current = session;
            console.log('✅ Live session connected, setting up audio pipeline');

            // Set up audio capture pipeline — session is guaranteed open and ref is set
            audioRefs.current.source = inputCtx.createMediaStreamSource(stream);
            audioRefs.current.processor = inputCtx.createScriptProcessor(4096, 1, 1);
            audioRefs.current.processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const blob = createBlob(inputData);
                if (sessionRef.current) {
                    try {
                        sessionRef.current.sendRealtimeInput({ media: blob });
                        audioChunkCount++;
                        if (audioChunkCount <= 3) console.log('🎤 audio chunk sent #' + audioChunkCount);
                    } catch (err) {
                        console.error('❌ sendRealtimeInput failed:', err);
                    }
                }
            };
            audioRefs.current.source.connect(audioRefs.current.processor);
            audioRefs.current.processor.connect(inputCtx.destination);
            console.log('✅ audio pipeline connected');

        } catch (e) {
            console.error('❌ handleStartLiveMode failed:', e);
            setIsVoiceMode(false); setIsVisionMode(false);
        }
    }, [navigate, SYSTEM_INSTRUCTION]);

    const handleStopLiveMode = useCallback(() => {
        setIsListening(false); setIsSpeaking(false); setAuditStatus('IDLE');
        if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
        if (sessionRef.current) {
            try { sessionRef.current.close(); } catch (_) {}
            sessionRef.current = null;
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
    
    // --- Mode-dependent UI text ---
    const headerTitle = mode === 'staff' 
        ? <h3 className="font-black text-sm tracking-tighter">THERAPYHUB <span className="text-primary tracking-widest text-[9px]">SUPERINTENDENT</span></h3>
        : <h3 className="font-black text-sm tracking-tighter">Clara <span className="text-indigo-500 tracking-widest text-[9px]">RECOVERY ASSISTANT</span></h3>;
    
    const headerStatus = mode === 'staff'
        ? (isVisionMode ? 'VISUAL AUDIT ACTIVE' : 'NATIVE AUDIO READY')
        : (isVisionMode ? 'VIDEO ACTIVE' : 'ONLINE');

    const headerIcon = mode === 'staff' 
        ? <ShieldCheck className="text-primary w-6 h-6" />
        : <Heart className="text-indigo-500 w-6 h-6" />;

    const headerIconBg = mode === 'staff' ? 'bg-primary/10' : 'bg-indigo-500/10';

    const placeholderText = mode === 'staff' ? 'Dispatch practice command...' : 'Ask Clara a question...';
    
    const groundingLabel = mode === 'staff' ? 'Operational Grounding:' : 'Helpful Resources:';

    return (
        <div className="fixed bottom-28 right-8 w-full max-w-sm h-[70vh] flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/20 dark:border-slate-800 rounded-[2.5rem] shadow-2xl z-50 animate-fade-in-up overflow-hidden ring-1 ring-black/5">
            <header className={`flex items-center justify-between p-6 ${mode === 'staff' ? 'bg-gradient-to-br from-primary/10 to-transparent' : 'bg-gradient-to-br from-indigo-500/10 to-transparent'} border-b border-border dark:border-slate-800`}>
                <div className="flex items-center gap-4">
                    <div className={`${headerIconBg} p-2.5 rounded-2xl`}>
                        {headerIcon}
                    </div>
                    <div>
                        {headerTitle}
                        <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mt-0.5">
                            <span className={`w-1.5 h-1.5 ${isVisionMode ? 'bg-red-500' : 'bg-green-500'} rounded-full animate-pulse`}></span> 
                            {headerStatus}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><Lock className="w-4 h-4 text-slate-400"/></button>
            </header>

            <div ref={chatContainerRef} className="flex-1 p-6 overflow-y-auto space-y-5 custom-scrollbar relative">
                <VisualAuditPanel 
                  isActive={isVisionMode} 
                  onClose={() => setIsVisionMode(false)}
                  onCaptureStill={() => {}}
                  stream={audioRefs.current.stream}
                  status={auditStatus}
                />

                {messages.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed shadow-sm transition-all ${msg.role === 'user' ? `${mode === 'staff' ? 'bg-primary' : 'bg-indigo-500'} text-white rounded-tr-none` : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-tl-none text-slate-800 dark:text-slate-200'}`}>
                            {msg.parts.map((part, i) => 'text' in part ? <div key={i} className="whitespace-pre-wrap">{part.text}</div> : null)}
                        </div>
                    </div>
                ))}
                
                {groundingLinks.length > 0 && (
                    <div className="space-y-2 animate-fade-in-up mt-4">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">{groundingLabel}</p>
                         <div className="grid gap-2">
                             {groundingLinks.map((chunk, i) => (chunk.web || chunk.maps) && (
                                 <a key={i} href={chunk.web?.uri || chunk.maps?.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl hover:border-primary/30 transition-all shadow-sm group">
                                     <Globe size={14} className="text-primary group-hover:scale-110 transition-transform" />
                                     <span className="text-[11px] font-bold truncate flex-1 dark:text-slate-300">{chunk.web?.title || chunk.maps?.title || 'Resource'}</span>
                                     <ExternalLink size={12} className="text-slate-400" />
                                 </a>
                             ))}
                         </div>
                    </div>
                )}
            </div>
            
            <div className="p-5 border-t border-border dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                {isVoiceMode || isVisionMode ? (
                    <div className="flex items-center justify-between gap-6 h-14 px-4 bg-white dark:bg-slate-800 rounded-3xl border border-border dark:border-slate-700 shadow-inner">
                        <button onClick={() => { setIsVoiceMode(false); setIsVisionMode(false); }} className="p-3 rounded-2xl bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg"><MicOff className="w-5 h-5" /></button>
                        <div className="flex-1 flex justify-center gap-1.5">
                            {[1,2,3,4,5].map(i => <div key={i} className={`w-1 h-6 bg-primary rounded-full transition-all duration-300 ${isSpeaking ? 'animate-bounce' : 'opacity-20'}`} style={{ animationDelay: `${i*0.1}s` }}></div>)}
                        </div>
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20"><Mic className={`text-primary w-6 h-6 ${isSpeaking ? '' : 'animate-pulse'}`} /></div>
                    </div>
                ) : (
                    <div className="relative group">
                        <input type="text" placeholder={placeholderText} value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleTextSend()} disabled={loading} className="w-full pr-24 pl-6 py-5 border-none bg-white dark:bg-slate-800 rounded-3xl shadow-xl focus:ring-2 focus:ring-primary/20 text-sm font-medium transition-all group-focus-within:shadow-2xl ring-1 ring-black/5" />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                            {mode === 'staff' && <button onClick={() => setIsVisionMode(true)} className="p-2.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-2xl transition-all" title="Toggle Visual Audit"><Camera size={20} /></button>}
                            <button onClick={() => setIsVoiceMode(true)} className="p-2.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-2xl transition-all" title="Toggle Voice Mode"><Mic size={20} /></button>
                            <button onClick={handleTextSend} disabled={loading || !input.trim()} className={`${mode === 'staff' ? 'bg-primary shadow-primary/20' : 'bg-indigo-500 shadow-indigo-500/20'} text-white p-3 rounded-2xl hover:opacity-90 transition-all disabled:opacity-50 shadow-lg active:scale-95`}><Send size={18} /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SynapseChatPopover;
