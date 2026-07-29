// Audit logging v1 — the single write helper for the append-only audit_logs ledger
// (see supabase/migrations/20260708_audit1_append_only_foundation.sql for the RLS/grant
// posture: staff-wide SELECT, self-attributed INSERT, no UPDATE/DELETE at all).
//
// FIRE-AND-FORGET BY DESIGN: an audit-log write failure must NEVER break the clinical/
// business action it's attached to (signing a note, booking a session, ...). This function
// therefore never throws — every failure path is caught and console.error'd internally.
// Callers should NOT await this in a way that blocks their own success path; `void logAudit(...)`
// is the intended call shape.
import { supabase } from './supabase';

export interface LogAuditInput {
    /** auth.uid() of the acting user. The INSERT policy also enforces user_id = auth.uid(),
     *  so a wrong/spoofed actor is rejected at the DB layer regardless of this value. */
    actor: string;
    /** e.g. 'note.signed' */
    action: string;
    /** e.g. 'clinical_notes' */
    entity_type: string;
    entity_id: string;
    /** ISO timestamp. Passed explicitly (rather than relying on the column default) so
     *  callers can attribute the log to the moment of the action, not the moment it's flushed. */
    timestamp: string;
    /** Freeform context written into the details jsonb column. Always include client_id here
     *  when the event is attributable to a client — audit_logs has no client_id column of its
     *  own, so details.client_id is the only way to make an event per-client reportable. */
    details?: Record<string, unknown>;
}

export const logAudit = async (input: LogAuditInput): Promise<void> => {
    try {
        const { error } = await supabase.from('audit_logs').insert({
            user_id: input.actor,
            action: input.action,
            entity_type: input.entity_type,
            entity_id: input.entity_id,
            created_at: input.timestamp,
            details: input.details ?? {},
        });
        if (error) console.error('[auditLog] write failed (non-fatal):', error.message);
    } catch (err) {
        console.error('[auditLog] write threw (non-fatal):', err);
    }
};

/**
 * LOUD variant — for CLINICALLY / COMPLIANCE-significant events only
 * (determination.signed, plan.created, plan.updated). Added 2026-07-28 after an
 * erroneous write reached two real charts and the ledger held nothing about it
 * (SECURITY_BACKLOG #21).
 *
 * Fire-and-forget is right for administrative events — an audit outage must not
 * block care delivery. It is WRONG for a signed determination or a treatment
 * plan: those must never complete silently unaudited, because the audit row is
 * the only durable evidence the act occurred and who performed it.
 *
 * HONEST LIMITATION — this is loud failure, NOT atomic rollback. The clinical row
 * is written first and audited second, so a failure here means the write LANDED
 * and is UNAUDITED; the thrown error says exactly that so the operator can
 * reconcile. True atomicity needs the write and its audit row in one transaction
 * (a SECURITY DEFINER RPC). It is not merely unimplemented for determinations —
 * `placement_determinations` is append-only by design, so its write cannot be
 * rolled back at all; loud failure is the only posture available there.
 */
export const logAuditOrThrow = async (input: LogAuditInput): Promise<void> => {
    let failure: string | null = null;
    try {
        const { error } = await supabase.from('audit_logs').insert({
            user_id: input.actor,
            action: input.action,
            entity_type: input.entity_type,
            entity_id: input.entity_id,
            created_at: input.timestamp,
            details: input.details ?? {},
        });
        if (error) failure = error.message;
    } catch (err) {
        failure = err instanceof Error ? err.message : String(err);
    }
    if (failure) {
        console.error(`[auditLog] REQUIRED audit write failed for ${input.action}:`, failure);
        throw new Error(
            `The record was saved but its audit entry FAILED — this ${input.action} is UNAUDITED ` +
            `(${input.entity_type} ${input.entity_id}). Reconcile before relying on it. Cause: ${failure}`,
        );
    }
};

/** Resolve the acting user id, or null when there is no session to attribute to. */
export const currentActorId = async (): Promise<string | null> => {
    try {
        const { data } = await supabase.auth.getUser();
        return data?.user?.id ?? null;
    } catch {
        return null;
    }
};
