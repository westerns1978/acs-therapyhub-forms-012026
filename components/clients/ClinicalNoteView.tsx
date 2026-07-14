import React from 'react';
import { FileSignature } from 'lucide-react';

// Shared clinical-note card (SOAP / DAP body). Used by BOTH the client Overview
// tab's "Clinical Notes" list and the Sessions tab's drill-in drawer, so the two
// surfaces can never drift.
//
// COMPLIANCE HONESTY GUARDS — this renders on a compliance surface, do not soften:
//   * NO signer NAME. clinical_notes has no signer-name column, and the old
//     THERAPIST_NAMES map was a 2-entry demo mock. We render the role "Clinician"
//     (or the raw therapist_id) — never an invented name.
//   * The timestamp is "Recorded" (created_at). There is NO signed_at column, so
//     it must never read as "Signed at".
//   * `is_signed` is the only signature signal we have; it drives the badge, nothing
//     more.
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
}

const ClinicalNoteView: React.FC<{ note: ClinicalNote }> = ({ note }) => {
  const noteLabel = (note.note_type || 'Note').toUpperCase();
  // Format is encoded in note_type (a "(DAP)" marker — see saveClinicalNote). DAP
  // notes render Data/Assessment/Plan with NO Objective; SOAP notes show
  // subjective + objective together under "Data:".
  const isDap = noteLabel.includes('DAP');
  // Honest attribution: clinical_notes has no signer-NAME column — only an opaque
  // therapist_id (or nothing). Render the generic role, never a fabricated signer
  // and never a meaningless UUID on a compliance surface.
  const clinician = 'Clinician';
  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileSignature className="w-4 h-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">{noteLabel} Note</span>
          {note.is_signed && (
            <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              Signed
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500">
          {note.created_at ? `Recorded ${new Date(note.created_at).toLocaleDateString()}` : ''}
        </span>
      </div>
      <div className="space-y-2 text-sm">
        {note.subjective && (
          <div>
            <span className="font-bold text-slate-700 dark:text-slate-200">Data: </span>
            <span className="text-slate-600 dark:text-slate-300">{note.subjective}{!isDap && note.objective ? ` ${note.objective}` : ''}</span>
          </div>
        )}
        {note.assessment && (
          <div>
            <span className="font-bold text-slate-700 dark:text-slate-200">Assessment: </span>
            <span className="text-slate-600 dark:text-slate-300">{note.assessment}</span>
          </div>
        )}
        {note.plan && (
          <div>
            <span className="font-bold text-slate-700 dark:text-slate-200">Plan: </span>
            <span className="text-slate-600 dark:text-slate-300">{note.plan}</span>
          </div>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 italic">
        {clinician}
      </div>
    </div>
  );
};

export default ClinicalNoteView;
