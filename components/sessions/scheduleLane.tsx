import React from 'react';
import { Appointment } from '../../types';
import { getAppointmentStatusStyle } from './AppointmentStatusModal';
import { parseTimeToMinutes, formatTime12, minutesToTimeLabel } from '../../config/time';
import { serviceCardClass } from '../../config/sessionTaxonomy';
import { Clock, Video, AlertTriangle } from 'lucide-react';

// Shared schedule-lane atom, extracted verbatim from CounselorDayView so the Day board
// and the by-counselor Week board render the SAME column: same visible window, same
// hour axis, same true-duration card, same double-book ring, same empty-slot click.
// A drift between the two views can't happen because there is only one renderer.

// Visible window: 6 AM – 9 PM. Covers early individual slots through evening groups
// (@ 18:00–20:00). The DB stores local times as 24-hour "HH:MM" (timeStrFromDate),
// so a 6 AM session is real and must fit.
export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 21;
export const WINDOW_MIN = (DAY_END_HOUR - DAY_START_HOUR) * 60;
export const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);

// The ONE shared hourHeight: every gutter/column renders HOURS.length rows of
// HOUR_ROW_PX, so the Day board and the Week board grids are always row-aligned.
// (Matches the h-[65px] / h-[1040px] Tailwind literals used in the markup below —
// change one, change all.)
export const HOUR_ROW_PX = 65;
export const GRID_HEIGHT_PX = HOURS.length * HOUR_ROW_PX;

// Time parsing/formatting comes from config/time.ts (single source of truth). Falls
// back to 9:00 for positioning only if the label is truly unparseable.
export const parseMinutes = (t: string): number => {
    const mins = parseTimeToMinutes(t);
    return Number.isNaN(mins) ? 9 * 60 : mins;
};

export const blockStyle = (apt: Appointment): React.CSSProperties => {
    const startMin = parseMinutes(apt.startTime);
    const endMin = Math.max(parseMinutes(apt.endTime), startMin + 20);   // floor a visible height
    const top = ((startMin - DAY_START_HOUR * 60) / WINDOW_MIN) * 100;
    const height = ((endMin - startMin) / WINDOW_MIN) * 100;
    return { top: `${Math.max(0, top)}%`, height: `${Math.min(height, 100 - Math.max(0, top))}%` };
};

export interface SlotClickInfo { counselorId?: string; counselorName?: string; date: Date; time: string }

// ---- Shared therapist -> counselor-lane attribution ------------------------------------
//
// A session is attributed to a lane by its real counselor_id FK (appointments.counselor_id,
// shipped 20260705 + backfilled/reconciled 2026-07-12). The therapist_name STRING match is
// now only a fallback for the legacy/unattributed tail (counselor_id NULL, or pointing at a
// counselor not in the active roster) — it strips credential suffixes so those rows still
// land in a lane instead of silently dropping to Unassigned. This is the ONE place the match
// happens; CounselorDayView and CounselorWeekView both call bucketByCounselor so Day and Week
// can never disagree about whose lane a session lands in.

export const UNASSIGNED_LANE_KEY = '__unassigned__';

/** Normalizes a display name for the NAME-FALLBACK attribution path: trims, collapses internal
 *  whitespace, strips a trailing credential suffix (everything from the first comma on —
 *  ", LPC" / ", MEd, LPC"), lowercases. Only used when a row has no usable counselor_id. */
export const normalizeCounselorName = (name: string | null | undefined): string =>
    (name ?? '').split(',')[0].trim().replace(/\s+/g, ' ').toLowerCase();

/** The lane an appointment attributes to, FK-first: its counselor_id when that id is in the
 *  active roster, else the normalized-name match, else undefined (Unassigned). `nameKeyToId`
 *  maps a normalized name to its counselor id; `knownIds` is the active roster's id set. */
export const laneCounselorIdFor = (
    appt: Pick<Appointment, 'counselorId' | 'therapist'>,
    knownIds: Set<string>,
    nameKeyToId: Map<string, string>,
): string | undefined => {
    if (appt.counselorId && knownIds.has(appt.counselorId)) return appt.counselorId;
    const nk = normalizeCounselorName(appt.therapist);
    return nk ? nameKeyToId.get(nk) : undefined;
};

export interface CounselorLaneBucket {
    key: string;
    label: string;
    counselorId?: string;
    events: Appointment[];
}

/** Buckets `events` into one lane per counselor — by counselor_id when present (the real FK),
 *  falling back to a normalized-name match for the legacy/NULL tail — plus a trailing
 *  "Unassigned" lane for anything that resolves to neither. Throws if two DISTINCT
 *  counselors.name values normalize to the same key, which would make the name-FALLBACK path
 *  ambiguous; a collision needs a human (rename in the roster), not a silent merge. The
 *  current roster is collision-free; this guards a future add. */
