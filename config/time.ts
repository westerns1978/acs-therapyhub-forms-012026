// Single source of truth for appointment time handling.
//
// CANONICAL FORMAT: 24-hour "HH:MM" (e.g. "18:00"). This is what <input type="time">
// emits and what timeStrFromDate produces on read, so the persisted round-trip is
// unambiguous. Display is derived (12-hour) — never stored.
//
// Why this exists: the booking path used to format times to 12-hour "06:00 PM" while
// combineDateAndTime only split on ":", so "06:00 PM" parsed to 6 AM — a 6 PM booking
// silently stored as 6 AM. Centralizing parse + format here kills that whole class of bug.

const pad2 = (n: number) => n.toString().padStart(2, '0');

/**
 * Parse a time label to minutes-from-midnight. Accepts the canonical 24-hour
 * "HH:MM" AND a defensive 12-hour "h:mm AM/PM" (so any legacy/foreign string is
 * handled correctly rather than truncated). Returns NaN when unparseable — callers
 * decide the fallback.
 */
export const parseTimeToMinutes = (label: string | null | undefined): number => {
    if (!label) return NaN;
    const m = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!m) return NaN;
    let hour = parseInt(m[1], 10);
    const minute = parseInt(m[2], 10);
    const mer = m[3]?.toUpperCase();
    if (mer === 'PM' && hour !== 12) hour += 12;
    if (mer === 'AM' && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return NaN;
    return hour * 60 + minute;
};

/** Canonical 24-hour "HH:MM" from minutes-from-midnight, clamped to 23:59 so a
 *  derived end time can never wrap past midnight into an inverted window. */
export const minutesToTimeLabel = (mins: number): string => {
    const clamped = Math.max(0, Math.min(Math.round(mins), 23 * 60 + 59));
    return `${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}`;
};

/** Local (NOT UTC) "YYYY-MM-DD" for a Date — matches <input type="date">'s value format.
 *  d.toISOString() would shift by the browser's UTC offset and can land on the wrong day. */
export const toLocalYMD = (d: Date): string =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Friendly 12-hour display, e.g. "18:00" → "6:00 PM". Falls back to the raw label
 *  if unparseable (never throws, never invents a time). */
export const formatTime12 = (label: string | null | undefined): string => {
    const mins = parseTimeToMinutes(label);
    if (Number.isNaN(mins)) return label ?? '';
    const h = Math.floor(mins / 60);
    const min = mins % 60;
    const mer = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${pad2(min)} ${mer}`;
};
