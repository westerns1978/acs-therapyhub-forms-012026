/**
 * WS1 gating witness — exhaustive truth table for the SATOP placement engine.
 *
 * Enumerates offense_count × bac(below/at/above 0.15) × dui_arrest_count × sud_diagnosis
 * and asserts computePlacement().recommendedFloor against an INDEPENDENT oracle (the
 * oracle re-derives the expected level without importing the engine's internals, so a
 * bug in the engine can't hide behind a shared helper). Plus explicit edge assertions
 * and screening-validity boundary checks.
 *
 * Run it via the dev server in the browser:
 *   const m = await import('/services/placementEngine.truthTable.ts'); console.log(m.runTruthTable().text)
 * Returns structured results; `text` is the printable report.
 */
import {
  computePlacement,
  screeningValidity,
  SROP_BAC_THRESHOLD,
  SROP_MIN_DUI_ARRESTS,
  type PlacementInputs,
} from './placementEngine';
import type { SatopLevel } from '../config/satopFees';

// INDEPENDENT oracle — re-derives the expected floor from the reg, no engine internals.
function oracleBase(off: number): SatopLevel {
  if (off >= 3) return 'III';
  if (off === 2) return 'II';
  return 'I';
}
function oracleFloor(off: number, bac: number | null, dui: number, sud: boolean): SatopLevel {
  const sropFires = bac != null && bac >= SROP_BAC_THRESHOLD && dui >= SROP_MIN_DUI_ARRESTS && sud === true;
  return sropFires ? 'IV' : oracleBase(off);
}

interface Cell { off: number; bac: number | null; dui: number; sud: boolean; got: SatopLevel; want: SatopLevel; ok: boolean; }

export interface TruthTableResult {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  failures: Cell[];
  text: string;
}

