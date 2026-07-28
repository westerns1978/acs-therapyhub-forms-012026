/**
 * Shared display formatters (2026-07-28).
 *
 * Before this file there were SIX byte-identical private `$${n.toFixed(2)}` money
 * formatters (Financials, BillingLedger, RecordPaymentModal, paymentReceipt,
 * complianceClock, ClientOverviewTab) and zero uses of Intl.NumberFormat — so
 * $1234.50 rendered without a thousands separator on court and billing documents.
 * And the one correct `plural()` helper was module-private in Dashboard.tsx while
 * the stat tiles beside it printed "1 SESSIONS TODAY".
 *
 * Add new formatters here, not per-component.
 */

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** "$1,234.50" — accepts number | string | null (DB numerics arrive as strings). */
export const formatMoney = (n: number | string | null | undefined): string =>
  USD.format(Number(n) || 0);

/** "1 session" / "3 sessions". Naive s-pluralizer — pass an explicit `pluralForm`
 *  for irregulars ("1 person", plural(2, 'person', 'people')). */
export const plural = (n: number, noun: string, pluralForm?: string): string =>
  `${n} ${n === 1 ? noun : (pluralForm ?? `${noun}s`)}`;

/** Bare plural noun for fixed labels next to a separate count ("SESSIONS TODAY"
 *  under a big number): pluralNoun(1, 'session') → "session". */
export const pluralNoun = (n: number, noun: string, pluralForm?: string): string =>
  n === 1 ? noun : (pluralForm ?? `${noun}s`);

const DAY_MS = 86_400_000;

/** Whole days elapsed since `iso` (local midnight-to-midnight, so "yesterday" is
 *  always 1 regardless of clock time). Null for missing/unparseable input —
 *  callers must render nothing rather than a fabricated 0. */
export const daysSince = (iso: string | Date | null | undefined): number | null => {
  if (!iso) return null;
  const then = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.max(0, Math.round((midnight(new Date()) - midnight(then)) / DAY_MS));
};

/** Human waiting-time label: "today" / "1 day" / "12 days". Null when unknown.
 *  Used for queue ageing (intake queue, unsigned notes) where an absolute date
 *  alone hides how long something has been sitting. */
export const waitingLabel = (iso: string | Date | null | undefined): string | null => {
  const d = daysSince(iso);
  if (d === null) return null;
  if (d === 0) return 'today';
  return plural(d, 'day');
};
