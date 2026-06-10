import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatMessage } from '../../types';
import { Send, Mic, MicOff, Zap, Globe, ShieldCheck, Lock, Camera, ExternalLink, Heart } from 'lucide-react';
import VisualAuditPanel from './VisualAuditPanel';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../services/supabase';

// Text chat routes through pds-gemini-proxy; Live voice uses an ephemeral token
// from gemini-live-token. The raw Gemini key is no longer held client-side.
const PROXY_MODELS = `${SUPABASE_URL}/functions/v1/pds-gemini-proxy/v1beta/models`;
const LIVE_TOKEN_URL = `${SUPABASE_URL}/functions/v1/gemini-live-token`;
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
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
  /**
   * Presentation shell ONLY — does not change the agent/voice logic:
   *   'floating' = client bubble that overlays content (portal, unchanged)
   *   'panel'    = staff docked right-side drawer (header-launched; pushes content)
   */
  variant?: 'floating' | 'panel';
}

const SynapseChatPopover: React.FC<SynapseChatPopoverProps> = ({ isOpen, onClose, mode = 'staff', variant = 'floating' }) => {
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
                ? "Hi — I'm Clara, your clinical operations assistant. I can help surface today's priorities, draft court letters and session notes, and answer questions about clients and schedules. What would you like to start with?"
                : "Hi there! I'm Clara, your personal recovery assistant. I'm here to help you with questions about your program, appointments, forms, or anything else you need. How can I help you today?" }] }
        ]);
    }, [mode]);

    // Role-aware tool set. Gemini rejects built-in tools (google_search) and
    // function calling in the SAME request, so each role gets EXACTLY ONE set:
    //   - CLIENT (portal): google_search grounding only. NO function_declarations —
    //     a portal client must never reach staff data or app navigation (security
    //     boundary).
    //   - STAFF: function_declarations (navigation) only; no search.
    // Patch 0 retired the dead MCP lookups (patient_session_summary /
    // billing_status): the mcp-orchestrator edge function has NO handler for
    // either — calling them dumped raw error JSON into chat.
    const getTools = () => {
        if (mode === 'client') {
            return [{ google_search: {} }];
        }
        return [
            {
                function_declarations: [
                    { name: "navigate_to_page", description: "Navigate to a specific system page (e.g. /dashboard, /clients).", parameters: { type: "OBJECT", properties: { path: { type: "STRING" } }, required: ["path"] } }
                ]
            }
        ];
    };

    const SYSTEM_INSTRUCTION = mode === 'staff'
        ? `You are Clara, the clinical operations assistant for Assessment & Counseling Solutions (ACS), a Missouri-licensed substance abuse treatment provider specializing in court-mandated SATOP and REACT programs.

You are speaking with a clinical staff member — counselor, administrator, or office staff at ACS. Address them by their name or role (Dr. Sharma, David). Never call them "technician," "tech," "lead technician," or any field-service title.

Your role:
- Surface clinical priorities for today: pending intakes, due court reports, missed sessions, approaching compliance deadlines
- Answer questions about client records, program progress, session schedules, and billing status
- Draft routine clinical documents — court progress letters, session summaries, intake packets, discharge summaries — for clinician review and signature
- Flag risks calmly: missed sessions, court reporting deadlines, incomplete forms, billing issues

You never:
- Make clinical judgments, diagnoses, or treatment recommendations
- Speak with the authority of a licensed clinician — you draft and surface, the clinician decides
- Discuss client information beyond what this staff member is authorized to see
- Cause alarm; you are the calm, steady presence that keeps the practice running

Tone: warm, organized, professional. You know the people you work with care deeply about their clients and are often stretched thin. Your job is to make their day lighter, not heavier. Brief responses by default; expand only when asked.

Missouri SATOP context: SATOP (Substance Abuse Traffic Offender Program) has multiple levels including OEP (Offender Education Program), Weekend Intervention Program, ADEP (Adolescent Diversion Education Program), and CIP (Clinical Intervention Program). REACT is the adolescent counterpart. Court reporting deadlines are real and consequential.

You work alongside David Yoder (Director) and the clinical team. You are part of the ACS team, not a vendor or external service.

You can navigate the staff UI and check client records via available tools.`
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
                `${PROXY_MODELS}/${TEXT_MODEL}:generateContent`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'apikey': SUPABASE_ANON_KEY,
                    },
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
            // Tool calls are a STAFF-only path (client getTools() declares no
            // function tools). Gating on mode here is defense-in-depth. The only
            // declared tool is navigate_to_page (Patch 0 retired the dead MCP
            // lookups); anything else is silently ignored rather than dispatched.
            if (mode === 'staff' && functionCalls.length > 0) {
                 for (const part of functionCalls) {
                     const fc = part.functionCall;
                     setToolUseState(`Looking that up...`);
                     if (fc.name === 'navigate_to_page') navigate(fc.args?.path);
                 }
                 setToolUseState(null);
            } else {
                const text = parts.map((p: any) => p.text || '').join('');
                setMessages(prev => [...prev, { role: 'model', parts: [{ text }] }]);
            }
        } catch(error) {
            setMessages(prev => [...prev, { role: 'model', parts: [{ text: mode === 'staff'
                ? "Sorry — I'm having trouble connecting right now. Please try again in a moment."
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

            // Fetch a short-lived ephemeral token from gemini-live-token (which
            // holds the real GEMINI_API_KEY server-side) and init the SDK with the
            // token — the raw key never reaches the browser.
            // NOTE: ephemeral tokens require apiVersion 'v1alpha'. This is NOT the
            // websocket-breaking apiProxy/httpOptions anti-pattern — it only selects
            // the API version. The Live model + audio config below are UNCHANGED.
            const tokenRes = await fetch(LIVE_TOKEN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
            });
            const tokenJson = await tokenRes.json();
            if (!tokenRes.ok || !tokenJson?.success || !tokenJson?.token?.name) {
                throw new Error(tokenJson?.error || 'Could not obtain a Live voice token.');
            }
            const ai = new GoogleGenAI({
                apiKey: tokenJson.token.name,
                httpOptions: { apiVersion: 'v1alpha' },
            });
            console.log('✅ GoogleGenAI SDK loaded (ephemeral token)');

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
                            // Note: the Live config above declares NO tools, so this
                            // branch is currently unreachable — kept as the safe shape
                            // for when v2 adds voice tools. Only navigate_to_page is
                            // handled (Patch 0 retired the dead MCP lookups).
                            for (const fc of msg.toolCall.functionCalls) {
                                if (fc.name === 'navigate_to_page') navigate((fc.args as any).path);
                                sessionRef.current?.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { status: 'OK' } }] });
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

    // CLOSE MEANS STOP (Patch 0 — hidden-hot-mic fix). `isOpen=false` renders null
    // below but the component STAYS MOUNTED (hooks keep running), so without this
    // the mic stream + Live WebSocket kept streaming invisibly after the panel was
    // closed (X, Escape, portal bubble) until a route change happened to unmount it.
    // Flipping the mode flags routes through the ONE voice effect above into
    // handleStopLiveMode — the same single teardown used by MicOff and unmount, so
    // there is exactly one way voice stops and no close path can miss it.
    useEffect(() => {
        if (!isOpen && (isVoiceMode || isVisionMode)) {
            setIsVoiceMode(false);
            setIsVisionMode(false);
        }
    }, [isOpen, isVoiceMode, isVisionMode]);

    if (!isOpen) return null;
    
    // --- Mode-dependent UI text ---
    const headerTitle = mode === 'staff'
        ? <h3 className="font-black text-sm tracking-tighter">Clara <span className="text-primary tracking-widest text-[9px]">CLINICAL ASSISTANT</span></h3>
        : <h3 className="font-black text-sm tracking-tighter">Clara <span className="text-indigo-500 tracking-widest text-[9px]">RECOVERY ASSISTANT</span></h3>;
    
    const headerStatus = mode === 'staff'
        ? (isVisionMode ? 'VISUAL AUDIT ACTIVE' : 'NATIVE AUDIO READY')
        : (isVisionMode ? 'VIDEO ACTIVE' : 'ONLINE');

    const headerIcon = mode === 'staff' 
        ? <ShieldCheck className="text-primary w-6 h-6" />
        : <Heart className="text-indigo-500 w-6 h-6" />;

    const headerIconBg = mode === 'staff' ? 'bg-primary/10' : 'bg-indigo-500/10';

    const placeholderText = mode === 'staff' ? 'Ask Clara about today...' : 'Ask Clara a question...';
    
    const groundingLabel = mode === 'staff' ? 'Operational Grounding:' : 'Helpful Resources:';

    // Presentation shell only. 'panel' docks to the right below the header (top-16)
    // and is sized by the layout's content push — it never floats over the ledger.
    // 'floating' is the unchanged client bubble. Warm tokens (#8B1E24/#F8F7F4/#D6CFC2)
    // via border-border / bg-white / text-primary, consistent with the staff app.
    const containerCls = variant === 'panel'
        ? 'fixed top-16 right-0 bottom-0 w-full sm:w-[420px] flex flex-col bg-white dark:bg-slate-900 border-l border-border dark:border-slate-800 shadow-2xl z-30 animate-fade-in-up overflow-hidden'
        : 'fixed bottom-28 right-8 w-full max-w-sm h-[70vh] flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/20 dark:border-slate-800 rounded-[2.5rem] shadow-2xl z-50 animate-fade-in-up overflow-hidden ring-1 ring-black/5';

    return (
        <div className={containerCls}>
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
