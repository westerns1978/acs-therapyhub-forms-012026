import React from 'react';
import { FileSignature } from 'lucide-react';

// Shared clinical-note card. Used by BOTH the client Overview tab's "Clinical
// Notes" list and the Sessions tab's drill-in drawer, so the two surfaces can
// never drift.
//
// L3 (2026-07-28): notes now carry a verbatim `narrative` plus David's
// structured fields (service_date, times, units, problems_addressed, staff
// name/credentials, signed_at/signed_by_name — migration
// 20260728_l3_note_structure). When `narrative` exists it renders UNTOUCHED
// (whitespace-pre-wrap) — this is the fix for "Start Session note loses
// formatting": the SOAP splitter destroyed headers/blank lines at write time,
// so rendering the split columns could never reproduce what was typed. Legacy
// rows (no narrative) fall back to the split columns, now as separate labeled
// blocks instead of the old run-on space-join of subjective+objective.
//
// COMPLIANCE HONESTY GUARDS — this renders on a compliance surface, do not soften:
//   * Signer name renders ONLY from the real signed_by_name column (L3). Legacy
//     rows without it show the role "Clinician" — never an invented name.
//   * "Signed" date renders ONLY from the real signed_at column; created_at is
//     always labeled "Recorded".
export interface ClinicalNote {
  id: string;
  note_type: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  is_signed: boolean | null;
  created_at: string | null;
  therapist_id: string | null;
  // L3 structured fields — optional so legacy select lists stay valid.
  narrative?: string | null;
  service_date?: string | null;
  time_started?: string | null;
  time_ended?: string | null;
  units?: number | null;
  problems_addressed?: string | null;
  staff_name?: string | null;
  staff_credentials?: string | null;
  signed_at?: string | null;
  signed_by_name?: string | null;
}

const hhmm = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : '');

const ClinicalNoteView: React.FC<{ note: ClinicalNote }> = ({ note }) => {
  const noteLabel = (note.note_type || 'Note').toUpperCase();
  // Format is encoded in note_type (a "(DAP)" marker — see saveClinicalNote). DAP
  // notes render Data/Assessment/Plan with NO Objective.
  const isDap = noteLabel.includes('DAP');
  // Honest attribution: real signer name when the column has one, else the role.
  const clinician = note.signed_by_name
    ? `${note.signed_by_name}${note.staff_credentials ? `, ${note.staff_credentials}` : ''}`
    : note.staff_name
      ? `${note.staff_name}${note.staff_credentials ? `, ${note.staff_credentials}` : ''}`
      : 'Clinician';

  const meta: string[] = [];
  if (note.service_date) meta.push(`Service ${new Date(note.service_date + 'T00:00:00').toLocaleDateString()}`);
  if (note.time_started && note.time_ended) meta.push(`${hhmm(note.time_started)}–${hhmm(note.time_ended)}`);
  if (typeof note.units === 'number') meta.push(`${note.units} ${note.units === 1 ? 'unit' : 'units'}`);

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <FileSignature className="w-4 h-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">{noteLabel} Note</span>
          {note.is_signed && (
            <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              Signed
            </span>
          )}
          {meta.length > 0 && (
            <span className="text-[11px] font-semibold text-slate-500">{meta.join(' · ')}</span>
          )}
        </div>
        <span className="text-xs text-slate-500">
          {note.created_at ? `Recorded ${new Date(note.created_at).toLocaleDateString()}` : ''}
        </span>
      </div>
      {note.problems_addressed && (
        <p className="mb-2 text-xs text-slate-500">
          <span className="font-bold text-slate-600 dark:text-slate-300">Tx Plan problems addressed: </span>
          {note.problems_addressed}
        </p>
      )}
      {note.narrative ? (
        // Verbatim narrative — exactly what was typed/dictated, structure intact.
        <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{note.narrative}</div>
      ) : (
        // Legacy rows: split columns as separate labeled blocks. No space-join —
        // the old `subjective + ' ' + objective` run-on was part of the
        // formatting-loss defect.
        <div className="space-y-2 text-sm">
          {note.subjective && (
            <div>
              <p className="font-bold text-slate-700 dark:text-slate-200">{isDap ? 'Data' : 'Subjective'}</p>
              <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{note.subjective}</p>
            </div>
          )}
          {!isDap && note.objective && (
            <div>
              <p className="font-bold text-slate-700 dark:text-slate-200">Objective</p>
              <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{note.objective}</p>
            </div>
          )}
          {note.assessment && (
            <div>
              <p className="font-bold text-slate-700 dark:text-slate-200">Assessment</p>
              <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{note.assessment}</p>
            </div>
          )}
          {note.plan && (
            <div>
              <p className="font-bold text-slate-700 dark:text-slate-200">Plan</p>
              <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{note.plan}</p>
            </div>
          )}
        </div>
      )}
      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 italic">
        {clinician}
        {note.signed_at ? ` — signed ${new Date(note.signed_at).toLocaleDateString()}` : ''}
      </div>
    </div>
  );
};

export default ClinicalNoteView;
