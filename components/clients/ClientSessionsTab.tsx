import React, { useEffect, useState } from 'react';
import type { Client, Appointment } from '../../types';
import { supabase } from '../../services/supabase';
import { getClientAppointments } from '../../services/api';
import { sessionTypeById } from '../../config/sessionTaxonomy';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
import ClinicalNoteView, { type ClinicalNote } from './ClinicalNoteView';
import { Calendar, FileText, ShieldCheck, Users } from 'lucide-react';

// Real session history for a client, composed from existing tables only:
//   - appointments (the client's scheduled/past sessions)
//   - clinical_notes (saved documentation; a note matched to an appointment marks
//     it "signed/on file")
// No mock data; an empty record set shows an honest empty state.

// NoteRow is a superset of ClinicalNote (adds appointment_id) so it can be handed
// straight to <ClinicalNoteView>. It carries the full SOAP body now so the drill-in
// drawer can render the note without a second fetch.
interface NoteRow extends ClinicalNote {
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
  // Real source objects retained for the drill-in drawer (never discarded).
  appt?: Appointment;
  note?: NoteRow;
}

const statusTone = (s: string): string => {
  const t = s.toLowerCase();
  if (t.includes('complete')) return 'text-emerald-600';
  if (t.includes('no show') || t.includes('cancel')) return 'text-red-600';
  if (t.includes('progress')) return 'text-amber-600';
  return 'text-slate-500';
};

// startTime/endTime are stored 24-hour "HH:MM" strings (see mapAppointmentRowToApp).
const parseHHMM = (s: string | undefined): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s || '').trim());
  if (!m) return null;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return Number.isFinite(mins) ? mins : null;
};

const derivedDuration = (a: Appointment): string | null => {
  const start = parseHHMM(a.startTime);
  const end = parseHHMM(a.endTime);
  if (start === null || end === null) return null;
  const d = end - start;
  return d > 0 ? `${d} min` : null;
};

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</dt>
    <dd className="text-sm text-slate-700 dark:text-slate-200 mt-0.5">{children}</dd>
  </div>
);

// Appointment drill-in. Every field shown is real appointment data; the only
// signature signal lives on the linked note (rendered via ClinicalNoteView) — the
// appointment itself carries no signer/signature.
const AppointmentDetail: React.FC<{ item: SessionItem }> = ({ item }) => {
  const a = item.appt!;
  const dur = derivedDuration(a);
  const sessionLabel = sessionTypeById(a.sessionTypeId)?.label;
  const isGroup = !!a.groupId || item.note?.note_type === 'Group Session';
  const serviceParts = [a.serviceType, sessionLabel].filter(Boolean) as string[];
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{a.type || a.title || 'Session'}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {a.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {isGroup && (
          <span className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            <Users size={11} /> Group session
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <DetailRow label="Time">
          {a.startTime && a.endTime ? `${a.startTime}–${a.endTime}` : '—'}{dur ? ` · ${dur}` : ''}
        </DetailRow>
        <DetailRow label="Modality">{a.modality || '—'}</DetailRow>
        <DetailRow label="Status"><span className={statusTone(a.status || '')}>{a.status || '—'}</span></DetailRow>
        <DetailRow label="Therapist">{a.therapist || '—'}</DetailRow>
        {serviceParts.length > 0 && (
          <DetailRow label="Service / session">{serviceParts.join(' · ')}</DetailRow>
        )}
        {a.zoomLink && (
          <DetailRow label="Zoom">
            <a href={a.zoomLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">Join link</a>
          </DetailRow>
        )}
      </dl>

      {item.hasNote && item.note && (
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Session note</p>
          <ClinicalNoteView note={item.note} />
        </div>
      )}
    </div>
  );
};

const ClientSessionsTab: React.FC<{ client: Client }> = ({ client }) => {
  const [items, setItems] = useState<SessionItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<SessionItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [appts, notesRes] = await Promise.all([
          getClientAppointments(client.id),
          supabase
            .from('clinical_notes')
            .select('id, note_type, subjective, objective, assessment, plan, is_signed, created_at, appointment_id, therapist_id')
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
            appt: a,
            note,
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
            note: n,
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
    <>
      <Card title="Session History" subtitle={`${items.length} record${items.length === 1 ? '' : 's'} from appointments and clinical notes.`}>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map(it => (
            <div
              key={it.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(it)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(it); } }}
              className="flex items-center gap-4 py-3 -mx-2 px-2 rounded-lg cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
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

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.kind === 'appointment' ? 'Session detail' : 'Clinical note'}
      >
        <div className="p-5">
          {selected?.kind === 'appointment' && selected.appt ? (
            <AppointmentDetail item={selected} />
          ) : selected?.note ? (
            <ClinicalNoteView note={selected.note} />
          ) : null}
        </div>
      </Modal>
    </>
  );
};

export default ClientSessionsTab;
