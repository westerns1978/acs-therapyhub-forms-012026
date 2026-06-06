import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../services/supabase';
import { X, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { LedgerCharge } from './BillingLedger';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  charge: LedgerCharge;
  /** Remaining balance on this charge — the default + ceiling for the amount field. */
  outstanding: number;
  onRecorded: () => void;
}

type Method = 'cash' | 'check' | 'money_order';
const METHODS: { value: Method; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'money_order', label: 'Money Order' },
];

const EPS = 0.005;

// Local YYYY-MM-DD for the date input default (no UTC shift in Central).
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;

/**
 * Deterministic manual-payment entry (cash / check / money_order). No AI — the
 * amount defaults to the charge's outstanding and is validated > 0 and <= outstanding.
 * Insert convention mirrors the Stripe webhook: dollars into `amount`, status
 * 'succeeded' (the value client_balance() counts), recorded_by = auth.uid()
 * (mandatory under the financial_staff_all_payments with-check), stripe_event_id null.
 * The balance recomputes via the payments trigger — we never hand-set it.
 *
 * Portaled to <body>: the workspace/layout carry a persisted fadeInUp transform
 * which would make `position: fixed` resolve relative to them (mis-centering).
 */
const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  clientId,
  charge,
  outstanding,
  onRecorded,
}) => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Method>('cash');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset to fresh defaults each time the modal opens for a (possibly new) charge.
  useEffect(() => {
    if (isOpen) {
      setAmount(outstanding > 0 ? outstanding.toFixed(2) : '');
      setMethod('cash');
      setReference('');
      setDate(todayLocal());
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen, charge?.id, outstanding]);

  if (!isOpen) return null;

  const amt = Number(amount);
  const amountValid = Number.isFinite(amt) && amt > 0 && amt <= outstanding + EPS;
  const showRef = method === 'check' || method === 'money_order';
  const canSubmit = amountValid && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) throw new Error('Your session expired — sign in again to record a payment.');

      const payment_date = new Date(date + 'T00:00:00').toISOString();
      const { error: insErr } = await supabase.from('payments').insert({
        client_id: clientId,
        charge_id: charge.id,
        amount: amt, // dollars (numeric), NOT cents
        payment_method: method,
        status: 'succeeded', // the value client_balance() counts
        recorded_by: uid, // mandatory: with_check requires recorded_by = auth.uid()
        payment_date,
        external_payment_id: showRef && reference.trim() ? reference.trim() : null,
        stripe_event_id: null, // manual entry — partial unique index allows many NULLs
        description: `Manual ${method.replace(/_/g, ' ')} payment`,
      });
      if (insErr) throw insErr;

      // Mark the charge paid when this payment fully covers it. Cosmetic for the
      // balance (the succeeded payment already nets it down via the trigger), but
      // keeps the charge's status pill accurate.
      if (amt >= outstanding - EPS && charge.status !== 'paid') {
        const { error: upErr } = await supabase.from('charges').update({ status: 'paid' }).eq('id', charge.id);
        if (upErr) throw upErr;
      }

      onRecorded(); // parent refetches the real ledger + closes
    } catch (e: any) {
      setError(e?.message || 'Could not record the payment. Please try again.');
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2.5 rounded-xl border border-border dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40';

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in-up"
      style={{ animationDuration: '0.3s' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-payment-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-border dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[92vh]">
        {/* Header */}
        <header className="flex justify-between items-center p-4 border-b border-border dark:border-white/10 flex-shrink-0">
          <h2 id="record-payment-title" className="text-lg font-black text-slate-800 dark:text-slate-100">
            Record Payment
          </h2>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white disabled:opacity-50"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </header>

        {/* Body */}
        <main className="p-4 space-y-4 overflow-y-auto">
          {/* Charge context */}
          <div className="rounded-2xl border border-border dark:border-slate-700 bg-background dark:bg-slate-800/50 p-3">
            <p className="text-sm font-black text-slate-800 dark:text-slate-100">
              {charge.description || charge.charge_type}
            </p>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Outstanding {money(outstanding)}
            </p>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${inputCls} pl-7`}
                autoFocus
              />
            </div>
            {amount !== '' && !amountValid && (
              <p className="text-[11px] font-bold text-rose-600 mt-1">
                {amt <= 0
                  ? 'Enter an amount greater than $0.00.'
                  : `Cannot exceed the outstanding ${money(outstanding)}.`}
              </p>
            )}
          </div>

          {/* Method */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as Method)} className={inputCls}>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reference (check / money order only) */}
          {showRef && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                {method === 'check' ? 'Check #' : 'Money Order #'} <span className="text-slate-300">(optional)</span>
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={method === 'check' ? 'e.g. 1042' : 'e.g. MO-558231'}
                className={inputCls}
              />
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-[12px] bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-2.5 text-rose-700 dark:text-rose-300">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="p-4 border-t border-border dark:border-white/10 flex-shrink-0 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm transition ${
              canSubmit
                ? 'bg-primary text-white hover:bg-primary-focus'
                : 'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Recording…
              </>
            ) : (
              <>
                <CheckCircle2 size={16} /> Confirm {amountValid ? money(amt) : 'Payment'}
              </>
            )}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};

export default RecordPaymentModal;
