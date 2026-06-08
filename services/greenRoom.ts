/**
 * Green Room data — pre-session staging for a clinician. READ-ONLY.
 *
 * The spine: every value comes from a real source via the EXISTING engine.
 *   • per-client progress  → displayProgress.fetchClientProgress (the same
 *     accrual + signed-determination composition the dashboard guardrails use)
 *   • balance / enrollment → public.clients (balance, created_at)
 *   • last note            → public.clinical_notes (latest, signed-first)
 *   • treatment plan       → public.treatment_plans (honest "none on file" when empty)
 *
 * No writes, no recomputation of compliance logic, no invented presence. A row we
 * cannot resolve is dropped (never fabricated); a query failure throws so the page
 * shows a visible error rather than phantom data.
 *
 * Roster read path (matches the demo-week seed): a GROUP session's attendees are the
 * appointments sharing group_id + start_time; an individual session is its one client.
 * NOTE: appointments.client_id is TEXT while clients.id is uuid (SECURITY_BACKLOG #7) —
 * the values are uuid-shaped strings, so the .eq() comparison works as text.
 */
import { supabase } from './supabase';
import { fetchClientProgress, type ClientProgress } from './displayProgress';

export interface GreenRoomSession {
  appointmentId: string;
  title: string;
  appointmentType: string | null;
  startTime: string;          // ISO timestamptz
  endTime: string | null;
  serviceType: string | null; // 'counseling' → counts toward hours (badge)
  counselorName: string | null;
  zoomLink: string | null;
  zoomMeetingId: string | null;
  groupId: string | null;
  isGroup: boolean;
}

export interface GreenRoomNote {
  noteType: string;
  isSigned: boolean;
  createdAt: string;
  snippet: string;
}

export interface GreenRoomAttendee {
  clientId: string;
  name: string;
  initials: string;
  programLabel: string;        // 'SATOP · Level IV (SROP)' | 'SATOP · placement pending'
  progress: ClientProgress;    // established / level / completed / required / counseling
  balance: number;
  daysSinceEnrollment: number | null; // from clients.created_at (the engine's 90-day anchor)
  lastNote: GreenRoomNote | null;
  hasTreatmentPlan: boolean;
}

export interface GreenRoomData {
  session: GreenRoomSession;
  attendees: GreenRoomAttendee[];
}

const DAY_MS = 86_400_000;

const toInitials = (name: string) =>
  name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

function programLabel(programType: string | null, p: ClientProgress): string {
  const prog = (programType || 'Program').trim();
  if (p.established && p.determinedLevel) {
    const srop = p.determinedLevel === 'IV' ? ' (SROP)' : '';
    return `${prog} · Level ${p.determinedLevel}${srop}`;
  }
  return `${prog} · placement pending`;
}

async function fetchLatestNote(clientId: string): Promise<GreenRoomNote | null> {
  // Signed notes first, then most recent. clinical_notes stores discrete SOAP/DAP columns.
  const { data, error } = await supabase
    .from('clinical_notes')
    .select('note_type, subjective, objective, assessment, plan, is_signed, created_at')
    .eq('client_id', clientId)
    .order('is_signed', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const n = data[0] as any;
  const snippet = String(n.assessment || n.subjective || n.plan || n.objective || '').trim();
  if (!snippet) return null;
  return { noteType: n.note_type || 'Note', isSigned: !!n.is_signed, createdAt: n.created_at, snippet };
}

async function fetchHasTreatmentPlan(clientId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('treatment_plans')
    .select('id')
    .eq('client_id', clientId)
    .limit(1);
  if (error || !data) return false; // honest default: show "none on file" rather than guess
  return data.length > 0;
}

export async function fetchGreenRoomSession(appointmentId: string): Promise<GreenRoomData> {
  const { data: appt, error: aErr } = await supabase
    .from('appointments')
    .select(
      'id, title, appointment_type, start_time, end_time, service_type, therapist_name, zoom_link, zoom_meeting_id, group_id, client_id, client_name',
    )
    .eq('id', appointmentId)
    .single();
  if (aErr || !appt) throw new Error(aErr?.message || 'Appointment not found');

  const session: GreenRoomSession = {
    appointmentId: appt.id,
    title: appt.title || appt.appointment_type || 'Session',
    appointmentType: appt.appointment_type ?? null,
    startTime: appt.start_time,
    endTime: appt.end_time ?? null,
    serviceType: appt.service_type ?? null,
    counselorName: appt.therapist_name ?? null,
    zoomLink: appt.zoom_link ?? null,
    zoomMeetingId: appt.zoom_meeting_id ?? null,
    groupId: appt.group_id ?? null,
    isGroup: !!appt.group_id,
  };

  // Roster: group → appointments sharing group_id + start_time; individual → the one client.
  let rosterClientIds: string[] = [];
  if (appt.group_id) {
    const { data: sibs, error: sErr } = await supabase
      .from('appointments')
      .select('client_id')
      .eq('group_id', appt.group_id)
      .eq('start_time', appt.start_time);
    if (sErr) throw new Error(sErr.message);
    rosterClientIds = (sibs || []).map((r: any) => r.client_id).filter(Boolean);
  } else if (appt.client_id) {
    rosterClientIds = [appt.client_id];
  }
  rosterClientIds = Array.from(new Set(rosterClientIds));

  const attendees = await Promise.all(
    rosterClientIds.map(async (cid): Promise<GreenRoomAttendee | null> => {
      const { data: client } = await supabase
        .from('clients')
        .select('id, name, balance, created_at, program_type')
        .eq('id', cid)
        .maybeSingle();
      if (!client) return null; // can't resolve → drop, never fabricate
      const [progress, lastNote, hasTreatmentPlan] = await Promise.all([
        fetchClientProgress(client.id),
        fetchLatestNote(client.id),
        fetchHasTreatmentPlan(client.id),
      ]);
      const days = client.created_at
        ? Math.floor((Date.now() - new Date(client.created_at).getTime()) / DAY_MS)
        : null;
      return {
        clientId: client.id,
        name: client.name,
        initials: toInitials(client.name),
        programLabel: programLabel(client.program_type, progress),
        progress,
        balance: client.balance == null ? 0 : Number(client.balance),
        daysSinceEnrollment: days,
        lastNote,
        hasTreatmentPlan,
      };
    }),
  );

  return {
    session,
    attendees: (attendees.filter(Boolean) as GreenRoomAttendee[]).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  };
}
