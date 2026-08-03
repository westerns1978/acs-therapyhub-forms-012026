/**
 * Completion-gate parity check — run whenever anything touches the completion
 * gate's constants.
 *
 *   npm run check:gate
 *
 * WHY THIS EXISTS. The completion gate now lives in Postgres
 * (`public.complete_client`, migration 20260802_p0_1_completion_gate.sql) so it
 * cannot be bypassed by writing the row directly. But two of its inputs are
 * CONSTANTS, not facts, and constants cannot be shared between SQL and
 * TypeScript — they can only be copied. Before this check they were already
 * copied twice INSIDE TypeScript:
 *
 *   • config/satopFees.ts            REQUIRED_HOURS_BY_LEVEL
 *   • compliance/missouri-compliance-pack.json   total_required_hours
 *   • services/complianceEngine.ts   the SROP 90-day minimum, a bare literal
 *   • config/formRegistry.ts         REQUIRED_FORMS_BY_LEVEL
 *
 * The migration's seed is now the SINGLE SOURCE. This check reads that seed
 * straight out of the migration file — no database, no credentials, no network —
 * and fails the build if any TypeScript copy disagrees with it.
 *
 * These are the numbers that decide how many hours a court-mandated client owes
 * before Missouri will reinstate their licence. Drift here is not a style
 * problem.
 */
import { REQUIRED_HOURS_BY_LEVEL, type SatopLevel } from '../config/satopFees';
import { REQUIRED_FORMS_BY_LEVEL } from '../config/formRegistry';
import pack from '../compliance/missouri-compliance-pack.json';

const fs = require('fs');
const path = require('path');

// npm scripts run from the package root; __dirname would be the esbuild
// bundle's home under node_modules/.cache.
const ROOT = process.cwd();
const MIGRATION = path.join(ROOT, 'supabase', 'migrations', '20260802_p0_1_completion_gate.sql');
const ENGINE = path.join(ROOT, 'services', 'complianceEngine.ts');

const LEVELS: SatopLevel[] = ['I', 'II', 'III', 'IV'];

let failures = 0;
const fail = (msg: string) => { failures++; console.error(`  FAIL  ${msg}`); };
const pass = (msg: string) => console.log(`  ok    ${msg}`);

// ── Parse the seed out of the migration ─────────────────────────────────────
// Deliberately parses the FILE, not the database: the check must run in CI, on a
// fresh clone, with no secrets — and the file is what will be applied.
const sql: string = fs.readFileSync(MIGRATION, 'utf8');

type Seed = { hours: number; counseling: number; days: number };
const seedLevels: Record<string, Seed> = {};
{
  const block = sql.match(
    /insert into public\.satop_level_requirements[\s\S]*?values([\s\S]*?)on conflict/i,
  );
  if (!block) throw new Error(`Could not find the satop_level_requirements seed in ${MIGRATION}`);
  const row = /\(\s*'(I{1,3}|IV)'\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = row.exec(block[1])) !== null) {
    seedLevels[m[1]] = { hours: Number(m[2]), counseling: Number(m[3]), days: Number(m[4]) };
  }
}

const seedForms: string[] = (() => {
  const block = sql.match(
    /insert into public\.satop_required_forms[\s\S]*?cross join \(values([\s\S]*?)\) as f\(form_id\)/i,
  );
  if (!block) throw new Error(`Could not find the satop_required_forms seed in ${MIGRATION}`);
  return [...block[1].matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]);
})();

// ── Gate 1 · every level is seeded ──────────────────────────────────────────
console.log('\n1. Every SATOP level has a seeded requirement');
for (const lvl of LEVELS) {
  if (!seedLevels[lvl]) fail(`level ${lvl} is missing from the migration seed`);
}
if (!failures) pass(`levels seeded: ${LEVELS.map((l) => `${l}=${seedLevels[l].hours}h`).join(', ')}`);

