import React, { useState, useMemo, useEffect } from 'react';
import { getAppointments, getClients, getCounselors, deleteAppointment, updateAppointment, updateAppointmentStatus, assessLateCancellationFee, cancelSeries, deleteSeries } from '../services/api';
import type { Counselor } from '../services/api';
import { Appointment, AppointmentStatus, Client, isStaffRole, ServiceType } from '../types';
import ScheduleSessionModal from '../components/sessions/ScheduleSessionModal';
import CounselorDayView from '../components/sessions/CounselorDayView';
import CounselorWeekView from '../components/sessions/CounselorWeekView';
import { parseTimeToMinutes, formatTime12 } from '../config/time';
import { serviceCardClass } from '../config/sessionTaxonomy';
import { normalizeCounselorName, laneCounselorIdFor } from '../components/sessions/scheduleLane';
import { timeRangesOverlap } from '../services/recurrence';
import AppointmentStatusModal, { getAppointmentStatusStyle } from '../components/sessions/AppointmentStatusModal';
import type { CancelFeeDecision } from '../components/sessions/AppointmentStatusModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Video, Clock, Check, AlertTriangle } from 'lucide-react';
import { deleteGoogleCalendarEvent } from '../services/googleCalendar';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const SessionManagement: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const canManage = isStaffRole(user?.role);
    // Status actions are staff-wide (office work), but starting a live session writes
    // a CLINICAL note — restrict that entry to Director/Therapist (not Admin/Jessica).
    const canStartSession = !!user && (user.role === 'Director' || user.role === 'Therapist');
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [counselors, setCounselors] = useState<Counselor[]>([]);
    const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
    // Week presentation: 'byCounselor' = David's split-view board (each counselor's whole
    // week as a block, horizontal scroll across counselors — the fix for "the week view
    // merges everyone"); 'merged' = the old flat 7-day grid, kept reachable for office
    // staff who want the everyone-overlaid picture.
    const [weekStyle, setWeekStyle] = useState<'byCounselor' | 'merged'>('byCounselor');
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isScheduleModalOpen, setScheduleModalOpen] = useState(false);
    // Step 9: empty-slot click prefill (counselor + time), cleared whenever the modal closes
    // so the generic "Schedule Session" button never accidentally reuses a stale slot pick.
    const [slotPrefill, setSlotPrefill] = useState<{ counselorId?: string; counselorName?: string; date: Date; time: string } | null>(null);
    const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
    const [savingStatus, setSavingStatus] = useState(false);
    // Calendar load must FAIL VISIBLY — never silently render phantom/mock appointments.
    const [loadError, setLoadError] = useState<string | null>(null);
    const [retryKey, setRetryKey] = useState(0);

    // Opens the live session (ActiveSession → wrap-up → saved note) for this
    // appointment's client. Only reachable when the appointment carries a clientId.
    const handleStartSession = () => {
        const cid = selectedAppt?.clientId;
        if (!cid) return;
        setSelectedAppt(null);
        navigate(`/session/${cid}`);
    };

    // Real Supabase persistence: updateAppointmentStatus writes appointments.status,
    // then we patch local state with the mapped row so the card re-colors immediately
    // and the new status survives a refresh.
    const handleSetStatus = async (status: AppointmentStatus, serviceType?: ServiceType) => {
        if (!selectedAppt) return;
        setSavingStatus(true);
        try {
            const updated = await updateAppointmentStatus(selectedAppt.id, status, serviceType);
            setAppointments(prev => prev.map(a => (a.id === updated.id ? updated : a)));
            setSelectedAppt(updated);
        } catch (err) {
            console.error('[SessionManagement] status update failed:', err);
            alert('Could not update status: ' + (err as Error).message);
        } finally {
            setSavingStatus(false);
        }
    };

    // Late-cancellation fee: when a cancel is inside the 24h window, the modal returns a fee
    // decision (assess / waive). Cancel the appointment first, then post the fee as the current
    // staff user (charges INSERT is is_staff — the same predicate that authorized this cancel,
    // so no SECURITY DEFINER). A fee-insert failure is surfaced but never undoes the cancel.
    const handleCancel = async (decision: CancelFeeDecision) => {
        if (!selectedAppt) return;
        const appt = selectedAppt;
        setSavingStatus(true);
        try {
            const updated = await updateAppointmentStatus(appt.id, 'Canceled');
            setAppointments(prev => prev.map(a => (a.id === updated.id ? updated : a)));
            setSelectedAppt(updated);
            if (decision.fee !== 'none') {
                if (!appt.clientId) {
                    alert('Appointment cancelled. No client is attached to this session, so no late-cancellation fee was assessed.');
                } else {
                    try {
                        const outcome = await assessLateCancellationFee({
                            appointmentId: appt.id,
                            clientId: appt.clientId,
                            startsAt: appt.date,
                            waive: decision.fee === 'waive' ? { reason: decision.reason } : undefined,
                        });
                        if (outcome.alreadyAssessed) {
                            alert('Appointment cancelled. A late-cancellation fee was already on file for it — not charged again.');
                        }
                    } catch (feeErr) {
                        console.error('[SessionManagement] late-cancellation fee failed:', feeErr);
                        alert('The appointment was cancelled, but the late-cancellation fee could not be recorded: ' + (feeErr as Error).message);
                    }
                }
            }
        } catch (err) {
            console.error('[SessionManagement] cancel failed:', err);
            alert('Could not cancel the appointment: ' + (err as Error).message);
        } finally {
            setSavingStatus(false);
        }
    };

    // Hard delete (unchanged behavior): removes the row and its Google Calendar event.
    // Distinct from the soft "Cancel Session" status, which keeps the record.
    const handleDeleteAppointment = async () => {
        const apt = selectedAppt;
        if (!apt) return;
        if (!window.confirm(`Delete "${apt.title}"? This permanently removes the appointment and its Google Calendar event.`)) return;
        setSavingStatus(true);
        try {
            if (apt.googleEventId && user?.id) {
                try {
                    await deleteGoogleCalendarEvent(String(user.id), apt.googleEventId);
                } catch (err) {
                    console.warn('[SessionManagement] Google Calendar delete failed:', err);
                }
            }
            try {
                await deleteAppointment(apt.id);
            } catch (err) {
                console.error('[SessionManagement] DB delete failed:', err);
                alert('Could not delete: ' + (err as Error).message);
                return;
            }
            setAppointments(prev => prev.filter(a => a.id !== apt.id));
            setSelectedAppt(null);
        } finally {
            setSavingStatus(false);
        }
    };

    // Persist a per-occurrence note (appointments.notes). Patches local state so the saved
    // note survives a refresh and the pop-up reflects it immediately.
    const handleSaveNotes = async (notes: string) => {
        if (!selectedAppt) return;
        setSavingStatus(true);
        try {
            const updated = await updateAppointment(selectedAppt.id, { notes });
            setAppointments(prev => prev.map(a => (a.id === updated.id ? updated : a)));
            setSelectedAppt(updated);
        } catch (err) {
            console.error('[SessionManagement] save note failed:', err);
            alert('Could not save the note: ' + (err as Error).message);
        } finally {
            setSavingStatus(false);
        }
    };

    // Step 10: persist a new date/time (and optionally a reassigned counselor) for this
    // occurrence (the modal already ran the overlap check and got an explicit override if
    // needed — this just writes what it decided). counselorName is present only on an actual
    // reassignment, so we write counselor_id + therapist_name together and leave attribution
    // untouched otherwise.
    const handleReschedule = async (date: Date, startTime: string, endTime: string, counselorId?: string, counselorName?: string) => {
        if (!selectedAppt) return;
        setSavingStatus(true);
        try {
            const patch: Partial<Appointment> = { date, startTime, endTime };
            if (counselorName) { patch.counselorId = counselorId; patch.therapist = counselorName; }
            const updated = await updateAppointment(selectedAppt.id, patch);
            setAppointments(prev => prev.map(a => (a.id === updated.id ? updated : a)));
            setSelectedAppt(updated);
        } catch (err) {
            console.error('[SessionManagement] reschedule failed:', err);
            alert('Could not reschedule: ' + (err as Error).message);
        } finally {
            setSavingStatus(false);
        }
    };

    // Series edit-scope. Both bulk ops PROTECT Completed occurrences (accrual). After a bulk
    // change we refetch rather than surgically patch — the simplest correct thing for N rows.
    const handleCancelSeries = async () => {
        const sid = selectedAppt?.seriesId;
        if (!sid) return;
        if (!window.confirm('Cancel all upcoming sessions in this recurring series? Completed sessions are kept.')) return;
        setSavingStatus(true);
        try {
            const { canceled } = await cancelSeries(sid);
            setAppointments(await getAppointments());
            setSelectedAppt(null);
            alert(`Cancelled ${canceled} session${canceled === 1 ? '' : 's'} in the series.`);
        } catch (err) {
            console.error('[SessionManagement] cancel series failed:', err);
            alert('Could not cancel the series: ' + (err as Error).message);
        } finally {
            setSavingStatus(false);
        }
    };

    const handleDeleteSeries = async () => {
        const sid = selectedAppt?.seriesId;
        if (!sid) return;
        if (!window.confirm('Permanently delete the non-completed sessions in this recurring series? Completed sessions are kept.')) return;
        setSavingStatus(true);
        try {
            const { deleted } = await deleteSeries(sid);
            setAppointments(await getAppointments());
            setSelectedAppt(null);
            alert(`Deleted ${deleted} session${deleted === 1 ? '' : 's'} from the series.`);
        } catch (err) {
            console.error('[SessionManagement] delete series failed:', err);
            alert('Could not delete the series: ' + (err as Error).message);
        } finally {
            setSavingStatus(false);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setLoadError(null);
            try {
                // Fetch all appointments; the week/day grids filter client-side per date.
                // Counselors are the day-view lanes (best-effort — a lane-fetch failure must
                // not blank the whole schedule, so it falls back to no lanes, not an error).
                const [apts, cls, cnsl] = await Promise.all([
                    getAppointments(),
                    getClients(),
                    getCounselors().catch(err => { console.warn('[SessionManagement] counselor lanes unavailable:', err); return [] as Counselor[]; }),
                ]);
                setAppointments(apts);
                setClients(cls);
                setCounselors(cnsl);
            } catch (err) {
                // getAppointments rethrows on a real DB error (no mock fallback). Surface a
                // visible error + Retry rather than a hung spinner or fabricated rows.
                console.error('[SessionManagement] failed to load schedule:', err);
                setAppointments([]);
                setLoadError('Could not load the schedule from the records system. Appointments are hidden rather than risk showing stale or placeholder sessions.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [currentDate, retryKey]);

    const startOfWeek = useMemo(() => {
        const d = new Date(currentDate);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }, [currentDate]);

    // Restored flat 7-day week grid (recovered from the pre-step-8 grid this file used to
    // have — see 3de9519, which deleted it when Week was pointed at the lane board). Week
    // is a true Mon–Sun day-column grid again; Day remains the per-counselor lane board.
    const weekDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            days.push(d);
        }
        return days;
    }, [startOfWeek]);

    // By-counselor week board shows the working week. Bump to 7 to include weekends.
    const COUNSELOR_WEEK_DAYS = 5;
    const counselorWeekDays = useMemo(() => weekDays.slice(0, COUNSELOR_WEEK_DAYS), [weekDays]);

    // Header honesty: Week shows the actual date RANGE, never a bare "July 2026"
    // (which read as a month view). e.g. "Jul 6 – 12, 2026" / "Dec 29 – Jan 4, 2026".
    const weekRangeLabel = useMemo(() => {
        const end = new Date(startOfWeek);
        end.setDate(startOfWeek.getDate() + 6);
        const startStr = startOfWeek.toLocaleDateString('default', { month: 'short', day: 'numeric' });
        const endStr = startOfWeek.getMonth() === end.getMonth()
            ? String(end.getDate())
            : end.toLocaleDateString('default', { month: 'short', day: 'numeric' });
        return `${startStr} – ${endStr}, ${end.getFullYear()}`;
    }, [startOfWeek]);

    // Visible window: 6 AM start, 16 rows (matches CounselorDayView so early slots fit).
    const WIN_START = 6;
    const WIN_HOURS = 16;
    const hours = Array.from({ length: WIN_HOURS }, (_, i) => i + WIN_START);

    // Live therapist double-booking detection across the loaded set. Same COUNSELOR (resolved
    // FK-first via counselor_id, normalized-name fallback for the legacy tail — same identity
    // the lane bucketing uses, so the ring and the lane always agree on "whose") + same day +
    // half-open time overlap (the shared recurrence primitive). Both colliding occurrences are
    // flagged. Canceled rows don't count. O(n²) is fine at clinic scale.
    const conflictIds = useMemo(() => {
        const ids = new Set<string>();
        const knownIds = new Set(counselors.map(c => c.id));
        const nameKeyToId = new Map(counselors.map(c => [normalizeCounselorName(c.name), c.id]));
        // Canonical key: the resolved counselor id, else the raw normalized name so two
        // same-name phantoms (e.g. the unattributed "Jessica" rows) still collide with each other.
        const keyOf = (a: Appointment) =>
            laneCounselorIdFor(a, knownIds, nameKeyToId) || normalizeCounselorName(a.therapist);
        const active = appointments.filter(a => a.status !== 'Canceled' && !!keyOf(a));
        for (let i = 0; i < active.length; i++) {
            for (let j = i + 1; j < active.length; j++) {
                const a = active[i], b = active[j];
                if (keyOf(a) !== keyOf(b)) continue;
                if (new Date(a.date).toDateString() !== new Date(b.date).toDateString()) continue;
                if (timeRangesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
                    ids.add(a.id); ids.add(b.id);
                }
            }
        }
        return ids;
    }, [appointments, counselors]);

    // The client behind the selected appointment (for the pop-up's demographics). Matches by
    // uuid clientId; legacy text-id rows won't resolve → demographics block stays hidden.
    const selectedClient = useMemo(
        () => (selectedAppt?.clientId ? clients.find(c => c.id === selectedAppt.clientId) ?? null : null),
        [selectedAppt, clients],
    );

    const getEventStyle = (apt: Appointment) => {
        // Position from the canonical time via config/time.ts. Unparseable → 9 AM slot.
        // Height = the real start→end duration (the old grid hardcoded 50 min, which lied
        // about longer/shorter blocks — the seeded 15-min MRT must read short). 20-min
        // visual floor matches CounselorDayView so a tiny block stays clickable.
        const mins = parseTimeToMinutes(apt.startTime);
        const startMin = Number.isNaN(mins) ? 9 * 60 : mins;
        const endRaw = parseTimeToMinutes(apt.endTime);
        const duration = Math.max((Number.isNaN(endRaw) ? startMin + 50 : endRaw) - startMin, 20);
        const startOffset = startMin - WIN_START * 60;

        return {
            top: `${(startOffset / (WIN_HOURS * 60)) * 100}%`,
            height: `${(duration / (WIN_HOURS * 60)) * 100}%`,
        };
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    };

    if (isLoading) return <LoadingSpinner />;

    if (loadError) {
        return (
            <div className="h-full flex items-center justify-center p-8">
                <div className="max-w-md text-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-amber-200 dark:border-amber-900/40 rounded-2xl shadow-xl p-8">
                    <AlertTriangle className="mx-auto text-amber-500 mb-4" size={40} />
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Schedule unavailable</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{loadError}</p>
                    <button onClick={() => setRetryKey(k => k + 1)} className="px-5 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary-focus transition">Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Header Controls */}
            <div className="flex justify-between items-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-4 rounded-2xl shadow-sm border border-border dark:border-slate-700">
                <div className="flex items-center gap-6">
                    <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-sm font-bold border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Today</button>
                    {/* Week ↔ Day view toggle. Both are the full all-counselor swim-lane board —
                        step 9's distributed model (see below) opened it to every clinician. */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-xl text-sm font-bold border border-slate-300 dark:border-slate-600 shadow-sm">
                        <button onClick={() => setViewMode('week')} className={`px-4 py-1.5 rounded-lg transition-all ${viewMode === 'week' ? 'bg-primary text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-600/60'}`}>Week</button>
                        <button onClick={() => setViewMode('day')} className={`px-4 py-1.5 rounded-lg transition-all ${viewMode === 'day' ? 'bg-primary text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-600/60'}`}>Day</button>
                    </div>
                    {/* Week presentation sub-toggle — only meaningful in Week mode. */}
                    {viewMode === 'week' && (
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-600 shadow-sm">
                            <button onClick={() => setWeekStyle('byCounselor')} className={`px-3 py-1.5 rounded-lg transition-all ${weekStyle === 'byCounselor' ? 'bg-primary text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-600/60'}`}>By counselor</button>
                            <button onClick={() => setWeekStyle('merged')} className={`px-3 py-1.5 rounded-lg transition-all ${weekStyle === 'merged' ? 'bg-primary text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-600/60'}`}>Merged</button>
                        </div>
                    )}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-full">
                        <button aria-label={viewMode === 'day' ? 'Previous day' : 'Previous week'} onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - (viewMode === 'day' ? 1 : 7)); setCurrentDate(d); }} className="p-1.5 rounded-full hover:bg-white dark:hover:bg-slate-600 shadow-sm transition-all"><ChevronLeft size={18}/></button>
                        <button aria-label={viewMode === 'day' ? 'Next day' : 'Next week'} onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + (viewMode === 'day' ? 1 : 7)); setCurrentDate(d); }} className="p-1.5 rounded-full hover:bg-white dark:hover:bg-slate-600 shadow-sm transition-all"><ChevronRight size={18}/></button>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                        {viewMode === 'day'
                            ? currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                            : weekRangeLabel}
                    </h2>
                </div>
                <button onClick={() => { setSlotPrefill(null); setScheduleModalOpen(true); }} className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-focus hover:shadow-primary/40 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                    <CalIcon size={18} /> Schedule Session
                </button>
            </div>

            {/* Day view — step 9's distributed booking model ("open the calendar, not the
                chart"): EVERY staff role (Director/Therapist/Admin — same set as
                private.is_staff(), which also governs the widened appointments SELECT policy)
                sees the FULL all-counselor lane board and can book onto any lane by clicking an
                empty slot (modal opens prefilled with that lane's counselor + the clicked time).
                Week view has TWO presentations behind the "By counselor | Merged" sub-toggle:
                — By counselor (default; David's verbatim ask): each counselor's whole Mon–Fri
                  as its own block, blocks side by side with horizontal scroll (Outlook
                  split-view). Reuses the Day view's LaneColumn atom, so service-color fill,
                  double-book ring, true-duration cards AND empty-slot click-to-book all work.
                — Merged: the restored flat 7-day grid (recovered from pre-step-8 history):
                  days as columns, everyone overlaid, counselor name labelled on each card.
                  DISPLAY-ONLY: no empty-slot click-to-book here (clicking a CARD still opens
                  its status pop-up); booking clicks live in Day view + the by-counselor board. */}
            {canManage ? (
                viewMode === 'day' ? (
                <CounselorDayView
                    date={currentDate}
                    counselors={counselors}
                    appointments={appointments}
                    onSelectAppt={setSelectedAppt}
                    onSlotClick={info => { setSlotPrefill(info); setScheduleModalOpen(true); }}
                />
                ) : weekStyle === 'byCounselor' ? (
                <CounselorWeekView
                    weekDays={counselorWeekDays}
                    counselors={counselors}
                    appointments={appointments}
                    onSelectAppt={setSelectedAppt}
                    conflictIds={conflictIds}
                    onSlotClick={info => { setSlotPrefill(info); setScheduleModalOpen(true); }}
                />
                ) : (
                <div className="flex-1 bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-xl border border-border dark:border-slate-700 overflow-hidden flex flex-col min-h-[600px]">
                    {/* Header Row */}
                    <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-700/60">
                        <div className="p-4 border-r border-slate-100 dark:border-slate-700/30 text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center pt-8">GMT-05</div>
                        {weekDays.map(day => (
                            <div key={day.toISOString()} className={`p-4 text-center border-r border-border dark:border-slate-700/50 last:border-0 ${isToday(day) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                <p className={`text-[10px] font-bold uppercase mb-2 tracking-wider ${isToday(day) ? 'text-primary' : 'text-slate-400'}`}>{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto text-xl transition-all ${isToday(day) ? 'bg-primary text-white font-bold shadow-lg shadow-primary/30 scale-110' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                                    {day.getDate()}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Time Grid */}
                    <div className="flex-1 overflow-y-auto relative custom-scrollbar">
                        <div className="grid grid-cols-8 h-[1200px]">
                            {/* Time Column */}
                            <div className="border-r border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/20">
                                {hours.map(hour => (
                                    <div key={hour} className="h-[75px] border-b border-slate-100 dark:border-slate-700/30 text-right pr-3 pt-2 relative">
                                        <span className="text-xs font-medium text-slate-400 relative -top-3">{hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Day Columns */}
                            {weekDays.map(day => {
                                const dayEvents = appointments.filter(a => new Date(a.date).toDateString() === day.toDateString());
                                return (
                                    <div key={day.toISOString()} className="relative border-r border-border dark:border-slate-700/50 last:border-0 group">
                                        {/* Hour Grid Lines */}
                                        {hours.map(h => <div key={h} className="h-[75px] border-b border-slate-50 dark:border-slate-800/30 group-hover:border-slate-100 dark:group-hover:border-slate-700/50 transition-colors"></div>)}

                                        {/* Events */}
                                        {dayEvents.map(apt => {
                                            const s = getAppointmentStatusStyle(apt.status);
                                            // Card fill = service color (David 7/7); status stays on the
                                            // bar + badge. No taxonomy color (legacy rows, OMU family) →
                                            // fall back to the status card unchanged.
                                            const card = serviceCardClass(apt.sessionTypeId) ?? s.card;
                                            const isConflict = conflictIds.has(apt.id);
                                            return (
                                            <div
                                                key={apt.id}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => setSelectedAppt(apt)}
                                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedAppt(apt); } }}
                                                className={`group/event absolute left-1 right-1 rounded-xl p-2.5 border cursor-pointer hover:scale-[1.03] hover:z-10 transition-all duration-200 shadow-sm hover:shadow-md overflow-hidden backdrop-blur-sm ${card} ${isConflict ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
                                                style={getEventStyle(apt)}
                                                title={isConflict ? `${apt.title} — DOUBLE-BOOKED with another ${apt.therapist} session` : `${apt.title} — ${apt.status} (click to change status)`}
                                            >
                                                <div className="flex items-start gap-1">
                                                    <div className={`w-1 h-full absolute left-0 top-0 bottom-0 ${s.bar}`}></div>
                                                    {isConflict && (
                                                        <span className="absolute top-1 right-1 z-10" title={`Double-booked with another ${apt.therapist} session`}>
                                                            <AlertTriangle size={12} className="text-red-600 fill-red-100" />
                                                        </span>
                                                    )}
                                                    <div className="pl-2 overflow-hidden">
                                                        <p className={`font-bold text-xs truncate leading-tight ${apt.status === 'Canceled' ? 'line-through opacity-70' : ''}`}>{apt.clientName || apt.title}</p>
                                                        {/* Counselor label — the week grid has no lanes, so
                                                            each card must say whose session it is. */}
                                                        {apt.therapist && (
                                                            <p className="text-[10px] font-semibold truncate opacity-90">{apt.therapist}</p>
                                                        )}
                                                        <div className="flex items-center gap-1 mt-0.5 text-[10px] opacity-80">
                                                            <Clock size={10} /> {formatTime12(apt.startTime)} - {formatTime12(apt.endTime)}
                                                        </div>
                                                        {apt.modality?.includes('Zoom') && (
                                                            <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold opacity-90">
                                                                <Video size={10}/> Virtual
                                                            </div>
                                                        )}
                                                        {apt.status !== 'Scheduled' && (
                                                            <span className={`inline-flex items-center mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${s.badge}`}>
                                                                {apt.status}
                                                            </span>
                                                        )}
                                                        {apt.googleEventId && (
                                                            <a
                                                                href={apt.googleEventLink || '#'}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={e => e.stopPropagation()}
                                                                title="Open in Google Calendar"
                                                                className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-green-700 dark:text-green-300 hover:underline"
                                                            >
                                                                <Check size={10}/> Synced to Google
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            );
                                        })}

                                        {/* Current Time Indicator */}
                                        {isToday(day) && (
                                            <div
                                                className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                                                style={{ top: `${((new Date().getHours() - WIN_START) * 60 + new Date().getMinutes()) / (WIN_HOURS * 60) * 100}%` }}
                                            >
                                                <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-1.5 shadow-sm ring-2 ring-white dark:ring-slate-800"></div>
                                                <div className="h-[2px] w-full bg-red-500 shadow-sm"></div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                )
            ) : (
                <div className="flex-1 flex items-center justify-center min-h-[600px] bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-xl border border-border dark:border-slate-700">
                    <div className="max-w-md text-center p-8">
                        <CalIcon className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={40} />
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No scheduling access</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Your account's role doesn't include scheduling. Ask an administrator if you believe this is wrong.</p>
                    </div>
                </div>
            )}

            {isScheduleModalOpen && (
                <ScheduleSessionModal
                    isOpen={isScheduleModalOpen}
                    onClose={() => { setScheduleModalOpen(false); setSlotPrefill(null); }}
                    onSave={(newApt) => setAppointments(prev => [...prev, newApt])}
                    clients={clients}
                    prefillCounselorId={slotPrefill?.counselorId}
                    prefillCounselorName={slotPrefill?.counselorName}
                    prefillDate={slotPrefill?.date}
                    prefillTime={slotPrefill?.time}
                />
            )}

            <AppointmentStatusModal
                appointment={selectedAppt}
                isOpen={!!selectedAppt}
                onClose={() => setSelectedAppt(null)}
                onSetStatus={handleSetStatus}
                onCancel={handleCancel}
                onDelete={handleDeleteAppointment}
                onStartSession={canStartSession ? handleStartSession : undefined}
                isSaving={savingStatus}
                canManage={canManage}
                client={selectedClient}
                onSaveNotes={canManage ? handleSaveNotes : undefined}
                onReschedule={canManage ? handleReschedule : undefined}
                onCancelSeries={canManage && selectedAppt?.seriesId ? handleCancelSeries : undefined}
                onDeleteSeries={canManage && selectedAppt?.seriesId ? handleDeleteSeries : undefined}
            />
        </div>
    );
};

export default SessionManagement;