import React from 'react';
import { Appointment, AppointmentStatus } from '../../types';
import Modal from '../ui/Modal';
import { Clock, Video, MapPin, CheckCircle2, UserX, Ban, RotateCcw, Trash2 } from 'lucide-react';

// Single source of truth for status → Tailwind classes, shared with the schedule
// grid (SessionManagement) so a card and its detail badge always agree. Mirrors
// the inline status-pill convention already used in ManageAttendeesModal. Scheduled
// keeps the original blue treatment so unchanged cards look identical to before.
const STATUS_STYLES: Record<AppointmentStatus, { card: string; bar: string; badge: string }> = {
    'Scheduled':   { card: 'bg-blue-50/90 dark:bg-blue-900/40 border-blue-200/50 dark:border-blue-700/50 text-blue-900 dark:text-blue-100',                bar: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-800' },
    'In Progress': { card: 'bg-indigo-50/90 dark:bg-indigo-900/40 border-indigo-200/50 dark:border-indigo-700/50 text-indigo-900 dark:text-indigo-100',    bar: 'bg-indigo-500',  badge: 'bg-indigo-100 text-indigo-800' },
    'Completed':   { card: 'bg-emerald-50/90 dark:bg-emerald-900/40 border-emerald-200/50 dark:border-emerald-700/50 text-emerald-900 dark:text-emerald-100', bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800' },
    'No Show':     { card: 'bg-amber-50/90 dark:bg-amber-900/40 border-amber-200/50 dark:border-amber-700/50 text-amber-900 dark:text-amber-100',          bar: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-800' },
    'Canceled':    { card: 'bg-slate-100/90 dark:bg-slate-800/60 border-slate-300/60 dark:border-slate-600/50 text-slate-500 dark:text-slate-400',         bar: 'bg-slate-400',   badge: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
};

export const getAppointmentStatusStyle = (s: AppointmentStatus) => STATUS_STYLES[s] || STATUS_STYLES['Scheduled'];

interface AppointmentStatusModalProps {
    appointment: Appointment | null;
    isOpen: boolean;
    onClose: () => void;
    onSetStatus: (status: AppointmentStatus) => void;
    onDelete: () => void;
    isSaving: boolean;
    /** Staff-only gate. When false the actions are hidden (read-only detail). */
    canManage: boolean;
}

const AppointmentStatusModal: React.FC<AppointmentStatusModalProps> = ({
    appointment, isOpen, onClose, onSetStatus, onDelete, isSaving, canManage,
}) => {
    if (!appointment) return null;

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
                        <p className="flex items-center gap-2"><Clock size={14} /> {when} · {appointment.startTime} – {appointment.endTime}</p>
                        <p className="flex items-center gap-2">{appointment.modality.includes('Zoom') ? <Video size={14} /> : <MapPin size={14} />} {appointment.modality}</p>
                        {appointment.therapist && <p className="text-xs">with {appointment.therapist}</p>}
                    </div>
                </div>

                {canManage ? (
                    <>
                        <div className="grid grid-cols-1 gap-2">
                            <StatusAction status="Completed" label="Mark Completed" icon={CheckCircle2} className="bg-emerald-600 hover:bg-emerald-700 text-white" />
                            <StatusAction status="No Show" label="Mark No-Show" icon={UserX} className="bg-amber-500 hover:bg-amber-600 text-white" />
                            <StatusAction status="Canceled" label="Cancel Session" icon={Ban} className="bg-slate-600 hover:bg-slate-700 text-white" />
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
                            <p className="mt-1 text-center text-[11px] text-slate-400">Cancelling keeps the record; deleting also removes its Google Calendar event.</p>
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">You don't have permission to change this appointment.</p>
                )}
            </div>
        </Modal>
    );
};

export default AppointmentStatusModal;
