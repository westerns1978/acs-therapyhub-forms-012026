import React, { useState, useRef, useEffect } from 'react';
import { generateSoapNoteFromTranscript, saveClinicalNote, getClients } from '../../services/api';
import { Client } from '../../types';
import { Sparkles, Loader2, Mic, MicOff, Eraser, FileText, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface SmartNoteImporterProps {
    onNoteGenerated: (note: string) => void;
    clientId?: string;
    /** Optional: reports whether there is unsaved note text, so a host (e.g. the
     *  dockable side panel) can guard against an accidental close mid-session. */
    onDirtyChange?: (dirty: boolean) => void;
}

const SmartNoteImporter: React.FC<SmartNoteImporterProps> = ({ onNoteGenerated, clientId: initialId, onDirtyChange }) => {
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState(initialId || '');
    const [rawText, setRawText] = useState('');
    const [formattedNote, setFormattedNote] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [noteFormat, setNoteFormat] = useState<'SOAP' | 'DAP'>('SOAP');
    // The AI-formatted pane is collapsed by default so the Raw Input gets the full
    // height for live typing during a session; it auto-expands after formatting.
    const [showFormatted, setShowFormatted] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const load = async () => {
            const data = await getClients();
            setClients(data);
            if (!initialId && data.length > 0) setSelectedClientId(data[0].id);
        };
        load();
    }, [initialId]);

    // Let an optional host know whether there is unsaved content (for close guards).
    useEffect(() => {
        onDirtyChange?.(!!(rawText.trim() || formattedNote.trim()));
    }, [rawText, formattedNote, onDirtyChange]);

    const handleAIFormat = async () => {
        if (!rawText.trim()) return;
        setIsProcessing(true);
        try {
            const clientName = clients.find(c => c.id === selectedClientId)?.name || "Client";
            const note = await generateSoapNoteFromTranscript(rawText, clientName, noteFormat);
            setFormattedNote(note);
            setShowFormatted(true);
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSave = async () => {
        if (!selectedClientId) return;
        setIsSaving(true);
        try {
            await saveClinicalNote(selectedClientId, formattedNote || rawText, { noteFormat });
            onNoteGenerated(formattedNote || rawText);
        } catch (e) {
            alert("Error saving note");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            recognitionRef.current?.stop();
            setIsRecording(false);
        } else {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = true;
                recognitionRef.current.interimResults = true;
                recognitionRef.current.onresult = (e: any) => {
                    let t = '';
                    for (let i = e.resultIndex; i < e.results.length; ++i) {
                        if (e.results[i].isFinal) t += e.results[i][0].transcript + ' ';
                    }
                    setRawText(prev => prev + t);
                };
                recognitionRef.current.start();
                setIsRecording(true);
            }
        }
    };

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Toolbar — wraps at narrow width so it never overflows a docked panel. */}
            <div className="mb-4 flex flex-wrap justify-between items-center gap-3 bg-gray-50 dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700">
                {!initialId ? (
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-wide">Client:</span>
                        <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="p-2 border-none bg-transparent font-bold text-gray-900 dark:text-white focus:ring-0 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors max-w-[180px] truncate">
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 px-2 min-w-0">
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-wide">Record For:</span>
                        <span className="font-bold text-primary truncate">{clients.find(c => c.id === initialId)?.name}</span>
                    </div>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Note format toggle — therapist chooses SOAP (default) or DAP per note. */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide hidden sm:inline">Format:</span>
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-700 rounded-full p-1 shadow-sm border border-gray-100 dark:border-slate-600">
                            {(['SOAP', 'DAP'] as const).map(fmt => (
                                <button
                                    key={fmt}
                                    onClick={() => { setNoteFormat(fmt); setFormattedNote(''); setShowFormatted(false); }}
                                    title={fmt === 'DAP' ? 'Data / Assessment / Plan' : 'Subjective / Objective / Assessment / Plan'}
                                    className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wide transition-all ${noteFormat === fmt ? 'bg-primary text-white shadow' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
                                >
                                    {fmt}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={toggleRecording} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all shadow-sm ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-red-500/50' : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100'}`}>
                        {isRecording ? <><MicOff size={14}/> Stop</> : <><Mic size={14}/> Dictate</>}
                    </button>
                </div>
            </div>

            {/* Body — single-column stack so it stays comfortable at narrow (docked)
                width: Raw Input is the primary, always-ready typing surface; the AI
                pane stacks below and is collapsible (never a 2-column squeeze). */}
            <div className="flex-1 min-h-0 flex flex-col gap-3">
                {/* Raw Input (primary) */}
                <div className="flex flex-col flex-1 min-h-0">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold uppercase text-gray-500 tracking-wider flex items-center gap-2"><FileText size={14}/> Raw Input</label>
                        {rawText && <button onClick={() => setRawText('')} title="Clear" className="text-xs text-gray-400 hover:text-red-500 transition"><Eraser size={14}/></button>}
                    </div>
                    <textarea
                        className="flex-1 w-full p-4 border border-gray-200 dark:border-slate-700 rounded-2xl bg-gray-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none resize-none font-mono text-sm leading-relaxed transition-all shadow-inner min-h-[160px]"
                        placeholder="Type session notes here as the session goes, or use Dictate…"
                        value={rawText}
                        onChange={e => setRawText(e.target.value)}
                    />
                </div>

                {/* AI Output (collapsible, stacked below) */}
                <div className="flex flex-col flex-shrink-0">
                    <div className="flex justify-between items-center mb-2 gap-2">
                        <button onClick={() => setShowFormatted(s => !s)} className="text-xs font-bold uppercase text-indigo-500 flex items-center gap-1.5 tracking-wider hover:text-indigo-600 transition-colors">
                            <Sparkles size={14} className="fill-indigo-500"/> Structured {noteFormat}
                            {showFormatted ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}
                        </button>
                        <button onClick={handleAIFormat} disabled={!rawText.trim() || isProcessing} className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm hover:shadow-indigo-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95">
                            {isProcessing ? <Loader2 className="animate-spin" size={14}/> : <Sparkles size={14}/>}
                            Format with AI
                        </button>
                    </div>
                    {showFormatted && (
                        <textarea
                            className="w-full p-4 border border-indigo-100 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none resize-none text-sm leading-relaxed shadow-sm transition-all h-44"
                            placeholder="AI-formatted note appears here. You can edit it before saving."
                            value={formattedNote}
                            onChange={e => setFormattedNote(e.target.value)}
                        />
                    )}
                </div>
            </div>

            {/* Footer — Save persists via saveClinicalNote (unchanged path & formats). */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 flex justify-end flex-shrink-0">
                <button
                    onClick={handleSave}
                    disabled={isSaving || (!formattedNote && !rawText)}
                    className="w-full sm:w-auto justify-center bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 flex items-center gap-2 shadow-lg shadow-green-600/20 hover:shadow-green-600/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none"
                >
                    {isSaving ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18} />}
                    {isSaving ? 'Saving to Record...' : 'Save Note'}
                </button>
            </div>
        </div>
    );
};

export default SmartNoteImporter;
