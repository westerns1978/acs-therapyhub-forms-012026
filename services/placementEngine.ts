/**
 * ACS — SATOP Placement Engine (deterministic, 9 CSR 30-3.206).
 *
 * THE single source of truth for DUI/DWI program placement. Pure: no I/O, no AI,
 * and `computePlacement` is DATE-FREE (deterministic from its inputs alone). The
 * 6-month screening-validity clock needs "today", so it lives in a SEPARATE pure
 * helper (`screeningValidity`) the UI calls at view-time — never inside the
 * placement decision.
 *
 * CLINICAL SAFETY: the constants below are encoded from the project handoff and
 * confirmed against 9 CSR 30-3.206 (current to 2024-01-30). They are explicit,
 * single-source, and reviewable — never scatter these as magic numbers. The engine
 * RECOMMENDS a floor; a clinician confirms or escalates UP at WS2 sign-off; the
 * engine never auto-applies an upgrade and never recommends below the floor.
 *
 * Scope: adult OEP/WIP/CIP/SROP (Levels I–IV). ADEP/youth is a separate path, out
 * of scope here. Service-hour completion counts are a separate feature.
 */
import type { SatopLevel } from '../config/satopFees';

// ── Level identity (reuses SatopLevel 'I'|'II'|'III'|'IV' — same key charges.satop_level
//    stores and complianceEngine labels; NOT a parallel enum). ─────────────────
// Ordering: OEP (I) < WIP (II) < CIP (III) < SROP (IV).
export const SATOP_LEVEL_ORDER: Record<SatopLevel, number> = { I: 1, II: 2, III: 3, IV: 4 };

export const SATOP_LEVEL_META: Record<SatopLevel, { code: string; label: string }> = {
  I: { code: 'OEP', label: 'OEP — Offender Education Program (Level I)' },
  II: { code: 'WIP', label: 'WIP — Weekend Intervention Program (Level II)' },
  III: { code: 'CIP', label: 'CIP — Clinical Intervention Program (Level III)' },
  IV: { code: 'SROP', label: 'SROP — Serious & Repeat Offender Program (Level IV)' },
};

// ── Placement rule constants (9 CSR 30-3.206). ───────────────────────────────
// Base level from offense_count: 1 → OEP, 2 → WIP, ≥3 → CIP. (0/1 floor at OEP —
// there is no level below OEP; every assessed client carries at least one offense.)
export const BASE_WIP_OFFENSE_COUNT = 2; // exactly 2 → WIP
export const BASE_CIP_OFFENSE_COUNT = 3; // ≥3 → CIP

// SROP (Level IV) HARD FLOOR — fires only when ALL THREE hold (prior/persistent offender).
export const SROP_BAC_THRESHOLD = 0.15; // bac >= 0.15
export const SROP_MIN_DUI_ARRESTS = 2; // dui_arrest_count >= 2 (arrests w/ DOR administrative action)
// + sud_diagnosis === true

// Screening-completion validity window (NOT part of the placement decision).
export const SCREENING_VALIDITY_MONTHS = 6;

// ── Types ────────────────────────────────────────────────────────────────────
export interface PlacementInputs {
  offense_count: number;
  dui_arrest_count: number;
  bac: number | null;
  sud_diagnosis: boolean;
  prior_treatment?: boolean;
  other_arrests?: number;
  life_issues?: boolean;
  dri2_result?: string | null;
}

/** Factors a clinician may use to escalate UP at WS2 — the engine never auto-applies them. */
export type UpgradeFactor = 'high_bac' | 'other_arrests' | 'dri2_result' | 'prior_treatment' | 'life_issues';

