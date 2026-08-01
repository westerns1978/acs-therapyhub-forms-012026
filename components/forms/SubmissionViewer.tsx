/**
 * SubmissionViewer — THE shared embedded renderer for a committed form
 * submission (2026-07-28). Every staff surface that shows a submission's answers
 * renders through this; do not roll a new one per page (that is how the
 * client-record modal ended up hardcoding RecoveryPlan keys for every form).
 *
 * Definition-driven when the form is known: real field labels from the form's
 * own FieldDefinitions, values through the SAME resolver the live renderer and
 * the committed-record print use (config/fieldPath — literal-key-first is
 * load-bearing for legacy flat-dotted rows), conditional fields through
 * shouldPrintField. Falls back to key-based rendering for unknown forms —
 * never to a mock catalog.
 *
 * A genuinely unanswered field says "Not answered" in muted ink. A bare label
 * with nothing under it reads as a heading, which is exactly the bug this
 * component replaces.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import type { FieldDefinition, FormDefinition } from '../../types';
import { resolveFieldValue } from '../../config/fieldPath';
import { shouldPrintField } from '../../config/fieldVisibility';
import { definitionForSubmission } from '../../config/formDefinitions';
import { PrintPreview } from '../PrintPreview';
import { logAudit, currentActorId } from '../../services/auditLog';

// Bookkeeping keys that are metadata, not answers — never rendered as fields.
const INTERNAL_KEYS = new Set(['formId', 'is_paper_upload', 'requires_review', 'reviewed_at', 'reviewed_by']);

const toTitleCase = (key: string) =>
  key.replace(/([A-Z])/g, ' $1').replace(/[_.]/g, ' ').replace(/\s+/g, ' ').trim()
     .replace(/^./, c => c.toUpperCase());

/** Human string for an answered value; null when genuinely unanswered.
 *  Options-aware for select/checkbox-group so records show human labels
 *  ("Group Counseling"), not machine tokens. Mirrors PrintPreview's display
 *  rules; PrintPreview itself is left untouched because its output is
 *  witnessed byte-identical against a live committed row. */
