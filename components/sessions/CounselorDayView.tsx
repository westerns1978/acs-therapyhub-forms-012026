import React, { useMemo } from 'react';
import { Appointment } from '../../types';
import type { Counselor } from '../../services/api';
import { getAppointmentStatusStyle } from './AppointmentStatusModal';
import { parseTimeToMinutes, formatTime12, minutesToTimeLabel } from '../../config/time';
import { serviceCardClass } from '../../config/sessionTaxonomy';
import { Clock, Video, AlertTriangle } from 'lucide-react';

interface CounselorDayViewProps {
    date: Date;
    counselors: Counselor[];
    appointments: Appointment[];          // ALL appointments; filtered to `date` here
    onSelectAppt: (appt: Appointment) => void;
    // WS1 step C — single-lane mode for a non-admin clinician. When set, the view renders ONE
    // lane with this label holding ALL visible appointments (RLS already scopes them to this
    // clinician), and does NOT bucket by therapist_name (which would mis-file credential-
    // suffixed rows into "Unassigned") and shows NO Unassigned lane. Omitted/null = admin
    // all-counselor mode (unchanged).
    soloLabel?: string | null;
    /** Live therapist double-booking hits (SessionManagement's conflictIds — same-name +
     *  same-day + time-overlap). Renders the red ring/icon the old flat week grid had.
     *  Omitted = no ring, i.e. Day view's existing behavior is unchanged. */
    conflictIds?: Set<string>;
    /** Step 8 week board: fixed-width lane columns + horizontal scroll instead of the
     *  default compress-to-fit. Day view leaves this unset — unchanged behavior. */
    scrollable?: boolean;
    /** Step 9 distributed booking: the solo lane's counselor id (non-admin mode), so a
     *  slot click can prefill it same as any other lane. Ignored in admin mode. */
    soloCounselorId?: string;
    /** Step 9: fires when staff click an EMPTY point in a lane (not an existing appointment
     *  card, which stops propagation). Omitted = no click affordance (neither view opts out
     *  today, but kept optional so a future read-only consumer isn't forced to wire it). */
    onSlotClick?: (info: { counselorId?: string; counselorName?: string; date: Date; time: string }) => void;
}

// Visible window: 6 AM – 9 PM. Covers early individual slots through evening groups
// (@ 18:00–20:00). The DB stores local times as 24-hour "HH:MM" (timeStrFromDate),
// so a 6 AM session is real and must fit.
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 21;
const WINDOW_MIN = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);

// Time parsing/formatting comes from config/time.ts (single source of truth). Falls
// back to 9:00 for positioning only if the label is truly unparseable.
const parseMinutes = (t: string): number => {
    const mins = parseTimeToMinutes(t);
    return Number.isNaN(mins) ? 9 * 60 : mins;
};

const UNASSIGNED = '__unassigned__';

