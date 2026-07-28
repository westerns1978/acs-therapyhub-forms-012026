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
