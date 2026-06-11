/**
 * ACS TherapyHub — Deterministic Compliance Engine v1
 *
 * THE governing rule (see compliance/missouri-compliance-pack-SPEC.md):
 *   Deterministic code decides every count and verdict. AI NEVER does.
 *   There is intentionally NO Gemini/LLM import in this module. Clara may later
 *   *explain* a verdict from the RAG knowledge base, but the status/count below
 *   is computed here, in code, against real data.
 *
 * Rules are DATA (the Missouri pack JSON); the engine is CODE (seven primitive
 * evaluators). Adding a state = new pack, same evaluators.
 *
 * This v1 wires only the DEMO-SAFE rules that have backing data in the current
 * schema (SROP hours + SROP minimum-duration). Every other rule is implemented
 * but returns `not_enforceable` with the exact field it still needs — we never
 * invent schema to force a verdict.
 *
 * Advisory only in this pass: we WARN and FLAG. No hard-block/lock is applied
 * to mock demo flows (HARD_LOCK/HARD_BLOCK enforcement is the real-data era).
 */
import pack from '../compliance/missouri-compliance-pack.json';
import { supabase } from './supabase';
import { REQUIRED_HOURS_BY_LEVEL, type SatopLevel } from '../config/satopFees';
import { REQUIRED_FORMS_BY_LEVEL } from '../config/formRegistry';

export type Primitive =
  | 'HOURS' | 'DEADLINE' | 'DOCUMENT' | 'SIGNATURE' | 'CONSTRAINT' | 'SEQUENCE' | 'CREDENTIAL';

export type VerdictStatus = 'met' | 'warning' | 'violation' | 'not_enforceable';

export interface RuleVerdict {
  ruleId: string;
  label: string;
  primitive: Primitive;
  status: VerdictStatus;
  detail: string;
  citation: string;
}

/** Normalized, engine-readable view of one client. Decoupled from DB column names. */
export interface ClientFacts {
  id: string;
  name: string;
  program: string;            // UPPER-cased program_type
  status: string;             // lower-cased status
  hoursCompleted: number | null;
  determinedLevel: SatopLevel | null;  // WS4: from the SIGNED determination (current, non-superseded) — the level source
  totalRequired: number | null;        // WS4: DERIVED from determinedLevel (the static column is no longer the source)
  enrollmentDate: string | null;     // clients.created_at — the real program-start anchor
  completionDate: string | null;     // clients.program_end_date (or null while active)
  planExecutionDate: string | null;  // treatment-plan execution date — absent today
  hourComponents: Record<string, number> | null; // per-category hours — absent today
  outstandingBalance: number | null;  // clients.balance — completion gate (must be 0)
  completionSignedOff: boolean | null; // signed completion_signoff note — completion gate
  signedFormIds: Set<string> | null;   // WS5: ids of the client's completed/reviewed forms — required-forms gate
}

export const PACK_ID: string = (pack as any).pack_id;
export const PACK_VERSION: string = (pack as any).version;

const DAY_MS = 86_400_000;
const daysElapsed = (sinceIso: string, untilMs: number): number =>
  Math.floor((untilMs - new Date(sinceIso).getTime()) / DAY_MS);

// ── Flatten the nested pack into a by-id rule map once at load ────────────────
type RuleDef = any;
function buildRuleIndex(): Record<string, RuleDef> {
  const idx: Record<string, RuleDef> = {};
  const add = (r: any) => { if (r && r.id) idx[r.id] = r; };
  const programs = (pack as any).programs || {};
  for (const prog of Object.values<any>(programs)) {
    (prog.rules || []).forEach(add);
    if (prog.entry_rule) add(prog.entry_rule);
    if (prog.levels) for (const lvl of Object.values<any>(prog.levels)) (lvl.rules || []).forEach(add);
    if (prog.comparable_out_of_state) (prog.comparable_out_of_state.rules || []).forEach(add);
  }
  return idx;
}
export const RULES: Record<string, RuleDef> = buildRuleIndex();
export const getRule = (id: string): RuleDef | undefined => RULES[id];

/**
 * Program-aware routing. Maps a client's normalized program (UPPER program_type) to a
 * pack `programs.*` node key. SATOP routes through the level logic in evaluateClientCompliance,
 * NOT here. Non-SATOP programs run their node's flat `rules` (the evaluators are generic).
 */
const PROGRAM_TO_PACK: Record<string, string> = {
  OPIOID_RECOVERY: 'OUTPATIENT_SUD',         // opioid has no distinct node — generic outpatient SUD covers it
  'INDIVIDUAL COUNSELING': 'OUTPATIENT_SUD',
  GAMBLING_RECOVERY: 'GAMBLING',
  'ANGER MANAGEMENT': 'ANGER',
};
export const packKeyForProgram = (program: string): string | null => PROGRAM_TO_PACK[program] ?? null;
/** Human label of a pack program node (e.g. GAMBLING → "Compulsive Gambling Disorder
 *  Treatment"); null for unknown keys. Display-only — never part of a verdict. */
export const packNodeLabel = (packKey: string): string | null =>
  (pack as any).programs?.[packKey]?.label ?? null;
