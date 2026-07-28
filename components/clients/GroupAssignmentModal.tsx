import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { Client } from '../../types';
import { toLocalYMD } from '../../config/time';
import {
    WeeklyGroup, getWeeklyGroups, getClientGroupEnrollments,
    enrollClientInGroups, removeGroupEnrollment,
} from '../../services/api';
import { Users, Loader2, CheckCircle2 } from 'lucide-react';

// L2 STANDING ASSIGNMENT (David 7/15 + 7/28). Groups are OPEN — clients join
// and leave continuously. Multi-select (a client may be in 1 to 4 groups a
// week); staff choose a START date; there is deliberately NO end-date field
// anywhere (David: "if I give a time ending on this, I think we're going to
// run into problems"). An assignment persists in perpetuity until manually
// removed here.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hhmm = (t: string) => String(t).slice(0, 5);

interface GroupAssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client;
}

const GroupAssignmentModal: React.FC<GroupAssignmentModalProps> = ({ isOpen, onClose, client }) => {
    const [groups, setGroups] = useState<WeeklyGroup[]>([]);
    const [enrollments, setEnrollments] = useState<{ id: string; groupId: string; enrolledAt: string }[]>([]);
    const [checked, setChecked] = useState<Set<string>>(new Set()); // groupIds to ADD
    const [startDate, setStartDate] = useState(() => toLocalYMD(new Date()));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmRemove, setConfirmRemove] = useState<{ id: string; label: string } | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const [gs, es] = await Promise.all([getWeeklyGroups(), getClientGroupEnrollments(client.id)]);
            gs.sort((a, b) => a.weekday - b.weekday || String(a.startLocal).localeCompare(String(b.startLocal)));
            setGroups(gs);
            setEnrollments(es);
            setChecked(new Set());
        } catch (e: any) {
            setError(e?.message || 'Could not load groups.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) { setStartDate(toLocalYMD(new Date())); setConfirmRemove(null); load(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, client.id]);

    const enrollmentByGroup = useMemo(() => new Map(enrollments.map(e => [e.groupId, e])), [enrollments]);
    const groupLabel = (g: WeeklyGroup) =>
        `${WEEKDAYS[g.weekday]} ${hhmm(g.startLocal)}–${hhmm(g.endLocal)} · ${g.program} · ${g.counselorName ?? ''}`;

    const handleAdd = async () => {
        if (!checked.size) return;
        setSaving(true);
        setError(null);
        try {
            await enrollClientInGroups(client.id, Array.from(checked), startDate);
            await load();
        } catch (e: any) {
            setError(e?.message || 'Enrollment failed.');
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async (enrollmentId: string) => {
        setSaving(true);
        setError(null);
        try {
            await removeGroupEnrollment(enrollmentId);
            setConfirmRemove(null);
            await load();
        } catch (e: any) {
            setError(e?.message || 'Removal failed.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Groups — ${client.name}`} maxWidth="max-w-xl">
            <div className="p-5 space-y-4">
                {error && <p className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl text-xs font-medium text-red-700 dark:text-red-300">{error}</p>}
                {loading ? (
                    <div className="py-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Loading groups…</div>
                ) : (
                    <>
                        <p className="text-xs text-slate-500">
                            Open groups — assignment starts on the chosen date and persists <b>until manually removed</b>. There is no end date.
                        </p>
                        <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                            {groups.map(g => {
                                const enr = enrollmentByGroup.get(g.id);
                                return (
                                    <li key={g.id} className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border ${enr ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-700'}`}>
                                        <label className="flex items-center gap-2.5 min-w-0 cursor-pointer">
                                            {enr ? (
                                                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                                            ) : (
                                                <input
                                                    type="checkbox"
                                                    checked={checked.has(g.id)}
                                                    onChange={() => setChecked(s => { const n = new Set(s); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n; })}
                                                    className="rounded shrink-0"
                                                />
                                            )}
                                            <span className="min-w-0">
                                                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{groupLabel(g)}</span>
                                                {enr && <span className="block text-[10px] text-emerald-700 dark:text-emerald-300 font-bold uppercase tracking-wide">Member since {new Date(enr.enrolledAt + 'T00:00:00').toLocaleDateString()}</span>}
                                            </span>
                                        </label>
                                        {enr && (
                                            confirmRemove?.id === enr.id ? (
                                                <span className="flex items-center gap-1.5 shrink-0">
                                                    <button onClick={() => handleRemove(enr.id)} disabled={saving} className="text-[10px] font-black uppercase text-rose-600 hover:text-rose-700">Confirm remove</button>
                                                    <button onClick={() => setConfirmRemove(null)} className="text-[10px] font-bold uppercase text-slate-400">Keep</button>
                                                </span>
                                            ) : (
                                                <button onClick={() => setConfirmRemove({ id: enr.id, label: groupLabel(g) })} className="shrink-0 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-rose-600">
                                                    Remove
                                                </button>
                                            )
                                        )}
                                    </li>
                                );
                            })}
                        </ul>

                        <div className="flex items-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">Start date</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                    className="p-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800" />
                            </div>
                            <button
                                onClick={handleAdd}
                                disabled={saving || checked.size === 0}
                                className="ml-auto px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-focus font-bold text-sm flex items-center gap-2 shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="animate-spin" size={15} /> : <Users size={15} />}
                                Assign to {checked.size || ''} group{checked.size === 1 ? '' : 's'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default GroupAssignmentModal;
