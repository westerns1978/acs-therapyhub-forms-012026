/**
 * "Complete client" — the attestation step (P0/D1).
 *
 * Completion used to be a dropdown value on the Edit Client form. It is not an
 * attribute; it is an event with preconditions and a signer. This modal is the
 * only place in the product that can produce one.
 *
 * The design constraint that shaped it: if completing a client auto-wrote the
 * clinician sign-off, the sign-off gate would be tautological — satisfied by the
 * act of passing it, which is no gate at all. So the clinician must AFFIRM, in
 * their own words, before the call is possible:
 *
 *   • The canonical attestation is shown as prose, not as a checkbox caption. It
 *     is stored verbatim on the record, so the note says what was affirmed.
 *   • The clinician must add their own statement of the basis. No default text,
 *     no prefill — an empty box cannot be submitted.
 *   • The Postgres RPC re-derives every gate anyway and refuses on its own terms;
 *     nothing here is load-bearing for correctness. This is the human half.
 *
 * What is written is immutable: `clinical_notes` UPDATE/DELETE policies exclude
 * note_type='completion_signoff' (migration 20260802_p0_1_completion_gate.sql).
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle, Loader2, Lock, X } from 'lucide-react';
import { completeClient, completionAttestationPreamble } from '../../services/api';
import { programLabel } from '../../config/programVocab';
import type { Client } from '../../types';

/** The clinician's own statement must be a statement, not a keystroke. Kept in
 *  step with the RPC's own minimum so the UI never lets through what SQL refuses. */
const MIN_STATEMENT = 20;

interface Props {
    isOpen: boolean;
    client: Client | null;
    /** Display name + role of the signer, for the "signing as" line. */
    signerName?: string;
    signerRole?: string;
    onClose: () => void;
    onCompleted: (result: { completedAt: string; signoffNoteId: string }) => void;
}

const CompleteClientModal: React.FC<Props> = ({
    isOpen, client, signerName, signerRole, onClose, onCompleted,
}) => {
    const [statement, setStatement] = useState('');
    const [affirmed, setAffirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) { setStatement(''); setAffirmed(false); setError(null); setBusy(false); }
    }, [isOpen, client?.id]);

    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [isOpen]);

    if (!isOpen || !client) return null;

    const preamble = completionAttestationPreamble(client.name, programLabel(client.program));
    const ready = affirmed && statement.trim().length >= MIN_STATEMENT && !busy;

    const submit = async () => {
        if (!ready) return;
        setBusy(true);
        setError(null);
        try {
            // Stored verbatim: the canonical affirmation and the clinician's own
            // words, in that order, as one attestation.
            const result = await completeClient(client.id, `${preamble}\n\n${statement.trim()}`);
            onCompleted(result);
            onClose();
        } catch (e: any) {
            // The RPC's message names the failing gates with their real numbers
            // ("Hours: 9/10 total (1 remaining)"). Show it as-is.
            setError(e?.message || 'Could not complete this client.');
        } finally {
            setBusy(false);
        }
    };

    // Portalled to body: a fixed-position modal mis-centres under the layout's
    // persisted fadeInUp transform otherwise.
    return createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="complete-client-title">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={busy ? undefined : onClose} aria-hidden="true" />

            <div
                className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-white/20 dark:border-slate-700"
                style={{ maxHeight: 'min(90vh, calc(100dvh - 2rem))' }}
            >
                <div className="flex-shrink-0 bg-gray-50/80 dark:bg-slate-800/80 p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-start">
                    <div>
                        <h2 id="complete-client-title" className="text-xl font-bold text-gray-900 dark:text-white">
                            Attest to completion
                        </h2>
                        <p className="text-sm text-gray-500">{client.name} · {programLabel(client.program)}</p>
                    </div>
                    <button onClick={onClose} disabled={busy} aria-label="Close" className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors disabled:opacity-50">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-8 space-y-6">
                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl flex items-start gap-3 text-red-800 dark:text-red-300">
                            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                            <p className="text-xs font-medium leading-relaxed whitespace-pre-line">{error}</p>
                        </div>
                    )}

                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">
                            What you are attesting
                        </h3>
                        <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">{preamble}</p>
                        <p className="mt-4 text-xs text-slate-500 leading-relaxed">
                            Recorded under 9 CSR 30-3.206(13). This is the qualified professional&rsquo;s
                            sign-off the completion certificate depends on.
                        </p>
                    </section>

                    <section className="space-y-2">
                        <label htmlFor="completion-statement" className="block text-xs font-bold uppercase text-gray-500 tracking-wider">
                            Your statement of the basis <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            id="completion-statement"
                            value={statement}
                            onChange={(e) => setStatement(e.target.value)}
                            disabled={busy}
                            rows={4}
                            placeholder="In your own words: what you reviewed, and why this client has completed."
                            className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-60"
                        />
                        <p className="text-[11px] text-slate-400">
                            {statement.trim().length < MIN_STATEMENT
                                ? `${MIN_STATEMENT - statement.trim().length} more character(s) required — there is no default text.`
                                : 'Stored verbatim on the clinical record.'}
                        </p>
                    </section>

                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={affirmed}
                            disabled={busy}
                            onChange={(e) => setAffirmed(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                            I affirm the statement above.
                            {signerName && (
                                <span className="block text-xs text-slate-500 mt-0.5">
                                    Signing as {signerName}{signerRole ? ` · ${signerRole}` : ''} — recorded with this attestation.
                                </span>
                            )}
                        </span>
                    </label>

                    <p className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
                        <Lock size={12} className="shrink-0 mt-0.5" />
                        Once recorded, this attestation cannot be edited or deleted. Reopening the
                        client later is a separate audited action and does not remove it.
                    </p>
                </div>

                <div className="flex-shrink-0 p-6 bg-gray-50/80 dark:bg-slate-800/80 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center">
                    <button onClick={onClose} disabled={busy} className="px-5 py-2.5 text-gray-600 hover:text-gray-900 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50">
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={!ready}
                        className="px-8 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-focus font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {busy ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                        {busy ? 'Recording…' : 'Sign and complete'}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};

export default CompleteClientModal;
