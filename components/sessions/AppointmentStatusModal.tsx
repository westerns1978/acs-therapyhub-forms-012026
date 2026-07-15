import React, { useState, useEffect } from 'react';
import { Appointment, AppointmentStatus, ServiceType, Client } from '../../types';
import { getLastAppointment, getNextAppointment, getTherapistAppointments, getCounselors } from '../../services/api';
import type { Counselor } from '../../services/api';
import { qualifiedCounselorsFor } from '../../config/sessionTaxonomy';
import { LATE_CANCELLATION_FEE } from '../../config/satopFees';
import { unitGrainFor, suggestedUnits } from '../../config/billableUnits';
import { formatTime12, parseTimeToMinutes, minutesToTimeLabel, toLocalYMD } from '../../config/time';
import { detectOverlaps } from '../../services/recurrence';
import Modal from '../ui/Modal';
import { Clock, Video, MapPin, CheckCircle2, UserX, Ban, RotateCcw, Trash2, Play, AlertTriangle, DollarSign, HeartHandshake, ArrowLeft, Phone, Mail, Repeat, Save, Loader2, CalendarClock } from 'lucide-react';

/** The fee decision the cancel flow hands back to its parent. Outside the 24h window it's
 *  always { fee: 'none' }; inside, staff choose to assess or waive (with a logged reason). */
export type CancelFeeDecision =
    | { fee: 'none' }
    | { fee: 'assess' }
    | { fee: 'waive'; reason: string };