export interface PlacementResult {
  baseLevel: SatopLevel; // from offense_count
  sropFloorApplies: boolean; // the 3-condition hard rule
  sropConditions: { highBac: boolean; repeatDuiArrests: boolean; sudDiagnosis: boolean };
  recommendedFloor: SatopLevel; // higher of base vs SROP-if-fires; a clinician may go above, never below
  upgradeFactorsPresent: UpgradeFactor[];
  rationale: string[]; // FACTS only — which inputs drove the floor; not prose, not a verdict
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const toInt = (v: unknown): number => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const higher = (a: SatopLevel, b: SatopLevel): SatopLevel =>
  SATOP_LEVEL_ORDER[a] >= SATOP_LEVEL_ORDER[b] ? a : b;

/** Base level from offense_count (9 CSR 30-3.206). Floors at OEP for 0/1. */
export function baseLevelFromOffenseCount(offenseCount: number): SatopLevel {
  const n = toInt(offenseCount);
  if (n >= BASE_CIP_OFFENSE_COUNT) return 'III'; // CIP
  if (n === BASE_WIP_OFFENSE_COUNT) return 'II'; // WIP
  return 'I'; // OEP
}

/**
 * The deterministic placement recommendation. DATE-FREE — same inputs always give
 * the same result. Returns a recommended FLOOR; clinician escalates up at WS2.
 */
export function computePlacement(inputs: PlacementInputs): PlacementResult {
  const offenseCount = toInt(inputs.offense_count);
  const duiArrests = toInt(inputs.dui_arrest_count);
  const bac = inputs.bac == null || Number.isNaN(Number(inputs.bac)) ? null : Number(inputs.bac);
  const sud = inputs.sud_diagnosis === true;

  const baseLevel = baseLevelFromOffenseCount(offenseCount);

  // SROP hard floor: all three conditions.
  const highBac = bac != null && bac >= SROP_BAC_THRESHOLD;
  const repeatDuiArrests = duiArrests >= SROP_MIN_DUI_ARRESTS;
  const sropFloorApplies = highBac && repeatDuiArrests && sud;

  const recommendedFloor = sropFloorApplies ? higher(baseLevel, 'IV') : baseLevel;

  // Upgrade factors — surfaced for the clinician (NOT auto-applied).
  const upgradeFactorsPresent: UpgradeFactor[] = [];
  if (highBac) upgradeFactorsPresent.push('high_bac');
  if (toInt(inputs.other_arrests) > 0) upgradeFactorsPresent.push('other_arrests');
  if (typeof inputs.dri2_result === 'string' && inputs.dri2_result.trim() !== '')
    upgradeFactorsPresent.push('dri2_result');
  if (inputs.prior_treatment === true) upgradeFactorsPresent.push('prior_treatment');
  if (inputs.life_issues === true) upgradeFactorsPresent.push('life_issues');

  // Rationale — facts only.
  const rationale: string[] = [
    `offense_count=${offenseCount} ⇒ base ${SATOP_LEVEL_META[baseLevel].code} (Level ${baseLevel})`,
    `SROP conditions: bac≥${SROP_BAC_THRESHOLD}=${highBac} (bac=${bac == null ? 'n/a' : bac}), ` +
      `dui_arrest_count≥${SROP_MIN_DUI_ARRESTS}=${repeatDuiArrests} (count=${duiArrests}), ` +
      `sud_diagnosis=${sud} ⇒ SROP floor ${sropFloorApplies ? 'APPLIES' : 'not applied'}`,
    `recommendedFloor=${SATOP_LEVEL_META[recommendedFloor].code} (Level ${recommendedFloor})`,
  ];

  return { baseLevel, sropFloorApplies, sropConditions: { highBac, repeatDuiArrests, sudDiagnosis: sud }, recommendedFloor, upgradeFactorsPresent, rationale };
}

// ── Screening validity (separate from the placement decision) ────────────────
export interface ScreeningValidity {
  validUntil: string; // YYYY-MM-DD (screening_date + 6 months)
  expired: boolean; // asOf is strictly past validUntil
  daysRemaining: number; // negative once expired
}

const parseLocalDate = (d: string): Date | null => {
  // Parse date-only as LOCAL midnight (no UTC shift). Full timestamps parse as-is.
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00') : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};
const pad = (n: number) => String(n).padStart(2, '0');
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * 9 CSR screening-completion clock: a completed screening is valid for 6 months.
 * Pure — takes the reference date (`asOf`) explicitly so it stays deterministic
 * (the UI passes `new Date()`; tests pass a fixed date). Boundary: asOf == validUntil
 * is still valid; expired only once asOf is strictly past it.
 *
 * Reg exceptions (judicial-review motion / second opinion) are NOT auto-resolved —
 * the UI surfaces "re-screen required" and the clinician applies any exception at WS2.
 */
export function screeningValidity(screeningDate: string | null | undefined, asOf: Date): ScreeningValidity | null {
  if (!screeningDate) return null;
  const start = parseLocalDate(screeningDate);
  if (!start) return null;
  const until = new Date(start.getFullYear(), start.getMonth() + SCREENING_VALIDITY_MONTHS, start.getDate());
  const asOfMid = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  const daysRemaining = Math.round((until.getTime() - asOfMid.getTime()) / 86400000);
  return { validUntil: toYMD(until), expired: asOfMid.getTime() > until.getTime(), daysRemaining };
}
