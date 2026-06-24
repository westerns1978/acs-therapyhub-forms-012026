import React, { useMemo } from 'react';
import { Appointment } from '../../types';
import type { Counselor } from '../../services/api';
import { getAppointmentStatusStyle } from './AppointmentStatusModal';
import { Clock, Video } from 'lucide-react';

interface CounselorDayViewProps {
    date: Date;
    counselors: Counselor[];
    appointments: Appointment[];          // ALL appointments; filtered to `date` here
    onSelectAppt: (appt: Appointment) => void;
}

// Visible window: 6 AM – 9 PM. Covers early individual slots through evening groups
// (@ 18:00–20:00). The DB stores local times as 24-hour "HH:MM" (timeStrFromDate),
// so a 6 AM session is real and must fit.
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 21;
const WINDOW_MIN = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);

// Parse a time label → minutes-from-midnight. The app formats appointment times as
// 24-hour "HH:MM" (e.g. "06:00", "13:00") via timeStrFromDate; we also tolerate an
// "h:mm AM/PM" form defensively. Falls back to 9:00 only if truly unparseable.
const parseMinutes = (t: string): number => {
    const m = t?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return 9 * 60;
    let hour = parseInt(m[1], 10);
    const minute = parseInt(m[2], 10);
    const mer = m[3]?.toUpperCase();
    if (mer === 'PM' && hour !== 12) hour += 12;
    if (mer === 'AM' && hour === 12) hour = 0;
    return hour * 60 + minute;
};

const UNASSIGNED = '__unassigned__';

const CounselorDayView: React.FC<CounselorDayViewProps> = ({ date, counselors, appointments, onSelectAppt }) => {
    // Appointments on this calendar day.
    const dayEvents = useMemo(
        () => appointments.filter(a => new Date(a.date).toDateString() === date.toDateString()),
        [appointments, date],
    );

    // Lanes: one per active counselor (by name), plus a trailing "Unassigned" lane that
    // only appears when a same-day appointment's therapist matches no counselor — so the
    // admin view never silently drops a session.
    const lanes = useMemo(() => {
        const counselorNames = new Set(counselors.map(c => c.name));
        const byLane = new Map<string, Appointment[]>();
        counselors.forEach(c => byLane.set(c.name, []));
        let hasUnassigned = false;
        dayEvents.forEach(a => {
            const key = a.therapist && counselorNames.has(a.therapist) ? a.therapist : UNASSIGNED;
            if (key === UNASSIGNED) hasUnassigned = true;
            if (!byLane.has(key)) byLane.set(key, []);
            byLane.get(key)!.push(a);
        });
        const result = counselors.map(c => ({ key: c.name, label: c.name, events: byLane.get(c.name) || [] }));
        if (hasUnassigned) {
            result.push({ key: UNASSIGNED, label: 'Unassigned', events: byLane.get(UNASSIGNED) || [] });
        }
        return result;
    }, [counselors, dayEvents]);

    const blockStyle = (apt: Appointment): React.CSSProperties => {
        const startMin = parseMinutes(apt.startTime);
        const endMin = Math.max(parseMinutes(apt.endTime), startMin + 20);   // floor a visible height
        const top = ((startMin - DAY_START_HOUR * 60) / WINDOW_MIN) * 100;
        const height = ((endMin - startMin) / WINDOW_MIN) * 100;
        return { top: `${Math.max(0, top)}%`, height: `${Math.min(height, 100 - Math.max(0, top))}%` };
    };

    const isToday = date.toDateString() === new Date().toDateString();
    // Column template: a fixed time gutter + one equal fraction per lane.
    const gridCols = `4rem repeat(${lanes.length}, minmax(0, 1fr))`;

    return (
        <div className="flex-1 bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 dark:border-slate-700 overflow-hidden flex flex-col min-h-[600px]">
            {/* Lane header row: counselor names */}
            <div className="grid border-b border-slate-200 dark:border-slate-700/60" style={{ gridTemplateColumns: gridCols }}>
                <div className="p-3 border-r border-slate-100 dark:border-slate-700/30 text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center self-center">GMT-05</div>
                {lanes.map(lane => (
                    <div key={lane.key} className="p-3 text-center border-r border-slate-100 dark:border-slate-700/30 last:border-0">
                        <p className={`text-sm font-bold truncate ${lane.key === UNASSIGNED ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'}`}>{lane.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{lane.events.length} {lane.events.length === 1 ? 'session' : 'sessions'}</p>
                    </div>
                ))}
            </div>

            {/* Time grid */}
            <div className="flex-1 overflow-y-auto relative custom-scrollbar">
                <div className="grid h-[1040px]" style={{ gridTemplateColumns: gridCols }}>
                    {/* Time gutter */}
                    <div className="border-r border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/20">
                        {HOURS.map(hour => (
                            <div key={hour} className="h-[65px] border-b border-slate-100 dark:border-slate-700/30 text-right pr-2 pt-2 relative">
                                <span className="text-xs font-medium text-slate-400 relative -top-3">{hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}</span>
                            </div>
                        ))}
                    </div>

                    {/* Counselor lanes */}
                    {lanes.map(lane => (
                        <div key={lane.key} className="relative border-r border-slate-100 dark:border-slate-700/30 last:border-0 group">
                            {/* Hour gridlines */}
                            {HOURS.map(h => <div key={h} className="h-[65px] border-b border-slate-50 dark:border-slate-800/30"></div>)}

                            {/* Appointment blocks */}
                            {lane.events.map(apt => {
                                const s = getAppointmentStatusStyle(apt.status);
                                return (
                                    <div
                                        key={apt.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => onSelectAppt(apt)}
                                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectAppt(apt); } }}
                                        className={`group/event absolute left-1 right-1 rounded-xl p-2 border cursor-pointer hover:scale-[1.03] hover:z-10 transition-all duration-200 shadow-sm hover:shadow-md overflow-hidden backdrop-blur-sm ${s.card}`}
                                        style={blockStyle(apt)}
                                        title={`${apt.title} — ${apt.status} (click to change status)`}
                                    >
                                        <div className={`w-1 absolute left-0 top-0 bottom-0 ${s.bar}`}></div>
                                        <div className="pl-2 overflow-hidden">
                                            <p className={`font-bold text-xs truncate leading-tight ${apt.status === 'Canceled' ? 'line-through opacity-70' : ''}`}>{apt.clientName || apt.title}</p>
                                            <div className="flex items-center gap-1 mt-0.5 text-[10px] opacity-80">
                                                <Clock size={10} /> {apt.startTime} – {apt.endTime}
                                            </div>
                                            {apt.modality?.includes('Zoom') && (
                                                <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold opacity-90">
                                                    <Video size={10} /> Virtual
                                                </div>
                                            )}
                                            {apt.status !== 'Scheduled' && (
                                                <span className={`inline-flex items-center mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${s.badge}`}>{apt.status}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}

                    {/* Current-time indicator — spans all lanes when viewing today */}
                    {isToday && (() => {
                        const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
                        if (nowMin < DAY_START_HOUR * 60 || nowMin > DAY_END_HOUR * 60) return null;
                        const top = ((nowMin - DAY_START_HOUR * 60) / WINDOW_MIN) * 100;
                        return (
                            <div className="absolute left-[4rem] right-0 z-20 pointer-events-none flex items-center" style={{ top: `${top}%` }}>
                                <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-1.5 shadow-sm ring-2 ring-white dark:ring-slate-800"></div>
                                <div className="h-[2px] w-full bg-red-500 shadow-sm"></div>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};

export default CounselorDayView;