const formatValue = (value: any, field?: FieldDefinition): string | null => {
  if (value == null || value === '') return null;
  if (field?.type === 'select' && field.options) {
    return field.options.find(o => o.value === value)?.label ?? String(value);
  }
  if ((field?.type === 'checkbox-group' || typeof value === 'object') && value && typeof value === 'object' && !Array.isArray(value)) {
    const picked = Object.keys(value).filter(k => (value as any)[k]);
    if (picked.length === 0) return null;
    return picked.map(k => field?.options?.find(o => o.value === k)?.label ?? toTitleCase(k)).join(', ');
  }
  if (Array.isArray(value)) {
    return value.length ? value.map(v => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ') : null;
  }
  if (field?.type === 'rating' && typeof value === 'number') return `${value}/5`;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

const isSignatureImage = (key: string, value: any) =>
  /signaturedataurl/i.test(key) && typeof value === 'string' && value.startsWith('data:image');

const AnswerRow: React.FC<{ label: string; value: any; field?: FieldDefinition }> = ({ label, value, field }) => {
  if (isSignatureImage(field?.id ?? label, value)) {
    return (
      <div className="py-2.5 border-b border-hairline dark:border-slate-700/60 last:border-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">{label}</p>
        <img src={value} alt="Signature" className="h-16 mt-1.5 border border-hairline rounded-lg bg-white p-1" />
      </div>
    );
  }
  const display = formatValue(value, field);
  return (
    <div className="py-2.5 border-b border-hairline dark:border-slate-700/60 last:border-0">
      <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">{label}</p>
      {display === null ? (
        <p className="text-sm italic text-neutral-400 dark:text-neutral-500 mt-0.5">Not answered</p>
      ) : (
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-0.5 whitespace-pre-wrap">{display}</p>
      )}
    </div>
  );
};

export interface SubmissionViewerProps {
  formId?: string | null;
  formName?: string | null;
  data: any;
}

export const SubmissionViewer: React.FC<SubmissionViewerProps> = ({ formId, formName, data }) => {
  const definition = definitionForSubmission(formId, formName);
  const payload = data && typeof data === 'object' ? data : {};

  if (definition) {
    return (
      <div>
        {definition.fieldDefinitions.map(field => {
          if (!shouldPrintField(field, payload)) return null;
          return <AnswerRow key={field.id} label={field.label} field={field} value={resolveFieldValue(payload, field.id)} />;
        })}
      </div>
    );
  }

  // Unknown form: render every stored answer with a readable key. Honest, not
  // pretty — and never a mock-catalog lookup.
  const entries = Object.entries(payload).filter(([k]) => !INTERNAL_KEYS.has(k));
  if (entries.length === 0) {
    return <p className="text-sm italic text-neutral-400 dark:text-neutral-500 py-4">No answers were recorded on this submission.</p>;
  }
  return (
    <div>
      {entries.map(([key, value]) => (
        <AnswerRow key={key} label={toTitleCase(key)} value={value} />
      ))}
    </div>
  );
};

// ── Print / Save-as-PDF ───────────────────────────────────────────────────────
// Renders the committed-record layout (PrintPreview) into a body-level portal
// that is invisible on screen and becomes the ONLY printed content while
// `print-record-only` is on <body> (rules in /index.css). window.print() is the
// download path too — every browser's print dialog offers Save as PDF, and it
// reuses the exact committed-record renderer instead of a second PDF layout
// that could drift from what the client signed.

/** Synthetic definition for unknown forms so the print layout still works. */
const syntheticDefinition = (formName: string | null | undefined, data: any): FormDefinition<any> => ({
  id: 'unknown-form',
  title: formName || 'Form submission',
  description: '',
  category: 'Clinical',
  initialState: {},
  validateStep: () => ({}),
  fieldDefinitions: Object.keys(data && typeof data === 'object' ? data : {})
    .filter(k => !INTERNAL_KEYS.has(k))
    .map(k => ({ id: k, label: toTitleCase(k), type: 'text' as const })),
});

export const RecordPrintRoot: React.FC<SubmissionViewerProps & { committedAt?: string | null }> = ({ formId, formName, data, committedAt }) => {
  const definition = definitionForSubmission(formId, formName) ?? syntheticDefinition(formName, data);
  return createPortal(
    <div id="record-print-root" aria-hidden="true">
      <PrintPreview formData={data ?? {}} formDefinition={definition} committedAt={committedAt ?? undefined} />
    </div>,
    document.body,
  );
};

/**
 * What a print event records. METADATA ONLY — never answer content: audit_logs is
 * staff-wide SELECT, and a 42 CFR Part 2 record's answers must not be duplicated
 * into a second, more widely readable table. Ids and dates are enough to answer
 * "who printed which record, when, bearing what date".
 */
export interface PrintAuditContext {
  /** form_submissions.id — becomes entity_id. No id, no audit row (nothing to attribute). */
  submissionId?: string | null;
  /** REQUIRED to be useful. audit_logs has no client_id column, so details.client_id is
   *  the ONLY way this event is per-client reportable — which is the whole point. */
  clientId?: string | null;
  formId?: string | null;
  formName?: string | null;
  /** The date the printed document actually bore, so a disputed printout can be
   *  reconciled against what was on the paper (see §10a). */
  committedAt?: string | null;
}

/**
 * Print / Save-as-PDF for a COMMITTED record, and the one chokepoint where that is
 * audited (`form.printed`).
 *
 * FIRE-AND-FORGET, deliberately `logAudit` and never `logAuditOrThrow`: a clinician
 * standing at a printer does not care about our logging, and an audit outage must
 * never withhold a record from them. Every failure path is swallowed inside logAudit
 * and console.error'd.
 *
 * FIRED BEFORE window.print() AND NOT AWAITED. window.print() blocks the main thread,
 * so the write completes after the dialog closes — that is fine, and the ordering is
 * intentional: a print cancelled at the dialog still logs. This OVER-counts relative to
 * paper actually produced, which is the correct direction of error. An under-counting
 * log asserts a record was not rendered when it may have been; in a Part 2 accounting
 * context that is worse than no log at all. The document was on screen either way.
 *
 * NOT COVERED, and no client-side instrumentation can cover them — see
 * docs/design/forms-revision-080126.md §10b:
 *   - browser-native Ctrl+P (never reaches this function),
 *   - the in-session pre-commit print in BaseFormTemplate (a draft; no submission
 *     id exists yet, so there is nothing to attribute).
 */
export const printRecord = (ctx?: PrintAuditContext) => {
  if (ctx?.submissionId) {
    // Resolve the actor, then write. Not awaited — see the ordering note above.
    void currentActorId().then(actor => {
      if (!actor) return;
      void logAudit({
        actor,
        action: 'form.printed',
        entity_type: 'form_submissions',
        entity_id: ctx.submissionId as string,
        timestamp: new Date().toISOString(),
        details: {
          client_id: ctx.clientId ?? null,
          form_id: ctx.formId ?? null,
          form_name: ctx.formName ?? null,
          committed_at: ctx.committedAt ?? null,
          // Explicit rather than implied by the chokepoint: if a fresh-commit print
          // path is ever instrumented, this field already discriminates the two.
          reprint: true,
        },
      });
    });
  }
  document.body.classList.add('print-record-only');
  try {
    window.print();
  } finally {
    document.body.classList.remove('print-record-only');
  }
};
