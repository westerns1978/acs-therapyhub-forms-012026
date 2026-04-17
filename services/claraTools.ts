/**
 * ACS TherapyHub — Clara Tool Dispatcher
 *
 * Direct-to-Supabase tool implementations for Clara (staff mode only).
 * Read/write client records, session notes, and appointments without going
 * through the MCP orchestrator edge function.
 *
 * Security: all writes are gated by whitelist. Supabase RLS is the final
 * authority on who can read/write what.
 */

import { supabase } from './supabase';
import { logOutreach as logOutreachService, createTask as createTaskService } from './alertsService';

// Fields Clara is allowed to update on a client record. Anything else is rejected.
const ALLOWED_CLIENT_FIELDS = new Set([
  'phone',
  'email',
  'status',
  'nextDeadline',
  'next_deadline',
  'probationOfficer',
  'probation_officer',
  'licenseStatus',
  'license_status',
  'completionPercentage',
  'completion_percentage',
  'notes',
]);

const ALLOWED_APPOINTMENT_STATUSES = new Set([
  'Scheduled',
  'Completed',
  'Cancelled',
  'No Show',
  'Rescheduled',
]);

export type ClaraToolResult =
  | { ok: true; data: any }
  | { ok: false; error: string };

/** Live-session-compatible tool declarations for Gemini. */
export const CLARA_STAFF_TOOL_DECLARATIONS = [
  {
    name: 'navigate_to_page',
    description: 'Navigate the staff user to a specific portal page.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          description: 'Route path like /dashboard, /clients, /billing, /forms, /calendar',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_clients',
    description: 'Search clients by name or case number. Returns up to 10 matches.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Name fragment or case number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_client_details',
    description: 'Fetch full record for one client by id.',
    parameters: {
      type: 'OBJECT',
      properties: { client_id: { type: 'STRING' } },
      required: ['client_id'],
    },
  },
  {
    name: 'list_client_appointments',
    description: 'List upcoming and recent appointments for a client.',
    parameters: {
      type: 'OBJECT',
      properties: { client_id: { type: 'STRING' } },
      required: ['client_id'],
    },
  },
  {
    name: 'update_client_field',
    description:
      'Update a single whitelisted field on a client record. Allowed fields: phone, email, status, nextDeadline, probationOfficer, licenseStatus, completionPercentage, notes.',
    parameters: {
      type: 'OBJECT',
      properties: {
        client_id: { type: 'STRING' },
        field: { type: 'STRING' },
        value: { type: 'STRING' },
      },
      required: ['client_id', 'field', 'value'],
    },
  },
  {
    name: 'update_appointment_status',
    description:
      'Change an appointment status. Allowed: Scheduled, Completed, Cancelled, No Show, Rescheduled.',
    parameters: {
      type: 'OBJECT',
      properties: {
        appointment_id: { type: 'STRING' },
        status: { type: 'STRING' },
      },
      required: ['appointment_id', 'status'],
    },
  },
  {
    name: 'log_outreach',
    description:
      'Log an outreach attempt to a client (call, SMS, email, letter, or in-person). Use when the staff user reports they contacted a client, or when Clara completes outreach on their behalf.',
    parameters: {
      type: 'OBJECT',
      properties: {
        client_id: { type: 'STRING' },
        method: {
          type: 'STRING',
          description: 'One of: Phone, SMS, Email, Letter, In-Person',
        },
        notes: { type: 'STRING', description: 'What was said/sent or the outcome of the attempt' },
      },
      required: ['client_id', 'method', 'notes'],
    },
  },
  {
    name: 'create_task',
    description:
      'Create a follow-up task tied to a client. Use for scheduling reminders, court report drafting, document collection, probation notifications, etc.',
    parameters: {
      type: 'OBJECT',
      properties: {
        client_id: { type: 'STRING' },
        description: { type: 'STRING', description: 'What needs to be done' },
        due_date: { type: 'STRING', description: 'Optional ISO date (YYYY-MM-DD)' },
        priority: {
          type: 'STRING',
          description: 'One of: low, normal, high, urgent. Defaults to normal.',
        },
      },
      required: ['client_id', 'description'],
    },
  },
  {
    name: 'create_session_note',
    description: 'Create a clinical/session note attached to a client.',
    parameters: {
      type: 'OBJECT',
      properties: {
        client_id: { type: 'STRING' },
        content: { type: 'STRING' },
        note_type: {
          type: 'STRING',
          description: 'Optional. e.g. "Session", "Phone Call", "Intake"',
        },
      },
      required: ['client_id', 'content'],
    },
  },
];