/** The flat `rules` array for a pack program node (empty if none/SATOP-leveled). */
function packNodeRules(packKey: string): RuleDef[] {
  const node = (pack as any).programs?.[packKey];
  return Array.isArray(node?.rules) ? node.rules : [];
}

const mk = (rule: RuleDef, status: VerdictStatus, detail: string): RuleVerdict => ({
  ruleId: rule.id,
  label: rule.label,
  primitive: rule.primitive as Primitive,
  status,
  detail,
  citation: rule.citation,
});

// ── The seven primitive evaluators (PURE — no I/O, no AI) ─────────────────────

/** HOURS — accumulate hours toward a required total, possibly split by category. */
export function evaluateHours(rule: RuleDef, facts: ClientFacts): RuleVerdict {
  // Component split (e.g. CIP 10/20/20) needs per-category hours.
  if (Array.isArray(rule.components) && !facts.hourComponents) {
    const cats = rule.components.map((c: any) => c.category).join(', ');
    return mk(rule, 'not_enforceable', `Needs per-category hours (${cats})${rule.additional_constraint ? ' + an impaired-driving tag' : ''}; only a single hours total is tracked today.`);
  }
  if (facts.hoursCompleted == null) {
    return mk(rule, 'not_enforceable', 'Needs logged clinical hours for this client.');
  }
  const required = Number(rule.total_required_hours);
  const totalMet = facts.hoursCompleted >= required;
  // WS3: per-category counseling floor — SROP ≥35 counseling per 9 CSR 30-3.206(7)(D),
  // enforced from the categorized accrual (facts.hourComponents.counseling). Applies
  // ONLY when the rule sets counseling_min_hours; OEP/WIP/CIP leave it 0 → total-only
  // (the reg gives them no per-category floor and we don't invent one).
  const counselingMin = Number(rule.counseling_min_hours) || 0;
  const counselingHours = facts.hourComponents?.counseling ?? 0;
  const counselingMet = counselingMin <= 0 || counselingHours >= counselingMin;
  if (totalMet && counselingMet) {
    return mk(rule, 'met', counselingMin > 0
      ? `${facts.hoursCompleted}/${required} hours complete (incl. ${counselingHours}/${counselingMin} counseling).`
      : `${facts.hoursCompleted}/${required} hours complete.`);
  }
  const short: string[] = [];
  if (!totalMet) short.push(`${facts.hoursCompleted}/${required} total (${required - facts.hoursCompleted} remaining)`);
  if (!counselingMet) short.push(`${counselingHours}/${counselingMin} counseling (${counselingMin - counselingHours} remaining)`);
  return mk(rule, 'warning', `${short.join('; ')} before the completion certificate can issue.`);
}

/** DEADLINE — a clock relative to an anchor event (minimum-duration or recurring review). */
export function evaluateDeadline(rule: RuleDef, facts: ClientFacts, nowMs: number): RuleVerdict {
  // Minimum program duration (e.g. SROP ≥90 days) — anchored on enrollment (real field).
  if (rule.subtype === 'minimum_duration') {
    if (!facts.enrollmentDate) return mk(rule, 'not_enforceable', 'Needs an enrollment date.');
    const endMs = facts.completionDate ? new Date(facts.completionDate).getTime() : nowMs;
    const days = daysElapsed(facts.enrollmentDate, endMs);
    const min = 90;
    if (days >= min) return mk(rule, 'met', `${days}/${min} calendar days — minimum program duration satisfied.`);
    return mk(rule, 'warning', `${days}/${min} calendar days — minimum 90-day program length not yet met; completion certificate stays locked until satisfied.`);
  }
  // Recurring plan review — anchored on plan EXECUTION date (treatment_plans.created_at,
  // wired via fetchClientPlan). The cadence is PROGRAM-SPECIFIC and read from the rule:
  // SUD = 90 days (MO-OP-TXPLAN-REVIEW-90D, default), Gambling = 180 days
  // (MO-GAM-TXPLAN-REVIEW-180D, the 9 CSR 10-7.030 floor). Each program keeps its own clock.
  if (rule.id === 'MO-OP-TXPLAN-REVIEW-90D' || rule.subtype === 'plan_review') {
    const period = Number(rule.review_period_days ?? 90);
    if (!facts.planExecutionDate) {
      return mk(rule, 'not_enforceable', `Needs a treatment-plan execution date (no plan on file). Review cadence is ${period} days.`);
    }
    const warnBefore = Number(rule.warn_before_days ?? 7);
    const days = daysElapsed(facts.planExecutionDate, nowMs);
    if (days >= period) return mk(rule, 'violation', `Plan review overdue — ${days} days since plan execution (≥ the ${period}-day cadence).`);
    if (days >= period - warnBefore) return mk(rule, 'warning', `Plan review due in ${period - days} day(s) — ${days}/${period} days since plan execution.`);
    return mk(rule, 'met', `${days}/${period} days since plan execution — review not yet due.`);
  }
  return mk(rule, 'not_enforceable', 'Deadline anchor data not available yet.');
}

