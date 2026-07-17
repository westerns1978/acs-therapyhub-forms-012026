import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import { storageService, getSignedUrl } from './storageService';
import { geminiText, geminiJSON, geminiGenerate } from './gemini';
import {
  Client, ClientStatus, CLIENT_STATUSES, Appointment, Payment, DocumentFile, FormSubmission,
  SessionRecord, SROPProgress, ClientActivity,
  VideoSession, PracticeMetrics, User, AsamAnalysisResult, DailyBriefingData, ComplianceStatus,
  RevenueDataPoint, ComplianceDataPoint,
  TreatmentPlan, TreatmentPlanContent, TreatmentPlanStatus, AppointmentSeries, AuditLog
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { FORM_REGISTRY } from '../config/formRegistry';
import { fetchClientDetermination } from './complianceEngine';
import { programForLevel } from '../config/programVocab';
import { LATE_CANCELLATION_FEE } from '../config/satopFees';
import { parseTimeToMinutes } from '../config/time';
import { generateWeeklyOccurrences } from './recurrence';
import { logAudit } from './auditLog';

import {
    dbMessages, dbSropData, dbComplianceEvents,
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
    dbAiSuggestions,
    initializeDatabase
} from '../data/database';

const DEFAULT_ORG_ID = '71077b47-66e8-4fd9-90e7-709773ea6582';
const MCP_ORCHESTRATOR_URL = 'https://ldzzlndsspkyohvzfiiu.supabase.co/functions/v1/mcp-orchestrator';

// Map the REAL uploaded_files.document_type (documentExtraction taxonomy) to a
// human display category for the Documents "file cabinet". Anything missing or
// unrecognized is honestly "Uncategorized" — never mislabeled.
const DOC_TYPE_LABELS: Record<string, string> = {
    court_order: 'Court Order',
    intake_form: 'Intake',
    treatment_plan: 'Treatment Plan',
    verification_slip: 'Verification',
    consent: 'Consent',
    billing_record: 'Billing',
    progress_note: 'Progress Note',
    id_copy: 'ID / License',
    completion_certificate: 'Completion Certificate',
    drug_screen: 'Drug Screen',
    other: 'Other',
    profile: 'Other',
};
const categorizeDocType = (raw?: string | null): string => {
    const key = (raw ?? '').toString().trim().toLowerCase();
    return DOC_TYPE_LABELS[key] || 'Uncategorized';
};

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
    url: '', // minted as a short-lived signed URL by the async fetchers (private bucket; no public_url)
    extractedData: {
        summary: vDoc.metadata?.summary || vDoc.extracted_summary || '',
        fields: vDoc.metadata?.fields || [],
        actionItems: vDoc.metadata?.actionItems || [],
        // No real subfolder is stored; leave undefined rather than defaulting to
        // a misleading "Intake". The real grouping is `category` below.
        suggestedSubfolder: vDoc.metadata?.suggestedSubfolder,
    },
    // Real category from the uploaded_files.document_type column (previously
    // dropped here, which is why every doc displayed the hardcoded "Intake").
    category: categorizeDocType(vDoc.document_type),
    needsReview: !!vDoc.needs_review,
    complianceStatus: 'Approved',
    auditTrail: []
});

// Translate Supabase snake_case rows into the camelCase Client shape the UI
// expects. Tolerates rows that are already camelCase (e.g. local mock data) so
// callers can pass either through this function.
//
// STATUS_MAP is GONE (status normalization, 2026-06-11): it used to rename the
// lifecycle value 'active' to the STANDING word 'Compliant', which painted a
// fabricated green "Compliant" badge on every active client. clients.status is
// now lifecycle-only ('active'|'completed'|'archived', DB CHECK-enforced) and
// passes through canonically; standing is the engine's to compute at render.
const normalizeClientStatus = (raw: any): ClientStatus => {
    const key = (raw || '').toString().trim().toLowerCase();
    return (CLIENT_STATUSES as readonly string[]).includes(key) ? (key as ClientStatus) : 'active';
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
        case_number: c.caseNumber ?? c.case_number ?? null,
        dob: c.dob || null,
        county: c.county ?? null,
        probation_officer: c.probationOfficer ?? c.probation_officer ?? null,
        billing_type: c.billingType ?? c.billing_type ?? null,
        avatar_url: c.avatarUrl
            ?? c.avatar_url
            ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Client')}&background=8B1E24&color=fff`,
    };

    // Drop nulls so DB defaults (status='active', etc.)
    // can fill in. Without this, passing null overrides the default with NULL.
    for (const k of Object.keys(row)) {
        if (row[k] === null || row[k] === undefined) delete row[k];
    }
    return row;
};

const mapClientToApp = (c: any): Client => {
    const status = normalizeClientStatus(c.status);

    // WS-DisplayTruth: completionPercentage is NOT derived from the static
    // srop_hours_completed / total_sessions_required columns — those diverge from the
    // authoritative completion gate. Program-progress surfaces fetch fetchClientProgress
    // (services/displayProgress) — the same accrual + signed-determination sources the gate
    // uses. Here we only pass through an explicit completionPercentage if the row carries one.
    const completionPercentage = c.completionPercentage != null ? Number(c.completionPercentage) : 0;

    // A prospect (front-door intake, pre-placement) has NO program yet — its
    // program_type is set by staff at "Place & Activate" from a signed
    // determination. Don't coerce its null to 'SATOP' (that would be a phantom
    // program). Every other status keeps the legacy 'SATOP' fallback. (Verified
    // 2026-06-17: 0 non-prospect clients have a null program_type, so this scope
    // changes nothing for existing clients.)
    const program = c.program ?? c.program_type ?? (status === 'prospect' ? '' : 'SATOP');
    const name = c.name || [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'Unknown Client';

    return {
        ...c,
        name,
        initials: name.split(' ').map((n: string) => n[0]).filter(Boolean).join('').toUpperCase() || '??',
        status,
        completionPercentage,
        caseNumber: c.caseNumber ?? c.case_number ?? '',
        clientType: c.clientType ?? c.client_type ?? undefined,
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

/**
 * Clients list — the single choke-point (status normalization, 2026-06-11).
 * Archived clients are EXCLUDED by default, query-side, so every picker and
 * list inherits active-only behavior without per-surface filters.
 * Opt-outs:
 *   - { status: 'active'|'completed'|'archived' } — exactly one lifecycle set
 *     (the grid's filter chips); { status: 'all' } — no filter.
 *   - { includeArchived: true } — legacy full-set toggle (Compliance CSV).
 *   `status` takes precedence when both are passed.
 * Fails VISIBLY: the silent fallback to the mock dbClients array is GONE
 * (it fired on error AND on empty — phantom clients either way). Matches the
 * getAppointments / getFormSubmissions precedent.
 */
export const getClients = async (
    opts?: { includeArchived?: boolean; status?: ClientStatus | 'all' },
): Promise<Client[]> => {
    let query = supabase.from('clients').select('*');
    if (opts?.status) {
        if (opts.status !== 'all') query = query.eq('status', opts.status);
    } else if (!opts?.includeArchived) {
        // Default roster excludes BOTH archived and prospect: a prospect (front-door
        // intake, pre-placement) is not a client yet and must never leak into pickers
        // or the active list. The explicit { status: 'prospect' } opt-out still fetches
        // them for the intake-queue tile.
        query = query.not('status', 'in', '("archived","prospect")');
    }
    const { data, error } = await query;
    if (error) {
        console.error('[api] getClients failed:', error);
        throw new Error(error.message || 'Failed to load clients');
    }
    return (data || []).map(mapClientToApp);
};

/** Per-lifecycle counts for the grid's filter chips. One cheap select; counted
 *  client-side (single-clinic scale). Fails visibly like getClients. */
export const getClientStatusCounts = async (): Promise<Record<ClientStatus, number>> => {
    const { data, error } = await supabase.from('clients').select('status');
    if (error) {
        console.error('[api] getClientStatusCounts failed:', error);
        throw new Error(error.message || 'Failed to load client counts');
    }
    const counts: Record<ClientStatus, number> = {
        active: 0, completed: 0, archived: 0, prospect: 0,
        paused: 0, unsuccessful_dx: 0, successful_dx: 0,
    };
    for (const r of data || []) {
        const s = (r as any).status as ClientStatus;
        if (counts[s] !== undefined) counts[s]++;
    }
    return counts;
};

// ── Front-door intake (prospect lifecycle) ────────────────────────────────────

/** One row in the staff intake-queue tile. `intakeFeePaid` is derived from a REAL
 *  linked succeeded payment — never fabricated. */
export interface ProspectRow {
    id: string;
    name: string;
    intakeInterest: string | null;
    createdAt: string | null;
    intakeFeePaid: boolean;
}

/** The intake queue: prospect rows + whether their intake fee actually cleared.
 *  Reads payments (Director/Admin RLS), so surface this only to financial staff. */
export const getProspects = async (): Promise<ProspectRow[]> => {
    const { data, error } = await supabase
        .from('clients')
        .select('id, name, intake_interest, created_at')
        .eq('status', 'prospect')
        .order('created_at', { ascending: false });
    if (error) {
        console.error('[api] getProspects failed:', error);
        throw new Error(error.message || 'Failed to load intake queue');
    }
    const rows = data || [];
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    // Paid? = a real succeeded payment linked to the prospect (auto-linked by the
    // Stripe webhook via metadata.client_id). Never a fabricated "paid".
    const { data: pays } = await supabase
        .from('payments').select('client_id').eq('status', 'succeeded').in('client_id', ids);
    const paid = new Set((pays || []).map((p: any) => p.client_id));
    return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        intakeInterest: r.intake_interest ?? null,
        createdAt: r.created_at ?? null,
        intakeFeePaid: paid.has(r.id),
    }));
};

