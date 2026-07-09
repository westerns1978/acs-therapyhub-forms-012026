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
}

export const logAudit = async (input: LogAuditInput): Promise<void> => {
    try {
        const { error } = await supabase.from('audit_logs').insert({
            user_id: input.actor,
            action: input.action,
            entity_type: input.entity_type,
            entity_id: input.entity_id,
            created_at: input.timestamp,
        });
        if (error) console.error('[auditLog] write failed (non-fatal):', error.message);
    } catch (err) {
        console.error('[auditLog] write threw (non-fatal):', err);
    }
};
