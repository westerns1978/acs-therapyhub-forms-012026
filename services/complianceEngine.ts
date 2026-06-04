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
  totalRequired: number | null;
  enrollmentDate: string | null;     // clients.created_at — the real program-start anchor
  completionDate: string | null;     // clients.program_end_date (or null while active)
  planExecutionDate: string | null;  // treatment-plan execution date — absent today
  hourComponents: Record<string, number> | null; // per-category hours — absent today
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
  if (facts.hoursCompleted >= required) {
    return mk(rule, 'met', `${facts.hoursCompleted}/${required} hours complete.`);
  }
  const remaining = required - facts.hoursCompleted;
  return mk(rule, 'warning', `${facts.hoursCompleted}/${required} clinical hours — ${remaining} remaining before the completion certificate can issue.`);
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
  // Recurring plan review (90-day) — anchored on plan EXECUTION date, which is a
  // distinct field from enrollment and is not captured yet (treatment_plans empty).
  if (rule.id === 'MO-OP-TXPLAN-REVIEW-90D') {
    if (!facts.planExecutionDate) {
      return mk(rule, 'not_enforceable', 'Needs treatment-plan execution date (treatment_plans has 0 rows; no plan_executed_at field on clients). Enrollment date is NOT a substitute for this anchor.');
    }
    const period = 90;
    const warnBefore = Number(rule.warn_before_days ?? 7);
    const days = daysElapsed(facts.planExecutionDate, nowMs);
    if (days >= period) return mk(rule, 'violation', `Plan review overdue — ${days} days since last review (≥${period}). Real-data era: charting locks until a documented review.`);
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

  if (isSatop && facts.totalRequired === 75) {
    const h = getRule('MO-SATOP-SROP-HOURS'); if (h) verdicts.push(evaluateRule(h, facts, nowMs));
    const d = getRule('MO-SATOP-SROP-DURATION'); if (d) verdicts.push(evaluateRule(d, facts, nowMs));
  }
  if (isSatop && facts.totalRequired === 50) {
    const c = getRule('MO-SATOP-CIP-HOURS-SPLIT'); if (c) verdicts.push(evaluateRule(c, facts, nowMs));
  }
  // Backbone outpatient review applies to every active client (currently not_enforceable).
  const r = getRule('MO-OP-TXPLAN-REVIEW-90D'); if (r) verdicts.push(evaluateRule(r, facts, nowMs));

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

function toFacts(row: any): ClientFacts {
  return {
    id: row.id,
    name: row.name,
    program: String(row.program_type || row.program || '').toUpperCase(),
    status: String(row.status || '').toLowerCase(),
    hoursCompleted: row.srop_hours_completed == null ? null : Number(row.srop_hours_completed),
    totalRequired: row.total_sessions_required == null ? null : Number(row.total_sessions_required),
    enrollmentDate: row.created_at ?? null,
    completionDate: row.program_end_date ?? null,
    planExecutionDate: null,   // treatment_plans empty / no plan_executed_at — see evaluateDeadline
    hourComponents: null,      // no per-category hours in schema yet
  };
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
    .not('status', 'in', '(Completed,Archived,completed,archived)');
  if (error || !data) {
    if (error) console.warn('[complianceEngine] clients query failed:', error.message);
    return [];
  }
  const nowMs = Date.now();
  const out: GuardrailVerdict[] = [];
  for (const row of data) {
    const facts = toFacts(row);
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
    .not('status', 'in', '(Completed,Archived,completed,archived)');
  if (error || !data) {
    if (error) console.warn('[complianceEngine] readiness query failed:', error.message);
    return base;
  }

  const nowMs = Date.now();
  const neMap = new Map<string, NotEnforceableItem>();

  for (const row of data) {
    const facts = toFacts(row);
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

export interface CompletionAssessment {
  program: string;
  programLabel: string;
  hasCriteria: boolean;          // false when no completion rules are wired for this program/level
  eligible: boolean;             // true ONLY if every gating rule is 'met'
  gatingVerdicts: RuleVerdict[]; // the rules that gate the completion certificate
  unmetReasons: string[];        // human-readable reasons any gating rule is not met
}

export function evaluateProgramCompletion(facts: ClientFacts, nowMs: number = Date.now()): CompletionAssessment {
  let programLabel = facts.program || 'Program';
  let gatingIds: string[] = [];

  // SATOP level inferred from the required-hours signature (data-driven).
  if (facts.program === 'SATOP' && facts.totalRequired === 75) {
    programLabel = 'SATOP — Serious & Repeat Offender Program (SROP, Level IV)';
    gatingIds = ['MO-SATOP-SROP-HOURS', 'MO-SATOP-SROP-DURATION'];
  } else if (facts.program === 'SATOP' && facts.totalRequired === 50) {
    programLabel = 'SATOP — Clinical Intervention Program (CIP, Level III)';
    gatingIds = ['MO-SATOP-CIP-HOURS-SPLIT'];
  }

  if (gatingIds.length === 0) {
    return {
      program: facts.program,
      programLabel,
      hasCriteria: false,
      eligible: false,
      gatingVerdicts: [],
      unmetReasons: ['No deterministic completion criteria are wired for this program/level with the data captured today.'],
    };
  }

  const gatingVerdicts = gatingIds
    .map((id) => getRule(id))
    .filter((r): r is RuleDef => !!r)
    .map((r) => evaluateRule(r, facts, nowMs));
  const unmet = gatingVerdicts.filter((v) => v.status !== 'met');

  return {
    program: facts.program,
    programLabel,
    hasCriteria: true,
    eligible: unmet.length === 0,
    gatingVerdicts,
    unmetReasons: unmet.map((v) => `${v.label}: ${v.detail}`),
  };
}

/**
 * One-call assessment for a single client row/object (snake_case fields present,
 * as on both raw rows and the mapped Client). Pure + deterministic; no AI.
 */
export function assessClient(row: any, nowMs: number = Date.now()): {
  facts: ClientFacts;
  verdicts: RuleVerdict[];
  completion: CompletionAssessment;
} {
  const facts = toFacts(row);
  return {
    facts,
    verdicts: evaluateClientCompliance(facts, nowMs),
    completion: evaluateProgramCompletion(facts, nowMs),
  };
}
