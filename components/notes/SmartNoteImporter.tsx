import React, { useState, useRef, useEffect } from 'react';
import { generateSoapNoteFromTranscript, saveClinicalNote, getClients } from '../../services/api';
import { Client } from '../../types';
import { Sparkles, Loader2, Save, Mic, MicOff, SplitSquareHorizontal, ArrowRight, Eraser, FileText, CheckCircle } from 'lucide-react';

interface SmartNoteImporterProps {
    onNoteGenerated: (note: string) => void;
    clientId?: string;
}

const SmartNoteImporter: React.FC<SmartNoteImporterProps> = ({ onNoteGenerated, clientId: initialId }) => {
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState(initialId || '');
    const [rawText, setRawText] = useState('');
    const [formattedNote, setFormattedNote] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const load = async () => {
            const data = await getClients();
            setClients(data);
            if (!initialId && data.length > 0) setSelectedClientId(data[0].id);
        };
        load();
    }, [initialId]);

    const handleAIFormat = async () => {
        if (!rawText.trim()) return;
        setIsProcessing(true);
        try {
            const clientName = clients.find(c => c.id === selectedClientId)?.name || "Client";
            const note = await generateSoapNoteFromTranscript(rawText, clientName);
            setFormattedNote(note);
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
            await saveClinicalNote(selectedClientId, formattedNote || rawText);
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
        <div className="flex flex-col h-[70vh]">
            <div className="mb-6 flex justify-between items-center bg-gray-50 dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700">
                {!initialId ? (
                    <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-wide">Client:</span>
                        <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="p-2 border-none bg-transparent font-bold text-gray-900 dark:text-white focus:ring-0 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 px-2">
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-wide">Record For:</span>
                        <span className="font-bold text-primary">{clients.find(c => c.id === initialId)?.name}</span>
                    </div>
                )}
                
                <div className="flex gap-2">
                    <button onClick={toggleRecording} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all shadow-sm ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-red-500/50' : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100'}`}>
                        {isRecording ? <><MicOff size={14}/> Stop</> : <><Mic size={14}/> Dictate</>}
                    </button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
                {/* Left: Raw Input */}
                <div className="flex flex-col relative group">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold uppercase text-gray-500 tracking-wider flex items-center gap-2"><FileText size={14}/> Raw Input</label>
                        {rawText && <button onClick={() => setRawText('')} className="text-xs text-gray-400 hover:text-red-500 transition"><Eraser size={14}/></button>}
                    </div>
                    <textarea 
                        className="flex-1 w-full p-5 border border-gray-200 dark:border-slate-700 rounded-2xl bg-gray-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none resize-none font-mono text-sm leading-relaxed transition-all shadow-inner"
                        placeholder="Type session notes here or use Dictation..."
                        value={rawText}
                        onChange={e => setRawText(e.target.value)}
                    />
                    
                    {/* Floating Action for Conversion */}
                    <div className="absolute top-1/2 -right-3 transform -translate-y-1/2 z-10 hidden md:block">
                        <div className="bg-white dark:bg-slate-800 p-1.5 rounded-full shadow-lg border border-gray-100 dark:border-slate-600 text-gray-400">
                            <ArrowRight size={16} />
                        </div>
                    </div>
                </div>

                {/* Right: AI Output */}
                <div className="flex flex-col relative">
                    <label className="text-xs font-bold uppercase text-indigo-500 mb-2 flex items-center gap-2 tracking-wider">
                        <Sparkles size={14} className="fill-indigo-500"/> Structured SOAP
                    </label>
                    <div className="flex-1 relative group">
                        <textarea 
                            className="w-full h-full p-5 border border-indigo-100 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none resize-none text-sm leading-relaxed shadow-sm transition-all"
                            placeholder="AI formatted note will appear here..."
                            value={formattedNote}
                            onChange={e => setFormattedNote(e.target.value)}
                        />
                        {!formattedNote && rawText && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-[2px] rounded-2xl transition-all">
                                <button onClick={handleAIFormat} disabled={isProcessing} className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-8 py-3 rounded-full font-bold shadow-xl shadow-indigo-500/30 hover:scale-105 hover:shadow-indigo-500/50 transition-all flex items-center gap-3 active:scale-95">
                                    {isProcessing ? <Loader2 className="animate-spin" size={20}/> : <SplitSquareHorizontal size={20} />}
                                    <span>Format with AI</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-3">
                <button 
                    onClick={handleSave} 
                    disabled={isSaving || (!formattedNote && !rawText)} 
                    className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 flex items-center gap-2 shadow-lg shadow-green-600/20 hover:shadow-green-600/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none"
                >
                    {isSaving ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18} />}
                    {isSaving ? 'Saving to Record...' : 'Save Note'}
                </button>
            </div>
        </div>
    );
};

export default SmartNoteImporter;