import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import ClientTypeAhead from '../ui/ClientTypeAhead';
import { Client } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { toLocalYMD } from '../../config/time';
import { GROUP_DECLARED_TYPES, declaredTypeById, defaultDeclaredTypeFor } from '../../config/groupNote';
import {
    WeeklyGroup, GroupEnrollmentRow, GroupSessionRecord,
    getGroupRoster, getGroupSession, getClients, submitGroupSession,
    getGroupAttendanceDraft, saveGroupAttendanceDraft,
} from '../../services/api';
import { Users, Loader2, CheckCircle2, UserMinus, UserPlus, FileSignature, Save } from 'lucide-react';

// L2 GROUP NOTE (David 7/15 + 7/28). The counselor clicks the weekly block →
// this note, pre-populated with every ASSIGNED client. Adding a makeup or
// removing an absence here applies to THIS session only — the standing
// enrollment is never touched. On submit, every attendee gets the declared
// type + date + units on their Services tab (per-seat appointment + note).
// Required fields follow David's group-note spec and BLOCK submit.

interface GroupNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    group: WeeklyGroup | null;
    date: Date | null;
    onSubmitted?: () => void;
}

const hhmm = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : '');

const GroupNoteModal: React.FC<GroupNoteModalProps> = ({ isOpen, onClose, group, date, onSubmitted }) => {
    const { user } = useAuth();
    const sessionDate = date ? toLocalYMD(date) : '';

    const [loading, setLoading] = useState(true);
    const [existing, setExisting] = useState<GroupSessionRecord | null>(null);
    const [roster, setRoster] = useState<GroupEnrollmentRow[]>([]);
    const [absent, setAbsent] = useState<Set<string>>(new Set());
    const [makeups, setMakeups] = useState<{ clientId: string; clientName: string }[]>([]);
    const [allClients, setAllClients] = useState<Client[]>([]);
    const [makeupPick, setMakeupPick] = useState<string | undefined>(undefined);

    const [timeStarted, setTimeStarted] = useState('');
    const [timeEnded, setTimeEnded] = useState('');
    const [units, setUnits] = useState('');
    const [declaredTypeId, setDeclaredTypeId] = useState('');
    const [staffName, setStaffName] = useState('');
    const [staffCredentials, setStaffCredentials] = useState('');
    const [narrative, setNarrative] = useState('');
    const [signature, setSignature] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showMissing, setShowMissing] = useState(false);
    // B1: save who showed up NOW, write the narrative later. A separate,
    // deliberate action from Submit — never autosave, never required-gated.
    const [isSavingAttendance, setIsSavingAttendance] = useState(false);
    const [attendanceSaved, setAttendanceSaved] = useState(false);

    // Load roster + any already-submitted note whenever the modal opens.
    useEffect(() => {
        if (!isOpen || !group || !sessionDate) return;
        setLoading(true);
        setError(null);
        setShowMissing(false);
        setAbsent(new Set());
        setMakeups([]);
        setMakeupPick(undefined);
        setAttendanceSaved(false);
        setTimeStarted(hhmm(group.startLocal));
        setTimeEnded(hhmm(group.endLocal));
        setUnits('');
        setDeclaredTypeId(defaultDeclaredTypeFor(group.sessionKind)?.id ?? '');
        setStaffName(user?.name ?? '');
        setStaffCredentials('');
        setNarrative('');
        setSignature('');
        Promise.all([
            getGroupSession(group.id, sessionDate),
            getGroupRoster(group.id, sessionDate),
            getClients().catch(() => [] as Client[]),
            getGroupAttendanceDraft(group.id, sessionDate),
        ]).then(([sess, ros, cls, draft]) => {
            setExisting(sess);
            setRoster(ros);
            setAllClients(cls);
            // Restore a saved-but-not-submitted attendance mark. Skipped when the
            // note is already submitted (`sess` truthy) — the real attendee list
            // takes over and any leftover draft is stale, ignorable clutter.
            if (!sess && draft.length) {
                setAbsent(new Set(draft.filter(d => d.source === 'standing').map(d => d.clientId)));
                const makeupIds = new Set(draft.filter(d => d.source === 'makeup').map(d => d.clientId));
                setMakeups(cls.filter(c => makeupIds.has(c.id)).map(c => ({ clientId: c.id, clientName: c.name })));
            }
        }).catch(e => setError(e?.message || 'Could not load the group roster.'))
          .finally(() => setLoading(false));
    }, [isOpen, group?.id, sessionDate]);   // eslint-disable-line react-hooks/exhaustive-deps

    // Any attendance edit after a save invalidates the "Saved" confirmation.
    useEffect(() => { setAttendanceSaved(false); }, [absent, makeups]);

    const handleSaveAttendance = async () => {
        if (!group) return;
        setIsSavingAttendance(true);
        setError(null);
        try {
            const entries = [
                ...Array.from(absent).map(clientId => ({ clientId, source: 'standing' as const })),
                ...makeups.map(m => ({ clientId: m.clientId, source: 'makeup' as const })),
            ];
            await saveGroupAttendanceDraft(group.id, sessionDate, entries);
            setAttendanceSaved(true);
        } catch (e: any) {
            setError(e?.message || 'Failed to save attendance.');
        } finally {
            setIsSavingAttendance(false);
        }
    };

    useEffect(() => { if (user?.name) setStaffName(prev => prev || user.name); }, [user?.name]);

    const attendees = useMemo(() => {
        const standing = roster
            .filter(r => !absent.has(r.clientId))
            .map(r => ({ clientId: r.clientId, clientName: r.clientName, source: 'standing' as const }));
        return [...standing, ...makeups.map(m => ({ ...m, source: 'makeup' as const }))];
    }, [roster, absent, makeups]);

    const missingRequired = useMemo(() => {
        const missing: string[] = [];
        if (!sessionDate) missing.push('Date');
        if (!timeStarted) missing.push('Time started');
        if (!timeEnded) missing.push('Time ended');
        const u = parseInt(units, 10);
        if (!units || Number.isNaN(u) || u < 1 || u > 12) missing.push('Units (1–12)');
        if (!declaredTypeId) missing.push('Type');
        if (!staffName.trim()) missing.push('Staff name');
        if (!staffCredentials.trim()) missing.push('Credentials');
        if (!narrative.trim()) missing.push('Narrative');
        if (!signature.trim()) missing.push('Staff signature');
        if (attendees.length === 0) missing.push('At least one attendee');
        return missing;
    }, [sessionDate, timeStarted, timeEnded, units, declaredTypeId, staffName, staffCredentials, narrative, signature, attendees.length]);

    const addMakeup = (clientId: string | undefined) => {
        setMakeupPick(clientId);
        if (!clientId) return;
        const c = allClients.find(x => x.id === clientId);
        if (!c) return;
        const already = roster.some(r => r.clientId === clientId && !absent.has(clientId)) || makeups.some(m => m.clientId === clientId);
        if (!already) setMakeups(ms => [...ms, { clientId: c.id, clientName: c.name }]);
        setMakeupPick(undefined);
    };

    const handleSubmit = async () => {
        if (!group) return;
        if (missingRequired.length > 0) { setShowMissing(true); return; }
        const declared = declaredTypeById(declaredTypeId)!;
        setIsSaving(true);
        setError(null);
        try {
            await submitGroupSession({
                group,
                sessionDate,
                timeStarted,
                timeEnded,
                declaredTypeId: declared.id,
                declaredTypeLabel: declared.label,
                serviceType: declared.serviceType,
                units: parseInt(units, 10),
                narrative: narrative.trim(),
                staffName: signature.trim() || staffName.trim(),
                staffCredentials: staffCredentials.trim() || undefined,
                therapistId: user?.id ? String(user.id) : undefined,
                attendees,
            });
            onSubmitted?.();
            onClose();
        } catch (e: any) {
            setError(e?.message || 'Failed to submit the group note.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !group || !date) return null;

    const title = `${group.program} — ${group.counselorName ?? 'Group'}`;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-2xl">
            <div className="p-5 space-y-5">
                {loading ? (
                    <div className="py-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Loading roster…</div>
                ) : existing ? (
                    // Already submitted — show the record, never double-credit.
                    <div className="space-y-4">
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl">
                            <p className="flex items-center gap-2 text-sm font-black text-emerald-800 dark:text-emerald-200">
                                <CheckCircle2 size={16} /> Group note already submitted for {new Date(sessionDate + 'T00:00:00').toLocaleDateString()}
                            </p>
                            <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 mt-1">
                                {declaredTypeById(existing.declaredType)?.label ?? existing.declaredType} · {existing.units} unit{existing.units === 1 ? '' : 's'} · {hhmm(existing.startedAt)}–{hhmm(existing.endedAt)} · by {existing.staffName}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Attendees credited ({existing.attendees.length})</p>
                            <ul className="space-y-1">
                                {existing.attendees.map(a => (
                                    <li key={a.clientId} className="text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                        {/* David, 8/5 markup: drop the "makeup" designation — present
                                            or absent is all he needs. Everyone credited on this note
                                            reads the same. The attendees.source column still records
                                            how the seat arose (standing roster vs added here), which
                                            is a factual audit detail; it is simply not a label the
                                            clinician is shown or has to reason about. */}
                                        <Users size={13} className="text-slate-400" /> {a.clientName}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap border-t border-slate-100 dark:border-slate-800 pt-3">{existing.narrative}</p>
                    </div>
                ) : (
                    <>
                        {error && <p className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl text-xs font-medium text-red-700 dark:text-red-300">{error}</p>}

                        {/* Required fields — David's group-note spec, asterisked, block submit. */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">Date <span className="text-rose-500">*</span></label>
                                <input type="date" value={sessionDate} disabled
                                    className="w-full p-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 opacity-80" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">Started <span className="text-rose-500">*</span></label>
                                <input type="time" value={timeStarted} onChange={e => setTimeStarted(e.target.value)}
                                    className="w-full p-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">Ended <span className="text-rose-500">*</span></label>
                                <input type="time" value={timeEnded} onChange={e => setTimeEnded(e.target.value)}
                                    className="w-full p-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">Units (1–12) <span className="text-rose-500">*</span></label>
                                <input type="number" min={1} max={12} value={units} onChange={e => setUnits(e.target.value)} placeholder="e.g. 8"
                                    className="w-full p-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">Type <span className="text-rose-500">*</span></label>
                                {/* Deb's groups (alternating / MRT) declare Ed or Cns HERE, never in advance. */}
                                <select value={declaredTypeId} onChange={e => setDeclaredTypeId(e.target.value)}
                                    className="w-full p-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-semibold">
                                    <option value="">Declare the session type…</option>
                                    {GROUP_DECLARED_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">Staff name <span className="text-rose-500">*</span></label>
                                <input type="text" value={staffName} onChange={e => setStaffName(e.target.value)}
                                    className="w-full p-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">Credentials <span className="text-rose-500">*</span></label>
                                <input type="text" value={staffCredentials} onChange={e => setStaffCredentials(e.target.value)} placeholder="e.g. CRADC"
                                    className="w-full p-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" />
                            </div>
                        </div>

                        {/* Attendees — pre-populated from the standing assignment; edits are for
                            THIS session only. */}
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                                Attendees <span className="text-rose-500">*</span> — {attendees.length} of {roster.length + makeups.length} listed
                            </p>
                            {roster.length === 0 && makeups.length === 0 && (
                                <p className="text-xs text-slate-400 italic mb-2">No clients are assigned to this group yet. Assign clients from their client page, or add one below.</p>
                            )}
                            <ul className="space-y-1.5">
                                {roster.map(r => {
                                    const isAbsent = absent.has(r.clientId);
                                    return (
                                        <li key={r.id} className={`flex items-center justify-between gap-2 p-2 rounded-lg border ${isAbsent ? 'border-slate-200 dark:border-slate-700 opacity-50' : 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10'}`}>
                                            <span className={`text-sm font-semibold ${isAbsent ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>{r.clientName}</span>
                                            <button type="button"
                                                onClick={() => setAbsent(s => { const n = new Set(s); n.has(r.clientId) ? n.delete(r.clientId) : n.add(r.clientId); return n; })}
                                                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-rose-600">
                                                <UserMinus size={12} /> {isAbsent ? 'Mark present' : 'Absent today'}
                                            </button>
                                        </li>
                                    );
                                })}
                                {/* Same neutral treatment as a standing-roster row — no indigo
                                    "makeup" styling, no badge. An added client is just present. */}
                                {makeups.map(m => (
                                    <li key={m.clientId} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{m.clientName}</span>
                                        <button type="button" onClick={() => setMakeups(ms => ms.filter(x => x.clientId !== m.clientId))}
                                            className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-rose-600">Remove</button>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-2">
                                <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1 flex items-center gap-1"><UserPlus size={11} /> Add a client to this session</label>
                                <ClientTypeAhead clients={allClients} value={makeupPick} onChange={addMakeup} />
                            </div>
                            {/* B1: mark who showed up now, write the narrative later — persists
                                independently of Submit below, which still needs every required
                                field filled. Reopening this occurrence restores these marks. */}
                            <div className="mt-3 flex items-center gap-3">
                                <button type="button" onClick={handleSaveAttendance} disabled={isSavingAttendance}
                                    title="Save who's here — the note itself can wait"
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60">
                                    {isSavingAttendance ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                                    {isSavingAttendance ? 'Saving…' : 'Save attendance'}
                                </button>
                                {attendanceSaved && (
                                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                        <CheckCircle2 size={13} /> Saved — write the note whenever you're ready
                                    </span>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">Narrative <span className="text-rose-500">*</span></label>
                            <textarea value={narrative} onChange={e => setNarrative(e.target.value)} rows={5}
                                placeholder="Group narrative — stored verbatim on every attendee's note."
                                className="w-full p-3 text-sm border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 whitespace-pre-wrap" />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">Staff signature <span className="text-rose-500">*</span></label>
                            <input type="text" value={signature} onChange={e => setSignature(e.target.value)} placeholder="Type full name to sign"
                                className="w-full p-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 font-serif italic" />
                        </div>

                        {showMissing && missingRequired.length > 0 && (
                            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                                The note isn't complete — required: {missingRequired.join(', ')}.
                            </p>
                        )}

                        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors">Cancel</button>
                            <button onClick={handleSubmit} disabled={isSaving}
                                title={missingRequired.length > 0 ? `Required: ${missingRequired.join(', ')}` : 'Submit — credits every attendee'}
                                className="px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-focus font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all disabled:opacity-70">
                                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <FileSignature size={16} />}
                                {isSaving ? 'Submitting…' : `Submit — credit ${attendees.length} attendee${attendees.length === 1 ? '' : 's'}`}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default GroupNoteModal;