export function runTruthTable(): TruthTableResult {
  const offenses = [0, 1, 2, 3, 4];
  const bacs: (number | null)[] = [0.14, 0.15, 0.16]; // below / at / above
  const duis = [0, 1, 2, 3];
  const suds = [true, false];

  const cells: Cell[] = [];
  for (const off of offenses)
    for (const bac of bacs)
      for (const dui of duis)
        for (const sud of suds) {
          const got = computePlacement({ offense_count: off, dui_arrest_count: dui, bac, sud_diagnosis: sud }).recommendedFloor;
          const want = oracleFloor(off, bac, dui, sud);
          cells.push({ off, bac, dui, sud, got, want, ok: got === want });
        }

  const failures = cells.filter((c) => !c.ok);

  // ── Explicit edge assertions (named) ──
  const fl = (i: Partial<PlacementInputs>): SatopLevel =>
    computePlacement({ offense_count: 0, dui_arrest_count: 0, bac: null, sud_diagnosis: false, ...i }).recommendedFloor;
  const edges: { name: string; got: string; want: string; ok: boolean }[] = [
    { name: 'bac = 0.15 is SROP-eligible (>=)', want: 'IV', got: fl({ offense_count: 1, bac: 0.15, dui_arrest_count: 2, sud_diagnosis: true }) },
    { name: 'dui_arrest_count = 2 is eligible', want: 'IV', got: fl({ offense_count: 1, bac: 0.2, dui_arrest_count: 2, sud_diagnosis: true }) },
    { name: 'sud_diagnosis = false blocks SROP (high BAC + many arrests)', want: 'I', got: fl({ offense_count: 1, bac: 0.25, dui_arrest_count: 3, sud_diagnosis: false }) },
    { name: 'bac = 0.14 (just below) does NOT fire SROP', want: 'I', got: fl({ offense_count: 1, bac: 0.14, dui_arrest_count: 3, sud_diagnosis: true }) },
    { name: 'bac null does NOT fire SROP', want: 'II', got: fl({ offense_count: 2, bac: null, dui_arrest_count: 3, sud_diagnosis: true }) },
    { name: 'offense_count >= 3 → CIP base (no SROP)', want: 'III', got: fl({ offense_count: 3, bac: 0.1, dui_arrest_count: 1, sud_diagnosis: false }) },
    { name: 'SROP overrides a lower base (offense 1)', want: 'IV', got: fl({ offense_count: 1, bac: 0.16, dui_arrest_count: 2, sud_diagnosis: true }) },
    { name: 'CIP base + SROP fires → SROP (IV), never below floor', want: 'IV', got: fl({ offense_count: 4, bac: 0.16, dui_arrest_count: 2, sud_diagnosis: true }) },
  ].map((e) => ({ ...e, ok: e.got === e.want }));

  // ── Screening-validity boundary checks (fixed asOf — deterministic) ──
  const sv = (screening: string, y: number, m: number, d: number) => screeningValidity(screening, new Date(y, m - 1, d));
  const screen: { name: string; got: string; want: string; ok: boolean }[] = [
    { name: 'screening + 6mo == asOf → valid (not expired)', want: 'valid', got: sv('2025-12-06', 2026, 6, 6)!.expired ? 'expired' : 'valid' },
    { name: 'screening + 6mo + 1 day → expired', want: 'expired', got: sv('2025-12-06', 2026, 6, 7)!.expired ? 'expired' : 'valid' },
    { name: 'screening + >6mo → expired', want: 'expired', got: sv('2025-12-05', 2026, 6, 6)!.expired ? 'expired' : 'valid' },
    { name: 'screening within window → valid', want: 'valid', got: sv('2026-05-01', 2026, 6, 6)!.expired ? 'expired' : 'valid' },
    { name: 'validUntil computed correctly (2025-12-06 + 6mo)', want: '2026-06-06', got: sv('2025-12-06', 2026, 6, 6)!.validUntil },
  ].map((e) => ({ ...e, ok: e.got === e.want }));

  const edgeFails = edges.filter((e) => !e.ok).length + screen.filter((e) => !e.ok).length;
  const ok = failures.length === 0 && edgeFails === 0;

  // ── Printable report ──
  const lines: string[] = [];
  lines.push('═══ SATOP PLACEMENT ENGINE — TRUTH TABLE ═══');
  lines.push(`Rules: base 1→OEP(I) 2→WIP(II) ≥3→CIP(III); SROP(IV) floor iff bac≥${SROP_BAC_THRESHOLD} AND dui≥${SROP_MIN_DUI_ARRESTS} AND sud=true`);
  lines.push('');
  lines.push('off | bac  | dui | sud   | floor | expect | ok');
  lines.push('----|------|-----|-------|-------|--------|----');
  let lastOff = -1;
  for (const c of cells) {
    if (c.off !== lastOff) { if (lastOff !== -1) lines.push('----|------|-----|-------|-------|--------|----'); lastOff = c.off; }
    lines.push(
      `${c.off}   | ${String(c.bac ?? 'null').padEnd(4)} | ${c.dui}   | ${String(c.sud).padEnd(5)} | ${c.got.padEnd(5)} | ${c.want.padEnd(6)} | ${c.ok ? '✓' : '✗ FAIL'}`,
    );
  }
  lines.push('');
  lines.push(`TRUTH TABLE: ${cells.length - failures.length}/${cells.length} cells pass${failures.length ? ` — ${failures.length} FAILED` : ' — ALL GREEN'}`);
  lines.push('');
  lines.push('── Explicit edge assertions ──');
  for (const e of edges) lines.push(`${e.ok ? '✓' : '✗ FAIL'}  ${e.name}  →  got ${e.got}, want ${e.want}`);
  lines.push('');
  lines.push('── Screening-validity boundaries (6-month clock) ──');
  for (const e of screen) lines.push(`${e.ok ? '✓' : '✗ FAIL'}  ${e.name}  →  got ${e.got}, want ${e.want}`);
  lines.push('');
  lines.push(ok ? '✅ ALL ASSERTIONS GREEN' : '❌ FAILURES PRESENT — DO NOT SHIP');

  return { ok, total: cells.length, passed: cells.length - failures.length, failed: failures.length, failures, text: lines.join('\n') };
}