/** DOCUMENT — a required artifact must exist / be current / contain fields. */
export function evaluateDocument(rule: RuleDef, _facts: ClientFacts): RuleVerdict {
  if (rule.id === 'MO-OP-CONSENT-ANNUAL') {
    return mk(rule, 'not_enforceable', 'Needs a consent record with execution date (no consent store yet). Real enforcement also requires the audit-log/trust-layer rebuild.');
  }
  return mk(rule, 'not_enforceable', `Needs the document/fields this rule checks (${(rule.required_fields || rule.fields || ['artifact']).join(', ')}).`);
}

/** SIGNATURE — an action requires authenticated sign-off, possibly co-signed. */
export function evaluateSignature(rule: RuleDef, _facts: ClientFacts): RuleVerdict {
  return mk(rule, 'not_enforceable', 'Needs per-record signature + signer-credential data (no signature/credential store wired yet).');
}

/** CONSTRAINT — a limit/restriction on a value or combination. */
export function evaluateConstraint(rule: RuleDef, _facts: ClientFacts): RuleVerdict {
  if (rule.subtype === 'no_gate') {
    // Honest no-gate program (e.g. standalone anger management): not state-regulated,
    // completion is court-determined. Surfaced as not_enforceable (nothing to enforce).
    return mk(rule, 'not_enforceable', rule.note || 'No state compliance gate — completion is court-determined, not Missouri-regulated.');
  }
  if (rule.id === 'MO-GROUP-SIZE-CAP') {
    return mk(rule, 'not_enforceable', 'Needs per-session group attendance (attendees per facilitator per calendar month). Appointments are one row per session without attendee counts.');
  }
  return mk(rule, 'not_enforceable', 'Needs the value(s) this constraint restricts.');
}

/** SEQUENCE — step A must precede step B. */
export function evaluateSequence(rule: RuleDef, _facts: ClientFacts): RuleVerdict {
  return mk(rule, 'not_enforceable', `Needs ordered event timestamps (${(rule.order || ['step_a', 'step_b']).join(' → ')}).`);
}

/** CREDENTIAL — the acting staff member must hold a qualifying credential. */
export function evaluateCredential(rule: RuleDef, _facts: ClientFacts): RuleVerdict {
  return mk(rule, 'not_enforceable', `Needs verified staff credential data (${(rule.allowed || ['credential']).join('/')}). No staff credential store wired yet.`);
}

/** Dispatch by primitive. */
export function evaluateRule(rule: RuleDef, facts: ClientFacts, nowMs: number): RuleVerdict {
  switch (rule.primitive as Primitive) {
    case 'HOURS': return evaluateHours(rule, facts);
    case 'DEADLINE': return evaluateDeadline(rule, facts, nowMs);
    case 'DOCUMENT': return evaluateDocument(rule, facts);
    case 'SIGNATURE': return evaluateSignature(rule, facts);
    case 'CONSTRAINT': return evaluateConstraint(rule, facts);
    case 'SEQUENCE': return evaluateSequence(rule, facts);
    case 'CREDENTIAL': return evaluateCredential(rule, facts);
    default: return mk(rule, 'not_enforceable', 'Unknown primitive.');
  }
}

/**
 * Run the rules applicable to one client. Applicability is data-driven:
 * SATOP + 75-hour requirement ⇒ SROP (Level IV); SATOP + 50-hour ⇒ CIP (Level III).
 */
export function evaluateClientCompliance(facts: ClientFacts, nowMs: number = Date.now()): RuleVerdict[] {
  const verdicts: RuleVerdict[] = [];
  const isSatop = facts.program === 'SATOP';

  // WS4: applicable rules selected by the SIGNED determination level, not a static number.
  if (isSatop && facts.determinedLevel === 'I') {
    const h = getRule('MO-SATOP-OEP-HOURS'); if (h) verdicts.push(evaluateRule(h, facts, nowMs));
  }
  if (isSatop && facts.determinedLevel === 'II') {
    const h = getRule('MO-SATOP-WIP-HOURS'); if (h) verdicts.push(evaluateRule(h, facts, nowMs));
  }
  if (isSatop && facts.determinedLevel === 'IV') {
    const h = getRule('MO-SATOP-SROP-HOURS'); if (h) verdicts.push(evaluateRule(h, facts, nowMs));
    const d = getRule('MO-SATOP-SROP-DURATION'); if (d) verdicts.push(evaluateRule(d, facts, nowMs));
  }
  if (isSatop && facts.determinedLevel === 'III') {
    const c = getRule('MO-SATOP-CIP-HOURS-SPLIT'); if (c) verdicts.push(evaluateRule(c, facts, nowMs));
  }
  if (isSatop) {
    // SATOP keeps the backbone outpatient review (not_enforceable unless a plan exists) — unchanged.
    const r = getRule('MO-OP-TXPLAN-REVIEW-90D'); if (r) verdicts.push(evaluateRule(r, facts, nowMs));
  } else {
    // NON-SATOP (program-aware): route the client's program to its own pack node and run its
    // rules. buildRuleIndex + the primitive evaluators are program-agnostic; only this
    // SELECTION is by-program. Unmapped programs return no verdicts (honest "no pack").
    const packKey = packKeyForProgram(facts.program);
    if (packKey) {
      for (const rule of packNodeRules(packKey)) verdicts.push(evaluateRule(rule, facts, nowMs));
    }
  }

  return verdicts;
}

