/**
 * ACS TherapyHub — Alerts Service
 *
 * Computes actionable alerts from real client data using Missouri
 * compliance rules. This replaces the empty `highPriorityAlerts: []`
 * stub in getDailyBriefingData.
 *
 * Alert tiers:
 *   CRITICAL — warrant imminent, deadline < 3 days, or already escalated
 *   HIGH     — 2+ consecutive missed sessions, or deadline 3–14 days + incomplete
 *   ELEVATED — non-compliant status, missing signature, deadline < 30 days
 *   MODERATE — lagging attendance trend, single missed session
 */

import { supabase } from './supabase';
import type { Client } from '../types';
import { fetchAllClientProgress, type ClientProgress } from './displayProgress';

export type AlertTier = 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'MODERATE';

export type AlertReason =
  | 'WARRANT_RISK'
  | 'DEADLINE_IMMINENT'
  | 'MISSED_SESSIONS'
  | 'NON_COMPLIANT_STATUS'
  | 'LICENSE_SUSPENDED'
  | 'MISSING_DOCUMENTS'
  | 'LAGGING_COMPLETION'
  | 'CSR_PLAN_REVIEW_DUE';

export interface ClientAlert {
  id: string; // stable — built from clientId + reason
  clientId: string;
  clientName: string;
  program: string;
  tier: AlertTier;
  reason: AlertReason;
  headline: string;
  detail: string;
  recommendedActions: RecommendedAction[];
  computedAt: string;
}

export type RecommendedAction =
  | 'SEND_OUTREACH'
  | 'SCHEDULE_URGENT'
  | 'CREATE_TASK'
  | 'NOTIFY_PROBATION'
  | 'FLAG_SUPERVISOR';

export interface AlertsSummary {
  critical: number;
  high: number;
  elevated: number;
  moderate: number;
  total: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / DAY_MS);
}

function consecutiveAbsences(history: Client['attendanceHistory']): number {
  if (!history || history.length === 0) return 0;
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i] === 'absent') count++;
    else break;
  }
  return count;
}

function alertId(clientId: string, reason: AlertReason): string {
  return `${clientId}__${reason}`;
}

