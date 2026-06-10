/**
 * Build 1 — Packet Readiness: the reconciliation engine's face.
 *
 * PURE adapter (no I/O, no AI): composes the per-client checklist model from engine
 * outputs the workspace has ALREADY fetched/computed (assessClient + the signed-forms
 * set). It never re-derives a verdict — every row's state maps 1:1 from an engine
 * gate/verdict, so the checklist can't disagree with the certificate gate.
 *
 * Three honest row states — NEVER merged:
 *   met            the engine verified it
 *   action         verified missing / short / overdue — someone must do something
 *   cannot_verify  not_enforceable: the system lacks the data to evaluate this rule
 *                  (must never read as a pass OR a failure)
 *
 * Five kinds, one per honest-state-matrix cell:
 *   gates            SATOP with a signed determination → completion.gates (+ per-form
 *                    sub-rows under the forms gate). Header count = "X of N gates met"
 *                    — a derivable count, NEVER a percentage.
 *   not_established  SATOP with no signed determination — the single designed state,
 *                    never an empty / 0-of-0 checklist.
 *   timeline         non-SATOP program with a mapped rule pack → the FULL verdicts
 *                    array (not the collapsed board-card state).
 *   no_gate          standalone anger management — court-determined, nothing to list.
 *   no_pack          non-SATOP program with no mapped pack — designed state, not blank.
 */
import type { CompletionAssessment, RuleVerdict } from './complianceEngine';
import { packKeyForProgram, packNodeLabel } from './complianceEngine';
import { REQUIRED_FORMS_BY_LEVEL, FORM_REGISTRY_BY_ID } from '../config/formRegistry';
import type { SatopLevel } from '../config/satopFees';

export type ReadinessState = 'met' | 'action' | 'cannot_verify';

export interface ReadinessRow {
  id: string;              // stable key: gate key / rule id / form id
  label: string;
  state: ReadinessState;
  detail: string;
  citation?: string;
  subRows?: ReadinessRow[]; // per-form rows under the forms gate
}

export type ReadinessKind = 'gates' | 'not_established' | 'timeline' | 'no_gate' | 'no_pack';

export interface PacketReadiness {
  kind: ReadinessKind;
  programLabel: string;
  /** 'gates' only — derivable honest count for the "X of N gates met" header. */
  metCount: number | null;
  totalCount: number | null;
  /** The engine's certificate verdict (gates kind; false otherwise). */
  eligible: boolean;
  /** Designed single-state message (not_established / no_gate / no_pack) or the
   *  timeline no-plan lead. null when the rows speak for themselves. */
  statusNote: string | null;
  citation?: string;       // citation for a single-state kind (e.g. the no-gate rule)
  rows: ReadinessRow[];
}

const verdictState = (s: RuleVerdict['status']): ReadinessState =>
  s === 'met' ? 'met' : s === 'not_enforceable' ? 'cannot_verify' : 'action';

export function composePacketReadiness(input: {
  /** Normalized UPPER program (assessClient's facts.program). */
  program: string;
  completion: CompletionAssessment;
  verdicts: RuleVerdict[];
  determinedLevel: SatopLevel | null;
  signedFormIds: Set<string> | null;
  planExecutionDate: string | null;
}): PacketReadiness {
  const { program, completion, verdicts, determinedLevel, signedFormIds, planExecutionDate } = input;

  if (program === 'SATOP') {
    if (!completion.hasCriteria) {
      // No signed determination — the single designed state. The engine's reason
      // string is the body; we never render an empty checklist here.
      return {
        kind: 'not_established',
        programLabel: completion.programLabel,
        metCount: null,
        totalCount: null,
        eligible: false,
        statusNote:
          completion.unmetReasons[0] ??
          'Completion not established — a clinician must sign a placement determination before completion criteria apply.',
        rows: [],
      };
    }

    // Certificate gates, 1:1 from the engine. The forms gate carries per-form
    // sub-rows: REQUIRED_FORMS_BY_LEVEL[level] × signedFormIds × registry titles —
    // the same inputs the gate itself was computed from, so they cannot disagree.
    const required = determinedLevel ? (REQUIRED_FORMS_BY_LEVEL[determinedLevel] ?? []) : [];
    const signed = signedFormIds ?? new Set<string>();
    const rows: ReadinessRow[] = completion.gates.map((g) => ({
      id: g.key,
      label: g.label,
      state: g.passed ? 'met' : 'action',
      detail: g.detail,
      citation: g.citation,
      ...(g.key === 'forms' && required.length > 0
        ? {
            subRows: required.map((fid) => ({
              id: fid,
              label: FORM_REGISTRY_BY_ID[fid]?.title ?? fid,
              state: (signed.has(fid) ? 'met' : 'action') as ReadinessState,
              detail: signed.has(fid) ? 'Completed / signed.' : 'Not yet signed.',
            })),
          }
        : {}),
    }));
    const metCount = rows.filter((r) => r.state === 'met').length;
    return {
      kind: 'gates',
      programLabel: completion.programLabel,
      metCount,
      totalCount: rows.length,
      eligible: completion.eligible,
      statusNote: null,
      rows,
    };
  }

  // ── Non-SATOP ────────────────────────────────────────────────────────────────
  const packKey = packKeyForProgram(program);
  if (!packKey) {
    return {
      kind: 'no_pack',
      programLabel: completion.programLabel,
      metCount: null,
      totalCount: null,
      eligible: false,
      statusNote:
        'No Missouri rule pack is mapped for this program — documentation requirements cannot be evaluated yet.',
      rows: [],
    };
  }

  const noGate = verdicts.find((v) => v.ruleId === 'MO-ANGER-NO-STATE-GATE');
  if (noGate) {
    return {
      kind: 'no_gate',
      programLabel: packNodeLabel(packKey) ?? completion.programLabel,
      metCount: null,
      totalCount: null,
      eligible: false,
      statusNote: noGate.detail,
      citation: noGate.citation,
      rows: [],
    };
  }

  // Documentation timeline: every rule verdict is its own row — the full array,
  // NOT the collapsed board-card state (fetchClientProgramCardState).
  return {
    kind: 'timeline',
    programLabel: packNodeLabel(packKey) ?? completion.programLabel,
    metCount: null,
    totalCount: null,
    eligible: false,
    statusNote: planExecutionDate
      ? null
      : 'No treatment plan on file — documentation timelines start when a plan is executed.',
    rows: verdicts.map((v) => ({
      id: v.ruleId,
      label: v.label,
      state: verdictState(v.status),
      detail: v.detail,
      citation: v.citation,
    })),
  };
}