// ── Integration layer (reads data, calls the pure engine — still no AI) ───────

export interface GuardrailVerdict {
  id: string;          // `${clientId}__${ruleId}`
  clientId: string;
  clientName: string;
  program: string;
  ruleId: string;
  status: 'warning' | 'violation';
  headline: string;    // rule label
  detail: string;
  citation: string;
}

/** WS3 — categorized accrued hours, derived from Completed appointments via the
 *  `client_accrued_hours` view. THE gate's hours source — NOT the static
 *  `clients.srop_hours_completed` (now legacy/display only). */
export interface AccruedHours { total: number; counseling: number; education: number; rehabilitative_support: number; }
const ZERO_ACCRUAL: AccruedHours = { total: 0, counseling: 0, education: 0, rehabilitative_support: 0 };

function toFacts(row: any, opts: { accrual?: AccruedHours; completionSignedOff?: boolean; determinedLevel?: SatopLevel | null; signedFormIds?: Set<string> | null; planExecutionDate?: string | null } = {}): ClientFacts {
  // No fallback to srop_hours_completed: a client with no Completed sessions reads 0
  // accrued hours and does NOT pass on seeded data.
  const accrual = opts.accrual ?? ZERO_ACCRUAL;
  // WS4: the level comes from the SIGNED determination (current, non-superseded), never
  // inferred from the static total_sessions_required. The required total is DERIVED
  // from that level; no signed determination ⇒ null (completion not established).
  const determinedLevel = opts.determinedLevel ?? null;
  return {
    id: row.id,
    name: row.name,
    program: String(row.program_type || row.program || '').toUpperCase(),
    status: String(row.status || '').toLowerCase(),
    // WS3: completed hours + per-category come from the categorized accrual (Completed
    // appointments), never the static srop_hours_completed column.
    hoursCompleted: accrual.total,
    determinedLevel,
    totalRequired: determinedLevel ? REQUIRED_HOURS_BY_LEVEL[determinedLevel] : null,
    enrollmentDate: row.created_at ?? null,
    completionDate: row.program_end_date ?? null,
    planExecutionDate: opts.planExecutionDate ?? null,   // treatment_plans.created_at via fetchClientPlan — see evaluateDeadline
    hourComponents: { counseling: accrual.counseling, education: accrual.education, rehabilitative_support: accrual.rehabilitative_support },
    // Completion-gate inputs. Balance is on the client row (clients.balance);
    // sign-off is a separate clinical_notes lookup the caller injects (see
    // fetchCompletionSignoff / assessClient). When unknown we pass null and the
    // gate treats it as NOT satisfied — a certificate never issues on missing proof.
    outstandingBalance: row.balance == null ? null : Number(row.balance),
    completionSignedOff:
      opts.completionSignedOff ?? (typeof row.completionSignedOff === 'boolean' ? row.completionSignedOff : null),
    signedFormIds: opts.signedFormIds ?? null,
  };
}

/** Read ONE client's categorized accrued hours from the derived view. */
export async function fetchClientAccrual(clientId: string): Promise<AccruedHours> {
  const { data, error } = await supabase
    .from('client_accrued_hours').select('*').eq('client_id', clientId).maybeSingle();
  if (error || !data) {
    if (error) console.warn('[complianceEngine] accrual query failed:', error.message);
    return { ...ZERO_ACCRUAL };
  }
  return {
    total: Number(data.total_hours) || 0,
    counseling: Number(data.counseling_hours) || 0,
    education: Number(data.education_hours) || 0,
    rehabilitative_support: Number(data.rehabilitative_support_hours) || 0,
  };
}

/** WS-program-aware — ONE client's treatment-plan execution anchor (latest plan's created_at).
 *  Null when the client has no treatment plan (⇒ plan-review rule stays not_enforceable). */
export async function fetchClientPlan(clientId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('treatment_plans').select('created_at').eq('client_id', clientId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error || !data) {
    if (error) console.warn('[complianceEngine] plan query failed:', error.message);
    return null;
  }
  return data.created_at ?? null;
}

/** Batch — latest plan execution date keyed by client_id (for the practice-wide fetchers). */
async function fetchAllPlans(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const { data, error } = await supabase
    .from('treatment_plans').select('client_id, created_at').order('created_at', { ascending: false });
  if (error || !data) {
    if (error) console.warn('[complianceEngine] batch plan query failed:', error.message);
    return out;
  }
  for (const r of data) if (r.client_id && r.created_at && !out.has(r.client_id)) out.set(r.client_id, r.created_at); // first = latest (desc)
  return out;
}

/** Batch — all clients' accrued hours keyed by client_id (for the practice-wide fetchers). */
async function fetchAllAccruals(): Promise<Map<string, AccruedHours>> {
  const out = new Map<string, AccruedHours>();
  const { data, error } = await supabase.from('client_accrued_hours').select('*');
  if (error || !data) {
    if (error) console.warn('[complianceEngine] batch accrual query failed:', error.message);
    return out;
  }
  for (const r of data) out.set(r.client_id, {
    total: Number(r.total_hours) || 0,
    counseling: Number(r.counseling_hours) || 0,
    education: Number(r.education_hours) || 0,
    rehabilitative_support: Number(r.rehabilitative_support_hours) || 0,
  });
  return out;
}

