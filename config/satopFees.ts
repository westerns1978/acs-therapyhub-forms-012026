/**
 * Single source of truth for Missouri SATOP program fees by level.
 *
 * Amounts are PLACEHOLDERS pending confirmation against the current DMH/ACS
 * published fee schedule (kickoff brief §5). Update them HERE — one place — when
 * the real numbers are confirmed; never re-hardcode a fee inline. The demo seed
 * (supabase/migrations/20260605_demo_data_completed_oep.sql) mirrors SATOP_FEES.I
 * for Jordan Ellis's payment row and must be kept in sync (SQL can't import this).
 */
export type SatopLevel = 'I' | 'II' | 'III' | 'IV';

export const SATOP_FEES: Record<SatopLevel, number | null> = {
  I: 200,    // OEP / ADEP — PLACEHOLDER, verify
  II: 467,   // WIP        — PLACEHOLDER, verify
  III: 1067, // CIP        — PLACEHOLDER, verify
  IV: null,  // SROP       — sliding scale / means-tested (no flat fee)
};

/** Map the engine's required-hours signature (10/20/50/75) to a SATOP level. */
export function satopLevelForRequiredHours(hours: number | null | undefined): SatopLevel | null {
  switch (hours) {
    case 10: return 'I';
    case 20: return 'II';
    case 50: return 'III';
    case 75: return 'IV';
    default: return null;
  }
}

/** Required program hours by SATOP level (9 CSR 30-3.206) — the inverse of
 *  satopLevelForRequiredHours, the single place the per-level total is declared. Lets
 *  the completion gate derive the required total FROM a signed level (WS4) instead of
 *  inferring the level from a static number. (SROP also has a ≥35-hour counseling floor,
 *  enforced via the pack rule's counseling_min_hours — not here.) */
export const REQUIRED_HOURS_BY_LEVEL: Record<SatopLevel, number> = { I: 10, II: 20, III: 50, IV: 75 };

/** Flat fee for a level, or null when unknown / means-tested. */
export function satopFee(level: SatopLevel | null | undefined): number | null {
  return level ? SATOP_FEES[level] : null;
}
