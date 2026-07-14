import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { Appointment } from '../../types';
import type { Counselor } from '../../services/api';
import { LaneColumn, SlotClickInfo, HOURS, GRID_HEIGHT_PX, bucketByCounselor, UNASSIGNED_LANE_KEY } from './scheduleLane';

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
// SCROLL MODEL (fixed 2026-07-12): the scroll container's height is CAPPED to the viewport
// so it becomes its own two-axis scroll region — the horizontal scrollbar sits at the bottom
// of the VISIBLE box (previously it rendered ~700px below the fold because the track grew to
// its full ~1200px content height and the whole PAGE scrolled instead, leaving a mouse user
// with no way to reach counselors off the right edge). On top of the now-visible bar:
//   • wheel-to-horizontal over the counselor HEADER strip (vertical mouse wheel → sideways
//     pan) so a Windows/mouse user needs no shift key; the day BODIES keep vertical wheel =
//     time scroll.
//   • a right-edge fade + "scroll" hint so the off-screen counselors are discoverable.
//
// Dividers: 2px between counselor blocks, hairline (0.5px) between days within a block.
// Bucketing goes through scheduleLane's bucketByCounselor (FK-first, name fallback), with a
// trailing amber "Unassigned" block whenever a visible appointment matches no counselor.

const DAY_COL_PX = 130;   // width of one weekday column inside a counselor block

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
        return bucketByCounselor(visible, counselors);
    }, [counselors, appointments, weekDays]);

    const isToday = (d: Date) => d.toDateString() === new Date().toDateString();
    const eventsFor = (blockEvents: Appointment[], day: Date) =>
        blockEvents.filter(a => new Date(a.date).toDateString() === day.toDateString());

    // Divider recipe (applied identically to header cells and body columns so vertical
    // edges line up): 2px block divider on each block after the first, 0.5px hairline
    // between days inside a block.
    const blockDivider = (bi: number) => (bi > 0 ? 'border-l-2 border-l-slate-300 dark:border-l-slate-600' : '');
    const dayDivider = (di: number) => (di > 0 ? 'border-l-[0.5px] border-l-slate-200 dark:border-l-slate-700/50' : '');

    const scrollerRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const rightFadeRef = useRef<HTMLDivElement>(null);
    const leftFadeRef = useRef<HTMLDivElement>(null);
    const pillRef = useRef<HTMLDivElement>(null);

    // Cues are painted by DIRECT DOM writes from a native scroll listener rather than React
    // state — React-state + the delegated onScroll + the Play-CDN class toggling each proved
    // unreliable (stale reads, non-bubbling scroll, ungenerated utility values). A ref write
    // is immune to all three.
    const paintCues = useCallback(() => {
        const sc = scrollerRef.current;
        if (!sc) return;
        const moreRight = sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 1;
        const moreLeft = sc.scrollLeft > 1;
        if (rightFadeRef.current) rightFadeRef.current.style.opacity = moreRight ? '1' : '0';
        if (pillRef.current) pillRef.current.style.opacity = moreRight ? '1' : '0';
        if (leftFadeRef.current) leftFadeRef.current.style.opacity = moreLeft ? '1' : '0';
    }, []);

    // Cap the scroller to the viewport so it (not the page) owns vertical + horizontal scroll,
    // which lands the horizontal scrollbar inside the visible box and makes the sticky header/
    // gutter pin against real internal scroll. Re-measured live so header wrap / window resize
    // never strands the bar off-screen again.
    useEffect(() => {
        const sc = scrollerRef.current;
        if (!sc) return;
        const fit = () => {
            const top = sc.getBoundingClientRect().top;
            const vh = window.innerHeight || document.documentElement.clientHeight || 800;
            sc.style.maxHeight = `${Math.max(320, vh - top - 12)}px`;
            paintCues();
        };
        fit();
        // rAF catches the first post-layout frame — on the first synchronous run
        // clientWidth/scrollWidth can still be 0, which would mis-hide the edge cue.
        const raf = requestAnimationFrame(fit);
        const onScroll = () => paintCues();
        sc.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', fit);
        const ro = new ResizeObserver(fit);
        ro.observe(sc);
        return () => {
            cancelAnimationFrame(raf);
            sc.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', fit);
            ro.disconnect();
        };
    }, [paintCues, blocks.length, weekDays.length]);

    // Wheel-to-horizontal over the counselor header strip — a Windows/mouse user pans across
    // counselors with the plain vertical wheel (no shift). Non-passive so preventDefault can
    // stop the page from also scrolling. Day bodies are untouched → vertical wheel = time scroll.
    useEffect(() => {
        const hdr = headerRef.current;
        if (!hdr) return;
        const onWheel = (e: WheelEvent) => {
            const sc = scrollerRef.current;
            if (!sc || sc.scrollWidth <= sc.clientWidth) return;
            const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
            if (delta === 0) return;
            sc.scrollLeft += delta;
            paintCues();   // repaint directly — don't depend on a scroll event following
            e.preventDefault();
        };
        hdr.addEventListener('wheel', onWheel, { passive: false });
        return () => hdr.removeEventListener('wheel', onWheel);
    }, [paintCues]);

    return (
        <div className="relative flex-1 bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-xl border border-border dark:border-slate-700 overflow-hidden flex flex-col min-h-0">
            {/* ONE scroll container for both axes (height capped in the effect above) so sticky
                top (header) + sticky left (gutter) hold against real internal scroll and the
                horizontal scrollbar stays inside the visible box. */}
            <div ref={scrollerRef} className="flex-1 overflow-auto">
                <div className="min-w-max">
                    {/* Header row: counselor name over that counselor's weekday labels. Wheel
                        over this strip pans horizontally (see effect). */}
                    <div ref={headerRef} className="flex sticky top-0 z-30 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/60">
                        {/* Corner cell — sticky on BOTH axes */}
                        <div className="sticky left-0 z-40 w-16 shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700/60 flex items-end justify-center pb-2">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">GMT-05</span>
                        </div>
                        {blocks.map((block, bi) => (
                            <div key={block.key} className={`shrink-0 ${blockDivider(bi)}`}>
                                <div className="px-3 pt-2 pb-1 text-center">
                                    <p className={`text-sm font-bold truncate ${block.key === UNASSIGNED_LANE_KEY ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'}`}>{block.label}</p>
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
                                        counselorName={block.key === UNASSIGNED_LANE_KEY ? undefined : block.label}
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

            {/* Discoverability cues — more counselors exist off an edge. pointer-events-none so
                they never block a card click; the sticky left gutter sits above the left fade.
                Opacity is an INLINE style (not a toggled Tailwind class) because the Play-CDN
                Tailwind can fail to generate a utility value that wasn't in the initial DOM scan. */}
            <div
                ref={rightFadeRef}
                className="pointer-events-none absolute top-0 right-0 bottom-0 w-14 bg-gradient-to-l from-white/95 dark:from-slate-800/95 to-transparent transition-opacity duration-200"
                style={{ opacity: 0 }}
                aria-hidden
            />
            <div
                ref={leftFadeRef}
                className="pointer-events-none absolute top-0 left-16 bottom-0 w-10 bg-gradient-to-r from-white/90 dark:from-slate-800/90 to-transparent transition-opacity duration-200"
                style={{ opacity: 0 }}
                aria-hidden
            />
            <div
                ref={pillRef}
                className="pointer-events-none absolute bottom-3 right-3 z-40 flex items-center gap-1 rounded-full bg-slate-800/80 dark:bg-slate-100/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white dark:text-slate-800 shadow transition-opacity duration-200"
                style={{ opacity: 0 }}
                aria-hidden
            >
                Scroll for more counselors →
            </div>
        </div>
    );
};

export default CounselorWeekView;