/** Current = the signed row not superseded by any other (latest determined_at wins). */
function currentLevelFromRows(rows: any[]): SatopLevel | null {
  const supersededIds = new Set(rows.filter((r) => r.supersedes_id).map((r) => r.supersedes_id));
  const current = rows
    .filter((r) => !supersededIds.has(r.id))
    .sort((a, b) => new Date(b.determined_at).getTime() - new Date(a.determined_at).getTime())[0];
  return (current?.determined_level as SatopLevel) ?? null;
}

/** WS4 — the CURRENT (signed, non-superseded, latest) determination LEVEL for one client.
 *  null when the client has no signed determination (gate → not established). */
export async function fetchClientDetermination(clientId: string): Promise<SatopLevel | null> {
  const { data, error } = await supabase
    .from('placement_determinations')
    .select('id, determined_level, supersedes_id, determined_at')
    .eq('client_id', clientId).eq('status', 'signed');
  if (error || !data || data.length === 0) {
    if (error) console.warn('[complianceEngine] determination query failed:', error.message);
    return null;
  }
  return currentLevelFromRows(data);
}

/** Batch — current determination level keyed by client_id (for the practice-wide fetchers). */
async function fetchAllCurrentDeterminations(): Promise<Map<string, SatopLevel>> {
  const out = new Map<string, SatopLevel>();
  const { data, error } = await supabase
    .from('placement_determinations')
    .select('id, client_id, determined_level, supersedes_id, determined_at')
    .eq('status', 'signed');
  if (error || !data) {
    if (error) console.warn('[complianceEngine] batch determination query failed:', error.message);
    return out;
  }
  const byClient = new Map<string, any[]>();
  for (const r of data) {
    const arr = byClient.get(r.client_id) ?? [];
    arr.push(r);
    byClient.set(r.client_id, arr);
  }
  for (const [cid, rows] of byClient) {
    const lvl = currentLevelFromRows(rows);
    if (lvl) out.set(cid, lvl);
  }
  return out;
}

/** WS5 — the set of form_ids the client has COMPLETED or REVIEWED (case-insensitive;
 *  the data is mixed-case 'Completed'/'completed'). The required-forms gate's input. */
export async function fetchClientSignedForms(clientId: string): Promise<Set<string>> {
  const out = new Set<string>();
  const { data, error } = await supabase
    .from('form_submissions').select('form_id, status').eq('client_id', clientId);
  if (error || !data) {
    if (error) console.warn('[complianceEngine] signed-forms query failed:', error.message);
    return out;
  }
  for (const r of data) {
    const s = String(r.status || '').toLowerCase();
    if (r.form_id && (s === 'completed' || s === 'reviewed')) out.add(r.form_id);
  }
  return out;
}

/** Batch — completed/reviewed form_id sets keyed by client_id (practice-wide fetchers). */
async function fetchAllSignedForms(): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  const { data, error } = await supabase.from('form_submissions').select('client_id, form_id, status');
  if (error || !data) {
    if (error) console.warn('[complianceEngine] batch signed-forms query failed:', error.message);
    return out;
  }
  for (const r of data) {
    const s = String(r.status || '').toLowerCase();
    if (!r.client_id || !r.form_id || (s !== 'completed' && s !== 'reviewed')) continue;
    if (!out.has(r.client_id)) out.set(r.client_id, new Set<string>());
    out.get(r.client_id)!.add(r.form_id);
  }
  return out;
}

/**
 * Fetch active clients and compute their guardrail verdicts. Only surfaced
 * statuses (warning/violation) are returned for the Clinical Guardrails card;
 * met / not_enforceable are computed but not shown as flags. No AI involved.
 */
export async function fetchComplianceGuardrails(): Promise<GuardrailVerdict[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    // Lowercase-only since the 20260611 CHECK constraint guarantees the vocabulary.
    .not('status', 'in', '(completed,archived)');
  if (error || !data) {
    if (error) console.warn('[complianceEngine] clients query failed:', error.message);
    return [];
  }
  const nowMs = Date.now();
  const accruals = await fetchAllAccruals();
  const determinations = await fetchAllCurrentDeterminations();
  const signedForms = await fetchAllSignedForms();
  const plans = await fetchAllPlans();
  const out: GuardrailVerdict[] = [];
  for (const row of data) {
    const facts = toFacts(row, { accrual: accruals.get(row.id), determinedLevel: determinations.get(row.id) ?? null, signedFormIds: signedForms.get(row.id) ?? null, planExecutionDate: plans.get(row.id) ?? null });
    if (['completed', 'archived', 'inactive'].includes(facts.status)) continue;
    for (const v of evaluateClientCompliance(facts, nowMs)) {
      if (v.status === 'warning' || v.status === 'violation') {
        out.push({
          id: `${facts.id}__${v.ruleId}`,
          clientId: facts.id,
          clientName: facts.name,
          program: facts.program,
          ruleId: v.ruleId,
          status: v.status,
          headline: v.label,
          detail: v.detail,
          citation: v.citation,
        });
      }
    }
  }
  // Violations before warnings.
  out.sort((a, b) => (a.status === b.status ? 0 : a.status === 'violation' ? -1 : 1));
  return out;
}

