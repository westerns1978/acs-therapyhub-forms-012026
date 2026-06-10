/**
 * Clara v2 Phase 1 — the ClaraProvider spine.
 *
 * ONE app-level owner of Clara's session, transcript, and voice state, mounted
 * inside AuthProvider ABOVE the route switch (App.tsx). Before this, everything
 * lived in SynapseChatPopover component state inside per-route layout instances,
 * so Clara's survival across navigation was an accident of React reconciliation
 * (same gate-wrapper type → survived; ProtectedRoute↔RequireRole crossing or any
 * portal page swap → killed). The provider never unmounts, so:
 *
 *   • Panel open + navigation ANYWHERE → session, voice, transcript survive.
 *   • Panel closed (X / Escape / portal close) → mic + Live socket DIE — the
 *     Patch-0 close-means-stop privacy invariant, now provider-owned. The
 *     transcript persists for reopen; only the capture/socket is torn down.
 *   • stopVoice() remains the ONE teardown — close, MicOff, user-switch, and
 *     provider unmount all converge on it.
 *
 * Session resilience (the ephemeral-token flow, v1alpha httpOptions, and the
 * exact model string are PRESERVED — see the voice-fix memory):
 *   • sessionResumption enabled; the freshest server handle is kept in memory
 *     and a drop while voice is desired auto-reconnects (fresh ephemeral token
 *     + the handle) with visible 'reconnecting' state. Bounded backoff.
 *   • contextWindowCompression (sliding window) so long sessions don't hit the
 *     context ceiling.
 *   • Input/output audio transcription ON — voice turns land in the SAME
 *     transcript text mode reads, so text and voice share one conversation.
 *
 * Identity: the system instruction is built per-connect from the real logged-in
 * user (name + role from useAuth) — the hardcoded "Dr. Sharma, David" greetings
 * are gone. The staff/client security boundary is unchanged: client mode gets
 * google_search ONLY (no function declarations, no navigation tools).
 *
 * Text mode now sends bounded conversation history (last TEXT_HISTORY_TURNS
 * turns, never starting on a model turn) instead of a single stateless message.
 *
 * NOT in Phase 1: Supabase transcript persistence, rolling summaries,
 * engine-truth injection on navigation, new tools.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ChatMessage, User, isStaffRole } from '../types';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../services/supabase';

// Text chat routes through pds-gemini-proxy; Live voice uses an ephemeral token
// from gemini-live-token. The raw Gemini key is never held client-side.
const PROXY_MODELS = `${SUPABASE_URL}/functions/v1/pds-gemini-proxy/v1beta/models`;
const LIVE_TOKEN_URL = `${SUPABASE_URL}/functions/v1/gemini-live-token`;
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const TEXT_MODEL = 'gemini-2.5-flash';

/** Bounded text-history window (turns, after trimming a leading model turn). */
const TEXT_HISTORY_TURNS = 20;
const MAX_RECONNECT_ATTEMPTS = 4;

export type ClaraMode = 'staff' | 'client';
export type ClaraConnection = 'off' | 'connecting' | 'connected' | 'reconnecting';

// ── Audio plumbing (unchanged from the popover implementation) ────────────────
function encode(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}
async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}
function createBlob(data: Float32Array): { data: string; mimeType: string } {
  const int16 = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
  return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
}

// ── Persona (identity injected from the real session user) ────────────────────
const staffInstruction = (user: User | null) => `You are Clara, the clinical operations assistant for Assessment & Counseling Solutions (ACS), a Missouri-licensed substance abuse treatment provider specializing in court-mandated SATOP and REACT programs.

You are speaking with ${user ? `${user.name}, ${user.role} at ACS` : 'a clinical staff member at ACS'}. Address them by their first name. Never call them "technician," "tech," "lead technician," or any field-service title.

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

You can navigate the staff UI via the available tool.`;

const clientInstruction = (user: User | null) => `You are Clara, a warm and supportive recovery assistant for clients at Assessment & Counseling Solutions (ACS) in St. Louis, Missouri.
${user ? `You are speaking with ${user.name}, an enrolled ACS client. Address them by their first name.` : ''}
You help clients with questions about their SATOP program, REACT program, DWI Court requirements, appointment scheduling, form completion, payment information, and general recovery support.
Be empathetic, encouraging, and use simple language. Never use clinical jargon or technical terms.
If someone seems distressed, gently encourage them to reach out to their counselor or call the office at 314-849-2800.
Always be positive and remind them that completing their program is achievable.`;