// Single source of truth for status → Tailwind classes, shared with the schedule
// grid (SessionManagement) so a card and its detail badge always agree. Mirrors
// the inline status-pill convention already used in ManageAttendeesModal. Scheduled
// keeps the original blue treatment so unchanged cards look identical to before.
const STATUS_STYLES: Record<AppointmentStatus, { card: string; bar: string; badge: string }> = {
    'Scheduled':   { card: 'bg-blue-50/90 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100',                bar: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-800' },
    'In Progress': { card: 'bg-indigo-50/90 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-100',    bar: 'bg-indigo-500',  badge: 'bg-indigo-100 text-indigo-800' },
    'Completed':   { card: 'bg-emerald-50/90 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100', bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800' },
    'No Show':     { card: 'bg-amber-50/90 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100',          bar: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-800' },
    'Canceled':    { card: 'bg-slate-100/90 dark:bg-slate-800/60 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400',         bar: 'bg-slate-400',   badge: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
};

export const getAppointmentStatusStyle = (s: AppointmentStatus) => STATUS_STYLES[s] || STATUS_STYLES['Scheduled'];

interface AppointmentStatusModalProps {
    appointment: Appointment | null;
    isOpen: boolean;
    onClose: () => void;
    /** billableUnits is passed ONLY when the chosen service_type has a configured unit
     *  grain (config/billableUnits.ts) — the clinician-asserted count at Mark-Complete.
     *  undefined for unconfigured service types (the column is left untouched). */
    onSetStatus: (status: AppointmentStatus, serviceType?: ServiceType, billableUnits?: number) => void;
    /** Cancel path. Split from onSetStatus because a cancel inside 24h carries a fee
     *  decision (assess / waive-with-reason); the parent does the status write + the charge. */
    onCancel: (decision: CancelFeeDecision) => void;
    onDelete: () => void;
    /** Opens the live session for this appointment's client. Only offered when the
     *  appointment has a clientId (1:1 sessions, not unassigned group slots). */
    onStartSession?: () => void;
    isSaving: boolean;
    /** Staff-only gate. When false the actions are hidden (read-only detail). */
    canManage: boolean;
    /** The matched client for this appointment (by uuid clientId) — drives the demographics
     *  block. Null for legacy text-id rows or group slots that don't resolve to one client. */
    client?: Client | null;
    /** Persist a per-occurrence note (appointments.notes). */
    onSaveNotes?: (notes: string) => void;
    /** Step 10: persist a new date/time (and optionally a new counselor) for this occurrence via
     *  the existing updateAppointment. counselorId/counselorName are supplied only when the
     *  counselor was reassigned, so the parent can skip the counselor write otherwise.
     *  Omitted = no reschedule UI (read-only detail keeps its current behavior). */
    onReschedule?: (date: Date, startTime: string, endTime: string, counselorId?: string, counselorName?: string) => void;
    /** Recurring-series edit-scope. Offered only when the appointment carries a seriesId.
     *  These act on the WHOLE series (future/non-completed occurrences); the buttons above
     *  act on THIS occurrence only. */
    onCancelSeries?: () => void;
    onDeleteSeries?: () => void;
}

const AppointmentStatusModal: React.FC<AppointmentStatusModalProps> = ({
    appointment, isOpen, onClose, onSetStatus, onCancel, onDelete, onStartSession, isSaving, canManage,
    client, onSaveNotes, onCancelSeries, onDeleteSeries, onReschedule,
}) => {
    // WS3: a session category is REQUIRED before completion (drives categorized accrual).
    const [serviceType, setServiceType] = useState<ServiceType | ''>('');
    // Billable units — a clinician-asserted COUNT at Mark-Complete, per the service type's
    // grain (config/billableUnits.ts). Only meaningful when the category has a configured
    // grain; the picker is hidden otherwise. '' = untouched.
    const [billableUnits, setBillableUnits] = useState<number | ''>('');
    // Late-cancel fee panel — shown only when a cancel falls inside the 24h window.
    const [cancelPanel, setCancelPanel] = useState(false);
    const [waiveOpen, setWaiveOpen] = useState(false);
    const [waiveReason, setWaiveReason] = useState('');
    // Per-occurrence note draft. Reset when the appointment changes.
    const [notesDraft, setNotesDraft] = useState('');
    // Step 10: reschedule draft (date/start/end), synced to the appointment's CURRENT persisted
    // values. Deps include date/startTime/endTime (not just id) so a successful reschedule —
    // which patches this same appointment id with new values — resyncs the draft too, clearing
    // the dirty state instead of leaving stale pre-save values in the inputs.
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [rescheduleStart, setRescheduleStart] = useState('');
    const [rescheduleEnd, setRescheduleEnd] = useState('');
    const [rescheduleConflicts, setRescheduleConflicts] = useState<string[]>([]);
    const [checkingReschedule, setCheckingReschedule] = useState(false);
    const [overrideRescheduleConflict, setOverrideRescheduleConflict] = useState(false);
    // Step: reassign the counselor as part of a reschedule/edit. Synced to the appointment's
    // current counselor_id; the picker is gated through the same cert-gating seam the booking
    // modal uses, and writes counselor_id + therapist_name together on save.
    const [rescheduleCounselorId, setRescheduleCounselorId] = useState<string | undefined>(undefined);
    const [counselors, setCounselors] = useState<Counselor[]>([]);
    useEffect(() => { if (isOpen && onReschedule) getCounselors().then(setCounselors).catch(() => setCounselors([])); }, [isOpen, onReschedule]);
    useEffect(() => {
        setServiceType((appointment?.serviceType as ServiceType) ?? '');
        setCancelPanel(false); setWaiveOpen(false); setWaiveReason('');
        setNotesDraft(appointment?.notes ?? '');
        if (appointment) {
            setRescheduleDate(toLocalYMD(new Date(appointment.date)));
            setRescheduleStart(appointment.startTime);
            setRescheduleEnd(appointment.endTime);
        }
        setRescheduleCounselorId(appointment?.counselorId);
        setRescheduleConflicts([]);
        setOverrideRescheduleConflict(false);
    }, [appointment?.id, appointment?.date, appointment?.startTime, appointment?.endTime, appointment?.counselorId]);

    // Reschedule counselor picker roster: the cert-gating seam's qualified set for this
    // session type (full active roster when the type is OPEN/unknown), but ALWAYS include the
    // appointment's CURRENT counselor even if the matrix wouldn't — reassigning must never
    // silently drop the person it's already booked with.
    const rescheduleRoster = (() => {
        const qualified = appointment ? qualifiedCounselorsFor(appointment.sessionTypeId ?? '', counselors) : [];
        if (appointment?.counselorId && !qualified.some(c => c.id === appointment.counselorId)) {
            const cur = counselors.find(c => c.id === appointment.counselorId);
            if (cur) return [cur, ...qualified];
        }
        return qualified;
    })();
    const selectedRescheduleCounselor = counselors.find(c => c.id === rescheduleCounselorId);
    // The name to run the double-booking check against: the (possibly reassigned) counselor,
    // falling back to the row's existing therapist string for legacy/unattributed rows.
    const rescheduleTherapistName = selectedRescheduleCounselor?.name || appointment?.therapist || '';
    const counselorReassigned = !!appointment && (rescheduleCounselorId ?? undefined) !== (appointment.counselorId ?? undefined);

    // Preserves the appointment's ORIGINAL duration when the user picks a new start time —
    // the end time auto-shifts with it (still hand-editable afterward if staff want a
    // different length). Falls back to 60 min if the stored window is somehow invalid.
    const originalDurationMin = (() => {
        if (!appointment) return 60;
        const s = parseTimeToMinutes(appointment.startTime), e = parseTimeToMinutes(appointment.endTime);
        return (!Number.isNaN(s) && !Number.isNaN(e) && e > s) ? e - s : 60;
    })();
    const handleRescheduleStartChange = (val: string) => {
        setRescheduleStart(val);
        const s = parseTimeToMinutes(val);
        if (!Number.isNaN(s)) setRescheduleEnd(minutesToTimeLabel(s + originalDurationMin));
    };

    // Billable-units gate — TWO axes (config/billableUnits.ts): ELIGIBILITY = the client's
    // program (SATOP-family only; client?.program is the canonical program_type, and a null
    // client → undefined → fails closed here), GRAIN = the selected service_type. null = do
    // not render the control. Today every grain is unset, so this is null for everything —
    // intended: the mechanism ships, the grain table stays empty until David's codes land.
    const unitGrain = unitGrainFor(client?.program, serviceType);
    // Prefill the units count when the category has a grain: reuse an already-asserted value
    // from the row if present, else suggest round(duration / grain) clamped to the cap. The
    // prefill is a SUGGESTION — the clinician can override it. When the grain is null (no
    // config), clear the field so a stale count from another category can't leak through.
    useEffect(() => {
        if (!unitGrain) { setBillableUnits(''); return; }
        setBillableUnits(
            typeof appointment?.billableUnits === 'number'
                ? appointment.billableUnits
                : suggestedUnits(originalDurationMin, unitGrain),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serviceType, appointment?.id, appointment?.billableUnits, originalDurationMin]);

    const rescheduleDirty = !!appointment && (
        rescheduleDate !== toLocalYMD(new Date(appointment.date))
        || rescheduleStart !== appointment.startTime
        || rescheduleEnd !== appointment.endTime
        || counselorReassigned
    );

    // Debounced re-run of the SAME deterministic overlap check ScheduleSessionModal uses
    // (getTherapistAppointments + detectOverlaps), scoped to the new date and EXCLUDING this
    // appointment's own row (else it would trivially "conflict" with its own current slot).
    useEffect(() => {
        setRescheduleConflicts([]);
        setOverrideRescheduleConflict(false);
        // Check against the SELECTED counselor (reassignment-aware), not the row's original.
        if (!appointment || !rescheduleTherapistName || rescheduleTherapistName === 'Unassigned') return;
        const s = parseTimeToMinutes(rescheduleStart), e = parseTimeToMinutes(rescheduleEnd);
        if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return;
        const t = setTimeout(async () => {
            setCheckingReschedule(true);
            try {
                const day = new Date(rescheduleDate + 'T00:00:00');
                const from = new Date(day); from.setHours(0, 0, 0, 0);
                const to = new Date(day); to.setHours(23, 59, 59, 999);
                const existing = await getTherapistAppointments(rescheduleTherapistName, from.toISOString(), to.toISOString());
                const others = existing.filter(a => a.id !== appointment.id);
                const existingWindows = others.map(a => ({ date: new Date(a.date), startTime: a.startTime, endTime: a.endTime, _t: a.clientName || a.title }));
                const hits = detectOverlaps([{ date: day, startTime: rescheduleStart, endTime: rescheduleEnd }], existingWindows);
                setRescheduleConflicts(hits.map(h => (h.conflictsWith as any)._t || 'another appointment'));
            } catch {
                // Visible-empty on failure — never silently assert "no conflicts".
            } finally {
                setCheckingReschedule(false);
            }
        }, 600);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appointment?.id, rescheduleTherapistName, rescheduleDate, rescheduleStart, rescheduleEnd]);

    const rescheduleBlocked = rescheduleConflicts.length > 0 && !overrideRescheduleConflict;
    const handleReschedule = () => {
        if (!appointment || !onReschedule || rescheduleBlocked) return;
        // Pass counselor id + name ONLY when actually reassigned, so an untouched reschedule
        // never rewrites (or clobbers) the row's existing attribution.
        onReschedule(
            new Date(rescheduleDate + 'T00:00:00'), rescheduleStart, rescheduleEnd,
            counselorReassigned ? rescheduleCounselorId : undefined,
            counselorReassigned ? selectedRescheduleCounselor?.name : undefined,
        );
    };

    // WS4 booking glance — this client's most-recent PAST and next UPCOMING appointment.
    // Tri-state so the reads never flash the wrong thing: `undefined` = still loading ("…"),
    // `null` = loaded, none found ("—"), an Appointment = loaded. Mirrors ClientWorkspace's
    // consume pattern exactly (Promise.allSettled → fulfilled ? value : null), so a thrown
    // read (DB error) or an unresolved legacy TEXT client_id degrades to "—", never crashes.
    const [lastBooked, setLastBooked] = useState<Appointment | null | undefined>(undefined);
    const [nextBooked, setNextBooked] = useState<Appointment | null | undefined>(undefined);
    useEffect(() => {
        const cid = client?.id;
        if (!isOpen || !cid) { setLastBooked(undefined); setNextBooked(undefined); return; }
        let active = true;
        setLastBooked(undefined); setNextBooked(undefined); // reflect loading on (re)open
        Promise.allSettled([getLastAppointment(cid), getNextAppointment(cid)]).then(([last, next]) => {
            if (!active) return;
            setLastBooked(last.status === 'fulfilled' ? (last.value as Appointment | null) : null);
            setNextBooked(next.status === 'fulfilled' ? (next.value as Appointment | null) : null);
        });
        return () => { active = false; };
    }, [isOpen, client?.id]);

    if (!appointment) return null;

    const notesDirty = (appointment.notes ?? '') !== notesDraft;

    // Compact "Mon D, YYYY, h:mm AM" for the booking-glance lines (same format as the
    // client header's booking glance). Tri-state value: undefined → "…" (loading),
    // null → "—" (none on file), Appointment → the formatted date.
    const formatBooking = (apt: Appointment): string => {
        const d = apt.date instanceof Date ? apt.date : new Date(apt.date);
        const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `${datePart}, ${formatTime12(apt.startTime)}`;
    };
    const renderBookingValue = (apt: Appointment | null | undefined) => {
        if (apt === undefined) return <span className="text-slate-400">…</span>;
        if (apt === null) return <span className="text-slate-400">—</span>;
        return <span className="font-semibold text-slate-700 dark:text-slate-200">{formatBooking(apt)}</span>;
    };

    // "Less than 24 hours in advance" — only for an appointment that hasn't started yet.
    // A past/started appointment is no-show territory (deferred), never an auto fee.
    const LATE_CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;
    const msUntilStart = new Date(appointment.date).getTime() - Date.now();
    const insideLateCancelWindow = msUntilStart > 0 && msUntilStart < LATE_CANCEL_WINDOW_MS;

    const resetCancelPanel = () => { setCancelPanel(false); setWaiveOpen(false); setWaiveReason(''); };
    const handleCancelClick = () => {
        if (insideLateCancelWindow) setCancelPanel(true);
        else onCancel({ fee: 'none' });
    };
    const dispatchCancel = (decision: CancelFeeDecision) => { onCancel(decision); resetCancelPanel(); };

    const style = getAppointmentStatusStyle(appointment.status);
    const when = new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const StatusAction: React.FC<{ status: AppointmentStatus; label: string; icon: React.ElementType; className: string }> = ({ status, label, icon: Icon, className }) => {
        const active = appointment.status === status;
        return (
            <button
                type="button"
                onClick={() => onSetStatus(status)}
                disabled={isSaving || active}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
            >
                <Icon size={16} /> {active ? `${label} (current)` : label}
            </button>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Appointment Status" maxWidth="max-w-md">
            <div className="p-5 space-y-5">
                {/* Summary */}
                <div>
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">{appointment.clientName || appointment.title}</h3>
                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full flex-shrink-0 ${style.badge}`}>{appointment.status}</span>
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-slate-500 dark:text-slate-400">
                        <p className="flex items-center gap-2"><Clock size={14} /> {when} · {formatTime12(appointment.startTime)} – {formatTime12(appointment.endTime)}</p>
                        <p className="flex items-center gap-2">{appointment.modality.includes('Zoom') ? <Video size={14} /> : <MapPin size={14} />} {appointment.modality}</p>
                        {appointment.therapist && <p className="text-xs">with {appointment.therapist}</p>}
                        {appointment.seriesId && (
                            <p className="flex items-center gap-2 text-xs text-indigo-500 dark:text-indigo-300"><Repeat size={13} /> Part of a recurring series</p>
                        )}
                    </div>

                    {/* Client demographics — David's 6/24 ask. Shown when the appointment resolves
                        to a real client (uuid clientId). Legacy text-id rows won't match → hidden. */}
                    {client && (
                        <div className="mt-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3 space-y-1.5">
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Client contact</p>
                            {client.phone
                                ? <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 hover:underline"><Phone size={14} /> {client.phone}</a>
                                : <p className="flex items-center gap-2 text-sm text-slate-400"><Phone size={14} /> No phone on file</p>}
                            {client.email
                                ? <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 hover:underline"><Mail size={14} /> {client.email}</a>
                                : <p className="flex items-center gap-2 text-sm text-slate-400"><Mail size={14} /> No email on file</p>}
                            {/* WS4 booking glance — most-recent past + next upcoming appointment for
                                this client (getLastAppointment/getNextAppointment; see the effect above). */}
                            <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 pt-1">
                                <Clock size={14} className="shrink-0" /> <span>Last booked: {renderBookingValue(lastBooked)}</span>
                            </p>
                            <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                <Clock size={14} className="shrink-0" /> <span>Next booked: {renderBookingValue(nextBooked)}</span>
                            </p>
                        </div>
                    )}

                    {/* Per-occurrence note (appointments.notes). Available to staff regardless of
                        status; save is enabled only when the draft differs from what's persisted. */}
                    {canManage && onSaveNotes && (
                        <div className="mt-3">
                            <label htmlFor="apptNotes" className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Session note</label>
                            <textarea
                                id="apptNotes"
                                value={notesDraft}
                                onChange={e => setNotesDraft(e.target.value)}
                                rows={3}
                                placeholder="Add a note for this appointment…"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
                            />
                            <div className="mt-1.5 flex justify-end">
                                <button
                                    type="button"
                                    disabled={isSaving || !notesDirty}
                                    onClick={() => onSaveNotes(notesDraft.trim())}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-slate-700 hover:bg-slate-800 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Save size={14} /> Save note
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {canManage ? (
                    cancelPanel ? (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-amber-300/70 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 p-4">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">Inside 24 hours</p>
                                        <p className="text-sm text-amber-800/90 dark:text-amber-200/80 mt-0.5 leading-snug">
                                            This cancellation is less than 24 hours before the appointment ({when} · {formatTime12(appointment.startTime)}). Per the ACS Late Cancellation Policy, a <span className="font-black">${LATE_CANCELLATION_FEE}</span> late-cancellation fee applies.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {!waiveOpen ? (
                                <div className="grid grid-cols-1 gap-2">
                                    <button
                                        type="button"
                                        disabled={isSaving}
                                        onClick={() => dispatchCancel({ fee: 'assess' })}
                                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-700 hover:bg-slate-800 text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <DollarSign size={16} /> Assess ${LATE_CANCELLATION_FEE} fee &amp; cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isSaving}
                                        onClick={() => setWaiveOpen(true)}
                                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-60"
                                    >
                                        <HeartHandshake size={16} /> Waive (emergency)…
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isSaving}
                                        onClick={resetCancelPanel}
                                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
                                    >
                                        <ArrowLeft size={15} /> Back
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400">Reason for waiver <span className="text-rose-400">(required)</span></label>
                                    <textarea
                                        value={waiveReason}
                                        onChange={(e) => setWaiveReason(e.target.value)}
                                        rows={2}
                                        autoFocus
                                        placeholder="e.g. documented medical emergency"
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
                                    />
                                    <div className="grid grid-cols-1 gap-2 pt-1">
                                        <button
                                            type="button"
                                            disabled={isSaving || !waiveReason.trim()}
                                            onClick={() => dispatchCancel({ fee: 'waive', reason: waiveReason.trim() })}
                                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            <HeartHandshake size={16} /> Waive fee &amp; cancel
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isSaving}
                                            onClick={() => { setWaiveOpen(false); setWaiveReason(''); }}
                                            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
                                        >
                                            <ArrowLeft size={15} /> Back
                                        </button>
                                    </div>
                                </div>
                            )}
                            <p className="text-center text-[11px] text-slate-400">Cancelling keeps the appointment record; the fee posts to the client's ledger.</p>
                        </div>
                    ) : (
                    <>
                        {/* Step 10: reschedule this occurrence — date/time edit via updateAppointment,
                            re-running the SAME deterministic overlap check the booking modal uses. */}
                        {onReschedule && (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                                <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400">
                                    <CalendarClock size={13} /> Reschedule
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <input
                                        type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
                                        className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
                                    />
                                    <input
                                        type="time" value={rescheduleStart} onChange={e => handleRescheduleStartChange(e.target.value)}
                                        className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
                                    />
                                    <input
                                        type="time" value={rescheduleEnd} onChange={e => setRescheduleEnd(e.target.value)}
                                        className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
                                    />
                                </div>
                                {/* Reassign counselor — same cert-gating seam the booking modal uses;
                                    writes counselor_id + therapist_name together on Save. */}
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Counselor</label>
                                    <select
                                        value={rescheduleCounselorId ?? ''}
                                        onChange={e => setRescheduleCounselorId(e.target.value || undefined)}
                                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
                                    >
                                        {rescheduleCounselorId == null && <option value="">— Unassigned —</option>}
                                        {rescheduleRoster.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    {counselorReassigned && (
                                        <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                                            Reassigning to {selectedRescheduleCounselor?.name}. Save to apply.
                                        </p>
                                    )}
                                </div>
                                {checkingReschedule && (
                                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                                        <Loader2 size={12} className="animate-spin" /> Checking for conflicts…
                                    </p>
                                )}
                                {rescheduleConflicts.length > 0 && (
                                    <div className="p-2 rounded-lg border bg-red-50 border-red-200">
                                        <p className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                                            <AlertTriangle size={13} className="shrink-0" /> Double-booking — overlaps {rescheduleConflicts.join(', ')}
                                        </p>
                                        <label className="mt-1.5 flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={overrideRescheduleConflict} onChange={e => setOverrideRescheduleConflict(e.target.checked)} className="rounded" />
                                            <span className="text-xs font-semibold text-red-800">Reschedule anyway (override)</span>
                                        </label>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={handleReschedule}
                                    disabled={isSaving || !rescheduleDirty || rescheduleBlocked}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-slate-700 hover:bg-slate-800 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Save size={14} /> Save new time
                                </button>
                            </div>
                        )}

                        {appointment.clientId && onStartSession && (
                            <button
                                type="button"
                                onClick={onStartSession}
                                disabled={isSaving}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <Play size={16} /> Start transcribed session
                            </button>
                        )}
                        {/* WS3: session category — REQUIRED to mark complete; drives categorized hours accrual. */}
                        <div>
                            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Session category <span className="text-rose-400">(required to complete)</span></label>
                            <select
                                value={serviceType}
                                onChange={(e) => setServiceType(e.target.value as ServiceType | '')}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100"
                            >
                                <option value="">Select category…</option>
                                <option value="counseling">Counseling (individual + group)</option>
                                <option value="education">Education</option>
                                <option value="rehabilitative_support">Group rehabilitative support</option>
                                <option value="other">Other (non-program — does not accrue)</option>
                            </select>
                        </div>
                        {/* Billable units — records a COUNT only (no dollars, not submitted to
                            DMH/CIMOR). Rendered ONLY when the chosen category has a configured
                            grain (unitGrainFor: SATOP-eligible program × configured service_type).
                            When it returns null — no grain today — render NOTHING: no line, no
                            placeholder, no empty div. The picker appears on its own the day a grain
                            is configured. */}
                        {serviceType && unitGrain && (
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                                    Billable units <span className="normal-case font-bold text-slate-400">({unitGrain.unitMinutes} min each)</span>
                                </label>
                                <select
                                    value={billableUnits === '' ? '' : String(billableUnits)}
                                    onChange={(e) => setBillableUnits(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100"
                                >
                                    {Array.from({ length: unitGrain.maxUnits }, (_, i) => i + 1).map(n => (
                                        <option key={n} value={n}>{n} unit{n === 1 ? '' : 's'} ({n * (unitGrain.unitMinutes as number)} min)</option>
                                    ))}
                                </select>
                                <p className="mt-1 text-[11px] text-slate-400">Prefilled from the scheduled length — adjust to the units actually delivered.</p>
                            </div>
                        )}
                        <div className="grid grid-cols-1 gap-2">
                            <button
                                type="button"
                                onClick={() => serviceType && onSetStatus('Completed', serviceType as ServiceType, unitGrain && typeof billableUnits === 'number' ? billableUnits : undefined)}
                                disabled={isSaving || appointment.status === 'Completed' || !serviceType}
                                title={!serviceType ? 'Choose a session category first' : undefined}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                <CheckCircle2 size={16} /> {appointment.status === 'Completed' ? 'Completed (current)' : 'Mark Completed'}
                            </button>
                            <StatusAction status="No Show" label="Mark No-Show" icon={UserX} className="bg-amber-500 hover:bg-amber-600 text-white" />
                            <button
                                type="button"
                                onClick={handleCancelClick}
                                disabled={isSaving || appointment.status === 'Canceled'}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed bg-slate-600 hover:bg-slate-700 text-white"
                            >
                                <Ban size={16} /> {appointment.status === 'Canceled' ? 'Cancel Session (current)' : 'Cancel Session'}
                            </button>
                            {appointment.status !== 'Scheduled' && (
                                <StatusAction status="Scheduled" label="Reset to Scheduled" icon={RotateCcw} className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600" />
                            )}
                        </div>
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={onDelete}
                                disabled={isSaving}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors disabled:opacity-60"
                            >
                                <Trash2 size={15} /> Delete permanently
                            </button>
                            <p className="mt-1 text-center text-[11px] text-slate-400">
                                {appointment.seriesId
                                    ? 'The actions above affect THIS occurrence only. Cancelling keeps the record; deleting also removes its Google Calendar event.'
                                    : 'Cancelling keeps the record; deleting also removes its Google Calendar event.'}
                            </p>
                        </div>

                        {/* Recurring-series edit-scope — whole-series actions, distinct from the
                            this-occurrence buttons above. Completed occurrences are protected. */}
                        {appointment.seriesId && (onCancelSeries || onDeleteSeries) && (
                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                                <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-300 mb-2">
                                    <Repeat size={13} /> Entire series
                                </p>
                                <div className="grid grid-cols-1 gap-2">
                                    {onCancelSeries && (
                                        <button
                                            type="button"
                                            onClick={onCancelSeries}
                                            disabled={isSaving}
                                            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition disabled:opacity-60"
                                        >
                                            <Ban size={15} /> Cancel entire series
                                        </button>
                                    )}
                                    {onDeleteSeries && (
                                        <button
                                            type="button"
                                            onClick={onDeleteSeries}
                                            disabled={isSaving}
                                            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition disabled:opacity-60"
                                        >
                                            <Trash2 size={15} /> Delete entire series
                                        </button>
                                    )}
                                </div>
                                <p className="mt-1 text-center text-[11px] text-slate-400">Completed sessions in the series are kept (they hold accrued hours).</p>
                            </div>
                        )}
                    </>
                    )
                ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">You don't have permission to change this appointment.</p>
                )}
            </div>
        </Modal>
    );
};

export default AppointmentStatusModal;