// ── Practice-wide readiness (Director view) ───────────────────────────────────
// Same pure engine, aggregated across ALL active clients. Surfaces every status
// (met / warning / violation / not_enforceable) so an owner sees what the system
// can verify now vs. what still needs data captured. No AI.

export interface NotEnforceableItem {
  ruleId: string;
  label: string;
  primitive: Primitive;
  citation: string;
  reason: string;       // the missing-field detail from the evaluator
  clientCount: number;  // how many active clients this rule would apply to
}

export interface ComplianceReadiness {
  packId: string;
  packVersion: string;
  clientsEvaluated: number;
  counts: Record<VerdictStatus, number>;
  flags: GuardrailVerdict[];            // warning/violation, violations first
  notEnforceable: NotEnforceableItem[]; // deduped by rule, with reason + client count
}

export async function fetchComplianceReadiness(): Promise<ComplianceReadiness> {
  const base: ComplianceReadiness = {
    packId: PACK_ID,
    packVersion: PACK_VERSION,
    clientsEvaluated: 0,
    counts: { met: 0, warning: 0, violation: 0, not_enforceable: 0 },
    flags: [],
    notEnforceable: [],
  };

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    // Lowercase-only since the 20260611 CHECK constraint guarantees the vocabulary.
    .not('status', 'in', '(completed,archived)');
  if (error || !data) {
    if (error) console.warn('[complianceEngine] readiness query failed:', error.message);
    return base;
  }

  const nowMs = Date.now();
  const accruals = await fetchAllAccruals();
  const determinations = await fetchAllCurrentDeterminations();
  const signedForms = await fetchAllSignedForms();
  const plans = await fetchAllPlans();
  const neMap = new Map<string, NotEnforceableItem>();

  for (const row of data) {
    const facts = toFacts(row, { accrual: accruals.get(row.id), determinedLevel: determinations.get(row.id) ?? null, signedFormIds: signedForms.get(row.id) ?? null, planExecutionDate: plans.get(row.id) ?? null });
    if (['completed', 'archived', 'inactive'].includes(facts.status)) continue;
    base.clientsEvaluated++;

    for (const v of evaluateClientCompliance(facts, nowMs)) {
      base.counts[v.status]++;
      if (v.status === 'warning' || v.status === 'violation') {
        base.flags.push({
          id: `${facts.id}__${v.ruleId}`,
          clientId: facts.id,
          clientName: facts.name,
          program: facts.program,
          ruleId: v.ruleId,
          status: v.status,
          headline: v.label,
          detail: v.detail,
          citation: v.citation,
        });
      } else if (v.status === 'not_enforceable') {
        const existing = neMap.get(v.ruleId);
        if (existing) existing.clientCount++;
        else neMap.set(v.ruleId, {
          ruleId: v.ruleId,
          label: v.label,
          primitive: v.primitive,
          citation: v.citation,
          reason: v.detail,
          clientCount: 1,
        });
      }
    }
  }

  base.flags.sort((a, b) => (a.status === b.status ? 0 : a.status === 'violation' ? -1 : 1));
  base.notEnforceable = Array.from(neMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  return base;
}

// ── Program completion (gates the completion certificate) ─────────────────────
// Completion is decided DETERMINISTICALLY: a program is "eligible" only when every
// completion-certificate-gating rule for that program/level evaluates to 'met'.
// No AI, no hardcoded "complete" — the engine's verdicts are the sole authority.

/**
 * The fees-paid gate rule, factored out so it is defined ONCE. The completion
 * payment gate below AND the WS2.5 compliance clock (services/complianceClock.ts)
 * both call it — no drift. A balance is "settled" only when KNOWN and ≤ 0;
 * unknown (null) never passes (a certificate never issues on an unconfirmed balance).
 */
export function isBalanceSettled(balance: number | null): boolean {
  return balance != null && balance <= 0;
}

/**
 * One human-facing completion gate for the certificate viewer. The certificate
 * issues only when EVERY gate.passed is true. The three the addendum surfaces —
 * hours · payment · sign-off — are always present for a SATOP level (a duration
 * gate is added for SROP/Level IV). Each is derived from the engine verdicts and
 * the completion-gate facts; none of these is a bypass flag.
 */
export interface CompletionGate {
  key: 'hours' | 'duration' | 'payment' | 'signoff' | 'forms';
  label: string;
  passed: boolean;
  detail: string;
  /** Build 1 (additive): the 9 CSR anchor for this gate — hours/duration carry their
   *  rule verdict's citation; payment/signoff cite the 3.206(13) completion umbrella;
   *  forms cites 3.206(13)(F) ("completes and signs all required forms"). */
  citation?: string;
  /** Build 1 (additive): forms gate only — the unsigned required form ids (the array
   *  previously computed here but surfaced only string-joined into `detail`). */
  missingFormIds?: string[];
}

export interface CompletionAssessment {
  program: string;
  programLabel: string;
  hasCriteria: boolean;          // false when no completion rules are wired for this program/level
  eligible: boolean;             // true ONLY if every gate passes (rules MET + balance 0 + signed)
  gates: CompletionGate[];       // hours · [duration] · payment · sign-off — for the viewer
  gatingVerdicts: RuleVerdict[]; // the underlying rule verdicts (hours/duration)
  unmetReasons: string[];        // human-readable reasons any gate is not satisfied
}

export function evaluateProgramCompletion(facts: ClientFacts, nowMs: number = Date.now()): CompletionAssessment {
  let programLabel = facts.program || 'Program';
  let gatingIds: string[] = [];

  // WS4: SATOP level comes from the SIGNED determination (facts.determinedLevel), not
  // inferred from a static hours number. The per-level required totals + SROP counseling
  // floor live in the pack rules selected here (reused, not re-encoded).
  if (facts.program === 'SATOP' && facts.determinedLevel === 'I') {
    programLabel = 'SATOP — Offender Education Program (OEP, Level I)';
    gatingIds = ['MO-SATOP-OEP-HOURS'];
  } else if (facts.program === 'SATOP' && facts.determinedLevel === 'II') {
    programLabel = 'SATOP — Weekend Intervention Program (WIP, Level II)';
    gatingIds = ['MO-SATOP-WIP-HOURS'];
  } else if (facts.program === 'SATOP' && facts.determinedLevel === 'III') {
    programLabel = 'SATOP — Clinical Intervention Program (CIP, Level III)';
    gatingIds = ['MO-SATOP-CIP-HOURS-SPLIT'];
  } else if (facts.program === 'SATOP' && facts.determinedLevel === 'IV') {
    programLabel = 'SATOP — Serious & Repeat Offender Program (SROP, Level IV)';
    gatingIds = ['MO-SATOP-SROP-HOURS', 'MO-SATOP-SROP-DURATION'];
  }

  if (gatingIds.length === 0) {
    return {
      program: facts.program,
      programLabel,
      hasCriteria: false,
      eligible: false,
      gates: [],
      gatingVerdicts: [],
      unmetReasons: [
        facts.program === 'SATOP' && !facts.determinedLevel
          ? 'No signed placement determination — completion not established (a clinician must sign a determination before the gate applies).'
          : 'No deterministic completion criteria are wired for this program/level with the data captured today.',
      ],
    };
  }

  const gatingVerdicts = gatingIds
    .map((id) => getRule(id))
    .filter((r): r is RuleDef => !!r)
    .map((r) => evaluateRule(r, facts, nowMs));

  // Build the human-facing gates the certificate viewer renders. The certificate
  // issues ONLY when every gate passes — hours/duration (program rules) AND a
  // settled balance AND a signed clinician completion sign-off. This is the real
  // three-(or four-)part gate; seeding the underlying data is what opens it.
  const gates: CompletionGate[] = gatingVerdicts.map((v) => ({
    key: v.primitive === 'DEADLINE' ? 'duration' : 'hours',
    label: v.primitive === 'DEADLINE' ? 'Minimum duration' : 'Hours',
    passed: v.status === 'met',
    detail: v.detail,
    citation: v.citation,
  }));

  // Payment gate — clients.balance must be a KNOWN zero. Unknown (null) never
  // passes: a certificate cannot issue without confirming the balance is settled.
  const bal = facts.outstandingBalance;
  gates.push({
    key: 'payment',
    label: 'Balance paid',
    passed: isBalanceSettled(bal),
    detail:
      bal == null
        ? 'Outstanding balance unknown — cannot confirm payment.'
        : bal <= 0
          ? 'No outstanding balance.'
          : `Outstanding balance of $${bal.toFixed(2)} must be cleared.`,
    citation: '9 CSR 30-3.206(13)',
  });

  // Sign-off gate — a signed completion_signoff clinical note must exist. This is
  // a DISTINCT event from the placement sign-off (placement_determinations).
  gates.push({
    key: 'signoff',
    label: 'Clinician sign-off',
    passed: facts.completionSignedOff === true,
    detail:
      facts.completionSignedOff === true
        ? 'Completion sign-off signed by the qualified professional.'
        : 'Awaiting the clinician’s signed completion sign-off.',
    citation: '9 CSR 30-3.206(13)',
  });

  // WS5: required-forms-signed gate (3.206(13)(F) "completes and signs all required
  // forms"). The required set derives from the determined LEVEL (REQUIRED_FORMS_BY_LEVEL),
  // not a static list. No-phantom: null/empty signedFormIds => not met (never a default
  // pass); the required-core is intrinsic — a never-assigned required form still blocks.
  const requiredForms = facts.determinedLevel ? (REQUIRED_FORMS_BY_LEVEL[facts.determinedLevel] ?? []) : [];
  if (requiredForms.length > 0) {
    const signed = facts.signedFormIds ?? new Set<string>();
    const missing = requiredForms.filter((id) => !signed.has(id));
    gates.push({
      key: 'forms',
      label: 'Required forms signed',
      passed: missing.length === 0,
      detail: missing.length === 0
        ? `All ${requiredForms.length} required forms completed/signed.`
        : `${missing.length} of ${requiredForms.length} required form(s) unsigned (${missing.join(', ')}).`,
      citation: '9 CSR 30-3.206(13)(F)',
      missingFormIds: missing,
    });
  }

  const unmet = gates.filter((g) => !g.passed);

  return {
    program: facts.program,
    programLabel,
    hasCriteria: true,
    eligible: unmet.length === 0,
    gates,
    gatingVerdicts,
    unmetReasons: unmet.map((g) => `${g.label}: ${g.detail}`),
  };
}

/**
 * One-call assessment for a single client row/object (snake_case fields present,
 * as on both raw rows and the mapped Client). Pure + deterministic; no AI.
 */
export function assessClient(
  row: any,
  opts: { nowMs?: number; completionSignedOff?: boolean; accrual?: AccruedHours; determinedLevel?: SatopLevel | null; signedFormIds?: Set<string> | null; planExecutionDate?: string | null } = {},
): {
  facts: ClientFacts;
  verdicts: RuleVerdict[];
  completion: CompletionAssessment;
} {
  const nowMs = opts.nowMs ?? Date.now();
  const facts = toFacts(row, { accrual: opts.accrual, completionSignedOff: opts.completionSignedOff, determinedLevel: opts.determinedLevel, signedFormIds: opts.signedFormIds, planExecutionDate: opts.planExecutionDate });
  return {
    facts,
    verdicts: evaluateClientCompliance(facts, nowMs),
    completion: evaluateProgramCompletion(facts, nowMs),
  };
}

/**
 * Completion sign-off lookup (integration layer): true iff a SIGNED clinical_notes
 * row with note_type='completion_signoff' exists for the client. This is the
 * distinct completion event (separate from the placement sign-off); the cert gate
 * reads it via assessClient({ completionSignedOff }). Reads data only — no AI.
 */
export async function fetchCompletionSignoff(clientId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('clinical_notes')
    .select('id')
    .eq('client_id', clientId)
    .eq('note_type', 'completion_signoff')
    .eq('is_signed', true)
    .limit(1);
  if (error) {
    console.warn('[complianceEngine] completion sign-off query failed:', error.message);
    return false;
  }
  return !!(data && data.length > 0);
}

/** Card state for a NON-SATOP (documentation-timeline) program. */
export interface ProgramCardState {
  kind: 'timeline' | 'no_gate';
  status: 'met' | 'warning' | 'violation' | 'not_enforceable';
  label: string;     // e.g. "Plan review overdue", "Plan review due in 30 day(s)", "No regulatory gate (court-determined)"
  detail: string;
  ruleId: string;
  citation: string;
}

/**
 * Program-aware CARD STATE for a NON-SATOP program — for the Clients board / workspace.
 * Returns null for SATOP (the board shows the hours Progress% there, unchanged) or an
 * unmapped program. Reads only; runs the same deterministic engine, no AI.
 */
export async function fetchClientProgramCardState(clientId: string): Promise<ProgramCardState | null> {
  const { data: row, error } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
  if (error || !row) return null;
  const program = String(row.program_type || row.program || '').toUpperCase();
  if (program === 'SATOP') return null;            // SATOP keeps the % progress path
  const packKey = packKeyForProgram(program);
  if (!packKey) return null;                        // unmapped program — nothing to show
  const [accrual, plan] = await Promise.all([fetchClientAccrual(clientId), fetchClientPlan(clientId)]);
  const facts = toFacts(row, { accrual, planExecutionDate: plan });
  const verdicts = evaluateClientCompliance(facts, Date.now());

  const noGate = verdicts.find(v => v.ruleId === 'MO-ANGER-NO-STATE-GATE');
  if (noGate) {
    return { kind: 'no_gate', status: noGate.status, label: 'No regulatory gate (court-determined)', detail: noGate.detail, ruleId: noGate.ruleId, citation: noGate.citation };
  }
  const review = verdicts.find(v => v.ruleId === 'MO-OP-TXPLAN-REVIEW-90D' || v.ruleId === 'MO-GAM-TXPLAN-REVIEW-180D');
  if (review) {
    let label: string;
    if (review.status === 'violation') label = 'Plan review overdue';
    else if (review.status === 'warning') label = review.detail.split('—')[0].trim(); // "Plan review due in N day(s)"
    else if (review.status === 'met') {
      const m = review.detail.match(/(\d+)\/(\d+)\s*days/);                            // "X/Y days since plan execution"
      label = m ? `Plan review due in ${Number(m[2]) - Number(m[1])} days` : 'Plan review current';
    } else label = 'Plan review — no plan on file';
    return { kind: 'timeline', status: review.status, label, detail: review.detail, ruleId: review.ruleId, citation: review.citation };
  }
  const surfaced = verdicts.find(v => v.status === 'violation' || v.status === 'warning');
  return surfaced ? { kind: 'timeline', status: surfaced.status, label: surfaced.label, detail: surfaced.detail, ruleId: surfaced.ruleId, citation: surfaced.citation } : null;
}
