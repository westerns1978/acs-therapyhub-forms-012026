import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Download, ShieldCheck, AlertTriangle, Award, FileText, Receipt, FileCheck } from 'lucide-react';
import type { jsPDF } from 'jspdf';
import { buildCompletionCertificateDoc, buildStatusReportDoc } from '../../services/pdfDocuments';
import type { CompletionAssessment, RuleVerdict } from '../../services/complianceEngine';
import type { ClientProgress } from '../../services/displayProgress';

// Cert/status callers keep this exact type — the receipt mode is a separate union
// member below, so existing callers (ClientWorkspace) are unaffected.
export type PreviewKind = 'certificate' | 'status';

interface CommonProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CertStatusProps extends CommonProps {
  kind: PreviewKind;
  client: any;
  verdicts: RuleVerdict[];
  completion: CompletionAssessment;
  /** WS-DisplayTruth: the gate-sourced hours (composeProgress) for the status report's
   *  "Clinical hours" line — the static columns it used to read were dropped (#10a). */
  progress?: ClientProgress | null;
}

interface GenericDocProps extends CommonProps {
  // Generic build()-closure mode — reused by the payment receipt ('receipt') and the
  // CIMOR placement packet ('cimor'). Same same-instance preview→save plumbing.
  kind: 'receipt' | 'cimor';
  /**
   * Builds the EXACT jsPDF shown in the preview AND saved on "Create PDF" — one
   * instance, one blob, zero drift. Throws on bad input (surfaced as an error).
   */
  build: () => jsPDF;
  /** Download filename (no path). */
  fileName: string;
  /** Header title. */
  title: string;
  /** Rebuild identity — re-renders the doc when the subject changes (e.g. payment id). */
  rebuildKey?: string;
}

type DocumentPreviewModalProps = CertStatusProps | GenericDocProps;

// A user-defined type guard narrows BOTH branches reliably (true → GenericDocProps,
// false → CertStatusProps). TS does not reliably narrow the negative branch of a
// compound `kind === 'a' || kind === 'b'` over this 4-member discriminant, so we use
// this guard everywhere we split generic (receipt/cimor) vs cert/status.
const isGenericProps = (p: DocumentPreviewModalProps): p is GenericDocProps =>
  p.kind === 'receipt' || p.kind === 'cimor';

const safeFileName = (name: string) =>
  (name || 'client').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'client';

/**
 * WS6 preview-then-PDF viewer. One renderer, no drift: the in-app preview is the
 * ACTUAL jsPDF document (shown as a blob in an <iframe>), and "Create PDF" saves
 * that exact same document. For the certificate it surfaces the completion gates
 * (hours · payment · sign-off, + duration for SROP) and only unlocks export when
 * every gate passes — the same engine verdict that guards the renderer itself.
 *
 * The same plumbing also powers the payment receipt via the `receipt` mode, which
 * hands in a pre-bound `build()` closure instead of cert/status inputs — reused,
 * not forked, so the zero-drift guarantee holds identically.
 */