/** Compute all alerts for a set of clients. Pure function — safe to call from anywhere. */
export function computeAlertsForClients(clients: Client[], progressByClientId?: Map<string, ClientProgress>): ClientAlert[] {
  const alerts: ClientAlert[] = [];
  const now = new Date().toISOString();

  for (const c of clients) {
    // fetchAlerts passes raw DB rows where status is lowercase ('active', 'archived').
    // Skip anything that's not currently in treatment.
    const statusLc = (c.status || '').toString().toLowerCase();
    if (statusLc === 'completed' || statusLc === 'archived' || statusLc === 'inactive') continue;

    const missed = consecutiveAbsences(c.attendanceHistory);
    const deadlineDays = daysUntil(c.nextDeadline);
    // WS-DisplayTruth: completeness from the AUTHORITATIVE progress (accrual + signed
    // determination) the caller passes in — never the neutralized c.completionPercentage.
    // Not established or below required ⇒ incomplete; only established-and-≥100% is complete.
    const prog = progressByClientId?.get(c.id);
    const completionPct = prog?.established ? (prog.progressPct ?? 0) : null;
    const incomplete = completionPct === null || completionPct < 100;

    // REMOVED (status normalization, 2026-06-11): the WARRANT_RISK,
    // NON_COMPLIANT_STATUS and LICENSE_SUSPENDED rules that lived here read
    // compliance words off `status` (and a `licenseStatus` field that doesn't
    // exist on raw rows) — they had NEVER fired against live data. Standing is
    // the engine's to compute; properly engine-driven versions of these alerts
    // are logged as future candidates in SECURITY_BACKLOG #15.

    // 2+ consecutive missed sessions → warrant risk
    if (missed >= 2) {
      alerts.push({
        id: alertId(c.id, 'MISSED_SESSIONS'),
        clientId: c.id,
        clientName: c.name,
        program: c.program,
        tier: missed >= 3 ? 'CRITICAL' : 'HIGH',
        reason: 'MISSED_SESSIONS',
        headline: `${missed} consecutive absences`,
        detail: `${c.name} has missed ${missed} sessions in a row. Per Missouri program rules, this triggers warrant risk and requires outreach within 24 hours.`,
        recommendedActions: ['SEND_OUTREACH', 'SCHEDULE_URGENT', 'CREATE_TASK'],
        computedAt: now,
      });
    }

    // Court deadline approaching with incomplete program
    if (deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 14 && incomplete) {
      const tier: AlertTier = deadlineDays <= 3 ? 'CRITICAL' : 'HIGH';
      alerts.push({
        id: alertId(c.id, 'DEADLINE_IMMINENT'),
        clientId: c.id,
        clientName: c.name,
        program: c.program,
        tier,
        reason: 'DEADLINE_IMMINENT',
        headline: `Deadline in ${deadlineDays} day${deadlineDays === 1 ? '' : 's'}`,
        detail: `${c.name} ${completionPct !== null ? `is ${completionPct}% complete` : 'is behind (no signed determination yet)'} with a court deadline in ${deadlineDays} day${deadlineDays === 1 ? '' : 's'}. ${tier === 'CRITICAL' ? 'Escalate immediately.' : 'Schedule catch-up sessions now.'}`,
        recommendedActions: ['SCHEDULE_URGENT', 'SEND_OUTREACH', 'NOTIFY_PROBATION'],
        computedAt: now,
      });
    }

    // (NON_COMPLIANT_STATUS and LICENSE_SUSPENDED rules removed here — see the
    // note above the missed-sessions rule and SECURITY_BACKLOG #15.)

    // 9 CSR 30-3 — every SATOP/SROP client needs a 90-day treatment plan review.
    // Trigger when an active client is mid-program (≥40 of 75 hours, <75 total).
    // Visible on the client record AND counted on the staff dashboard.
    // WS-DisplayTruth: fire off the AUTHORITATIVE accrual + signed determination (the same
    // sources the completion gate uses), NEVER the static srop_hours_completed /
    // total_sessions_required. Only fires when a determination is established — no-phantom,
    // so a "behind on hours" alert can never contradict the gate.
    if (prog?.established && prog.requiredTotal != null && prog.requiredTotal >= 50
        && prog.completedTotal >= 40 && prog.completedTotal < prog.requiredTotal) {
      const programLabel = c.program || (c as any).program_type || 'program';
      alerts.push({
        id: alertId(c.id, 'CSR_PLAN_REVIEW_DUE'),
        clientId: c.id,
        clientName: c.name,
        program: programLabel,
        tier: 'ELEVATED',
        reason: 'CSR_PLAN_REVIEW_DUE',
        headline: '90-Day Treatment Plan Update Due',
        detail: `${c.name} is ${prog.completedTotal}/${prog.requiredTotal} hours into their ${programLabel} program. Per 9 CSR 30-3, the 90-day treatment plan review is due within 7 days. Schedule clinical staffing.`,
        recommendedActions: ['CREATE_TASK', 'FLAG_SUPERVISOR'],
        computedAt: now,
      });
    }

    // Missing required documents
    if ((c.missingDocuments?.length ?? 0) > 0) {
      alerts.push({
        id: alertId(c.id, 'MISSING_DOCUMENTS'),
        clientId: c.id,
        clientName: c.name,
        program: c.program,
        tier: 'MODERATE',
        reason: 'MISSING_DOCUMENTS',
        headline: `${c.missingDocuments!.length} missing document${c.missingDocuments!.length === 1 ? '' : 's'}`,
        detail: `Outstanding: ${c.missingDocuments!.join(', ')}. Program placement may be blocked until collected.`,
        recommendedActions: ['CREATE_TASK', 'SEND_OUTREACH'],
        computedAt: now,
      });
    }
  }

  // Sort: CRITICAL first, then HIGH, ELEVATED, MODERATE
  const tierOrder: Record<AlertTier, number> = { CRITICAL: 0, HIGH: 1, ELEVATED: 2, MODERATE: 3 };
  alerts.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);
  return alerts;
}