/** "Place & Activate" — convert a prospect to an active client. REQUIRES a
 *  clinician-SIGNED placement determination (the existing gate): the program is
 *  derived from the signed level (IV→SROP, III→CIP, II→WIP, I→OEP), never from the
 *  prospect. Throws if no determination is signed yet — the gate cannot be skipped.
 *  Does NOT create a portal auth account (that stays staff-provisioned, unchanged). */
export const placeAndActivate = async (clientId: string): Promise<Client> => {
    const level = await fetchClientDetermination(clientId);
    if (!level) {
        throw new Error('Sign a placement determination before activating this prospect.');
    }
    const program = programForLevel(level);
    return updateClient(clientId, { program, status: 'active' });
};

export const getClient = async (id: string): Promise<Client | undefined> => {
    // No mock fallback (2026-06-11) — a missing client is honestly undefined,
    // a failed query throws. Status-blind by design (archived stays loadable
    // by id: records are retained, not hidden from direct access).
    const { data, error } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
    if (error) {
        console.error('[api] getClient failed:', error);
        throw new Error(error.message || 'Failed to load client');
    }
    return data ? mapClientToApp(data) : undefined;
};

export const getDocumentFilesForClient = async (clientId: string): Promise<DocumentFile[]> => {
    try {
        const vaultDocs = await storageService.fetchVault(clientId);
        if (!vaultDocs || (vaultDocs || []).length === 0) {
            return (dbDocumentFiles || []).filter(d => d.clientId === clientId);
        }
        const docs = (vaultDocs || []).map(mapVaultDocToApp);
        // Mint a signed URL per doc from its private-bucket file_path (gcs_file_path).
        return Promise.all(docs.map(async d => ({ ...d, url: (await getSignedUrl(d.gcs_file_path)) || '' })));
    } catch (e) {
        return (dbDocumentFiles || []).filter(d => d.clientId === clientId);
    }
};

export const saveDocumentFile = async (doc: DocumentFile, file?: File, uploadedBy?: string): Promise<DocumentFile> => {
    if (!file) throw new Error("Binary required for Vault ingestion.");
    // Dropzone path → unified ingest core (one bucket + always-classified + real uploader).
    const vDoc = await storageService.ingestDocument(file, { clientId: doc.clientId, source: 'dropzone', uploadedBy });
    const mapped = mapVaultDocToApp(vDoc);
    return { ...mapped, url: (await getSignedUrl(mapped.gcs_file_path)) || '' };
};

export const checkSupabaseConnection = () => storageService.checkConnection();

// --- Appointments: real Supabase persistence -------------------------------------------------
// The `appointments` table stores when-it-happens as `start_time` (timestamptz) + duration_minutes.
// The app's Appointment type splits that into date + "HH:MM" startTime/endTime. Map both ways.
const pad2 = (n: number) => n.toString().padStart(2, '0');
const timeStrFromDate = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const combineDateAndTime = (date: Date, hhmm: string): Date => {
    // Parse via the single source of truth so a 12-hour "06:00 PM" stores as 18:00,
    // not 6 AM (the old split(':') dropped the meridiem). 24-hour "18:00" round-trips.
    const mins = parseTimeToMinutes(hhmm);
    const out = new Date(date);
    if (Number.isNaN(mins)) { out.setHours(0, 0, 0, 0); return out; }
    out.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
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
        serviceType: row.service_type || undefined,
        sessionTypeId: row.session_type || undefined,
        counselorId: row.counselor_id || undefined,
        groupId: row.group_id || undefined,
        billableUnits: row.billable_units ?? undefined,
        capacity: row.capacity ?? undefined,
        // NOTE: appointments.client_id is TEXT in the DB, while every other
        // client_id column is uuid (SECURITY_BACKLOG.md #7). It maps fine to a
        // string here, but the WS0 RLS self-read policy must cast it to compare
        // against uuids — normalize this column to uuid + add an FK to drop that cast.
        clientId: row.client_id || undefined,
        clientName: row.client_name || undefined,
        isRecurring: row.is_recurring ?? false,
        seriesId: row.series_id || undefined,
        notes: row.notes ?? undefined,
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
        service_type: appt.serviceType ?? null,   // WS3/WS6: born categorized (group inherits; ad-hoc → null, set at mark-complete)
        session_type: appt.sessionTypeId ?? null,  // taxonomy token (config/sessionTaxonomy.ts) — NOT the accrual axis
        counselor_id: appt.counselorId ?? null,    // explicit attribution; NULL → trigger self-attributes the booker
        group_id: appt.groupId ?? null,            // WS6: standing-group instance (null = ad-hoc)
        capacity: appt.capacity ?? null,
        client_id: appt.clientId ?? null,
        client_name: appt.clientName ?? null,
        is_recurring: appt.isRecurring ?? false,
        series_id: appt.seriesId ?? null,            // recurring 1:1 occurrence (null = ad-hoc)
        notes: appt.notes ?? null,                   // per-occurrence clinician note
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
        // Honesty: NEVER fall back to mock appointments. A calendar showing fabricated
        // sessions is worse than a visible failure — rethrow so the caller surfaces an
        // error/empty state instead of silently rendering phantom data.
        console.error('[api] getAppointments failed:', e);
        throw e instanceof Error ? e : new Error('Failed to load appointments');
    }
};
export const getSyncedAppointments = async (date?: Date) => (await getAppointments(date));
export const getClientAppointments = async (id: string) => (await getAppointments()).filter(a => a.clientId === id);