const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = (props) => {
  const { isOpen, onClose } = props;
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const docRef = useRef<jsPDF | null>(null);

  const isCert = props.kind === 'certificate';
  const isReceipt = props.kind === 'receipt';
  // The certificate can only be rendered once the gate is open — the builder
  // throws otherwise, by design. Status and generic (receipt/cimor) render anytime.
  const eligible = isGenericProps(props) ? true : props.completion.eligible;
  const canRender = isCert ? eligible : true;
  // Rebuild identity: build-closure key for generic docs, client id (+ gate) for cert/status.
  const rebuildKey = isGenericProps(props) ? (props.rebuildKey ?? '') : props.client?.id;

  useEffect(() => {
    if (!isOpen) return;
    setBuildError(null);
    docRef.current = null;
    let url: string | null = null;
    try {
      if (canRender) {
        const doc = isGenericProps(props)
          ? props.build()
          : props.kind === 'certificate'
            ? buildCompletionCertificateDoc(props.client, props.completion)
            : buildStatusReportDoc(props.client, props.verdicts, props.completion, props.progress);
        docRef.current = doc;
        url = URL.createObjectURL(doc.output('blob'));
        setBlobUrl(url);
      } else {
        setBlobUrl(null);
      }
    } catch (e) {
      setBuildError((e as Error).message || 'Could not render the document.');
      setBlobUrl(null);
    }
    return () => { if (url) URL.revokeObjectURL(url); };
    // Rebuild only when the document identity or gate state changes — not on every
    // parent re-render (inputs are fresh objects each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, props.kind, rebuildKey, eligible]);

  if (!isOpen) return null;

  // Cert/status-only data (null in receipt mode) — guarded for the gate strip etc.
  const completion = isGenericProps(props) ? null : props.completion;
  const gates = completion?.gates ?? [];
  const unmetReasons = completion?.unmetReasons ?? [];

  const title = isGenericProps(props)
    ? props.title
    : props.kind === 'certificate'
      ? 'SATOP Completion Certificate'
      : 'Compliance Status Report';
  const Icon = isCert ? Award : props.kind === 'cimor' ? FileCheck : isReceipt ? Receipt : FileText;
  const createDisabled = isCert && !eligible;

  const handleCreatePdf = () => {
    const doc = docRef.current;
    if (!doc) return;
    doc.save(
      isGenericProps(props)
        ? props.fileName
        : props.kind === 'certificate'
          ? `SATOP_Completion_Certificate_${safeFileName(props.client?.name)}.pdf`
          : `Compliance_Status_${safeFileName(props.client?.name)}.pdf`,
    );
  };

  // Portal to <body>: the client workspace and layout <main> carry a persisted
  // fadeInUp transform, which would make `position: fixed` resolve relative to
  // them (mis-centering the modal) instead of the viewport. Rendering at the body
  // root escapes those transformed containing blocks.
  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in-up"
      style={{ animationDuration: '0.3s' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-900 border border-black/10 dark:border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <header className="flex justify-between items-center p-4 border-b border-black/10 dark:border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Icon size={18} className="text-primary" />
            <h2 className="text-lg font-semibold">{title} — Preview</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            aria-label="Close preview"
          >
            <X size={22} />
          </button>
        </header>

        {/* Gate strip — certificate only (self-documents why a cert is/ isn't issuable) */}
        {isCert && gates.length > 0 && (
          <div className="px-4 py-3 border-b border-black/10 dark:border-white/10 flex-shrink-0 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-widest ${
                  eligible
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                }`}
              >
                {eligible ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
                {eligible ? 'Eligible to issue' : 'Not yet eligible'}
              </span>
              {gates.map((g) => (
                <span
                  key={g.key}
                  title={g.detail}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                    g.passed
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800'
                  }`}
                >
                  {g.passed ? <Check size={13} /> : <X size={13} />} {g.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Body — the actual PDF, or an explanation when the cert gate is closed */}
        <main className="flex-1 overflow-hidden bg-slate-100 dark:bg-slate-800 min-h-[55vh]">
          {buildError ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <AlertTriangle className="text-rose-500 mb-3" size={36} />
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{buildError}</p>
            </div>
          ) : !canRender ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <AlertTriangle className="text-amber-500 mb-3" size={36} />
              <p className="text-base font-bold mb-2">Certificate not yet issuable</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mb-4">
                Every completion gate must pass before the certificate can be generated:
              </p>
              <ul className="text-sm text-left space-y-1.5 max-w-md">
                {unmetReasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <X size={15} className="text-rose-500 mt-0.5 flex-shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : blobUrl ? (
            <iframe
              src={blobUrl}
              title={`${title} preview`}
              className="w-full h-full"
              style={{ minHeight: '60vh', border: 'none' }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">Rendering…</div>
          )}
        </main>

        {/* Footer */}
        <footer className="p-4 border-t border-black/10 dark:border-white/10 flex-shrink-0 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {createDisabled
              ? 'Create PDF unlocks when hours, payment, and sign-off all pass.'
              : 'Preview is the exact PDF that will be created.'}
          </p>
          <button
            onClick={handleCreatePdf}
            disabled={createDisabled}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition ${
              createDisabled
                ? 'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-primary-focus'
            }`}
          >
            <Download size={16} /> Create PDF
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};

export default DocumentPreviewModal;