const CounselorDayView: React.FC<CounselorDayViewProps> = ({ date, counselors, appointments, onSelectAppt, soloLabel, conflictIds, scrollable, soloCounselorId, onSlotClick }) => {
    // Appointments on this calendar day.
    const dayEvents = useMemo(
        () => appointments.filter(a => new Date(a.date).toDateString() === date.toDateString()),
        [appointments, date],
    );

    // Lanes: one per active counselor (by name), plus a trailing "Unassigned" lane that
    // only appears when a same-day appointment's therapist matches no counselor — so the
    // admin view never silently drops a session.
    const lanes = useMemo(() => {
        // Single-lane mode (non-admin clinician): every visible appointment is already this
        // clinician's (RLS-scoped), so put them ALL in one lane — do NOT bucket by therapist_name
        // (that mis-files "Karen Ventimiglia, LPC" into Unassigned) and show NO Unassigned lane.
        if (soloLabel) {
            return [{ key: 'solo', label: soloLabel, events: dayEvents, counselorId: soloCounselorId }];
        }
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
        const result = counselors.map(c => ({ key: c.name, label: c.name, events: byLane.get(c.name) || [], counselorId: c.id as string | undefined }));
        if (hasUnassigned) {
            // No resolvable counselor for this lane — a slot click here still opens the
            // modal (via onSlotClick below), just without a counselor prefill.
            result.push({ key: UNASSIGNED, label: 'Unassigned', events: byLane.get(UNASSIGNED) || [], counselorId: undefined });
        }
        return result;
    }, [counselors, dayEvents, soloLabel, soloCounselorId]);

    const blockStyle = (apt: Appointment): React.CSSProperties => {
        const startMin = parseMinutes(apt.startTime);
        const endMin = Math.max(parseMinutes(apt.endTime), startMin + 20);   // floor a visible height
        const top = ((startMin - DAY_START_HOUR * 60) / WINDOW_MIN) * 100;
        const height = ((endMin - startMin) / WINDOW_MIN) * 100;
        return { top: `${Math.max(0, top)}%`, height: `${Math.min(height, 100 - Math.max(0, top))}%` };
    };

    // Step 9: empty-slot click -> prefilled booking. Reads the click's vertical position
    // within the lane, snaps to the nearest 30 min, and reports it plus the lane's counselor
    // (if any). Appointment cards stopPropagation() so clicking one opens ITS detail, never
    // also fires this.
    const handleLaneClick = (counselorId: string | undefined, counselorName: string | undefined, e: React.MouseEvent<HTMLDivElement>) => {
        if (!onSlotClick) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        let minutesFromStart = Math.round((ratio * WINDOW_MIN) / 30) * 30;
        minutesFromStart = Math.max(0, Math.min(minutesFromStart, WINDOW_MIN - 30));
        onSlotClick({ counselorId, counselorName, date, time: minutesToTimeLabel(DAY_START_HOUR * 60 + minutesFromStart) });
    };

    const isToday = date.toDateString() === new Date().toDateString();
    // Column template: a fixed time gutter + one fraction per lane. `scrollable` (week board)
    // forces a real per-lane min-width so the roster doesn't compress into illegibility —
    // the container scrolls horizontally instead, matching the Outlook split-view model.
    // Day view passes nothing, so it keeps its original compress-to-fit behavior untouched.
    const LANE_MIN_WIDTH = 160;
    const gridCols = scrollable
        ? `4rem repeat(${lanes.length}, minmax(${LANE_MIN_WIDTH}px, 1fr))`
        : `4rem repeat(${lanes.length}, minmax(0, 1fr))`;

    // Lane header row (counselor names) and the time grid body are split into named JSX so
    // `scrollable` (week board) can wrap BOTH in a shared horizontal-scroll container without
    // touching their own markup — Day view (scrollable unset) renders them exactly as before.
    const laneHeader = (
        <div className="grid border-b border-slate-200 dark:border-slate-700/60" style={{ gridTemplateColumns: gridCols }}>
            <div className="p-3 border-r border-border dark:border-slate-700/50 text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center self-center">GMT-05</div>
            {lanes.map(lane => (
                <div key={lane.key} className="p-3 text-center border-r border-border dark:border-slate-700/50 last:border-0">
                    <p className={`text-sm font-bold truncate ${lane.key === UNASSIGNED ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'}`}>{lane.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{lane.events.length} {lane.events.length === 1 ? 'session' : 'sessions'}</p>
                </div>
            ))}
        </div>
    );

    const timeGridBody = (
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
                        <div
                            key={lane.key}
                            className={`relative border-r border-border dark:border-slate-700/50 last:border-0 group ${onSlotClick ? 'cursor-pointer' : ''}`}
                            onClick={onSlotClick ? e => handleLaneClick(lane.counselorId, lane.key === UNASSIGNED ? undefined : lane.label, e) : undefined}
                        >
                            {/* Hour gridlines */}
                            {HOURS.map(h => <div key={h} className="h-[65px] border-b border-slate-50 dark:border-slate-800/30"></div>)}

                            {/* Appointment blocks */}
                            {lane.events.map(apt => {
                                const s = getAppointmentStatusStyle(apt.status);
                                // Card fill = service color; status stays on the bar + badge.
                                // No taxonomy color → status card unchanged (see SessionManagement).
                                const card = serviceCardClass(apt.sessionTypeId) ?? s.card;
                                // Same double-booking overlay the old flat week grid had — carried
                                // over so the week board is born correct (David 7/7, step 8).
                                const isConflict = !!conflictIds?.has(apt.id);
                                return (
                                    <div
                                        key={apt.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={e => { e.stopPropagation(); onSelectAppt(apt); }}
                                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSelectAppt(apt); } }}
                                        className={`group/event absolute left-1 right-1 rounded-xl p-2 border cursor-pointer hover:scale-[1.03] hover:z-10 transition-all duration-200 shadow-sm hover:shadow-md overflow-hidden backdrop-blur-sm ${card} ${isConflict ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
                                        style={blockStyle(apt)}
                                        title={isConflict ? `${apt.title} — DOUBLE-BOOKED with another ${apt.therapist} session` : `${apt.title} — ${apt.status} (click to change status)`}
                                    >
                                        <div className={`w-1 absolute left-0 top-0 bottom-0 ${s.bar}`}></div>
                                        {isConflict && (
                                            <span className="absolute top-1 right-1 z-10" title={`Double-booked with another ${apt.therapist} session`}>
                                                <AlertTriangle size={12} className="text-red-600 fill-red-100" />
                                            </span>
                                        )}
                                        <div className="pl-2 overflow-hidden">
                                            <p className={`font-bold text-xs truncate leading-tight ${apt.status === 'Canceled' ? 'line-through opacity-70' : ''}`}>{apt.clientName || apt.title}</p>
                                            <div className="flex items-center gap-1 mt-0.5 text-[10px] opacity-80">
                                                <Clock size={10} /> {formatTime12(apt.startTime)} – {formatTime12(apt.endTime)}
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
    );

    return (
        <div className="flex-1 bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-xl border border-border dark:border-slate-700 overflow-hidden flex flex-col min-h-[600px]">
            {scrollable ? (
                <div className="flex-1 overflow-x-auto flex flex-col min-h-0">
                    <div style={{ minWidth: `calc(4rem + ${lanes.length * LANE_MIN_WIDTH}px)` }} className="flex flex-col flex-1 min-h-0">
                        {laneHeader}
                        {timeGridBody}
                    </div>
                </div>
            ) : (
                <>
                    {laneHeader}
                    {timeGridBody}
                </>
            )}
        </div>
    );
};

export default CounselorDayView;
