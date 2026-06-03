import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import { storageService } from './storageService';
import { geminiText, geminiJSON, geminiGenerate } from './gemini';
import {
  Client, Appointment, Payment, DocumentFile, FormSubmission,
  SessionRecord, SROPProgress, ClientActivity,
  VideoSession, PracticeMetrics, User, AsamAnalysisResult, DailyBriefingData, ComplianceStatus,
  RevenueDataPoint, ComplianceDataPoint,
  TreatmentPlan, TreatmentPlanContent, TreatmentPlanStatus
} from '../types';
import { v4 as uuidv4 } from 'uuid';

import {
    dbMessages, dbSropData, dbComplianceEvents, dbAuditLogs,
    dbClientAssignments, dbFormTemplates, dbBillingSummaries,
    dbClientActivityFeed, dbForms, dbVideoSessions,
    dbSessionRecords,
    dbDocumentFiles,
    dbClientDocuments,
    dbAsamAssessments,
    dbProgramPlans,
    dbAppointments as mockAppointments,
    dbPayments as mockPayments,
    dbClients,
    dbFormSubmissions,
    dbAiSuggestions,
    initializeDatabase
} from '../data/database';

const DEFAULT_ORG_ID = '71077b47-66e8-4fd9-90e7-709773ea6582';
const MCP_ORCHESTRATOR_URL = 'https://ldzzlndsspkyohvzfiiu.supabase.co/functions/v1/mcp-orchestrator';

const mapVaultDocToApp = (vDoc: any): DocumentFile => ({
    id: vDoc.id,
    nodeId: vDoc.id,
    clientId: vDoc.metadata?.clientId || '',
    clientName: 'Client', 
    filename: vDoc.file_name,
    documentType: 'Unknown',
    gcs_file_path: vDoc.file_path,
    sql_metadata_id: vDoc.id,
    uploadDate: new Date(vDoc.uploaded_at),
    fileSize: vDoc.file_size,
    mimeType: vDoc.file_type,
    url: vDoc.public_url,
    extractedData: {
        summary: vDoc.metadata?.summary || '',
        fields: vDoc.metadata?.fields || [],
        actionItems: vDoc.metadata?.actionItems || [],
        suggestedSubfolder: vDoc.metadata?.suggestedSubfolder || 'Intake'
    },
    complianceStatus: 'Approved',
    auditTrail: []
});

// Translate Supabase snake_case rows into the camelCase Client shape the UI
// expects. Tolerates rows that are already camelCase (e.g. local mock data) so
// callers can pass either through this function.
const STATUS_MAP: Record<string, Client['status']> = {
    active: 'Compliant',
    compliant: 'Compliant',
    'non-compliant': 'Non-Compliant',
    'non_compliant': 'Non-Compliant',
    warrant: 'Warrant Issued',
    'warrant_issued': 'Warrant Issued',
    'warrant issued': 'Warrant Issued',
    completed: 'Completed',
    archived: 'Archived',
};

// Inverse of mapClientToApp — translates the camelCase shape the UI hands us
// (from CreateClientModal etc.) into the snake_case row shape the clients
// table expects. Only includes columns that actually exist on the table;
// extras the modal collects but the schema doesn't store (firstName/lastName
// separately, enrollmentDate, completionPercentage) are dropped here.
const mapAppToClientRow = (c: any): Record<string, any> => {
    const name = c.name
        || [c.firstName, c.lastName].filter(Boolean).join(' ').trim()
        || [c.first_name, c.last_name].filter(Boolean).join(' ').trim();

    const row: Record<string, any> = {
        name,
        email: c.email ?? null,
        primary_phone: c.phone ?? c.primary_phone ?? null,
        program_type: c.program ?? c.program_type ?? null,
        status: c.status ?? 'active',
        compliance_score: c.complianceScore ?? c.compliance_score ?? 100,
        case_number: c.caseNumber ?? c.case_number ?? null,
        dob: c.dob || null,
        county: c.county ?? null,
        probation_officer: c.probationOfficer ?? c.probation_officer ?? null,
        billing_type: c.billingType ?? c.billing_type ?? null,
        avatar_url: c.avatarUrl
            ?? c.avatar_url
            ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Client')}&background=8B1E24&color=fff`,
    };

    // Drop nulls so DB defaults (status='active', compliance_score=100, etc.)
    // can fill in. Without this, passing null overrides the default with NULL.
    for (const k of Object.keys(row)) {
        if (row[k] === null || row[k] === undefined) delete row[k];
    }
    return row;
};

