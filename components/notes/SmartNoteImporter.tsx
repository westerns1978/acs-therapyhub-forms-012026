import React, { useState, useRef, useEffect, useMemo } from 'react';
import { generateSoapNoteFromTranscript, saveClinicalNote, getClients, getClientAppointments } from '../../services/api';
import { Client, Appointment } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { toLocalYMD, formatTime12 } from '../../config/time';
import { Sparkles, Loader2, Mic, MicOff, Eraser, FileText, CheckCircle, ChevronDown, ChevronUp, FileSignature, Link2 } from 'lucide-react';

interface SmartNoteImporterProps {
    onNoteGenerated: (note: string) => void;
    clientId?: string;
    /** Optional: reports whether there is unsaved note text, so a host (e.g. the
     *  dockable side panel) can guard against an accidental close mid-session. */
    onDirtyChange?: (dirty: boolean) => void;
}

const SmartNoteImporter: React.FC<SmartNoteImporterProps> = ({ onNoteGenerated, clientId: initialId, onDirtyChange }) => {
    const { user } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    // Free-choice selection, used ONLY when the dock was opened without a client
    // (generic nav entry). When `initialId` is supplied it wins outright — see
    // targetClientId below. Never read this directly for a write.
    const [selectedClientId, setSelectedClientId] = useState(initialId || '');
    const [rawText, setRawText] = useState('');
    const [formattedNote, setFormattedNote] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSigning, setIsSigning] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [noteFormat, setNoteFormat] = useState<'SOAP' | 'DAP'>('SOAP');
    // The AI-formatted pane is collapsed by default so the Raw Input gets the full
    // height for live typing during a session; it auto-expands after formatting.
    const [showFormatted, setShowFormatted] = useState(false);
    const recognitionRef = useRef<any>(null);

    // ── L3 required fields (David 7/15 — structure is specified, don't invent) ──
    // Date | Time started/ended | Units 1-12 | Client | Tx Plan problems addressed |
    // Staff name + credentials | Narrative | Staff signature + date | Submit.
    // Required fields get an asterisk and BLOCK submit ("that field has to be
    // filled or the note isn't complete"). Save draft stays open so mid-session
    // text is never lost; SIGN is the submit that completes the note.
    const [serviceDate, setServiceDate] = useState<string>(() => toLocalYMD(new Date()));
    const [timeStarted, setTimeStarted] = useState('');
    const [timeEnded, setTimeEnded] = useState('');
    const [units, setUnits] = useState<string>('');
    const [problemsAddressed, setProblemsAddressed] = useState('');
    const [staffName, setStaffName] = useState<string>(user?.name ?? '');
    const [staffCredentials, setStaffCredentials] = useState('');
    const [showMissing, setShowMissing] = useState(false);

    const missingRequired = useMemo(() => {
        const missing: string[] = [];
        if (!targetOrEmpty()) missing.push('Client');
        if (!serviceDate) missing.push('Date');
        if (!timeStarted) missing.push('Time started');
        if (!timeEnded) missing.push('Time ended');
        const u = parseInt(units, 10);
        if (!units || Number.isNaN(u) || u < 1 || u > 12) missing.push('Units (1–12)');
        if (!problemsAddressed.trim()) missing.push('Tx Plan problems addressed');
        if (!staffName.trim()) missing.push('Staff name');
        if (!staffCredentials.trim()) missing.push('Credentials');
        if (!(formattedNote.trim() || rawText.trim())) missing.push('Narrative');
        return missing;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serviceDate, timeStarted, timeEnded, units, problemsAddressed, staffName, staffCredentials, formattedNote, rawText, initialId, selectedClientId]);
    function targetOrEmpty() { return initialId || selectedClientId; }

    // ── The single source of truth for WHICH CHART this note lands on ───────────
    // When the dock is opened from a client header, `initialId` IS the target and
    // local selection is irrelevant. Deriving it this way makes the header label
    // and the save target structurally incapable of diverging.
    //
    // They used to diverge: `selectedClientId` was seeded by a useState initializer
    // that runs once, and the loader effect below only assigns it in the
    // `!initialId` branch. The dock stays mounted while minimized, so opening the
    // Note Studio on client A, minimizing, then clicking "Note" on client B left
    // the header rendering B's name (it reads initialId) while every save call
    // still passed A's id — a note written for B filed to A's chart. Silent
    // misattribution, which is worse than exposure: nothing looks wrong afterward.
    const targetClientId = initialId || selectedClientId;

    // ── DEFERRED #44: header-written notes never linked to a session ───────────
    // The header's "Start typed or dictated note" button (initialId set, no
    // appointment in scope) is the one entry point that can silently orphan a
    // note — no star on the calendar, no unit precedence, a duplicate Services
    // row. Fix shape (DEFERRED.md #44): offer to attach to a recent/same-day
    // appointment, default UNLINKED — never guess. Appointment-scoped entry
    // points (Start transcribed session, group note) already pass an
    // appointmentId and don't need this picker.
    const [recentAppointments, setRecentAppointments] = useState<Appointment[]>([]);
    const [attachAppointmentId, setAttachAppointmentId] = useState('');

    useEffect(() => {
        if (!initialId) { setRecentAppointments([]); setAttachAppointmentId(''); return; }
        let cancelled = false;
        (async () => {
            try {
                const appts = await getClientAppointments(initialId);
                const todayYMD = toLocalYMD(new Date());
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - 3);
                const cutoffYMD = toLocalYMD(cutoff);
                const recent = appts
                    .filter(a => a.status !== 'Canceled')
                    .filter(a => {
                        const ymd = toLocalYMD(new Date(a.date));
                        return ymd >= cutoffYMD && ymd <= todayYMD;
                    })
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                if (!cancelled) { setRecentAppointments(recent); setAttachAppointmentId(''); }
            } catch (e) {
                if (!cancelled) { setRecentAppointments([]); setAttachAppointmentId(''); }
            }
        })();
        return () => { cancelled = true; };
    }, [initialId]);

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

    // Auth resolves async — backfill the staff name once it lands (never stomp an edit).
    useEffect(() => {
        if (user?.name) setStaffName(prev => prev || user.name);
    }, [user?.name]);

    const handleAIFormat = async () => {
        if (!rawText.trim()) return;
        setIsProcessing(true);
        try {
            const clientName = clients.find(c => c.id === targetClientId)?.name || "Client";
            const note = await generateSoapNoteFromTranscript(rawText, clientName, noteFormat);
            setFormattedNote(note);
            setShowFormatted(true);
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    // Structured fields shared by draft-save and sign-submit.
    const structuredOpts = () => ({
        noteFormat,
        serviceDate: serviceDate || undefined,
        timeStarted: timeStarted || undefined,
        timeEnded: timeEnded || undefined,
        units: (() => { const u = parseInt(units, 10); return Number.isNaN(u) ? undefined : u; })(),
        problemsAddressed: problemsAddressed.trim() || undefined,
        staffName: staffName.trim() || undefined,
        staffCredentials: staffCredentials.trim() || undefined,
        therapistId: user?.id ? String(user.id) : undefined,
        appointmentId: attachAppointmentId || undefined,
    });

    const handleSave = async () => {
        if (!targetClientId) return;
        setIsSaving(true);
        try {
            await saveClinicalNote(targetClientId, formattedNote || rawText, structuredOpts());
            onNoteGenerated(formattedNote || rawText);
        } catch (e) {
            alert("Error saving note");
        } finally {
            setIsSaving(false);
        }
    };

    // Signing is a deliberate, separate action from the plain draft Save above —
    // it must never be the default. A signed note is permanent (clinical_notes has
    // no unsign path) and, via saveClinicalNote's isSigned branch, writes a
    // note.signed audit_logs row. The confirm() is the "are you sure" gate; there
    // is no unsign affordance to fall back on if this is clicked by mistake.
    const handleSignAndSave = async () => {
        if (!targetClientId) return;
        // L3 (David): required fields BLOCK submit — the sign is the submit.
        if (missingRequired.length > 0) { setShowMissing(true); return; }
        if (!window.confirm('Sign this note now? Signed notes are permanent and cannot be edited or unsigned afterward.')) return;
        setIsSigning(true);
        try {
            await saveClinicalNote(targetClientId, formattedNote || rawText, { ...structuredOpts(), isSigned: true });
            onNoteGenerated(formattedNote || rawText);
        } catch (e) {
            alert("Error signing note");
        } finally {
            setIsSigning(false);
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
                {/* DEFERRED #44 fix: only offered when opened without an appointment
                    already in scope (initialId + recent sessions found), and only ever
                    an offer — "Not linked" is the default, never a guess. */}
                {initialId && recentAppointments.length > 0 && (
                    <div className="flex items-center gap-2 min-w-0 px-2">
                        <Link2 size={14} className="text-gray-400 flex-shrink-0" />
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Attach to session:</label>
                        <select
                            value={attachAppointmentId}
                            onChange={e => setAttachAppointmentId(e.target.value)}
                            className="p-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 max-w-[220px] truncate"
                        >
                            <option value="">Not linked — standalone note</option>
                            {recentAppointments.map(a => (
                                <option key={a.id} value={a.id}>
                                    {toLocalYMD(new Date(a.date)) === toLocalYMD(new Date()) ? 'Today' : new Date(a.date).toLocaleDateString()} {formatTime12(a.startTime)} · {a.type} ({a.status})
                                </option>
                            ))}
                        </select>
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
                    <button onClick={toggleRecording} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all shadow-sm ${isRecording ? 'bg-primary text-white animate-pulse shadow-primary/50' : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100'}`}>
                        {isRecording ? <><MicOff size={14}/> Stop</> : <><Mic size={14}/> Dictate</>}
                    </button>
                </div>
            </div>

            {/* L3 required fields (David 7/15). Asterisked; the SIGN submit blocks
                until every one is filled. Compact grid so the narrative keeps the
                vertical space in a docked panel. */}
            <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="col-span-1">
                    <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">Date <span className="text-rose-500">*</span></label>
                    <input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)}
                        className="w-full p-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" />
                </div>
                <div className="col-span-1">
                    <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">Started <span className="text-rose-500">*</span></label>
                    <input type="time" value={timeStarted} onChange={e => setTimeStarted(e.target.value)}
                        className="w-full p-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" />
                </div>
                <div className="col-span-1">
                    <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">Ended <span className="text-rose-500">*</span></label>
                    <input type="time" value={timeEnded} onChange={e => setTimeEnded(e.target.value)}
                        className="w-full p-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" />
                </div>
                <div className="col-span-1">
                    <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">Units (1–12) <span className="text-rose-500">*</span></label>
                    <input type="number" min={1} max={12} value={units} onChange={e => setUnits(e.target.value)}
                        placeholder="e.g. 4"
                        className="w-full p-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" />
                </div>
                <div className="col-span-2 sm:col-span-4">
                    <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">Tx Plan problems addressed <span className="text-rose-500">*</span></label>
                    <input type="text" value={problemsAddressed} onChange={e => setProblemsAddressed(e.target.value)}
                        placeholder="Problem number(s) or a full sentence"
                        className="w-full p-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" />
                </div>
                <div className="col-span-1 sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">Staff name <span className="text-rose-500">*</span></label>
                    <input type="text" value={staffName} onChange={e => setStaffName(e.target.value)}
                        className="w-full p-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" />
                </div>
                <div className="col-span-1 sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">Credentials <span className="text-rose-500">*</span></label>
                    <input type="text" value={staffCredentials} onChange={e => setStaffCredentials(e.target.value)}
                        placeholder="e.g. LPC, CRADC"
                        className="w-full p-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" />
                </div>
            </div>

            {/* Body — single-column stack so it stays comfortable at narrow (docked)
                width: Raw Input is the primary, always-ready typing surface; the AI
                pane stacks below and is collapsible (never a 2-column squeeze). */}
            <div className="flex-1 min-h-0 flex flex-col gap-3">
                {/* Raw Input (primary) */}
                <div className="flex flex-col flex-1 min-h-0">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold uppercase text-gray-500 tracking-wider flex items-center gap-2"><FileText size={14}/> Narrative <span className="text-rose-500">*</span></label>
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

            {/* Footer — Save persists an unsigned draft via saveClinicalNote (unchanged
                path & formats). Sign & Save is a separate, deliberate action (confirm()
                gated) that persists WITH isSigned: true — never the default. */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 flex-shrink-0">
                {/* L3: required-field gate — listed plainly when submit was blocked. */}
                {showMissing && missingRequired.length > 0 && (
                    <p className="mb-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                        The note isn't complete — required: {missingRequired.join(', ')}.
                    </p>
                )}
                <div className="flex flex-wrap justify-end gap-3">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isSigning || (!formattedNote && !rawText)}
                        title="Saves an unsigned draft — the note is not complete until signed"
                        className="flex-1 sm:flex-none justify-center bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 flex items-center gap-2 shadow-lg shadow-green-600/20 hover:shadow-green-600/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18} />}
                        {isSaving ? 'Saving to Record...' : 'Save Draft'}
                    </button>
                    <button
                        onClick={handleSignAndSave}
                        disabled={isSaving || isSigning}
                        title={missingRequired.length > 0 ? `Required: ${missingRequired.join(', ')}` : 'Sign this note — permanent, cannot be undone'}
                        className="flex-1 sm:flex-none justify-center bg-slate-900 dark:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold hover:bg-black dark:hover:bg-indigo-800 flex items-center gap-2 shadow-lg shadow-slate-900/20 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none"
                    >
                        {isSigning ? <Loader2 className="animate-spin" size={18}/> : <FileSignature size={18} />}
                        {isSigning ? 'Signing...' : 'Sign & Submit'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SmartNoteImporter;