// ── Gate 2 · config/satopFees.ts agrees with the seed ───────────────────────
console.log('\n2. config/satopFees.ts REQUIRED_HOURS_BY_LEVEL == migration seed');
for (const lvl of LEVELS) {
  const ts = REQUIRED_HOURS_BY_LEVEL[lvl];
  const db = seedLevels[lvl]?.hours;
  if (ts !== db) fail(`level ${lvl}: satopFees.ts says ${ts}, the seed says ${db}`);
  else pass(`level ${lvl}: ${ts} hours`);
}

// ── Gate 3 · the compliance pack agrees with the seed ───────────────────────
console.log('\n3. compliance/missouri-compliance-pack.json == migration seed');
{
  const PACK_RULE: Record<SatopLevel, string> = {
    I: 'MO-SATOP-OEP-HOURS', II: 'MO-SATOP-WIP-HOURS',
    III: 'MO-SATOP-CIP-HOURS-SPLIT', IV: 'MO-SATOP-SROP-HOURS',
  };
  const levels = (pack as any).programs?.SATOP?.levels ?? {};
  const byId: Record<string, any> = {};
  for (const node of Object.values<any>(levels)) for (const r of node.rules ?? []) byId[r.id] = r;

  for (const lvl of LEVELS) {
    const rule = byId[PACK_RULE[lvl]];
    if (!rule) { fail(`level ${lvl}: pack rule ${PACK_RULE[lvl]} not found`); continue; }
    const seed = seedLevels[lvl];
    if (Number(rule.total_required_hours) !== seed.hours) {
      fail(`level ${lvl}: pack ${PACK_RULE[lvl]}.total_required_hours=${rule.total_required_hours}, seed=${seed.hours}`);
    } else pass(`${PACK_RULE[lvl]}: ${rule.total_required_hours} hours`);

    const packCouns = Number(rule.counseling_min_hours ?? 0);
    if (packCouns !== seed.counseling) {
      fail(`level ${lvl}: pack counseling_min_hours=${packCouns}, seed=${seed.counseling}`);
    } else pass(`${PACK_RULE[lvl]}: counselling floor ${packCouns}`);
  }
}

// ── Gate 4 · the SROP minimum-duration literal ──────────────────────────────
// evaluateDeadline() carries the 90 as a bare literal rather than reading it
// from the rule — the third copy this check exists to pin.
console.log('\n4. services/complianceEngine.ts SROP minimum duration == migration seed');
{
  const src: string = fs.readFileSync(ENGINE, 'utf8');
  const m = src.match(/const\s+min\s*=\s*(\d+)\s*;/);
  if (!m) fail('could not find the `const min = <days>` literal in evaluateDeadline()');
  else if (Number(m[1]) !== seedLevels.IV.days) {
    fail(`complianceEngine.ts hardcodes ${m[1]} days, the seed says ${seedLevels.IV.days}`);
  } else pass(`minimum duration ${m[1]} days`);
}

// ── Gate 5 · the required-forms set ─────────────────────────────────────────
console.log('\n5. config/formRegistry.ts REQUIRED_FORMS_BY_LEVEL == migration seed');
{
  const seedSorted = [...seedForms].sort();
  for (const lvl of LEVELS) {
    const tsSorted = [...(REQUIRED_FORMS_BY_LEVEL[lvl] ?? [])].sort();
    if (JSON.stringify(tsSorted) !== JSON.stringify(seedSorted)) {
      fail(`level ${lvl}: formRegistry.ts [${tsSorted.join(', ')}] != seed [${seedSorted.join(', ')}]`);
    } else pass(`level ${lvl}: ${tsSorted.length} required forms`);
  }
}

console.log(
  failures
    ? `\ncheck:gate FAILED — ${failures} disagreement(s) with supabase/migrations/20260802_p0_1_completion_gate.sql.\nThe migration seed is the single source. Change it there, then bring the TypeScript copies into line.\n`
    : '\ncheck:gate PASSED — every TypeScript copy of the completion-gate constants agrees with the migration seed.\n',
);
process.exit(failures ? 1 : 0);