const mapClientToApp = (c: any): Client => {
    const statusRaw = (c.status || '').toString().toLowerCase();
    const status = STATUS_MAP[statusRaw] || c.status || 'Compliant';

    const complianceScore = Number(c.complianceScore ?? c.compliance_score ?? 0);
    const sropHours = Number(c.srop_hours_completed ?? c.sropHoursCompleted ?? 0);
    const totalSessionsRequired = Number(c.total_sessions_required ?? c.totalSessionsRequired ?? 75);
    const completionPercentage = c.completionPercentage != null
        ? Number(c.completionPercentage)
        : (totalSessionsRequired > 0 ? Math.min(100, Math.round((sropHours / totalSessionsRequired) * 100)) : 0);

    const program = c.program ?? c.program_type ?? 'SATOP';
    const name = c.name || [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'Unknown Client';

    return {
        ...c,
        name,
        initials: name.split(' ').map((n: string) => n[0]).filter(Boolean).join('').toUpperCase() || '??',
        status,
        complianceScore,
        completionPercentage,
        caseNumber: c.caseNumber ?? c.case_number ?? '',
        phone: c.phone ?? c.primary_phone ?? '',
        program,
        programType: c.programType ?? c.program_type ?? program,
        referralSource: c.referralSource ?? c.referral_source ?? '',
        billingType: c.billingType ?? c.payment_type ?? c.billing_type ?? 'Court Mandate',
        avatarUrl: c.avatar_url ?? c.avatarUrl ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=8B1E24&color=fff`,
        missingDocuments: c.missingDocuments || [],
        gamification: c.gamification || { points: 0, badges: [] },
        attendanceHistory: c.attendanceHistory || [],
    };
};

export const callMcpOrchestrator = async (tool: string, params: any) => {
    try {
        const response = await fetch(MCP_ORCHESTRATOR_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'apikey': SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ agent: 'ACS_THERAPYHUB', tool, params })
        });
        if (!response.ok) throw new Error('Orchestrator request failed');
        return await response.json();
    } catch (e) {
        console.error("MCP Error:", e);
        return { error: "Service unavailable", status: "OFFLINE" };
    }
};

export const callWestFlowOrchestrator = callMcpOrchestrator;

export const getClients = async (): Promise<Client[]> => {
    try {
        const { data, error } = await supabase.from('clients').select('*');
        if (error || !data || data.length === 0) return (dbClients || []).map(mapClientToApp); 
        return data.map(mapClientToApp);
    } catch (e) {
        return (dbClients || []).map(mapClientToApp);
    }
};

export const getClient = async (id: string): Promise<Client | undefined> => {
    try {
        const { data, error } = await supabase.from('clients').select('*').eq('id', id).single();
        if (error || !data) {
            const mock = (dbClients || []).find(c => c.id === id);
            return mock ? mapClientToApp(mock) : undefined;
        }
        return mapClientToApp(data);
    } catch (e) {
        const mock = (dbClients || []).find(c => c.id === id);
        return mock ? mapClientToApp(mock) : undefined;
    }
};

export const getDocumentFilesForClient = async (clientId: string): Promise<DocumentFile[]> => {
    try {
        const vaultDocs = await storageService.fetchVault(clientId);
        if (!vaultDocs || (vaultDocs || []).length === 0) {
            return (dbDocumentFiles || []).filter(d => d.clientId === clientId);
        }
        return (vaultDocs || []).map(mapVaultDocToApp);
    } catch (e) {
        return (dbDocumentFiles || []).filter(d => d.clientId === clientId);
    }
};

export const saveDocumentFile = async (doc: DocumentFile, file?: File): Promise<DocumentFile> => {
    if (!file) throw new Error("Binary required for Vault ingestion.");
    const vDoc = await storageService.uploadToVault(file, doc.clientId);
    return mapVaultDocToApp(vDoc);
};

export const checkSupabaseConnection = () => storageService.checkConnection();

// --- Appointments: real Supabase persistence -------------------------------------------------
// The `appointments` table stores when-it-happens as `start_time` (timestamptz) + duration_minutes.
// The app's Appointment type splits that into date + "HH:MM" startTime/endTime. Map both ways.
const pad2 = (n: number) => n.toString().padStart(2, '0');
const timeStrFromDate = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const combineDateAndTime = (date: Date, hhmm: string): Date => {
    const [h, m] = hhmm.split(':').map(Number);
    const out = new Date(date);
    out.setHours(h || 0, m || 0, 0, 0);
    return out;
};
const diffMinutes = (start: Date, end: Date) => Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));

// The DB default for appointments.status is 'scheduled' (lowercase) and there
// is no CHECK constraint, so writers landed a mix of 'completed'/'scheduled'
// while the app's AppointmentStatus enum is capitalized. Mirrors the
// STATUS_MAP pattern used for clients above. Post-trial fix is a DB CHECK
// constraint or enum — logged in SECURITY_BACKLOG.md.
const APPOINTMENT_STATUS_MAP: Record<string, Appointment['status']> = {
    scheduled: 'Scheduled',
    'in progress': 'In Progress',
    in_progress: 'In Progress',
    completed: 'Completed',
    canceled: 'Canceled',
    cancelled: 'Canceled',
    'no show': 'No Show',
    no_show: 'No Show',
    rescheduled: 'Scheduled',
};

const normalizeAppointmentStatus = (raw: any): Appointment['status'] => {
    const key = String(raw || '').trim().toLowerCase();
    return APPOINTMENT_STATUS_MAP[key] || (raw as Appointment['status']) || 'Scheduled';
};

const mapAppointmentRowToApp = (row: any): Appointment => {
    const start = row.start_time ? new Date(row.start_time) : new Date();
    const end = row.end_time
        ? new Date(row.end_time)
        : new Date(start.getTime() + (row.duration_minutes ?? 60) * 60000);
    return {
        id: row.id,
        title: row.title || row.appointment_type || 'Session',
        type: (row.appointment_type || 'Individual Counseling') as any,
        date: start,
        startTime: timeStrFromDate(start),
        endTime: timeStrFromDate(end),
        modality: (row.modality || 'In-Person') as any,
        therapist: row.therapist_name || '',
        zoomLink: row.zoom_link || undefined,
        zoomMeetingId: row.zoom_meeting_id || undefined,
        status: normalizeAppointmentStatus(row.status),
        capacity: row.capacity ?? undefined,
        clientId: row.client_id || undefined,
        clientName: row.client_name || undefined,
        isRecurring: row.is_recurring ?? false,
        googleEventId: row.google_event_id || undefined,
        googleEventLink: row.google_event_link || undefined,
    };
};

const mapAppToAppointmentRow = (appt: Partial<Appointment>) => {
    const dateObj = appt.date instanceof Date ? appt.date : (appt.date ? new Date(appt.date) : new Date());
    const start = appt.startTime ? combineDateAndTime(dateObj, appt.startTime) : dateObj;
    const end = appt.endTime ? combineDateAndTime(dateObj, appt.endTime) : new Date(start.getTime() + 60 * 60000);
    return {
        title: appt.title ?? null,
        appointment_type: appt.type ?? null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration_minutes: diffMinutes(start, end),
        modality: appt.modality ?? null,
        therapist_name: appt.therapist ?? null,
        zoom_link: appt.zoomLink ?? null,
        zoom_meeting_id: appt.zoomMeetingId ?? null,
        status: appt.status ?? 'Scheduled',
        capacity: appt.capacity ?? null,
        client_id: appt.clientId ?? null,
        client_name: appt.clientName ?? null,
        is_recurring: appt.isRecurring ?? false,
        google_event_id: appt.googleEventId ?? null,
        google_event_link: appt.googleEventLink ?? null,
        updated_at: new Date().toISOString(),
    };
};

export const getAppointments = async (date?: Date): Promise<Appointment[]> => {
    try {
        let q = supabase.from('appointments').select('*').order('start_time', { ascending: true });
        if (date) {
            const from = new Date(date); from.setHours(0, 0, 0, 0);
            const to = new Date(date); to.setHours(23, 59, 59, 999);
            q = q.gte('start_time', from.toISOString()).lte('start_time', to.toISOString());
        }
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map(mapAppointmentRowToApp);
    } catch (e) {
        console.warn('[api] getAppointments fell back to mock:', e);
        return (mockAppointments || []).map((a: any) => ({ ...a, date: new Date(a.date) }));
    }
};
export const getSyncedAppointments = async (date?: Date) => (await getAppointments(date));
export const getClientAppointments = async (id: string) => (await getAppointments()).filter(a => a.clientId === id);
export const getPayments = async () => (mockPayments || []).map(p => ({...p, id: p.id.toString(), date: new Date(p.date), amount: p.amount, method: 'Stripe', status: 'Completed'}));
export const getPracticeMetrics = async () => ({ incomeMTD: 15400, unbilledAmount: 1200, missingNotesCount: 3, outstandingInvoicesCount: 2, totalActiveClients: (dbClients || []).length });

export const addAppointment = async (data: Partial<Appointment>): Promise<Appointment> => {
    const row = mapAppToAppointmentRow(data);
    const { data: saved, error } = await supabase
        .from('appointments')
        .insert(row)
        .select()
        .single();
    if (error) {
        console.error('[api] addAppointment failed:', error);
        throw new Error(error.message || 'Failed to save appointment');
    }
    return mapAppointmentRowToApp(saved);
};

export const updateAppointment = async (id: string, patch: Partial<Appointment>): Promise<Appointment> => {
    // Only send keys the caller actually supplied. Avoids clobbering existing
    // fields with the insert-mapper's defaults (which resets start_time to "now"
    // when `date/startTime/endTime` aren't in the patch, etc.).
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('title' in patch) row.title = patch.title ?? null;
    if ('type' in patch) row.appointment_type = patch.type ?? null;
    if ('modality' in patch) row.modality = patch.modality ?? null;
    if ('therapist' in patch) row.therapist_name = patch.therapist ?? null;
    if ('zoomLink' in patch) row.zoom_link = patch.zoomLink ?? null;
    if ('zoomMeetingId' in patch) row.zoom_meeting_id = patch.zoomMeetingId ?? null;
    if ('status' in patch) row.status = patch.status ?? 'Scheduled';
    if ('capacity' in patch) row.capacity = patch.capacity ?? null;
    if ('clientId' in patch) row.client_id = patch.clientId ?? null;
    if ('clientName' in patch) row.client_name = patch.clientName ?? null;
    if ('isRecurring' in patch) row.is_recurring = patch.isRecurring ?? false;
    if ('googleEventId' in patch) row.google_event_id = patch.googleEventId ?? null;
    if ('googleEventLink' in patch) row.google_event_link = patch.googleEventLink ?? null;
    if ('date' in patch || 'startTime' in patch || 'endTime' in patch) {
        const dateObj = patch.date instanceof Date ? patch.date : (patch.date ? new Date(patch.date) : new Date());
        if (patch.startTime) {
            const start = combineDateAndTime(dateObj, patch.startTime);
            row.start_time = start.toISOString();
            if (patch.endTime) {
                const end = combineDateAndTime(dateObj, patch.endTime);
                row.end_time = end.toISOString();
                row.duration_minutes = diffMinutes(start, end);
            }
        }
    }

    const { data, error } = await supabase
        .from('appointments')
        .update(row)
        .eq('id', id)
        .select()
        .single();
    if (error) {
        console.error('[api] updateAppointment failed:', error);
        throw new Error(error.message || 'Failed to update appointment');
    }
    return mapAppointmentRowToApp(data);
};

// Focused convenience wrapper for the single-field status change the schedule UI
// drives (Mark Completed / No-Show / Cancel). Delegates to updateAppointment so
// the real Supabase write + the row→app mapping stay in exactly one place. The
// `status` column is plain text with no CHECK constraint, so the capitalized
// AppointmentStatus values persist as-is and round-trip via normalizeAppointmentStatus.
export const updateAppointmentStatus = async (
    appointmentId: string,
    status: Appointment['status'],
): Promise<Appointment> => updateAppointment(appointmentId, { status });

export const deleteAppointment = async (id: string): Promise<void> => {
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) {
        console.error('[api] deleteAppointment failed:', error);
        throw new Error(error.message || 'Failed to delete appointment');
    }
};
export const getFormSubmissions = async (filters: any) => {
    // Real Supabase fetch — falls back to mock data only if Supabase is unreachable.
    try {
        let q = supabase.from('form_submissions').select('*').order('submitted_at', { ascending: false, nullsFirst: false });
        if (filters?.clientId) q = q.eq('client_id', filters.clientId);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map((row: any) => ({
            id: row.id,
            formId: row.form_id || row.form_type || row.form_name || 'form',
            formName: row.form_name || row.form_type || 'Form',
            clientId: row.client_id,
            status: row.status || 'Not Started',
            submittedAt: row.submitted_at ? new Date(row.submitted_at) : undefined,
            reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
            reviewedBy: row.reviewed_by || undefined,
            assignedAt: row.created_at ? new Date(row.created_at) : undefined,
            dueDate: row.due_date ? new Date(row.due_date) : undefined,
            data: row.data || {},
        }));
    } catch (e) {
        console.warn('[api] getFormSubmissions fell back to mock:', e);
        return (dbFormSubmissions || []).filter(s => !filters?.clientId || s.clientId === filters.clientId);
    }
};
export const saveFormSubmission = async (sub: any) => {
    // Real persistence — writes to form_submissions. Throws on failure so callers
    // can show the error to the user rather than silently losing data.
    const row = {
        form_id: sub.formId || sub.form_id,
        client_id: sub.clientId || sub.client_id,
        form_name: sub.formName || sub.form_name || null,
        status: sub.status || 'Completed',
        submitted_at: (sub.submittedAt instanceof Date ? sub.submittedAt.toISOString() : sub.submittedAt) || new Date().toISOString(),
        assigned_at: sub.assignedAt instanceof Date ? sub.assignedAt.toISOString() : (sub.assignedAt || null),
        due_date: sub.dueDate instanceof Date ? sub.dueDate.toISOString() : (sub.dueDate || null),
        data: sub.data || {},
    };
    const { data, error } = await supabase
        .from('form_submissions')
        .insert(row)
        .select()
        .single();
    if (error) {
        console.error('[api] saveFormSubmission failed:', error);
        throw new Error(error.message || 'Failed to save form submission');
    }
    return data;
};
export const getSROPData = async (id: string) => (dbSropData || []).find(d => d.clientId === id) || null;
export const getClientActivityFeed = async (id: string) => (dbClientActivityFeed || []).filter(a => a.clientId === id);
// The clinical_notes table stores notes as discrete SOAP columns
// (subjective/objective/assessment/plan) — there is NO `content` or `source`
// column, so the previous insert (which wrote those) was rejected every time and
// nothing persisted. We split a well-formed SOAP string into those columns;
// anything not cleanly structured drops wholesale into `subjective` so no text is
// lost and it still renders in the client's Clinical Notes card (subjective shows
// under "Data:"). Existing columns only — no schema changes.
const SOAP_KEYS = ['subjective', 'objective', 'assessment', 'plan'] as const;
type SoapKey = (typeof SOAP_KEYS)[number];

const splitSoapNote = (note: string): Partial<Record<SoapKey, string>> => {
    const headerRe = /(?:^|\n)[ \t]*[*#>\-]*[ \t]*(subjective|objective|assessment|plan)\b[ \t]*[:\-–]?[ \t]*\*{0,2}/gi;
    const matches = [...note.matchAll(headerRe)];
    const keysFound = matches.map(m => m[1].toLowerCase());
    // Only trust the split when it's an unambiguous, canonical S→O→A→P note;
    // otherwise a stray heading-like line could scatter clinical text into the
    // wrong sections. When unsure, keep the whole note intact in `subjective`.
    const isCanonical = keysFound.length === 4 && SOAP_KEYS.every((k, i) => keysFound[i] === k);
    if (!isCanonical) return { subjective: note.trim() };

    const sections: Partial<Record<SoapKey, string>> = {};
    for (let i = 0; i < matches.length; i++) {
        const key = matches[i][1].toLowerCase() as SoapKey;
        const start = (matches[i].index ?? 0) + matches[i][0].length;
        const end = i + 1 < matches.length ? (matches[i + 1].index ?? note.length) : note.length;
        sections[key] = note.slice(start, end).trim();
    }
    const preamble = note.slice(0, matches[0].index ?? 0).trim();
    if (preamble) sections.subjective = `${preamble}\n\n${sections.subjective ?? ''}`.trim();
    return sections;
};

export interface SaveClinicalNoteOptions {
    /** Existing clinical_notes columns only — never invent new ones. */
    appointmentId?: string | null;
    therapistId?: string | null;
    noteType?: string;
    isSigned?: boolean;
}

export const saveClinicalNote = async (
    clientId: string,
    note: string,
    opts: SaveClinicalNoteOptions = {},
) => {
    if (!clientId || !note?.trim()) throw new Error('clientId and note are required');
    const row: Record<string, any> = {
        client_id: clientId,
        note_type: opts.noteType ?? 'Session',
        is_signed: opts.isSigned ?? false,
        created_at: new Date().toISOString(),
        ...splitSoapNote(note),
    };
    if (opts.appointmentId) row.appointment_id = opts.appointmentId;
    if (opts.therapistId) row.therapist_id = opts.therapistId;

    const { data, error } = await supabase
        .from('clinical_notes')
        .insert(row)
        .select()
        .single();
    if (error) {
        console.error('[api] saveClinicalNote failed:', error);
        throw new Error(error.message || 'Failed to save clinical note');
    }
    return data;
};
export const getMessages = async () => dbMessages || [];
export const getStaffMessages = async () => (dbMessages || []).filter(m => m.sender === 'counselor' || m.sender === 'system');
export const getConversation = async (clientId?: string) => dbMessages || [];

// --- Client communications: REAL Supabase persistence (client_communications) ---
// The office/admin Communication Center sends client messages here. The table
// has a permissive "Allow all" RLS policy, so authenticated inserts succeed
// without any RLS change. `type` is NOT NULL on the table, so we always set it.
// Human-sent only — advisory AI must never write here.
export interface ClientCommunication {
    id: string;
    clientId: string | null;
    message: string;
    type: string;
    sentBy: string;
    sentAt: string;
}

const mapCommRow = (r: any): ClientCommunication => ({
    id: r.id,
    clientId: r.client_id ?? null,
    message: r.message ?? '',
    type: r.type ?? 'message',
    sentBy: r.sent_by ?? 'staff',
    sentAt: r.sent_at ?? r.created_at ?? new Date().toISOString(),
});

export const getClientCommunications = async (clientId: string): Promise<ClientCommunication[]> => {
    if (!clientId) return [];
    const { data, error } = await supabase
        .from('client_communications')
        .select('*')
        .eq('client_id', clientId)
        .order('sent_at', { ascending: true });
    if (error) {
        console.warn('[api] getClientCommunications failed:', error);
        return [];
    }
    return (data || []).map(mapCommRow);
};

export const sendClientMessage = async (
    clientId: string,
    text: string,
    sentBy: string = 'staff',
): Promise<ClientCommunication> => {
    if (!clientId || !text?.trim()) throw new Error('clientId and message text are required');
    const { data, error } = await supabase
        .from('client_communications')
        .insert({ client_id: clientId, message: text.trim(), type: 'message', sent_by: sentBy })
        .select()
        .single();
    if (error) {
        console.error('[api] sendClientMessage failed:', error);
        throw new Error(error.message || 'Failed to send message');
    }
    return mapCommRow(data);
};

// Recent client communications across all clients (for the office/admin dashboard).
// No embed/join — client names are resolved caller-side from the clients list to
// avoid depending on a PostgREST FK relationship. NOTE: the table has no read/unread
// flag, so this is "recent", not "unread" — callers must not present it as unread.
export const getRecentClientCommunications = async (limit = 6): Promise<ClientCommunication[]> => {
    const { data, error } = await supabase
        .from('client_communications')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(limit);
    if (error) {
        console.warn('[api] getRecentClientCommunications failed:', error);
        return [];
    }
    return (data || []).map(mapCommRow);
};
export const submitPaperForm = async (clientId: string, formId: string, formName: string, file: File) => {
    // 1. Upload to Vault (triggers AI DNA extraction)
    const uploadedFile = await storageService.uploadToVault(file, clientId);
    
    // 2. Create Form Submission record
    const { data, error } = await supabase
        .from('form_submissions')
        .insert({
            client_id: clientId,
            form_id: formId,
            form_name: formName,
            status: 'Completed', // Match FormSubmission['status'] case
            submitted_at: new Date().toISOString(),
            data: {
                is_paper_upload: true,
                file_id: uploadedFile.id,
                file_url: uploadedFile.public_url,
                ai_summary: uploadedFile.metadata?.summary,
                ai_tags: uploadedFile.metadata?.tags,
                is_signed: uploadedFile.metadata?.isSigned,
                requires_review: true,
                extracted_at: new Date().toISOString()
            }
        })
        .select()
        .single();
        
    if (error) throw error;
    return data;
};

export const approveFormSubmission = async (submissionId: string, reviewerName: string) => {
    const { data, error } = await supabase
        .from('form_submissions')
        .update({
            status: 'Reviewed',
            reviewed_at: new Date().toISOString(),
            reviewed_by: reviewerName,
            data: {
                requires_review: false,
                approved_at: new Date().toISOString()
            }
        })
        .eq('id', submissionId)
        .select()
        .single();
        
    if (error) throw error;
    return data;
};

export const getFormTemplates = async () => [
    { id: 'satop-intake', name: 'SATOP Intake Form', title: 'SATOP Intake Form', category: 'Intake' as const, description: 'Initial assessment for SATOP program.', fieldCount: 42, lastModified: '2024-05-15' },
    { id: 'auth-release', name: 'Authorization for Release', title: 'Authorization for Release', category: 'Compliance' as const, description: 'Consent to share information with courts/probation.', fieldCount: 12, lastModified: '2024-05-10' },
    { id: 'satop-checklist', name: 'SATOP Checklist', title: 'SATOP Checklist', category: 'Compliance' as const, description: 'Required documentation verification.', fieldCount: 8, lastModified: '2024-05-12' },
    { id: 'srop-progression', name: 'SROP Progression Requirements', title: 'SROP Progression Requirements', category: 'Assessment' as const, description: 'Tracking hours and compliance for SROP.', fieldCount: 15, lastModified: '2024-05-18' },
    { id: 'react-intake', name: 'REACT Intake Form', title: 'REACT Intake Form', category: 'Intake' as const, description: 'Initial assessment for REACT program.', fieldCount: 35, lastModified: '2024-05-01' }
];
export const getBillingSummary = async (id: string) => dbBillingSummaries[id];
export const getClientDocuments = async (id: string) => (dbClientDocuments || []).filter(d => d.clientId === id);
export const getClientAssignments = async (id: string) => (dbClientAssignments || []).filter(a => a.clientId === id);
export const addClientAssignment = async (assignment: any) => {};
export const addSignedDocument = async (doc: any) => {};
export const getForms = async () => dbForms || [];
export const assignForm = async (formId: string, clientIds: string[], dueDate: Date) => {
    // Bulk-insert one form_submission row per client with status='Not Started'.
    // Looks up template metadata so form_name/form_type are set — the portal filters
    // pending forms by matching on these, so they can't be left blank.
    if (!formId || !clientIds?.length) throw new Error('formId and clientIds are required');
    const templates = await getFormTemplates();
    const template = templates.find(t => t.id === formId);
    const now = new Date().toISOString();
    const due = dueDate instanceof Date ? dueDate.toISOString() : new Date(dueDate).toISOString();
    const rows = clientIds.map(clientId => ({
        form_id: formId,
        form_name: template?.title || template?.name || formId,
        form_type: template?.category || null,
        client_id: clientId,
        status: 'Not Started',
        assigned_at: now,
        due_date: due,
        data: {},
    }));
    const { data, error } = await supabase
        .from('form_submissions')
        .insert(rows)
        .select();
    if (error) {
        console.error('[api] assignForm failed:', error);
        throw new Error(error.message || 'Failed to assign form');
    }
    return data;
};
export const getAiSuggestions = async (context: any) => (dbAiSuggestions || []).filter(s => s.contextId === context.clientId || s.contextId === context.documentId);
export const getProgressData = async () => [];
export const getVideoSessions = async () => dbVideoSessions || [];
export const getVideoSessionById = async (id: string) => (dbVideoSessions || []).find(s => s.id === id);
export const addVideoSession = async (s: any) => ({...s, id: uuidv4(), createdAt: new Date()});
export const updateVideoSessionStatus = async (id: string, status: string) => {};
export const getAsamAssessment = async (id: string) => dbAsamAssessments[id] || {1:{dimension:1, name:'Intoxication', notes:''}, 2:{dimension:2, name:'Biomedical', notes:''}, 3:{dimension:3, name:'Emotional', notes:''}, 4:{dimension:4, name:'Readiness', notes:''}, 5:{dimension:5, name:'Relapse', notes:''}, 6:{dimension:6, name:'Environment', notes:''}};
export const getProgramPlan = async (id: string) => dbProgramPlans[id] || {clientId: id, goals: []};
export const getComplianceEvents = async () => dbComplianceEvents || [];
export const getAuditLogs = async () => dbAuditLogs || [];
export const getDocumentForSigning = async (id: string) => (dbClientDocuments || []).find(d => d.id === id);
export const saveClientSignature = async (docId: string, signature: string) => ({success: true});
export const updateDocumentComplianceStatus = async (ids: string[], status: string, user: any) => [];
export const addSessionRecord = async (record: any) => {};
export const getComplianceAnalysis = async (client: any, sropData: any) => "Analysis";
export const generateFormSuggestions = async (field: string, context: string) => "Suggestion";
export const getDailyBriefingData = async () => ({ therapistStats: { reportingStreak: 10, caseloadSize: (dbClients || []).length, thisWeekCompletions: 2 }, todaysAppointments: (mockAppointments || []).slice(0,3), highPriorityAlerts: [], complianceRisks: [], clientMilestones: [] });
export const getWestFlowExecutiveSummary = async () => "Executive summary data";

export const getRevenueData = async (): Promise<RevenueDataPoint[]> => [
    { name: 'SATOP', revenue: 12500 },
    { name: 'REACT', revenue: 8400 },
    { name: 'Anger', revenue: 5200 },
    { name: 'Gambling', revenue: 3100 },
];

export const getComplianceTrendData = async (): Promise<ComplianceDataPoint[]> => [
    { month: 'Jan', score: 88 },
    { month: 'Feb', score: 91 },
    { month: 'Mar', score: 89 },
    { month: 'Apr', score: 94 },
    { month: 'May', score: 96 },
    { month: 'Jun', score: 98 },
];

export const resetDemoData = async () => {
    initializeDatabase();
};

/**
 * HIGH-STAKES CLINICAL ANALYSIS: Gemini 3 Pro with Max Thinking Budget.
 */
export const generateAsamAnalysis = async (notes: string): Promise<AsamAnalysisResult> => {
    return geminiJSON('gemini-2.5-flash',
        `Perform a High-Fidelity Multidimensional ASAM Analysis. Deliberate on cross-dimensional interactions. Priority: Regulatory Compliance (9 CSR 30-3). Notes: ${notes}`,
        {
            type: "OBJECT",
            properties: {
                clinicalSummary: { type: "STRING" },
                recommendedLevel: { type: "STRING" },
                dimensionRisks: { type: "ARRAY", items: { type: "OBJECT", properties: { dimension: { type: "STRING" }, riskLevel: { type: "STRING" } } } },
                treatmentRecommendations: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: ["clinicalSummary", "recommendedLevel", "dimensionRisks", "treatmentRecommendations"]
        }
    );
};

/**
 * SPEED-OPTIMIZED CLINICAL SYNTHESIS: Gemini 3 Flash.
 */
export const generateSoapNoteFromTranscript = async (transcript: string, clientName: string) => {
    return geminiText('gemini-2.5-flash',
        `Construct a structural SOAP note for ${clientName}. Content must be HIPAA-compliant. Source: ${transcript}`);
};

export const generateClinicalSnapshot = async (client: Client) => {
    return geminiText('gemini-2.5-flash',
        `Synthesize operational intelligence for client ${client.name} (Program: ${client.program}, County: ${client.county}). Identify critical workflow bottlenecks.`);
};

/**
 * COMMUNITY RESOURCE FINDER: Google Maps Grounding via Gemini 2.5 Flash.
 */
export const searchCommunityResources = async (query: string, coords?: { latitude: number, longitude: number }) => {
    const body: any = {
        contents: [{ role: 'user', parts: [{ text: `Urgently locate verified community recovery resources for: ${query}. Focus on St. Louis/Jefferson County. Provide direct access links and place reviews.` }] }],
        tools: [{ google_maps: {} }],
    };
    if (coords) {
        body.tool_config = { retrieval_config: { lat_lng: { latitude: coords.latitude, longitude: coords.longitude } } };
    }
    const { text, candidates } = await geminiGenerate('gemini-2.5-flash', body);
    return {
        text,
        chunks: candidates[0]?.groundingMetadata?.groundingChunks || []
    };
};

/**
 * RELAPSE RISK PREDICTION: Gemini 3 reasoning for proactive clinical flagging.
 */
// Real Gemini call (gemini-2.5-flash). Returns null — never a fabricated score —
// when the call fails, times out, or comes back empty/malformed, so the UI can
// show a graceful "unavailable" state instead of a misleading 0%. Advisory output
// only: callers display it; it must not be written to any record or drive
// billing/compliance decisions.
export const generateRelapseRiskPrediction = async (
    client: Client,
    history: any[],
): Promise<{ score: number; reasoning: string } | null> => {
    try {
        const res = await geminiJSON<{ score?: number; reasoning?: string }>('gemini-2.5-flash',
            `Analyze historical telemetry for ${client.name} to predict relapse probability. Signals: ${JSON.stringify(history)}. Return probability (0-100) and rationale.`,
            {
                type: "OBJECT",
                properties: {
                    score: { type: "NUMBER" },
                    reasoning: { type: "STRING" }
                },
                required: ["score", "reasoning"]
            }
        );
        if (!res || typeof res.score !== 'number') return null; // empty/malformed → no fake profile
        return { score: res.score, reasoning: res.reasoning ?? '' };
    } catch (e) {
        console.warn('[api] generateRelapseRiskPrediction failed:', e);
        return null;
    }
};

/**
 * MILESTONE VIDEO GENERATION: Veo-3.1 Milestone celebrations.
 * Uses REST API for video generation (Imagen/Veo endpoint).
 */
export const generateMilestoneCelebration = async (clientName: string, milestone: string) => {
    // Routed through pds-gemini-proxy so no Gemini key is held client-side.
    // NOTE: this function currently has NO callers and is legacy (it previously
    // required the AI Studio `window.aistudio` key picker, which doesn't exist in
    // production). The generateVideos + polling calls route cleanly through the
    // proxy; the returned video URL, however, can't be rendered directly via the
    // verify_jwt proxy (a media <src> can't carry the auth header) — fetching it
    // as an authenticated blob is a follow-up. Left minimal and key-free.
    const PROXY = `${SUPABASE_URL}/functions/v1/pds-gemini-proxy/v1beta`;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
    };
    const res = await fetch(`${PROXY}/models/veo-3.1-fast-generate-preview:generateVideos`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            prompt: `A vibrant cinematic celebration for ${clientName} completing ${milestone}. Background shows a sunrise over a peaceful road, symbolizing a new path in recovery. Inspirational, cinematic 4k style.`,
            config: { numberOfVideos: 1, resolution: '1080p', aspectRatio: '16:9' }
        })
    });
    let operation = await res.json();

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        const pollRes = await fetch(`${PROXY}/${operation.name}`, { headers });
        operation = await pollRes.json();
    }

    return operation.response?.generatedVideos?.[0]?.video?.uri || '';
};

export const addClient = async (clientData: any): Promise<Client> => {
    const row = mapAppToClientRow(clientData);
    if (!row.name || !row.primary_phone) {
        throw new Error('Client name and phone are required.');
    }
    const { data, error } = await supabase
        .from('clients')
        .insert(row)
        .select()
        .single();
    if (error) throw error;
    return mapClientToApp(data);
};

// Explicit camelCase → DB column map for partial UPDATEs. Distinct from
// mapAppToClientRow (which is geared for INSERTs and auto-generates avatar_url
// + applies INSERT-time defaults). Here we touch only the fields the caller
// explicitly passes — avoids clobbering avatar or other server-side values on
// partial edits.
const CLIENT_UPDATE_COLUMNS: Record<string, string> = {
    name: 'name',
    email: 'email',
    phone: 'primary_phone',
    primary_phone: 'primary_phone',
    dob: 'dob',
    caseNumber: 'case_number',
    case_number: 'case_number',
    program: 'program_type',
    program_type: 'program_type',
    status: 'status',
    complianceScore: 'compliance_score',
    compliance_score: 'compliance_score',
    county: 'county',
    probationOfficer: 'probation_officer',
    probation_officer: 'probation_officer',
    billingType: 'billing_type',
    billing_type: 'billing_type',
    primarySubstance: 'primary_substance',
    primary_substance: 'primary_substance',
};

export const updateClient = async (id: string, changes: Record<string, any>): Promise<Client> => {
    const row: Record<string, any> = {};
    for (const [k, v] of Object.entries(changes)) {
        const col = CLIENT_UPDATE_COLUMNS[k];
        if (col && v !== undefined) row[col] = v;
    }
    if (Object.keys(row).length === 0) {
        throw new Error('No editable fields provided.');
    }
    const { data, error } = await supabase
        .from('clients')
        .update(row)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return mapClientToApp(data);
};

// ────────────────────────────────────────────────────────────────────────────
// Treatment Plans (Phase F2)
// ────────────────────────────────────────────────────────────────────────────
const mapTreatmentPlanRowToApp = (row: any): TreatmentPlan => ({
    id: row.id,
    clientId: row.client_id,
    templateId: row.template_id ?? undefined,
    title: row.title,
    category: row.category,
    estimatedDuration: row.estimated_duration ?? undefined,
    content: row.content || { problems: [] },
    status: (row.status || 'Active') as TreatmentPlanStatus,
    createdBy: row.created_by ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

export const getTreatmentPlansForClient = async (clientId: string): Promise<TreatmentPlan[]> => {
    const { data, error } = await supabase
        .from('treatment_plans')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapTreatmentPlanRowToApp);
};

export const saveTreatmentPlan = async (input: {
    clientId: string;
    templateId?: string;
    title: string;
    category: string;
    estimatedDuration?: string;
    content: TreatmentPlanContent;
    notes?: string;
}): Promise<TreatmentPlan> => {
    const { data, error } = await supabase
        .from('treatment_plans')
        .insert({
            client_id: input.clientId,
            template_id: input.templateId ?? null,
            title: input.title,
            category: input.category,
            estimated_duration: input.estimatedDuration ?? null,
            content: input.content,
            notes: input.notes ?? null,
            status: 'Active',
        })
        .select()
        .single();
    if (error) throw error;
    return mapTreatmentPlanRowToApp(data);
};

export const updateTreatmentPlan = async (
    id: string,
    changes: Partial<{
        title: string;
        estimatedDuration: string;
        content: TreatmentPlanContent;
        status: TreatmentPlanStatus;
        notes: string;
    }>
): Promise<TreatmentPlan> => {
    const row: Record<string, any> = { updated_at: new Date().toISOString() };
    if (changes.title !== undefined) row.title = changes.title;
    if (changes.estimatedDuration !== undefined) row.estimated_duration = changes.estimatedDuration;
    if (changes.content !== undefined) row.content = changes.content;
    if (changes.status !== undefined) row.status = changes.status;
    if (changes.notes !== undefined) row.notes = changes.notes;
    const { data, error } = await supabase
        .from('treatment_plans')
        .update(row)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return mapTreatmentPlanRowToApp(data);
};

export const archiveTreatmentPlan = async (id: string): Promise<TreatmentPlan> =>
    updateTreatmentPlan(id, { status: 'Archived' });

export const analyzeTravelRisk = async (id: string, date: string, time: string) => ({ risk: 'Low' as const, reason: 'Commute cleared by GeMyndFlow Dispatcher.' });
export const getSessionRecords = async (id: string) => (dbSessionRecords || []).filter(r => r.clientId === id);

export const processDocument = async (file: File, apiKey: string, clientId: string, clientName: string, onProgress: (p: number) => void): Promise<DocumentFile> => {
    onProgress(30);
    const dna = await storageService.extractDocumentDNA(file);
    onProgress(100);
    return {
        id: uuidv4(), nodeId: '', clientId, clientName, filename: file.name, uploadDate: new Date(), fileSize: file.size, 
        mimeType: file.type, url: '', sql_metadata_id: '', gcs_file_path: '',
        extractedData: { summary: dna.summary, fields: [], actionItems: [], suggestedSubfolder: 'Intake' },
        complianceStatus: 'Pending', auditTrail: [], documentType: 'Unknown'
    };
};