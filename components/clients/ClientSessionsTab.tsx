import React, { useEffect, useState } from 'react';
import type { Client, Appointment } from '../../types';
import { supabase } from '../../services/supabase';
import { getClientAppointments } from '../../services/api';
import Card from '../ui/Card';
import { Calendar, FileText, ShieldCheck } from 'lucide-react';

// Real session history for a client, composed from existing tables only:
//   - appointments (the client's scheduled/past sessions)
//   - clinical_notes (saved documentation; a note matched to an appointment marks
//     it "signed/on file")
// No mock data; an empty record set shows an honest empty state.

interface NoteRow {
  id: string;
  note_type: string | null;
  is_signed: boolean | null;
  created_at: string | null;
  appointment_id: string | null;
}

interface SessionItem {
  id: string;
  date: Date;
  kind: 'appointment' | 'note';
  title: string;
  subtitle: string;
  signed?: boolean;
  hasNote?: boolean;
}

const statusTone = (s: string): string => {
  const t = s.toLowerCase();
  if (t.includes('complete')) return 'text-emerald-600';
  if (t.includes('no show') || t.includes('cancel')) return 'text-red-600';
  if (t.includes('progress')) return 'text-amber-600';
  return 'text-slate-500';
};

const ClientSessionsTab: React.FC<{ client: Client }> = ({ client }) => {
  const [items, setItems] = useState<SessionItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [appts, notesRes] = await Promise.all([
          getClientAppointments(client.id),
          supabase
            .from('clinical_notes')
            .select('id, note_type, is_signed, created_at, appointment_id')
            .eq('client_id', client.id)
            .order('created_at', { ascending: false }),
        ]);
        if (cancelled) return;

        const notes = (notesRes.data as NoteRow[]) || [];
        const noteByAppt = new Map<string, NoteRow>();
        for (const n of notes) if (n.appointment_id) noteByAppt.set(n.appointment_id, n);

        const apptItems: SessionItem[] = (appts || []).map((a: Appointment) => {
          const note = noteByAppt.get(a.id);
          return {
            id: `appt-${a.id}`,
            date: a.date instanceof Date ? a.date : new Date(a.date as any),
            kind: 'appointment',
            title: a.type || a.title || 'Session',
            subtitle: `${a.modality || 'In-Person'} · ${a.status || 'Scheduled'}`,
            signed: !!note?.is_signed,
            hasNote: !!note,
          };
        });

        // Notes not tied to an appointment (e.g. Smart Note Studio) become their own rows.
        const noteItems: SessionItem[] = notes
          .filter(n => !n.appointment_id)
          .map(n => ({
            id: `note-${n.id}`,
            date: n.created_at ? new Date(n.created_at) : new Date(0),
            kind: 'note',
            title: `${n.note_type || 'Clinical'} note`,
            subtitle: n.is_signed ? 'Signed' : 'Unsigned',
            signed: !!n.is_signed,
            hasNote: true,
          }));

        const merged = [...apptItems, ...noteItems].sort((a, b) => b.date.getTime() - a.date.getTime());
        setItems(merged);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [client.id]);

  if (failed) {
    return <Card title="Session History"><p className="text-sm text-slate-500">Couldn’t load session history right now.</p></Card>;
  }
  if (items === null) {
    return <Card title="Session History"><p className="text-sm text-slate-400 uppercase tracking-widest font-bold text-xs">Loading…</p></Card>;
  }
  if (items.length === 0) {
    return (
      <Card title="Session History">
        <div className="text-center py-10 text-slate-400">
          <Calendar size={28} className="mx-auto mb-3 opacity-40" />
          <p className="text-xs font-bold uppercase tracking-widest">No sessions recorded yet</p>
          <p className="text-xs mt-1">Appointments and clinical notes for {client.name} will appear here.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Session History" subtitle={`${items.length} record${items.length === 1 ? '' : 's'} from appointments and clinical notes.`}>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {items.map(it => (
          <div key={it.id} className="flex items-center gap-4 py-3">
            <div className={`p-2 rounded-xl shrink-0 ${it.kind === 'appointment' ? 'bg-primary/10 text-primary' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600'}`}>
              {it.kind === 'appointment' ? <Calendar size={16} /> : <FileText size={16} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{it.title}</p>
              <p className={`text-xs ${it.kind === 'appointment' ? statusTone(it.subtitle) : 'text-slate-500'}`}>{it.subtitle}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold text-slate-500">{it.date.getTime() ? it.date.toLocaleDateString() : '—'}</p>
              {it.kind === 'appointment' && it.hasNote && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest mt-0.5 ${it.signed ? 'text-emerald-600' : 'text-amber-600'}`}>
                  <ShieldCheck size={10} /> {it.signed ? 'Signed note' : 'Note on file'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default ClientSessionsTab;