export const bucketByCounselor = (
    events: Appointment[],
    counselors: { id: string; name: string }[],
): CounselorLaneBucket[] => {
    const nameKeyToId = new Map<string, string>();
    const nameKeyToName = new Map<string, string>();
    counselors.forEach(c => {
        const key = normalizeCounselorName(c.name);
        const existing = nameKeyToName.get(key);
        if (existing && existing !== c.name) {
            throw new Error(`[bucketByCounselor] "${existing}" and "${c.name}" both normalize to "${key}" — name-fallback attribution would merge them. Rename one in the counselors table.`);
        }
        nameKeyToName.set(key, c.name);
        nameKeyToId.set(key, c.id);
    });

    const knownIds = new Set(counselors.map(c => c.id));
    const eventsById = new Map<string, Appointment[]>(counselors.map(c => [c.id, []]));
    const unassigned: Appointment[] = [];
    events.forEach(a => {
        const targetId = laneCounselorIdFor(a, knownIds, nameKeyToId);
        const bucket = targetId ? eventsById.get(targetId) : undefined;
        if (bucket) bucket.push(a);
        else unassigned.push(a);
    });

    const result: CounselorLaneBucket[] = counselors.map(c => ({
        key: c.name,
        label: c.name,
        counselorId: c.id,
        events: eventsById.get(c.id) || [],
    }));
    if (unassigned.length) {
        result.push({ key: UNASSIGNED_LANE_KEY, label: 'Unassigned', counselorId: undefined, events: unassigned });
    }
    return result;
};

interface LaneColumnProps {
    /** Calendar day this column represents (Day board: the viewed date; Week board: the weekday). */
    date: Date;
    /** Events already bucketed for THIS lane+day — the column does no filtering itself. */
    events: Appointment[];
    /** Lane identity for slot-click prefill; undefined = Unassigned lane (modal opens without a counselor). */
    counselorId?: string;
    counselorName?: string;
    onSelectAppt: (appt: Appointment) => void;
    /** Live therapist double-booking hits — renders the red ring/icon. Omitted = no ring. */
    conflictIds?: Set<string>;
    /** Fires when staff click an EMPTY point in the lane (cards stopPropagation). Omitted = no affordance. */
    onSlotClick?: (info: SlotClickInfo) => void;
    /** Border/width classes supplied by the host grid (Day: 1px lane dividers; Week: day/block dividers). */
    className?: string;
    /** Inline style from the host grid (Week board sets a fixed pixel column width). */
    style?: React.CSSProperties;
    /** Week board: draw the current-time line inside this column (its date is today).
     *  Day board leaves it unset — it draws one line spanning ALL lanes itself. */
    showNowLine?: boolean;
}

export const LaneColumn: React.FC<LaneColumnProps> = ({ date, events, counselorId, counselorName, onSelectAppt, conflictIds, onSlotClick, className, style, showNowLine }) => {
    // Step 9: empty-slot click -> prefilled booking. Reads the click's vertical position
    // within the lane, snaps to the nearest 30 min, and reports it plus the lane's counselor
    // (if any). Appointment cards stopPropagation() so clicking one opens ITS detail, never
    // also fires this.
    const handleLaneClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!onSlotClick) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        let minutesFromStart = Math.round((ratio * WINDOW_MIN) / 30) * 30;
        minutesFromStart = Math.max(0, Math.min(minutesFromStart, WINDOW_MIN - 30));
        onSlotClick({ counselorId, counselorName, date, time: minutesToTimeLabel(DAY_START_HOUR * 60 + minutesFromStart) });
    };

    const nowLine = (() => {
        if (!showNowLine) return null;
        const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
        if (nowMin < DAY_START_HOUR * 60 || nowMin > DAY_END_HOUR * 60) return null;
        const top = ((nowMin - DAY_START_HOUR * 60) / WINDOW_MIN) * 100;
        return (
            <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: `${top}%` }}>
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-1.5 shadow-sm ring-2 ring-white dark:ring-slate-800"></div>
                <div className="h-[2px] w-full bg-red-500 shadow-sm"></div>
            </div>
        );
    })();

    return (
        <div
            className={`relative group ${onSlotClick ? 'cursor-pointer' : ''} ${className ?? ''}`}
            style={style}
            onClick={onSlotClick ? handleLaneClick : undefined}
        >
            {/* Hour gridlines */}
            {HOURS.map(h => <div key={h} className="h-[65px] border-b border-slate-50 dark:border-slate-800/30"></div>)}

            {/* Appointment blocks */}
            {events.map(apt => {
                const s = getAppointmentStatusStyle(apt.status);
                // Card fill = service color; status stays on the bar + badge.
                // No taxonomy color → status card unchanged (see SessionManagement).
                const card = serviceCardClass(apt.sessionTypeId) ?? s.card;
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

            {nowLine}
        </div>
    );
};