const greetingFor = (mode: ClaraMode): ChatMessage => ({
  role: 'model',
  parts: [{ text: mode === 'staff'
    ? "Hi — I'm Clara, your clinical operations assistant. I can help surface today's priorities, draft court letters and session notes, and answer questions about clients and schedules. What would you like to start with?"
    : "Hi there! I'm Clara, your personal recovery assistant. I'm here to help you with questions about your program, appointments, forms, or anything else you need. How can I help you today?" }],
});

export interface ClaraContextValue {
  mode: ClaraMode;
  // panel
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  // transcript
  messages: ChatMessage[];
  sendText: (text: string) => Promise<void>;
  loading: boolean;
  toolUseState: string | null;
  groundingLinks: any[];
  // voice
  isVoiceMode: boolean;
  isVisionMode: boolean;
  setVoiceMode: (on: boolean) => void;
  setVisionMode: (on: boolean) => void;
  connection: ClaraConnection;
  isSpeaking: boolean;
  auditStatus: 'IDLE' | 'LINK_ACTIVE' | 'RECORDING' | 'ANALYZING';
  audioStream: MediaStream | null;
}

const ClaraContext = createContext<ClaraContextValue | null>(null);

export const useClara = (): ClaraContextValue => {
  const ctx = useContext(ClaraContext);
  if (!ctx) throw new Error('useClara must be used inside <ClaraProvider>');
  return ctx;
};

