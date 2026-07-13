import React, { useMemo } from 'react';
import { Appointment } from '../../types';
import type { Counselor } from '../../services/api';
import { LaneColumn, SlotClickInfo, HOURS, GRID_HEIGHT_PX } from './scheduleLane';

// By-counselor week board — David's verbatim ask (7/7 follow-up): each counselor's WHOLE
// WEEK is its own block, blocks laid side by side, scrolled HORIZONTALLY across counselors
// (Outlook split-view model). The merged 7-day grid stays reachable behind the
// "Merged | By counselor" toggle in SessionManagement.
//
// Composition: one sticky left time gutter (the same hour axis scheduleLane exports —
// shared with the Day board, so rows align everywhere), then a horizontal track of
// counselor blocks. Each block = sticky name header + a flex row of weekday LaneColumns.
// LaneColumn is reused verbatim, so true-duration cards, service-color fill, the
// double-book ring, and click-empty-slot→create all behave exactly as in Day view.
//
// Dividers: 2px between counselor blocks, hairline (0.5px) between days within a block.
// Bucketing is by therapist NAME (same de-facto join the Day board uses — appointments
// attribute via therapist_name, not counselor_id; see DEFERRED.md), with a trailing
// amber "Unassigned" block whenever a visible appointment matches no counselor, so the
// week board never silently drops a session.

const DAY_COL_PX = 130;   // width of one weekday column inside a counselor block
const UNASSIGNED = '__unassigned__';

interface CounselorWeekViewProps {
    /** Visible days, in order (SessionManagement passes Mon–Fri; hand it 7 to show weekends). */
    weekDays: Date[];
    counselors: Counselor[];
    appointments: Appointment[];          // ALL appointments; filtered to weekDays here
    onSelectAppt: (appt: Appointment) => void;
    conflictIds?: Set<string>;
    onSlotClick?: (info: SlotClickInfo) => void;
}

const CounselorWeekView: React.FC<CounselorWeekViewProps> = ({ weekDays, counselors, appointments, onSelectAppt, conflictIds, onSlotClick }) => {
    // Appointments falling on a visible day, pre-bucketed per counselor block.
    const blocks = useMemo(() => {
        const dayKeys = new Set(weekDays.map(d => d.toDateString()));
        const visible = appointments.filter(a => dayKeys.has(new Date(a.date).toDateString()));
        const counselorNames = new Set(counselors.map(c => c.name));
        const byName = new Map<string, Appointment[]>();
        counselors.forEach(c => byName.set(c.name, []));
        const unassigned: Appointment[] = [];
        visible.forEach(a => {
            if (a.therapist && counselorNames.has(a.therapist)) byName.get(a.therapist)!.push(a);
            else unassigned.push(a);
        });
        const result = counselors.map(c => ({ key: c.name, label: c.name, counselorId: c.id as string | undefined, events: byName.get(c.name) || [] }));
        if (unassigned.length) {
            result.push({ key: UNASSIGNED, label: 'Unassigned', counselorId: undefined, events: unassigned });
        }
        return result;
    }, [counselors, appointments, weekDays]);

    const isToday = (d: Date) => d.toDateString() === new Date().toDateString();
    const eventsFor = (blockEvents: Appointment[], day: Date) =>
        blockEvents.filter(a => new Date(a.date).toDateString() === day.toDateString());

    // Divider recipe (applied identically to header cells and body columns so vertical
    // edges line up): 2px block divider on each block after the first, 0.5px hairline
    // between days inside a block.
    const blockDivider = (bi: number) => (bi > 0 ? 'border-l-2 border-l-slate-300 dark:border-l-slate-600' : '');
    const dayDivider = (di: number) => (di > 0 ? 'border-l-[0.5px] border-l-slate-200 dark:border-l-slate-700/50' : '');

    return (
        <div className="flex-1 bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-xl border border-border dark:border-slate-700 overflow-hidden flex flex-col min-h-[600px]">
            {/* ONE scroll container for both axes so sticky top (header) and sticky left
                (gutter) hold against the same scrolling content. */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                <div className="min-w-max">
                    {/* Header row: counselor name over that counselor's weekday labels. */}
                    <div className="flex sticky top-0 z-30 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/60">
                        {/* Corner cell — sticky on BOTH axes */}
                        <div className="sticky left-0 z-40 w-16 shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700/60 flex items-end justify-center pb-2">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">GMT-05</span>
                        </div>
                        {blocks.map((block, bi) => (
                            <div key={block.key} className={`shrink-0 ${blockDivider(bi)}`}>
                                <div className="px-3 pt-2 pb-1 text-center">
                                    <p className={`text-sm font-bold truncate ${block.key === UNASSIGNED ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'}`}>{block.label}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">{block.events.length} {block.events.length === 1 ? 'session' : 'sessions'} this week</p>
                                </div>
                                <div className="flex">
                                    {weekDays.map((day, di) => (
                                        <div key={day.toISOString()} className={`shrink-0 py-1.5 text-center ${dayDivider(di)} ${isToday(day) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`} style={{ width: DAY_COL_PX }}>
                                            <p className={`text-[10px] font-bold uppercase tracking-wider ${isToday(day) ? 'text-primary' : 'text-slate-400'}`}>
                                                {day.toLocaleDateString('en-US', { weekday: 'short' })} {day.getDate()}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Body: time gutter + one LaneColumn per counselor × weekday. */}
                    <div className="flex" style={{ height: GRID_HEIGHT_PX }}>
                        {/* Time gutter — sticky against horizontal scroll; opaque so cards
                            slide beneath it, not through it. */}
                        <div className="sticky left-0 z-20 w-16 shrink-0 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/60">
                            {HOURS.map(hour => (
                                <div key={hour} className="h-[65px] border-b border-slate-100 dark:border-slate-700/30 text-right pr-2 pt-2 relative">
                                    <span className="text-xs font-medium text-slate-400 relative -top-3">{hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}</span>
                                </div>
                            ))}
                        </div>
                        {blocks.map((block, bi) => (
                            <div key={block.key} className={`flex shrink-0 ${blockDivider(bi)}`}>
                                {weekDays.map((day, di) => (
                                    <LaneColumn
                                        key={day.toISOString()}
                                        date={day}
                                        events={eventsFor(block.events, day)}
                                        counselorId={block.counselorId}
                                        counselorName={block.key === UNASSIGNED ? undefined : block.label}
                                        onSelectAppt={onSelectAppt}
                                        conflictIds={conflictIds}
                                        onSlotClick={onSlotClick}
                                        showNowLine={isToday(day)}
                                        className={`shrink-0 ${dayDivider(di)} ${isToday(day) ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''}`}
                                        style={{ width: DAY_COL_PX }}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CounselorWeekView;
