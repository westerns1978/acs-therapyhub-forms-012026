import React, { useState, useEffect } from 'react';
import { Appointment, AppointmentStatus, ServiceType, Client } from '../../types';
import { LATE_CANCELLATION_FEE } from '../../config/satopFees';
import { formatTime12 } from '../../config/time';
import Modal from '../ui/Modal';
import { Clock, Video, MapPin, CheckCircle2, UserX, Ban, RotateCcw, Trash2, Play, AlertTriangle, DollarSign, HeartHandshake, ArrowLeft, Phone, Mail, Repeat, Save } from 'lucide-react';

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
    onSetStatus: (status: AppointmentStatus, serviceType?: ServiceType) => void;
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
    /** Recurring-series edit-scope. Offered only when the appointment carries a seriesId.
     *  These act on the WHOLE series (future/non-completed occurrences); the buttons above
     *  act on THIS occurrence only. */
    onCancelSeries?: () => void;
    onDeleteSeries?: () => void;
}

const AppointmentStatusModal: React.FC<AppointmentStatusModalProps> = ({
    appointment, isOpen, onClose, onSetStatus, onCancel, onDelete, onStartSession, isSaving, canManage,
    client, onSaveNotes, onCancelSeries, onDeleteSeries,
}) => {
    // WS3: a session category is REQUIRED before completion (drives categorized accrual).
    const [serviceType, setServiceType] = useState<ServiceType | ''>('');
    // Late-cancel fee panel — shown only when a cancel falls inside the 24h window.
    const [cancelPanel, setCancelPanel] = useState(false);
    const [waiveOpen, setWaiveOpen] = useState(false);
    const [waiveReason, setWaiveReason] = useState('');
    // Per-occurrence note draft. Reset when the appointment changes.
    const [notesDraft, setNotesDraft] = useState('');
    useEffect(() => {
        setServiceType((appointment?.serviceType as ServiceType) ?? '');
        setCancelPanel(false); setWaiveOpen(false); setWaiveReason('');
        setNotesDraft(appointment?.notes ?? '');
    }, [appointment?.id]);
    if (!appointment) return null;

    const notesDirty = (appointment.notes ?? '') !== notesDraft;

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
                        {appointment.clientId && onStartSession && (
                            <button
                                type="button"
                                onClick={onStartSession}
                                disabled={isSaving}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <Play size={16} /> Start Session
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
                        <div className="grid grid-cols-1 gap-2">
                            <button
                                type="button"
                                onClick={() => serviceType && onSetStatus('Completed', serviceType as ServiceType)}
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