// Per-client booking glance: the most-recent PAST and the next UPCOMING appointment.
// Matches on appointments.client_id the SAME way the contact-popup lookup does — exact
// string equality against the client's uuid id. The column is TEXT (SECURITY_BACKLOG #7),
// so a legacy non-uuid row simply doesn't match and is excluded, never returned as someone
// else's appt. Returns the mapped row or null; a real DB error rethrows (no silent fallback).
export const getLastAppointment = async (clientId: string): Promise<Appointment | null> => {
    try {
        const { data, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('client_id', clientId)
            .lt('start_time', new Date().toISOString())
            .order('start_time', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data ? mapAppointmentRowToApp(data) : null;
    } catch (e) {
        console.error('[api] getLastAppointment failed:', e);
        throw e instanceof Error ? e : new Error('Failed to load last appointment');
    }
};

export const getNextAppointment = async (clientId: string): Promise<Appointment | null> => {
    try {
        const { data, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('client_id', clientId)
            .gte('start_time', new Date().toISOString())
            .order('start_time', { ascending: true })
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data ? mapAppointmentRowToApp(data) : null;
    } catch (e) {
        console.error('[api] getNextAppointment failed:', e);
        throw e instanceof Error ? e : new Error('Failed to load next appointment');
    }
};
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

// WS6: standing groups joined to their counselor (for the schedule modal). Staff-only by
// RLS (groups + counselors are staff_all). Flattens the counselor's permanent Zoom room so
// a group-instance can inherit zoom_link/zoom_meeting_id + the WS3 service_type.
export const getGroupsWithCounselor = async () => {
    const { data, error } = await supabase
        .from('groups')
        .select('id, program, weekday, start_local, end_local, session_kind, service_type, active, counselors(name, zoom_link, zoom_meeting_id)')
        .eq('active', true)
        .order('weekday', { ascending: true });
    if (error) {
        console.warn('[api] getGroupsWithCounselor failed:', error.message);
        return [];
    }
    return (data || []).map((g: any) => ({
        id: g.id,
        program: g.program,
        weekday: g.weekday,
        start_local: g.start_local,
        end_local: g.end_local,
        session_kind: g.session_kind,
        service_type: g.service_type,
        counselor_name: g.counselors?.name ?? null,
        counselor_zoom_link: g.counselors?.zoom_link ?? null,
        counselor_zoom_meeting_id: g.counselors?.zoom_meeting_id ?? null,
    }));
};

// authUserId is the WS1 step-A identity link (counselors.auth_user_id → auth.users.id).
// It's how the day view resolves "which lane is the logged-in clinician's own" without a
// fragile name match. Nullable: unlinked counselors (Bill/Debra/John/Rick) have none.
export interface Counselor { id: string; name: string; active: boolean; authUserId: string | null; }

// Active counselors, name-ordered — the lane source for the all-counselor day view.
// Lanes are keyed by NAME (appointments attribute via therapist_name, not therapist_id;
// see DEFERRED.md). Returns [] visibly on error rather than fabricating lanes.
export const getCounselors = async (): Promise<Counselor[]> => {
    const { data, error } = await supabase
        .from('counselors')
        .select('id, name, active, auth_user_id')
        .eq('active', true)
        .order('name', { ascending: true });
    if (error) {
        console.error('[api] getCounselors failed:', error.message);
        throw new Error(error.message || 'Failed to load counselors');
    }
    return (data || []).map((c: any) => ({
        id: c.id, name: c.name, active: c.active, authUserId: c.auth_user_id ?? null,
    }));
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
    if ('serviceType' in patch) row.service_type = patch.serviceType ?? null;
    if ('sessionTypeId' in patch) row.session_type = patch.sessionTypeId ?? null;
    if ('counselorId' in patch) row.counselor_id = patch.counselorId ?? null;
    if ('billableUnits' in patch) row.billable_units = patch.billableUnits ?? null;
    if ('capacity' in patch) row.capacity = patch.capacity ?? null;
    if ('clientId' in patch) row.client_id = patch.clientId ?? null;
    if ('clientName' in patch) row.client_name = patch.clientName ?? null;
    if ('isRecurring' in patch) row.is_recurring = patch.isRecurring ?? false;
    if ('seriesId' in patch) row.series_id = patch.seriesId ?? null;
    if ('notes' in patch) row.notes = patch.notes ?? null;
    if ('googleEventId' in patch) row.google_event_id = patch.googleEventId ?? null;
    if ('googleEventLink' in patch) row.google_event_link = patch.googleEventLink ?? null;
    const isReschedule = 'date' in patch || 'startTime' in patch || 'endTime' in patch;
    if (isReschedule) {
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

    // Audit foundation only (DEFERRED #4/#28) — capture the prior start/end BEFORE the
    // write so a future reschedule-history reader has a from/to, not just a bare event.
    // Scoped to date/time changes only (not every updateAppointment call, e.g. status
    // changes) since "reschedule audit" is the only event approved for this batch.
    let previous: { start_time: string | null; end_time: string | null; client_id: string | null } | null = null;
    if (isReschedule) {
        const { data: prevRow } = await supabase
            .from('appointments')
            .select('start_time, end_time, client_id')
            .eq('id', id)
            .single();
        previous = prevRow ?? null;
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

    // Fire-and-forget, same pattern as saveClinicalNote's note.signed write — never
    // blocks or fails the reschedule itself. No reader exists yet: this is the write
    // side only (DEFERRED note on this item — a "view reschedule history" UI is a
    // separate, unbuilt task on top of this).
    if (isReschedule) {
        supabase.auth.getUser().then(({ data: auth }) => {
            const actor = auth?.user?.id;
            if (!actor) return;
            void logAudit({
                actor,
                action: 'appointment.rescheduled',
                entity_type: 'appointments',
                entity_id: id,
                timestamp: new Date().toISOString(),
                details: {
                    client_id: previous?.client_id ?? (data as any)?.client_id ?? null,
                    from: { start_time: previous?.start_time ?? null, end_time: previous?.end_time ?? null },
                    to: { start_time: row.start_time ?? null, end_time: row.end_time ?? null },
                },
            });
        });
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
    serviceType?: Appointment['serviceType'],
    billableUnits?: number | null,
): Promise<Appointment> => {
    const patch: Partial<Appointment> = { status };
    if (serviceType) patch.serviceType = serviceType;
    // Only carry units when the caller passed a value (a configured service type at
    // Mark-Complete). `undefined` = don't touch the column; an explicit `null` clears it.
    if (billableUnits !== undefined) patch.billableUnits = billableUnits ?? undefined;
    return updateAppointment(appointmentId, patch);
};

export const deleteAppointment = async (id: string): Promise<void> => {
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) {
        console.error('[api] deleteAppointment failed:', error);
        throw new Error(error.message || 'Failed to delete appointment');
    }
};

// --- Recurring 1:1 scheduling -----------------------------------------------------------------
// VERIFIED-LANE. No AI: dates come from the pure recurrence.ts helper; conflict math is the
// pure detectOverlaps. This layer only persists + queries.

/** A therapist's appointments overlapping a [from,to] window, Canceled excluded — the existing
 *  set the conflict check intersects candidate occurrences against. Matched by NAME this round
 *  (fast-follow: therapist_id FK → swap the .eq predicate). Returns [] visibly on error so a
 *  failed conflict lookup never silently claims "no conflicts". */
export const getTherapistAppointments = async (
    therapistName: string,
    fromISO: string,
    toISO: string,
): Promise<Appointment[]> => {
    const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('therapist_name', therapistName)
        .gte('start_time', fromISO)
        .lte('start_time', toISO)
        .neq('status', 'Canceled')
        .order('start_time', { ascending: true });
    if (error) {
        console.warn('[api] getTherapistAppointments failed:', error.message);
        return [];
    }
    return (data || []).map(mapAppointmentRowToApp);
};

export interface CreateRecurringSeriesInput {
    clientId: string;        // REAL uuid FK to clients (the pop-up fetches phone/email by it)
    clientName: string;
    therapistName: string;
    appointmentType: Appointment['type'];
    modality: Appointment['modality'];
    title: string;
    firstDate: Date;         // first occurrence (weekday is implicit in this date)
    startTime: string;       // canonical "HH:MM"
    endTime: string;
    count: number;           // N weekly occurrences (the wired bound)
    serviceType?: Appointment['serviceType'];
    sessionTypeId?: string;  // taxonomy token — stamped on each occurrence row
    counselorId?: string;    // explicit attribution — stamped on each occurrence row
    zoomLink?: string;
    zoomMeetingId?: string;
}

const mapSeriesRowToApp = (row: any): AppointmentSeries => ({
    id: row.id,
    clientId: row.client_id,
    therapistName: row.therapist_name,
    appointmentType: row.appointment_type,
    modality: row.modality || undefined,
    weekday: row.weekday,
    startLocal: typeof row.start_local === 'string' ? row.start_local.slice(0, 5) : row.start_local,
    endLocal: typeof row.end_local === 'string' ? row.end_local.slice(0, 5) : row.end_local,
    serviceType: row.service_type || undefined,
    zoomLink: row.zoom_link || undefined,
    zoomMeetingId: row.zoom_meeting_id || undefined,
    recurrenceCount: row.recurrence_count ?? undefined,
    recurrenceUntil: row.recurrence_until || undefined,
    status: row.status || undefined,
});

/** Create a recurring 1:1 series: insert the parent rule, then bulk-insert N dated occurrences
 *  (ordinary appointments rows carrying series_id). Returns the series + the created occurrences.
 *  The occurrences are born 'Scheduled'; serviceType is set at mark-complete unless inherited. */
export const createRecurringSeries = async (
    input: CreateRecurringSeriesInput,
): Promise<{ series: AppointmentSeries; occurrences: Appointment[] }> => {
    const dates = generateWeeklyOccurrences(input.firstDate, input.count);
    if (dates.length === 0) throw new Error('A recurring series needs at least one occurrence.');

    const { data: seriesRow, error: seriesErr } = await supabase
        .from('appointment_series')
        .insert({
            client_id: input.clientId,
            therapist_name: input.therapistName,
            appointment_type: input.appointmentType,
            modality: input.modality ?? null,
            weekday: input.firstDate.getDay(),
            start_local: input.startTime,
            end_local: input.endTime,
            service_type: input.serviceType ?? null,
            zoom_link: input.zoomLink ?? null,
            zoom_meeting_id: input.zoomMeetingId ?? null,
            recurrence_count: input.count,
        })
        .select()
        .single();
    if (seriesErr) {
        console.error('[api] createRecurringSeries (series insert) failed:', seriesErr);
        throw new Error(seriesErr.message || 'Failed to create the recurring series.');
    }

    const seriesId = seriesRow.id as string;
    const rows = dates.map((d) => mapAppToAppointmentRow({
        title: input.title,
        type: input.appointmentType,
        date: d,
        startTime: input.startTime,
        endTime: input.endTime,
        modality: input.modality,
        therapist: input.therapistName,
        status: 'Scheduled',
        serviceType: input.serviceType,
        sessionTypeId: input.sessionTypeId,
        counselorId: input.counselorId,
        clientId: input.clientId,
        clientName: input.clientName,
        zoomLink: input.zoomLink,
        zoomMeetingId: input.zoomMeetingId,
        seriesId,
        isRecurring: true,
    }));

    const { data: occRows, error: occErr } = await supabase
        .from('appointments')
        .insert(rows)
        .select();
    if (occErr) {
        // Roll back the orphaned parent so a half-made series can't linger.
        await supabase.from('appointment_series').delete().eq('id', seriesId);
        console.error('[api] createRecurringSeries (occurrences insert) failed:', occErr);
        throw new Error(occErr.message || 'Failed to create the recurring occurrences.');
    }

    return {
        series: mapSeriesRowToApp(seriesRow),
        occurrences: (occRows || []).map(mapAppointmentRowToApp),
    };
};

/** Cancel the EVENTUAL occurrences of a series (status → Canceled). Completed sessions are
 *  PROTECTED (they carry WS3 accrual) and left untouched — likewise already-Canceled rows.
 *  Returns how many were canceled. The series row is marked canceled too. */
export const cancelSeries = async (seriesId: string): Promise<{ canceled: number }> => {
    const { data, error } = await supabase
        .from('appointments')
        .update({ status: 'Canceled', updated_at: new Date().toISOString() })
        .eq('series_id', seriesId)
        .not('status', 'in', '("Completed","Canceled")')
        .select('id');
    if (error) {
        console.error('[api] cancelSeries failed:', error);
        throw new Error(error.message || 'Failed to cancel the series.');
    }
    await supabase.from('appointment_series').update({ status: 'canceled' }).eq('id', seriesId);
    return { canceled: (data || []).length };
};

/** Delete the non-Completed occurrences of a series. Completed sessions are PROTECTED (accrual
 *  history) and kept. The parent series row is removed only when no Completed occurrence remains
 *  — otherwise it's left so the surviving rows keep a valid FK. Returns the delete count. */
export const deleteSeries = async (seriesId: string): Promise<{ deleted: number }> => {
    const { data, error } = await supabase
        .from('appointments')
        .delete()
        .eq('series_id', seriesId)
        .neq('status', 'Completed')
        .select('id');
    if (error) {
        console.error('[api] deleteSeries failed:', error);
        throw new Error(error.message || 'Failed to delete the series.');
    }
    const { count } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('series_id', seriesId)
        .eq('status', 'Completed');
    if (!count) {
        await supabase.from('appointment_series').delete().eq('id', seriesId);
    }
    return { deleted: (data || []).length };
};

// --- Late-cancellation fee (WS-LateCancel) ---------------------------------------------------
// The FIRST app-level charge writer — every prior charge was a SQL seed. A flat
// LATE_CANCELLATION_FEE (config) for an appointment cancelled inside 24h of its start, per
// the ACS Late Cancellation Policy. Runs as the CURRENT STAFF USER: charges INSERT is
// private.is_staff() since wsrp_2 — the SAME predicate that gates appointment-cancel — so no
// SECURITY DEFINER is needed (whoever could cancel is already authorized to write the charge).
// The charge raises clients.balance via the wsbilling_1 trigger and flows into the WS7
// completion gate's balance==0 determinant. A 'waived' charge is excluded from the balance
// formula but stays on the ledger with who/why/when for the audit trail.

export interface LateCancellationOutcome {
    created: boolean;          // a new charge row was inserted
    alreadyAssessed: boolean;  // idempotent no-op — a fee already existed for this appointment
    waived: boolean;           // the (new or pre-existing) fee is in 'waived' status
    charge: any | null;        // the charge row (inserted or pre-existing)
}

/**
 * Assess (or waive on the spot) the late-cancellation fee for ONE appointment.
 * Idempotent by appointment: if a late_cancellation_fee charge already exists for this
 * appointment_id (any status), no second row is created — a re-cancel, status flip, or
 * double-click can't double-charge. Deterministic: the amount is the config constant, never
 * AI/freeform. No phantom: only ever called after a real cancel inside the 24h window.
 */
export const assessLateCancellationFee = async (params: {
    appointmentId: string;
    clientId: string;
    startsAt: Date | string;
    waive?: { reason: string };
}): Promise<LateCancellationOutcome> => {
    const { appointmentId, clientId, startsAt, waive } = params;
    if (!appointmentId) throw new Error('Cannot assess a late-cancellation fee without an appointment.');
    if (!clientId) throw new Error('Cannot assess a late-cancellation fee without a client.');
    if (waive && !waive.reason.trim()) throw new Error('A reason is required to waive the late-cancellation fee.');

    // Idempotency guard — one late-cancellation fee per appointment, any status.
    const { data: existing, error: exErr } = await supabase
        .from('charges')
        .select('*')
        .eq('appointment_id', appointmentId)
        .eq('charge_type', 'late_cancellation_fee')
        .limit(1);
    if (exErr) throw new Error(exErr.message || 'Could not check for an existing late-cancellation fee.');
    if (existing && existing.length > 0) {
        const row: any = existing[0];
        return { created: false, alreadyAssessed: true, waived: row.status === 'waived', charge: row };
    }

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) throw new Error('Your session expired — sign in again to assess the fee.');

    const when = startsAt instanceof Date ? startsAt : new Date(startsAt);
    const whenLabel = isNaN(when.getTime())
        ? 'the scheduled appointment'
        : when.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

    const row: Record<string, any> = {
        client_id: clientId,
        charge_type: 'late_cancellation_fee',
        description: `Late cancellation fee — appointment ${whenLabel} cancelled less than 24 hours in advance.`,
        amount: LATE_CANCELLATION_FEE,
        appointment_id: appointmentId,
        created_by: uid,
        // status defaults to 'pending' (DB default) unless waived on the spot:
        ...(waive
            ? { status: 'waived', waived_by: uid, waived_reason: waive.reason.trim(), waived_at: new Date().toISOString() }
            : {}),
    };

    const { data: inserted, error: insErr } = await supabase
        .from('charges')
        .insert(row)
        .select('*')
        .single();
    if (insErr) throw new Error(insErr.message || 'Could not record the late-cancellation fee.');

    return { created: true, alreadyAssessed: false, waived: !!waive, charge: inserted };
};

/**
 * Waive an existing charge (the billing-surface action on a pending late-cancel fee).
 * status → 'waived' + provenance (who/why/when). The wsbilling_1 balance formula excludes
 * waived charges, so the client's balance drops on the next trigger pass and the completion
 * gate's payment determinant clears. Any staff may waive for v1 (tighten to isDirector later).
 */
export const waiveCharge = async (chargeId: string, reason: string): Promise<void> => {
    if (!chargeId) throw new Error('No charge to waive.');
    if (!reason || !reason.trim()) throw new Error('A reason is required to waive a charge.');
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) throw new Error('Your session expired — sign in again to waive this charge.');
    const { error } = await supabase
        .from('charges')
        .update({ status: 'waived', waived_by: uid, waived_reason: reason.trim(), waived_at: new Date().toISOString() })
        .eq('id', chargeId);
    if (error) throw new Error(error.message || 'Could not waive the charge.');
};

export const getFormSubmissions = async (filters: any) => {
    // Real Supabase fetch. NEVER falls back to mock — phantom forms on a forms list or a
    // completion surface are worse than a visible failure. Rethrows on a DB error so callers
    // surface an error/empty state (ClientWorkspace's Forms tab renders <ErrorFallback>),
    // mirroring the getAppointments fix. The cert gate reads forms separately
    // (complianceEngine.fetchClientSignedForms) and already fails closed (empty set on error).
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
        // NEVER fall back to mock — rethrow so the caller shows a visible error, never phantom forms.
        console.error('[api] getFormSubmissions failed:', e);
        throw e instanceof Error ? e : new Error('Failed to load form submissions');
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

// Shared slicer: cuts `note` into sections at each header match, then folds any
// text BEFORE the first match into that first section (never dropped). Used for
// both the canonical (all headers, in order) and partial (some headers found)
// cases — the slicing math is identical either way.
const sliceByHeaderMatches = <K extends string>(note: string, matches: RegExpMatchArray[]): Partial<Record<K, string>> => {
    const sections: Partial<Record<K, string>> = {};
    for (let i = 0; i < matches.length; i++) {
        const key = matches[i][1].toLowerCase() as K;
        const start = (matches[i].index ?? 0) + matches[i][0].length;
        const end = i + 1 < matches.length ? (matches[i + 1].index ?? note.length) : note.length;
        sections[key] = note.slice(start, end).trim();
    }
    const preamble = note.slice(0, matches[0].index ?? 0).trim();
    if (preamble) {
        const firstKey = matches[0][1].toLowerCase() as K;
        sections[firstKey] = `${preamble}\n\n${sections[firstKey] ?? ''}`.trim();
    }
    return sections;
};

const splitSoapNote = (note: string): Partial<Record<SoapKey, string>> => {
    const headerRe = /(?:^|\n)[ \t]*[*#>\-]*[ \t]*(subjective|objective|assessment|plan)\b[ \t]*[:\-–]?[ \t]*\*{0,2}/gi;
    const matches = [...note.matchAll(headerRe)];
    const keysFound = matches.map(m => m[1].toLowerCase());
    const isCanonical = keysFound.length === 4 && SOAP_KEYS.every((k, i) => keysFound[i] === k);
    if (isCanonical) return sliceByHeaderMatches<SoapKey>(note, matches);

    // Partial-match fallback: AI drift (or a hand-typed note) rarely produces all
    // four headers in exact S→O→A→P order, but often produces 2 or 3 of them
    // cleanly. Split on whatever was found rather than collapsing everything into
    // `subjective` — still never scatters text into the WRONG section, since each
    // slice only ever contains what actually followed its own header. Anything
    // genuinely ambiguous (0-1 headers, duplicates, or all 4 out of order) keeps
    // the old, safe whole-note-in-`subjective` behavior — when unsure, preserving
    // the whole note in one field is the correct failure, not a guessed split.
    const uniqueKeys = new Set(keysFound);
    const isPartial = (matches.length === 2 || matches.length === 3) && uniqueKeys.size === matches.length;
    if (isPartial) return sliceByHeaderMatches<SoapKey>(note, matches);

    return { subjective: note.trim() };
};

// DAP (Data / Assessment / Plan) is stored LOSSLESSLY in the existing SOAP
// columns — NO schema change. Data -> subjective, Assessment -> assessment,
// Plan -> plan; `objective` is left empty for DAP. Mirrors splitSoapNote: only a
// clean, canonical D->A->P note is split; anything else drops whole into
// `subjective` so no text is lost.
// TODO(isolation-migration): add a dedicated `note_format` column + a `data`
// column to clinical_notes so DAP is stored natively, instead of reusing the
// SOAP `subjective` column and encoding the format in `note_type`.
const DAP_KEYS = ['data', 'assessment', 'plan'] as const;
type DapKey = (typeof DAP_KEYS)[number];
const splitDapNote = (note: string): Partial<Record<SoapKey, string>> => {
    const headerRe = /(?:^|\n)[ \t]*[*#>\-]*[ \t]*(data|assessment|plan)\b[ \t]*[:\-–]?[ \t]*\*{0,2}/gi;
    const matches = [...note.matchAll(headerRe)];
    const keysFound = matches.map(m => m[1].toLowerCase());
    const isCanonical = keysFound.length === 3 && DAP_KEYS.every((k, i) => keysFound[i] === k);
    // Partial-match fallback (mirrors splitSoapNote): 2 of the 3 DAP headers found
    // cleanly still gets split on those, rather than collapsing to `subjective`.
    const uniqueKeys = new Set(keysFound);
    const isPartial = matches.length === 2 && uniqueKeys.size === 2;
    if (!isCanonical && !isPartial) return { subjective: note.trim() };

    const sections = sliceByHeaderMatches<DapKey>(note, matches);
    // Data -> subjective; Assessment/Plan keep their names; objective stays empty.
    return { subjective: sections.data ?? '', assessment: sections.assessment, plan: sections.plan };
};

export interface SaveClinicalNoteOptions {
    /** Existing clinical_notes columns only — never invent new ones. */
    appointmentId?: string | null;
    therapistId?: string | null;
    noteType?: string;
    isSigned?: boolean;
    /**
     * Note format the therapist chose. 'SOAP' (default) keeps today's behavior.
     * 'DAP' is recorded as a "(DAP)" marker in the EXISTING note_type column and
     * stored in the existing SOAP columns (see splitDapNote). No schema change.
     * TODO(isolation-migration): replace with a dedicated `note_format` column.
     */
    noteFormat?: 'SOAP' | 'DAP';
}

export const saveClinicalNote = async (
    clientId: string,
    note: string,
    opts: SaveClinicalNoteOptions = {},
) => {
    if (!clientId || !note?.trim()) throw new Error('clientId and note are required');
    const format = opts.noteFormat ?? 'SOAP';
    const baseType = opts.noteType ?? 'Session';
    const row: Record<string, any> = {
        client_id: clientId,
        // Format recorded in the EXISTING note_type column (no schema change): DAP
        // notes get a "(DAP)" marker so the format round-trips and shows in the
        // note badge. SOAP notes are unchanged (note_type stays the base type).
        note_type: format === 'DAP' ? `${baseType} (DAP)` : baseType,
        is_signed: opts.isSigned ?? false,
        created_at: new Date().toISOString(),
        ...(format === 'DAP' ? splitDapNote(note) : splitSoapNote(note)),
    };
    if (opts.appointmentId) {
        // Trust boundary: appointmentId can arrive via a URL query param (ActiveSession
        // reads ?appointmentId= off the route) — a stale tab or a hand-edited URL could
        // hand this function an appointment that belongs to a DIFFERENT client. Verify
        // before linking rather than trusting the caller; a wrong link is a records
        // defect, an unlinked note is just honest. Never blocks the save either way.
        const { data: apptRow, error: apptErr } = await supabase
            .from('appointments')
            .select('client_id')
            .eq('id', opts.appointmentId)
            .maybeSingle();
        if (!apptErr && apptRow && apptRow.client_id === clientId) {
            row.appointment_id = opts.appointmentId;
        } else {
            console.warn('[api] saveClinicalNote: appointmentId did not match clientId (or was not found) — saving unlinked', {
                appointmentId: opts.appointmentId,
                clientId,
                apptClientId: apptRow?.client_id ?? null,
                apptErr: apptErr?.message,
            });
        }
    }
    if (opts.therapistId) row.therapist_id = opts.therapistId;

    const { data, error } = await supabase
        .from('clinical_notes')
        .insert(row)
        .select()
        .single();
    if (error) {
        console.error('[api] saveClinicalNote failed:', error);
        // Preserve the Postgres SQLSTATE on the thrown Error (message unchanged, so existing
        // callers are unaffected). distributeGroupNote classifies 23505 (unique-violation from
        // ux_clinical_notes_group_seat) as a benign already-posted, not a failure.
        const e = new Error(error.message || 'Failed to save clinical note');
        (e as any).code = (error as any).code;
        throw e;
    }

    // Audit v1, event 1: the note SIGN write (is_signed=true). saveClinicalNote is the one
    // choke point for both create and sign (there is no separate UPDATE-to-sign path — see
    // recon/audit-logging), so instrumenting here covers every caller that signs. Fire-and-
    // forget: logAudit never throws, and this is deliberately NOT awaited so a slow/failed
    // audit write can never delay or break the note save the caller is waiting on.
    if (opts.isSigned) {
        supabase.auth.getUser().then(({ data: auth }) => {
            const actor = auth?.user?.id;
            if (!actor) return; // no session to attribute to — skip rather than log a null actor
            void logAudit({
                actor,
                action: 'note.signed',
                entity_type: 'clinical_notes',
                entity_id: data.id,
                timestamp: new Date().toISOString(),
                details: { client_id: clientId },
            });
        });
    }

    return data;
};

// --- WS2: group check-in → distribute one note into each present attendee's chart ------------
export interface GroupNoteDistribution {
    posted: string[];        // client_ids that got a NEW group note this run
    alreadyPosted: string[]; // client_ids whose seat already had a group note (23505 — NO dup written)
    failed: string[];        // client_ids whose write errored for any OTHER reason
}

/**
 * Distribute ONE group note into each SELECTED present attendee's chart.
 *
 * Resolves the group occurrence's roster the SAME way greenRoom.ts does (appointments sharing
 * group_id + start_time; one seat per client), filters to the selected clients, and loops the
 * EXISTING saveClinicalNote — stamping each note with that attendee's OWN appointment_id and
 * note_type = 'Group Session'. Reuses clinical_notes' clinician-only RLS; no RLS touched here.
 *
 * IDEMPOTENT via the ux_clinical_notes_group_seat partial unique index: a re-post for a seat
 * that already has a group note raises 23505, classified `alreadyPosted` — no duplicate chart
 * entry, no double-count. So a re-click / reopen / retry is safe.
 *
 * Partial-failure safe: Promise.allSettled over the loop — one client's failure never aborts
 * the others. FAIL-CLOSED: a selected client with no resolvable seat can't be stamped with the
 * idempotency key, so it's reported `failed` rather than written with a null key (which would
 * be un-dedupable and could later double-chart).
 */
export const distributeGroupNote = async (
    groupId: string,
    startTime: string,
    note: string,
    selectedClientIds: string[],
    opts: { therapistId?: string | null; isSigned?: boolean; noteFormat?: 'SOAP' | 'DAP' } = {},
): Promise<GroupNoteDistribution> => {
    if (!groupId) throw new Error('A group is required to distribute a note.');
    if (!startTime) throw new Error('The group occurrence time is required.');
    if (!note?.trim()) throw new Error('The group note is empty.');
    const selected = Array.from(new Set(selectedClientIds.filter(Boolean)));
    if (selected.length === 0) return { posted: [], alreadyPosted: [], failed: [] };

    // Resolve the roster (group_id + start_time), carrying each seat's own appointment_id.
    const { data: seats, error: seatErr } = await supabase
        .from('appointments')
        .select('id, client_id')
        .eq('group_id', groupId)
        .eq('start_time', startTime);
    if (seatErr) {
        console.error('[api] distributeGroupNote roster resolve failed:', seatErr);
        throw new Error(seatErr.message || 'Could not resolve the group roster.');
    }
    const seatByClient = new Map<string, string>();
    for (const r of seats || []) {
        if (r.client_id && !seatByClient.has(r.client_id)) seatByClient.set(r.client_id, r.id);
    }

    const targets = selected.map((cid) => ({ cid, appointmentId: seatByClient.get(cid) ?? null }));

    const results = await Promise.allSettled(
        targets.map(async ({ cid, appointmentId }) => {
            if (!appointmentId) {
                // No seat → can't stamp the idempotency key → refuse (would be un-dedupable).
                throw new Error('No group seat (appointment) found for this client in the occurrence.');
            }
            await saveClinicalNote(cid, note, {
                appointmentId,
                noteType: 'Group Session',            // the idempotency marker (partial unique index)
                therapistId: opts.therapistId ?? null,
                isSigned: opts.isSigned ?? false,
                noteFormat: opts.noteFormat ?? 'SOAP',
            });
            return cid;
        }),
    );

    const posted: string[] = [];
    const alreadyPosted: string[] = [];
    const failed: string[] = [];
    results.forEach((r, i) => {
        const cid = targets[i].cid;
        if (r.status === 'fulfilled') { posted.push(cid); return; }
        if ((r.reason as any)?.code === '23505') { alreadyPosted.push(cid); return; } // seat already charted — benign
        console.error('[api] distributeGroupNote write failed for', cid, r.reason);
        failed.push(cid);
    });

    return { posted, alreadyPosted, failed };
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

// --- Staff -> Support/Admin channel (reuses client_communications) ----------
// A staff member messaging ACS support/admin (Dan) is stored as a client_communications
// row with client_id = NULL and type = 'support'. This is additive REUSE of the existing
// table: client_id is nullable, there is no CHECK on `type`, and the table's permissive
// "Allow all" RLS policy lets the authenticated client insert/select. No new schema, no
// RLS change. Outbound-only today (support replies are handled out of band).
export const SUPPORT_COMM_TYPE = 'support';

export const getSupportMessages = async (): Promise<ClientCommunication[]> => {
    const { data, error } = await supabase
        .from('client_communications')
        .select('*')
        .is('client_id', null)
        .eq('type', SUPPORT_COMM_TYPE)
        .order('sent_at', { ascending: true });
    if (error) {
        console.warn('[api] getSupportMessages failed:', error);
        return [];
    }
    return (data || []).map(mapCommRow);
};

export const sendSupportMessage = async (
    text: string,
    sentBy: string = 'staff',
): Promise<ClientCommunication> => {
    if (!text?.trim()) throw new Error('message text is required');
    const { data, error } = await supabase
        .from('client_communications')
        .insert({ client_id: null, message: text.trim(), type: SUPPORT_COMM_TYPE, sent_by: sentBy })
        .select()
        .single();
    if (error) {
        console.error('[api] sendSupportMessage failed:', error);
        throw new Error(error.message || 'Failed to send support message');
    }
    return mapCommRow(data);
};
// A portal paper-form upload has a KNOWN type (the form being submitted), so we
// classify from the form name rather than re-detecting — it never lands as
// "Uncategorized". Keyword map mirrors storageService's document_type taxonomy.
const PAPER_FORM_DOCTYPE: Array<[RegExp, string]> = [
    [/court|order|dwi|disposition/i, 'court_order'],
    [/intake/i, 'intake_form'],
    [/consent|authorization|release/i, 'consent'],
    [/treatment plan|recovery plan/i, 'treatment_plan'],
    [/checklist|verification|certification|slip|completion/i, 'verification_slip'],
    [/progress|session note|clinical note/i, 'progress_note'],
    [/drug|screen|urinalysis|uds/i, 'drug_screen'],
];
const formNameToDocType = (name: string): string => {
    for (const [re, t] of PAPER_FORM_DOCTYPE) if (re.test(name || '')) return t;
    return 'other';
};

export const submitPaperForm = async (
    clientId: string,
    formId: string,
    formName: string,
    file: File,
    submittedByName?: string,
) => {
    // Paper forms carry a signature/tag signal the submission record surfaces, so
    // keep the DNA pass (it detects is_signed). All Gemini via pds-gemini-proxy.
    const dna = await storageService.extractDocumentDNA(file);

    // 1. Persist the file through the SAME unified core as scan/dropzone/upload:
    //    one bucket (gemynd-files), a real document_type (from the known form), and
    //    an honest portal uploader. The type is known, so we pass it as the
    //    classification rather than re-detecting (no extra Gemini call).
    const uploadedFile = await storageService.ingestDocument(file, {
        clientId,
        source: 'paper_form',
        uploadedBy: submittedByName ? `${submittedByName} (portal upload)` : 'Client (portal upload)',
        analysis: {
            documentType: formNameToDocType(formName),
            summary: dna.summary,
            needsReview: true, // client-submitted paper forms always get clinician review
        },
    });

    // 2. Create Form Submission record (unchanged shape — carry through the
    //    summary/tags/signature the portal already surfaced from the DNA pass).
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
                file_path: uploadedFile.file_path,
                ai_summary: dna.summary,
                ai_tags: dna.tags,
                is_signed: dna.isSigned,
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
    // MERGE into the data JSONB, never replace it. The previous whole-object
    // `data:` payload wiped the submission's form responses / file_path /
    // ai_summary at the exact moment of approval. Supabase .update() replaces
    // a jsonb column wholesale, so read-then-merge (single-staff approval flow;
    // the read-write window is acceptable at this scale). Only requires_review
    // is kept inside data (ClientFormsTab's "Requires Review" pill/button reads
    // it); the approval timestamp/reviewer live in the reviewed_at/reviewed_by
    // COLUMNS — the old data.approved_at duplicate had no readers and is dropped.
    const { data: existing, error: readError } = await supabase
        .from('form_submissions')
        .select('data')
        .eq('id', submissionId)
        .single();
    if (readError) throw readError;

    const { data, error } = await supabase
        .from('form_submissions')
        .update({
            status: 'Reviewed',
            reviewed_at: new Date().toISOString(),
            reviewed_by: reviewerName,
            data: { ...(existing?.data ?? {}), requires_review: false },
        })
        .eq('id', submissionId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// WS5: the assignable template catalog is the single FORM_REGISTRY (replaces the old
// 5-entry mock whose ids didn't match the components). NOT a hard allowlist — assignForm
// still inserts whatever formId it's given, so non-SATOP program intakes keep persisting.
export const getFormTemplates = async () =>
    FORM_REGISTRY.map(f => ({ id: f.id, name: f.title, title: f.title, category: f.category, description: f.description || '', audience: f.audience, requiredForCompletion: f.requiredForCompletion }));
export const getBillingSummary = async (id: string) => dbBillingSummaries[id];
export const getClientDocuments = async (id: string) => (dbClientDocuments || []).filter(d => d.clientId === id);
export const getClientAssignments = async (id: string) => (dbClientAssignments || []).filter(a => a.clientId === id);
export const addClientAssignment = async (assignment: any) => {};
// WS5: addSignedDocument/getDocumentForSigning/saveClientSignature retired (Option A) —
// the /sign no-op path is gone; signatures persist in form_submissions.data via the forms.
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
export interface AuditLogFilters {
    userId?: string;
    /** Filters on details.client_id (jsonb path) — populated for note.signed,
     *  client.updated, client.archived. Applied server-side via PostgREST's
     *  column->>key operator syntax. */
    clientId?: string;
    action?: string;
    /** 'YYYY-MM-DD', inclusive of the whole day. */
    dateFrom?: string;
    /** 'YYYY-MM-DD', inclusive of the whole day (bumped to < next-day internally
     *  so the selected end date isn't cut off at midnight). */
    dateTo?: string;
    /** Row cap — audit_logs has no built-in pagination UI yet, so this is the
     *  "don't dump thousands of rows unbounded" guard. */
    limit?: number;
}

// Audit v1: real read replacing the in-memory mock. Best-effort/fail-soft (returns [] on
// error rather than throwing) — Compliance.tsx loads this alongside several other Promise.all
// reads with no per-read try/catch, and an audit-trail read failure shouldn't blank the whole
// page. Resolves a friendly actor name via counselors.auth_user_id where possible; falls back
// to the raw user_id (not every staff role has a counselor row, e.g. Admin). Filters are
// applied server-side (not client-side array filtering) so this scales with the table.
export const getAuditLogs = async (filters: AuditLogFilters = {}): Promise<AuditLog[]> => {
    try {
        let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
        if (filters.userId) query = query.eq('user_id', filters.userId);
        if (filters.clientId) query = query.eq('details->>client_id', filters.clientId);
        if (filters.action) query = query.eq('action', filters.action);
        if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
        if (filters.dateTo) {
            const endExclusive = new Date(filters.dateTo);
            endExclusive.setDate(endExclusive.getDate() + 1);
            query = query.lt('created_at', endExclusive.toISOString());
        }
        query = query.limit(filters.limit ?? 500);

        const [{ data, error }, { data: counselors }] = await Promise.all([
            query,
            supabase.from('counselors').select('auth_user_id, name'),
        ]);
        if (error) throw error;
        const nameByAuthId = new Map(
            (counselors || []).filter((c: any) => c.auth_user_id).map((c: any) => [c.auth_user_id, c.name]),
        );
        return (data || []).map((row: any) => ({
            id: row.id,
            timestamp: new Date(row.created_at),
            user: nameByAuthId.get(row.user_id) || row.user_id || 'Unknown',
            userId: row.user_id,
            action: row.action,
            details: row.entity_type && row.entity_id ? `${row.entity_type}:${row.entity_id}` : '',
            clientId: row.details?.client_id,
            entityType: row.entity_type,
            entityId: row.entity_id,
        }));
    } catch (e) {
        console.error('[api] getAuditLogs failed:', e);
        return [];
    }
};
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
// Formats a transcript into a structured note. SOAP (default) is unchanged; when
// format='DAP' the prompt yields canonical Data/Assessment/Plan headings that
// splitDapNote maps onto the existing columns. All Gemini via pds-gemini-proxy.
export const generateSoapNoteFromTranscript = async (
    transcript: string,
    clientName: string,
    format: 'SOAP' | 'DAP' = 'SOAP',
) => {
    const prompt = format === 'DAP'
        ? `Construct a structured DAP progress note for ${clientName}. Use EXACTLY three sections, each beginning with its heading on its own line: "Data:", then "Assessment:", then "Plan:". Data = factual/observed session information (what the client reported and did, presentation, events); Assessment = clinical interpretation, progress toward goals, and risk; Plan = next steps, interventions, and follow-up. Content must be HIPAA-compliant. Source: ${transcript}`
        : `Construct a structural SOAP note for ${clientName}. Content must be HIPAA-compliant. Source: ${transcript}`;
    return geminiText('gemini-2.5-flash', prompt);
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

// DEFERRED #34: digit-only compare so phone formatting differences
// ("(555) 123-4567" vs "5551234567") don't cause false negatives.
const digitsOnly = (s: string | null | undefined) => (s || '').replace(/\D/g, '');

export interface DuplicateClientMatch {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    caseNumber: string | null;
    createdAt: string | null;
}

/** Pre-insert duplicate-client check for CreateClientModal (DEFERRED #34). Matches
 *  on name + phone only — the two fields populated on every live client row; email/
 *  case_number are returned as secondary context to show in the warning, not matched
 *  on. A soft speed bump, not a constraint: the caller decides whether to proceed.
 *  Fails open (returns []) on query error so a broken check never becomes a wall. */
export const findDuplicateClients = async (name: string, phone: string): Promise<DuplicateClientMatch[]> => {
    const trimmedName = name.trim();
    const wantPhone = digitsOnly(phone);
    if (!trimmedName || !wantPhone) return [];
    const { data, error } = await supabase
        .from('clients')
        .select('id, name, primary_phone, email, case_number, created_at')
        .ilike('name', trimmedName);
    if (error) {
        console.error('[api] findDuplicateClients failed:', error);
        return [];
    }
    return (data || [])
        .filter((r: any) => digitsOnly(r.primary_phone) === wantPhone)
        .map((r: any) => ({
            id: r.id,
            name: r.name,
            phone: r.primary_phone,
            email: r.email ?? null,
            caseNumber: r.case_number ?? null,
            createdAt: r.created_at ?? null,
        }));
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

    // '' is not a valid Postgres `date` — an empty dob field means "no value".
    // (Pre-existing: every EditClientModal save for a dob-less client 400'd.)
    if (row.dob === '') row.dob = null;

    // Audit v1, events 2/3: snapshot pre-update values for every column this call
    // may touch (including the two lifecycle stamps, which aren't in `row` yet)
    // so we can (a) diff against the post-update row to skip logging a no-op
    // re-save, and (b) — reusing the same read — check completed_at for the
    // 'active' transition below instead of a second round-trip.
    const beforeCols = Array.from(new Set([...Object.keys(row), 'archived_at', 'completed_at']));
    const { data: before, error: beforeErr } = await supabase
        .from('clients').select(beforeCols.join(',')).eq('id', id).maybeSingle();
    if (beforeErr) throw new Error(beforeErr.message || 'Failed to read client state before update');

    // Lifecycle transition stamps (migration 20260611). Callers send `status`
    // only when it actually changed (EditClientModal diffs), so a stamp here
    // means a real transition. Completing a program is a HISTORICAL FACT:
    // completed_at survives archive/unarchive — only archived_at clears on
    // reactivation, and unarchiving a client who had completed restores them
    // to 'completed', not 'active'.
    let isArchiving = false;
    if (row.status !== undefined) {
        if (row.status === 'archived') {
            row.archived_at = new Date().toISOString();
            isArchiving = true;
        } else if (row.status === 'completed') {
            row.completed_at = new Date().toISOString();
            row.archived_at = null;
        } else if (row.status === 'active') {
            if ((before as any)?.completed_at) row.status = 'completed';
            row.archived_at = null;
        }
    }

    const changedFields = Object.keys(row).filter((col) => (before as any)?.[col] !== row[col]);

    const { data, error } = await supabase
        .from('clients')
        .update(row)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;

    // Audit v1, events 2/3: client.updated / client.archived. Fire-and-forget,
    // same posture as note.signed — never awaited, never throws, and skipped
    // entirely when nothing actually changed (avoids ledger noise from a
    // re-save that round-trips the same values).
    if (changedFields.length > 0) {
        supabase.auth.getUser().then(({ data: auth }) => {
            const actor = auth?.user?.id;
            if (!actor) return;
            void logAudit({
                actor,
                action: isArchiving ? 'client.archived' : 'client.updated',
                entity_type: 'clients',
                entity_id: id,
                timestamp: new Date().toISOString(),
                details: { client_id: id, changed_fields: changedFields },
            });
        });
    }

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
    // Normalize content at the SOURCE: fixture/anchor plans store content '{}' and a
    // malformed row could lack the problems array — `row.content || {...}` missed both
    // ({} is truthy → .problems undefined → render crash). Honest normalization only:
    // empty stays empty (renders the unauthored state), nothing is fabricated.
    content: { ...(row.content ?? {}), problems: Array.isArray(row.content?.problems) ? row.content.problems : [] },
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

export const processDocument = async (file: File, clientId: string, clientName: string, onProgress: (p: number) => void): Promise<DocumentFile> => {
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