export const ClaraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mode: ClaraMode = isStaffRole(user?.role) ? 'staff' : 'client';

  // ── UI / transcript state ──
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([greetingFor('staff')]);
  const [loading, setLoading] = useState(false);
  const [toolUseState, setToolUseState] = useState<string | null>(null);
  const [groundingLinks, setGroundingLinks] = useState<any[]>([]);

  // ── voice state ──
  const [isVoiceMode, setIsVoiceModeState] = useState(false);
  const [isVisionMode, setIsVisionModeState] = useState(false);
  const [connection, setConnection] = useState<ClaraConnection>('off');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [auditStatus, setAuditStatus] = useState<'IDLE' | 'LINK_ACTIVE' | 'RECORDING' | 'ANALYZING'>('IDLE');
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  // ── refs ──
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;
  const modeRef = useRef<ClaraMode>(mode);
  modeRef.current = mode;
  const userRef = useRef<User | null>(user ?? null);
  userRef.current = user ?? null;

  const sessionRef = useRef<any>(null);
  const voiceDesiredRef = useRef(false);       // the user's intent — drives reconnect
  const manualStopRef = useRef(false);         // suppresses reconnect during teardown
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const resumeHandleRef = useRef<string | null>(null);  // latest sessionResumption handle
  const pendingInRef = useRef('');             // accumulating input (user voice) transcription
  const pendingOutRef = useRef('');            // accumulating output (Clara voice) transcription
  const audioRefs = useRef<{
    inputCtx: AudioContext | null;
    outputCtx: AudioContext | null;
    stream: MediaStream | null;
    processor: ScriptProcessorNode | null;
    source: MediaStreamAudioSourceNode | null;
    nextStartTime: number;
    sources: Set<AudioBufferSourceNode>;
  }>({ inputCtx: null, outputCtx: null, stream: null, processor: null, source: null, nextStartTime: 0, sources: new Set() });

  const pushMessage = useCallback((m: ChatMessage) => {
    setMessages((prev) => [...prev, m]);
  }, []);

  // Voice transcription turns flush into the SHARED transcript (text+voice = one
  // conversation). Called on turnComplete and on interruption.
  const flushVoiceTurn = useCallback(() => {
    const inText = pendingInRef.current.trim();
    const outText = pendingOutRef.current.trim();
    pendingInRef.current = '';
    pendingOutRef.current = '';
    setMessages((prev) => [
      ...prev,
      ...(inText ? [{ role: 'user' as const, parts: [{ text: inText }] }] : []),
      ...(outText ? [{ role: 'model' as const, parts: [{ text: outText }] }] : []),
    ]);
  }, []);

  const buildInstruction = useCallback(
    () => (modeRef.current === 'staff' ? staffInstruction(userRef.current) : clientInstruction(userRef.current)),
    [],
  );

  // Role-aware tool set — UNCHANGED boundary. Gemini rejects built-in tools
  // (google_search) and function calling in the same request, so each role gets
  // exactly one set: client = google_search ONLY (no function declarations, no
  // path to navigation); staff = navigate_to_page only (Patch 0 retired the dead
  // MCP lookups — mcp-orchestrator has no handler for them).
  const getTools = useCallback(() => {
    if (modeRef.current === 'client') {
      return [{ google_search: {} }];
    }
    return [
      {
        function_declarations: [
          { name: 'navigate_to_page', description: 'Navigate to a specific system page (e.g. /dashboard, /clients).', parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' } }, required: ['path'] } },
        ],
      },
    ];
  }, []);

  // ── THE single voice teardown (Patch-0 invariant, provider-owned) ────────────
  // Every stop path converges here: MicOff, panel close (close-means-stop),
  // user switch, provider unmount. Kills mic tracks, audio graph, socket, and
  // any pending reconnect. Idempotent.
  const stopVoice = useCallback(() => {
    voiceDesiredRef.current = false;
    manualStopRef.current = true;
    if (reconnectTimerRef.current != null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    setIsVoiceModeState(false);
    setIsVisionModeState(false);
    setIsSpeaking(false);
    setAuditStatus('IDLE');
    setConnection('off');
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (_) {}
      sessionRef.current = null;
    }
    const { stream, inputCtx, outputCtx, processor, source, sources } = audioRefs.current;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    sources.forEach((s) => { try { s.stop(); } catch (_) {} });
    sources.clear();
    if (processor) { processor.onaudioprocess = null; processor.disconnect(); }
    if (source) source.disconnect();
    if (inputCtx) { try { inputCtx.close(); } catch (_) {} }
    if (outputCtx) { try { outputCtx.close(); } catch (_) {} }
    Object.assign(audioRefs.current, { inputCtx: null, outputCtx: null, stream: null, processor: null, source: null, nextStartTime: 0, sources: new Set() });
    setAudioStream(null);
    // Flush any partial voice transcription so it isn't lost.
    if (pendingInRef.current || pendingOutRef.current) flushVoiceTurn();
    manualStopRef.current = false;
  }, [flushVoiceTurn]);

  // ── Live connect (token → SDK → session). Used for first connect AND for
  // resumption reconnects; the audio pipeline persists across reconnects (only
  // the socket is replaced — processor keeps feeding sessionRef.current). ──────
  const connectLive = useCallback(async () => {
    // Dynamic import — SDK loads only when voice is used.
    const { GoogleGenAI, Modality } = await import('@google/genai');

    // Fresh short-lived ephemeral token per connection (gemini-live-token holds
    // the real key server-side; the raw key never reaches the browser).
    // NOTE: ephemeral tokens require apiVersion 'v1alpha' — this is NOT the
    // websocket-breaking apiProxy/httpOptions anti-pattern; it only selects the
    // API version. Model + audio config unchanged.
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

    const session = await ai.live.connect({
      model: LIVE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
        },
        systemInstruction: buildInstruction(),
        // v2 resilience: resumable sessions + context compression + transcription.
        sessionResumption: resumeHandleRef.current ? { handle: resumeHandleRef.current } : {},
        contextWindowCompression: { slidingWindow: {} },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          reconnectAttemptRef.current = 0;
          setConnection('connected');
          setAuditStatus('LINK_ACTIVE');
        },
        onmessage: async (msg: any) => {
          // Resumption handle updates — keep the freshest resumable handle.
          if (msg.sessionResumptionUpdate?.resumable && msg.sessionResumptionUpdate.newHandle) {
            resumeHandleRef.current = msg.sessionResumptionUpdate.newHandle;
          }
          // GoAway: the server will close shortly — the onclose path reconnects.
          if (msg.goAway) {
            console.warn('[clara] server goAway — reconnect will follow. timeLeft:', msg.goAway.timeLeft);
          }

          const sc = msg.serverContent;
          // Voice↔text unification: transcriptions land in the shared transcript.
          if (sc?.inputTranscription?.text) pendingInRef.current += sc.inputTranscription.text;
          if (sc?.outputTranscription?.text) pendingOutRef.current += sc.outputTranscription.text;

          if (sc?.interrupted) {
            audioRefs.current.sources.forEach((s) => { try { s.stop(); } catch (_) {} });
            audioRefs.current.sources.clear();
            if (audioRefs.current.outputCtx) audioRefs.current.nextStartTime = audioRefs.current.outputCtx.currentTime;
            setIsSpeaking(false);
            flushVoiceTurn();
            return;
          }
          if (sc?.turnComplete) flushVoiceTurn();

          if (msg.toolCall) {
            // The Live config declares NO tools today — kept as the safe shape
            // for when later phases add voice tools. navigate_to_page only.
            for (const fc of msg.toolCall.functionCalls) {
              if (fc.name === 'navigate_to_page') navigate((fc.args as any).path);
              sessionRef.current?.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { status: 'OK' } }] });
            }
          }

          const audioData = sc?.modelTurn?.parts?.[0]?.inlineData?.data;
          const outputCtx = audioRefs.current.outputCtx;
          if (audioData && outputCtx) {
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
        onclose: (e: any) => {
          console.log('[clara] session closed:', e?.reason || e);
          handleDrop();
        },
        onerror: (e: any) => {
          console.error('[clara] session error:', e);
          handleDrop();
        },
      },
    });

    sessionRef.current = session;
  }, [buildInstruction, flushVoiceTurn, navigate]);

  // Drop handler — visible auto-reconnect with the resumption handle while voice
  // is still desired; bounded backoff; otherwise honest 'off'.
  const handleDrop = useCallback(() => {
    if (manualStopRef.current) return;                  // teardown in progress
    sessionRef.current = null;
    if (!voiceDesiredRef.current) { setConnection('off'); return; }
    if (reconnectTimerRef.current != null) return;      // a reconnect is already scheduled
    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[clara] reconnect attempts exhausted — stopping voice.');
      stopVoice();
      return;
    }
    const attempt = reconnectAttemptRef.current++;
    const delay = 800 * Math.pow(2, attempt);
    setConnection('reconnecting');
    reconnectTimerRef.current = window.setTimeout(async () => {
      reconnectTimerRef.current = null;
      if (!voiceDesiredRef.current) return;
      try {
        await connectLive();                             // fresh token + resumeHandle
      } catch (err) {
        console.error('[clara] reconnect failed:', err);
        handleDrop();                                    // schedule the next attempt
      }
    }, delay);
  }, [connectLive, stopVoice]);

  // ── Voice start (mic + audio graph + first connect) ──────────────────────────
  const startVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioRefs.current.stream = stream;
      setAudioStream(stream);

      // AudioContexts while we still have user-gesture context.
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      audioRefs.current.inputCtx = inputCtx;
      audioRefs.current.outputCtx = outputCtx;
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      voiceDesiredRef.current = true;
      reconnectAttemptRef.current = 0;
      resumeHandleRef.current = null;                    // a fresh voice session starts a fresh context
      setConnection('connecting');
      await connectLive();

      // Capture pipeline — feeds whichever session is current (survives reconnects).
      audioRefs.current.source = inputCtx.createMediaStreamSource(stream);
      audioRefs.current.processor = inputCtx.createScriptProcessor(4096, 1, 1);
      audioRefs.current.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const blob = createBlob(inputData);
        if (sessionRef.current) {
          try { sessionRef.current.sendRealtimeInput({ media: blob }); } catch (_) {}
        }
      };
      audioRefs.current.source.connect(audioRefs.current.processor);
      audioRefs.current.processor.connect(inputCtx.destination);
    } catch (e) {
      console.error('[clara] startVoice failed:', e);
      stopVoice();
    }
  }, [connectLive, stopVoice]);

  const setVoiceMode = useCallback((on: boolean) => {
    if (on) {
      if (voiceDesiredRef.current) return;
      setIsVoiceModeState(true);
      void startVoice();
    } else {
      stopVoice();
    }
  }, [startVoice, stopVoice]);

  const setVisionMode = useCallback((on: boolean) => {
    if (on) {
      setIsVisionModeState(true);
      if (!voiceDesiredRef.current) {
        setIsVoiceModeState(true);
        void startVoice();
      }
    } else {
      stopVoice();
    }
  }, [startVoice, stopVoice]);

  // ── Panel controls. CLOSE MEANS STOP (privacy invariant): hiding the panel
  // kills the mic + socket; the transcript persists in the provider. ───────────
  const close = useCallback(() => {
    setIsOpen(false);
    stopVoice();
  }, [stopVoice]);
  const open = useCallback(() => setIsOpen(true), []);
  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) stopVoice();
      return !prev;
    });
  }, [stopVoice]);

  // ── Text send — bounded shared history (voice transcriptions included). ──────
  const sendText = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || loading) return;
    const userMsg: ChatMessage = { role: 'user', parts: [{ text }] };
    pushMessage(userMsg);
    setLoading(true);
    setGroundingLinks([]);
    try {
      // Last N turns of the SHARED transcript (text + flushed voice turns),
      // text parts only, never starting on a model turn (API requirement).
      const history = [...messagesRef.current, userMsg]
        .map((m) => ({ role: m.role, parts: m.parts.filter((p: any) => 'text' in p && p.text) }))
        .filter((m) => m.parts.length > 0)
        .slice(-TEXT_HISTORY_TURNS);
      while (history.length > 0 && history[0].role === 'model') history.shift();

      const res = await fetch(`${PROXY_MODELS}/${TEXT_MODEL}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: buildInstruction() }] },
          contents: history,
          tools: getTools(),
        }),
      });
      const json = await res.json();
      const candidate = json.candidates?.[0];
      if (candidate?.groundingMetadata?.groundingChunks) {
        setGroundingLinks(candidate.groundingMetadata.groundingChunks);
      }
      const parts = candidate?.content?.parts || [];
      const functionCalls = parts.filter((p: any) => p.functionCall);
      // STAFF-only tool path (client declares no function tools) — defense in depth.
      if (modeRef.current === 'staff' && functionCalls.length > 0) {
        for (const part of functionCalls) {
          const fc = part.functionCall;
          setToolUseState('Looking that up...');
          if (fc.name === 'navigate_to_page') navigate(fc.args?.path);
        }
        setToolUseState(null);
      } else {
        const replyText = parts.map((p: any) => p.text || '').join('');
        pushMessage({ role: 'model', parts: [{ text: replyText }] });
      }
    } catch (error) {
      pushMessage({ role: 'model', parts: [{ text: modeRef.current === 'staff'
        ? "Sorry — I'm having trouble connecting right now. Please try again in a moment."
        : "I'm sorry, I'm having trouble connecting right now. Please try again in a moment, or call our office at 314-849-2800 for immediate help." }] });
    } finally {
      setLoading(false);
    }
  }, [buildInstruction, getTools, loading, navigate, pushMessage]);

  // ── User-boundary reset: a different login must never see the previous user's
  // transcript, session, or resumption handle. Also seeds the mode greeting. ────
  useEffect(() => {
    stopVoice();
    resumeHandleRef.current = null;
    setIsOpen(false);
    setGroundingLinks([]);
    setMessages([greetingFor(isStaffRole(user?.role) ? 'staff' : 'client')]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Provider-unmount safety (full app teardown / hot reload).
  useEffect(() => () => stopVoice(), [stopVoice]);

  // Dev-only witness hook (Tier-2 instrumented witnessing; stripped of meaning in prod).
  useEffect(() => {
    (window as any).__claraDebug = {
      connection,
      isVoiceMode,
      msgCount: messages.length,
      resumeHandle: () => resumeHandleRef.current,
    };
  }, [connection, isVoiceMode, messages.length]);

  const value: ClaraContextValue = {
    mode,
    isOpen, open, close, toggle,
    messages, sendText, loading, toolUseState, groundingLinks,
    isVoiceMode, isVisionMode, setVoiceMode, setVisionMode,
    connection, isSpeaking, auditStatus, audioStream,
  };

  return <ClaraContext.Provider value={value}>{children}</ClaraContext.Provider>;
};
