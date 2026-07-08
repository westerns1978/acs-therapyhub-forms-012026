import React, { useState, useMemo, useEffect } from 'react';
import { getAppointments, getClients, getCounselors, deleteAppointment, updateAppointment, updateAppointmentStatus, assessLateCancellationFee, cancelSeries, deleteSeries } from '../services/api';
import type { Counselor } from '../services/api';
import { Appointment, AppointmentStatus, Client, isStaffRole, ServiceType } from '../types';
import ScheduleSessionModal from '../components/sessions/ScheduleSessionModal';
import CounselorDayView from '../components/sessions/CounselorDayView';
import { timeRangesOverlap } from '../services/recurrence';
import AppointmentStatusModal from '../components/sessions/AppointmentStatusModal';
import type { CancelFeeDecision } from '../components/sessions/AppointmentStatusModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, AlertTriangle } from 'lucide-react';
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

    // Step 10: persist a new date/time for this occurrence (the modal already ran the overlap
    // check and got an explicit override if needed — this just writes what it decided).
    const handleReschedule = async (date: Date, startTime: string, endTime: string) => {
        if (!selectedAppt) return;
        setSavingStatus(true);
        try {
            const updated = await updateAppointment(selectedAppt.id, { date, startTime, endTime });
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

    // Live therapist double-booking detection across the loaded set. Same-therapist (by name,
    // this round) + same day + half-open time overlap (the shared recurrence primitive). Both
    // colliding occurrences are flagged. Canceled rows don't count. O(n²) is fine at clinic scale.
    const conflictIds = useMemo(() => {
        const ids = new Set<string>();
        const active = appointments.filter(a => a.status !== 'Canceled' && a.therapist);
        for (let i = 0; i < active.length; i++) {
            for (let j = i + 1; j < active.length; j++) {
                const a = active[i], b = active[j];
                if (a.therapist !== b.therapist) continue;
                if (new Date(a.date).toDateString() !== new Date(b.date).toDateString()) continue;
                if (timeRangesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
                    ids.add(a.id); ids.add(b.id);
                }
            }
        }
        return ids;
    }, [appointments]);

    // The client behind the selected appointment (for the pop-up's demographics). Matches by
    // uuid clientId; legacy text-id rows won't resolve → demographics block stays hidden.
    const selectedClient = useMemo(
        () => (selectedAppt?.clientId ? clients.find(c => c.id === selectedAppt.clientId) ?? null : null),
        [selectedAppt, clients],
    );

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
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-full">
                        <button aria-label={viewMode === 'day' ? 'Previous day' : 'Previous week'} onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - (viewMode === 'day' ? 1 : 7)); setCurrentDate(d); }} className="p-1.5 rounded-full hover:bg-white dark:hover:bg-slate-600 shadow-sm transition-all"><ChevronLeft size={18}/></button>
                        <button aria-label={viewMode === 'day' ? 'Next day' : 'Next week'} onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + (viewMode === 'day' ? 1 : 7)); setCurrentDate(d); }} className="p-1.5 rounded-full hover:bg-white dark:hover:bg-slate-600 shadow-sm transition-all"><ChevronRight size={18}/></button>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                        {viewMode === 'day'
                            ? currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                            : startOfWeek.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                    </h2>
                </div>
                <button onClick={() => { setSlotPrefill(null); setScheduleModalOpen(true); }} className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-focus hover:shadow-primary/40 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                    <CalIcon size={18} /> Schedule Session
                </button>
            </div>

            {/* Step 9 — distributed booking model ("open the calendar, not the chart"): EVERY
                staff role (Director/Therapist/Admin — same set as private.is_staff(), which now
                also governs the widened appointments SELECT policy) sees the FULL all-counselor
                board and can book onto any lane. This supersedes WS1 step C's non-admin solo-lane
                restriction, which belonged to the prior "each clinician sees only their own
                calendar" model. Week additionally forces fixed-width scrollable lanes and carries
                the double-booking ring (parity with the old flat 7-day grid it replaces); Day
                keeps its original compress-to-fit, no-ring behavior exactly as before. Clicking an
                empty slot opens the modal prefilled with that lane's counselor + the clicked time. */}
            {canManage ? (
                <CounselorDayView
                    date={currentDate}
                    counselors={counselors}
                    appointments={appointments}
                    onSelectAppt={setSelectedAppt}
                    conflictIds={viewMode === 'week' ? conflictIds : undefined}
                    scrollable={viewMode === 'week'}
                    onSlotClick={info => { setSlotPrefill(info); setScheduleModalOpen(true); }}
                />
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