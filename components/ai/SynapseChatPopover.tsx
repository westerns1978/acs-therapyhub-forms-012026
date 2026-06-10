import React, { useState, useRef } from 'react';
import { Send, Mic, MicOff, Globe, ShieldCheck, Lock, Camera, ExternalLink, Heart } from 'lucide-react';
import VisualAuditPanel from './VisualAuditPanel';
import { useClara } from '../../contexts/ClaraContext';

/**
 * Clara v2 Phase 1 — the popover is now a SHELL. All session, transcript, and
 * voice state lives in ClaraProvider (contexts/ClaraContext.tsx), mounted once
 * above the route switch, so Clara survives every navigation (including the old
 * ProtectedRoute↔RequireRole killer and portal page swaps). This component just
 * renders provider state in one of two skins:
 *   'floating' = client bubble that overlays content (portal)
 *   'panel'    = staff docked right-side drawer (header-launched; pushes content)
 * Close-means-stop is enforced by the PROVIDER (clara.close() tears voice down)
 * — no privacy logic lives here.
 */
interface SynapseChatPopoverProps {
  variant?: 'floating' | 'panel';
}

const SynapseChatPopover: React.FC<SynapseChatPopoverProps> = ({ variant = 'floating' }) => {
    const clara = useClara();
    const { mode, isOpen, close, messages, sendText, loading, groundingLinks,
            isVoiceMode, isVisionMode, setVoiceMode, setVisionMode,
            connection, isSpeaking, auditStatus, audioStream } = clara;
    const [input, setInput] = useState('');
    const chatContainerRef = useRef<HTMLDivElement>(null);

    if (!isOpen) return null;

    const handleSend = () => {
        if (!input.trim() || loading) return;
        const text = input;
        setInput('');
        void sendText(text);
    };

    // --- Mode-dependent UI text ---
    const headerTitle = mode === 'staff'
        ? <h3 className="font-black text-sm tracking-tighter">Clara <span className="text-primary tracking-widest text-[9px]">CLINICAL ASSISTANT</span></h3>
        : <h3 className="font-black text-sm tracking-tighter">Clara <span className="text-indigo-500 tracking-widest text-[9px]">RECOVERY ASSISTANT</span></h3>;

    // HONEST connection status — driven by the actual socket state, never a
    // perpetual "ONLINE" badge. Reconnects are visible.
    const headerStatus = isVisionMode
        ? 'VISUAL AUDIT ACTIVE'
        : connection === 'connected' ? 'VOICE LIVE'
        : connection === 'reconnecting' ? 'RECONNECTING…'
        : connection === 'connecting' ? 'CONNECTING…'
        : 'READY';
    const statusDot = connection === 'connected' ? 'bg-green-500 animate-pulse'
        : connection === 'reconnecting' || connection === 'connecting' ? 'bg-amber-500 animate-ping'
        : isVisionMode ? 'bg-red-500 animate-pulse'
        : 'bg-slate-400';

    const headerIcon = mode === 'staff'
        ? <ShieldCheck className="text-primary w-6 h-6" />
        : <Heart className="text-indigo-500 w-6 h-6" />;
    const headerIconBg = mode === 'staff' ? 'bg-primary/10' : 'bg-indigo-500/10';
    const placeholderText = mode === 'staff' ? 'Ask Clara about today...' : 'Ask Clara a question...';
    const groundingLabel = mode === 'staff' ? 'Operational Grounding:' : 'Helpful Resources:';

    // Presentation shell only. 'panel' docks to the right below the header (top-16)
    // and is sized by the layout's content push — it never floats over the ledger.
    // 'floating' is the unchanged client bubble.
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
                            <span className={`w-1.5 h-1.5 ${statusDot} rounded-full`}></span>
                            {headerStatus}
                        </p>
                    </div>
                </div>
                <button onClick={close} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full" aria-label="Close Clara"><Lock className="w-4 h-4 text-slate-400"/></button>
            </header>

            <div ref={chatContainerRef} className="flex-1 p-6 overflow-y-auto space-y-5 custom-scrollbar relative">
                <VisualAuditPanel
                  isActive={isVisionMode}
                  onClose={() => setVisionMode(false)}
                  onCaptureStill={() => {}}
                  stream={audioStream}
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
                        <button onClick={() => setVoiceMode(false)} className="p-3 rounded-2xl bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg" aria-label="Stop voice mode"><MicOff className="w-5 h-5" /></button>
                        <div className="flex-1 flex justify-center gap-1.5">
                            {[1,2,3,4,5].map(i => <div key={i} className={`w-1 h-6 bg-primary rounded-full transition-all duration-300 ${isSpeaking ? 'animate-bounce' : 'opacity-20'}`} style={{ animationDelay: `${i*0.1}s` }}></div>)}
                        </div>
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20"><Mic className={`text-primary w-6 h-6 ${isSpeaking ? '' : 'animate-pulse'}`} /></div>
                    </div>
                ) : (
                    <div className="relative group">
                        <input type="text" placeholder={placeholderText} value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} disabled={loading} className="w-full pr-24 pl-6 py-5 border-none bg-white dark:bg-slate-800 rounded-3xl shadow-xl focus:ring-2 focus:ring-primary/20 text-sm font-medium transition-all group-focus-within:shadow-2xl ring-1 ring-black/5" />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                            {mode === 'staff' && <button onClick={() => setVisionMode(true)} className="p-2.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-2xl transition-all" title="Toggle Visual Audit"><Camera size={20} /></button>}
                            <button onClick={() => setVoiceMode(true)} className="p-2.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-2xl transition-all" title="Toggle Voice Mode"><Mic size={20} /></button>
                            <button onClick={handleSend} disabled={loading || !input.trim()} className={`${mode === 'staff' ? 'bg-primary shadow-primary/20' : 'bg-indigo-500 shadow-indigo-500/20'} text-white p-3 rounded-2xl hover:opacity-90 transition-all disabled:opacity-50 shadow-lg active:scale-95`}><Send size={18} /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SynapseChatPopover;
