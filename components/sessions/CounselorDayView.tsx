import React, { useMemo } from 'react';
import { Appointment } from '../../types';
import type { Counselor } from '../../services/api';
import { LaneColumn, SlotClickInfo, DAY_START_HOUR, DAY_END_HOUR, WINDOW_MIN, HOURS } from './scheduleLane';

// The lane column itself (gridlines + true-duration cards + double-book ring + empty-slot
// click) lives in scheduleLane.tsx — shared verbatim with the by-counselor week board.
// This file keeps what is Day-specific: bucketing the day's appointments into one lane
// per counselor, the lane header row, the time gutter, and the all-lane now-line.

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
    onSlotClick?: (info: SlotClickInfo) => void;
}

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
                        <LaneColumn
                            key={lane.key}
                            date={date}
                            events={lane.events}
                            counselorId={lane.counselorId}
                            counselorName={lane.key === UNASSIGNED ? undefined : lane.label}
                            onSelectAppt={onSelectAppt}
                            conflictIds={conflictIds}
                            onSlotClick={onSlotClick}
                            className="border-r border-border dark:border-slate-700/50 last:border-0"
                        />
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