/** Dispatch a tool call by name. Returns a plain object safe to JSON-stringify back to Clara. */
export async function executeClaraTool(
  name: string,
  args: Record<string, any>
): Promise<ClaraToolResult> {
  try {
    switch (name) {
      case 'search_clients':
        return await searchClients(args.query);
      case 'get_client_details':
        return await getClientDetails(args.client_id);
      case 'list_client_appointments':
        return await listClientAppointments(args.client_id);
      case 'update_client_field':
        return await updateClientField(args.client_id, args.field, args.value);
      case 'update_appointment_status':
        return await updateAppointmentStatus(args.appointment_id, args.status);
      case 'create_session_note':
        return await createSessionNote(args.client_id, args.content, args.note_type);
      case 'log_outreach':
        return await logOutreachTool(args.client_id, args.method, args.notes);
      case 'create_task':
        return await createTaskTool(args.client_id, args.description, args.due_date, args.priority);
      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (e: any) {
    console.error(`[claraTools] ${name} failed:`, e);
    return { ok: false, error: e?.message || String(e) };
  }
}

async function searchClients(query: string): Promise<ClaraToolResult> {
  if (!query || query.trim().length < 2) {
    return { ok: false, error: 'query must be at least 2 characters' };
  }
  const q = query.trim();
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, program, status, caseNumber, nextDeadline, completionPercentage')
    .or(`name.ilike.%${q}%,caseNumber.ilike.%${q}%`)
    .limit(10);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data || [] };
}

async function getClientDetails(clientId: string): Promise<ClaraToolResult> {
  if (!clientId) return { ok: false, error: 'client_id required' };
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

async function listClientAppointments(clientId: string): Promise<ClaraToolResult> {
  if (!clientId) return { ok: false, error: 'client_id required' };
  const { data, error } = await supabase
    .from('appointments')
    .select('id, title, date, startTime, endTime, status, therapist, modality')
    .eq('clientId', clientId)
    .order('date', { ascending: false })
    .limit(20);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data || [] };
}

async function updateClientField(
  clientId: string,
  field: string,
  value: string
): Promise<ClaraToolResult> {
  if (!clientId || !field) {
    return { ok: false, error: 'client_id and field required' };
  }
  if (!ALLOWED_CLIENT_FIELDS.has(field)) {
    return {
      ok: false,
      error: `Field "${field}" is not editable. Allowed: ${Array.from(ALLOWED_CLIENT_FIELDS).join(', ')}`,
    };
  }
  const { data, error } = await supabase
    .from('clients')
    .update({ [field]: value })
    .eq('id', clientId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

async function updateAppointmentStatus(
  appointmentId: string,
  status: string
): Promise<ClaraToolResult> {
  if (!appointmentId || !status) {
    return { ok: false, error: 'appointment_id and status required' };
  }
  if (!ALLOWED_APPOINTMENT_STATUSES.has(status)) {
    return {
      ok: false,
      error: `Invalid status. Allowed: ${Array.from(ALLOWED_APPOINTMENT_STATUSES).join(', ')}`,
    };
  }
  const { data, error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', appointmentId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

async function createSessionNote(
  clientId: string,
  content: string,
  noteType?: string
): Promise<ClaraToolResult> {
  if (!clientId || !content) {
    return { ok: false, error: 'client_id and content required' };
  }
  const { data, error } = await supabase
    .from('clinical_notes')
    .insert({
      client_id: clientId,
      content,
      note_type: noteType || 'Session',
      created_at: new Date().toISOString(),
      source: 'clara',
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

const VALID_OUTREACH_METHODS = new Set(['Phone', 'SMS', 'Email', 'Letter', 'In-Person']);
const VALID_TASK_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);

async function logOutreachTool(
  clientId: string,
  method: string,
  notes: string
): Promise<ClaraToolResult> {
  if (!clientId || !method || !notes) {
    return { ok: false, error: 'client_id, method, and notes required' };
  }
  if (!VALID_OUTREACH_METHODS.has(method)) {
    return {
      ok: false,
      error: `Invalid method. Allowed: ${Array.from(VALID_OUTREACH_METHODS).join(', ')}`,
    };
  }
  const result = await logOutreachService(clientId, method as any, notes);
  if (!result.ok) return { ok: false, error: result.error || 'outreach log failed' };
  return { ok: true, data: { logged: true, method } };
}

async function createTaskTool(
  clientId: string,
  description: string,
  dueDate?: string,
  priority?: string
): Promise<ClaraToolResult> {
  if (!clientId || !description) {
    return { ok: false, error: 'client_id and description required' };
  }
  const p = (priority || 'normal').toLowerCase();
  if (!VALID_TASK_PRIORITIES.has(p)) {
    return {
      ok: false,
      error: `Invalid priority. Allowed: ${Array.from(VALID_TASK_PRIORITIES).join(', ')}`,
    };
  }
  const result = await createTaskService(clientId, description, dueDate, p as any);
  if (!result.ok) return { ok: false, error: result.error || 'task creation failed' };
  return { ok: true, data: { id: result.id, priority: p, due_date: dueDate || null } };
}