export function summarizeAlerts(alerts: ClientAlert[]): AlertsSummary {
  const s: AlertsSummary = { critical: 0, high: 0, elevated: 0, moderate: 0, total: alerts.length };
  for (const a of alerts) {
    if (a.tier === 'CRITICAL') s.critical++;
    else if (a.tier === 'HIGH') s.high++;
    else if (a.tier === 'ELEVATED') s.elevated++;
    else if (a.tier === 'MODERATE') s.moderate++;
  }
  return s;
}

/** Fetch all active clients and compute alerts. Falls back to empty array on error. */
export async function fetchAlerts(): Promise<ClientAlert[]> {
  try {
    // Canonical lowercase lifecycle values (status normalization, 2026-06-11).
    // The old capitalized '(Completed,Archived)' exclusion matched NOTHING in
    // the live DB (values were always lowercase), so archived + completed
    // clients were silently alert-evaluated. Fixed; CHECK constraint now
    // guarantees this vocabulary.
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .not('status', 'in', '(completed,archived)');
    if (error) {
      console.warn('[alertsService] supabase query failed:', error.message);
      return [];
    }
    const rows = (data || []) as Client[];
    // WS-DisplayTruth: authoritative progress (accrual + signed determination) per client,
    // so the "behind on hours" alert agrees with the gate — not the static columns.
    const progress = await fetchAllClientProgress(rows.map((r: any) => r.id));
    return computeAlertsForClients(rows, progress);
  } catch (e) {
    console.error('[alertsService] fetchAlerts failed:', e);
    return [];
  }
}

/** Log an outreach attempt to the backend. Falls back to clinical_notes if outreach_log table is missing. */
export async function logOutreach(
  clientId: string,
  method: 'Phone' | 'SMS' | 'Email' | 'Letter' | 'In-Person',
  notes: string,
  alertId?: string
): Promise<{ ok: boolean; error?: string }> {
  // Try dedicated outreach_log table first
  const attempt = await supabase
    .from('outreach_log')
    .insert({
      client_id: clientId,
      method,
      notes,
      alert_id: alertId || null,
      created_at: new Date().toISOString(),
    });

  if (!attempt.error) return { ok: true };

  // Fall back to clinical_notes with a structured type
  const fallback = await supabase
    .from('clinical_notes')
    .insert({
      client_id: clientId,
      content: `[${method} Outreach] ${notes}`,
      note_type: 'Outreach',
      created_at: new Date().toISOString(),
      source: 'alerts',
    });

  if (!fallback.error) return { ok: true };
  return { ok: false, error: fallback.error.message };
}

/** Create a task tied to a client. Falls back to clinical_notes with note_type='Task'. */
export async function createTask(
  clientId: string,
  description: string,
  dueDate?: string,
  priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const attempt = await supabase
    .from('tasks')
    .insert({
      client_id: clientId,
      description,
      due_date: dueDate || null,
      priority,
      status: 'open',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (!attempt.error && attempt.data) return { ok: true, id: attempt.data.id };

  // Fallback: clinical_notes with structured type
  const fallback = await supabase
    .from('clinical_notes')
    .insert({
      client_id: clientId,
      content: `[Task — ${priority.toUpperCase()}${dueDate ? ` — due ${dueDate}` : ''}] ${description}`,
      note_type: 'Task',
      created_at: new Date().toISOString(),
      source: 'alerts',
    })
    .select()
    .single();

  if (!fallback.error) return { ok: true, id: fallback.data?.id };
  return { ok: false, error: fallback.error.message };
}
