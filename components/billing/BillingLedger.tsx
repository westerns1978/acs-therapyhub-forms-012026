import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import Card from '../ui/Card';
import RecordPaymentModal from './RecordPaymentModal';
import DocumentPreviewModal from '../clients/DocumentPreviewModal';
import { buildPaymentReceiptDoc, receiptFileName } from '../../services/paymentReceipt';
import { Loader2, AlertTriangle, Wallet, CheckCircle2, Receipt, Plus } from 'lucide-react';

// Shared, real-ledger billing view. Reads charges (debits) + payments (credits) +
// the derived clients.balance straight from Supabase by clientId — the SAME ledger
// the client portal and the staff workspace both render. Never hand-sets a balance.
//
//  - portal mount:  <BillingLedger clientId={portalClient.id} showSummary={false} />   (read-only)
//  - staff mount:   <BillingLedger clientId={client.id} canRecord showSummary />        (Director/Admin)
//
// RLS makes this safe for both: financial_staff_all_payments (Director/Admin) for staff,
// client_self_read_charges/payments for the portal user reading their own ledger.

export interface LedgerCharge {
  id: string;
  client_id: string;
  charge_type: string;
  satop_level?: string | null;
  description?: string | null;
  amount: number;
  is_pass_through: boolean;
  status: string; // pending | paid | waived | void
  created_at?: string | null;
}

export interface LedgerPayment {
  id: string;
  client_id: string;
  charge_id?: string | null;
  amount: number;
  payment_method?: string | null;
  status: string; // succeeded | failed | refunded | void
  external_payment_id?: string | null;
  stripe_event_id?: string | null;
  payment_date?: string | null;
  description?: string | null;
}

interface BillingLedgerProps {
  clientId: string;
  /** Show per-charge Record Payment affordance (Director/Admin staff mount). */
  canRecord?: boolean;
  /** Show the Outstanding / Paid / Total summary tiles (staff mount). */
  showSummary?: boolean;
}

const EPS = 0.005; // sub-cent tolerance so float math doesn't leave $0.00 "outstanding"

const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;

// Local-parse so a date-only string ('YYYY-MM-DD') doesn't shift a day in Central.
// timestamptz values carry a time, so parse those as-is.
const fmtDate = (s?: string | null) => {
  if (!s) return '—';
  const d = s.length <= 10 ? new Date(s + 'T00:00:00') : new Date(s);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

const prettyMethod = (m?: string | null) =>
  (m || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—';

// Per-charge OUTSTANDING mirrors the v14 acs-create-checkout fn exactly:
//   outstanding = charge.amount − Σ(succeeded payments linked to that charge)
const paidForCharge = (chargeId: string, payments: LedgerPayment[]) =>
  payments
    .filter((p) => p.status === 'succeeded' && p.charge_id === chargeId)
    .reduce((s, p) => s + Number(p.amount), 0);

type Pill = { label: string; cls: string };
const chargePill = (charge: LedgerCharge, paid: number): Pill => {
  const outstanding = Number(charge.amount) - paid;
  if (charge.status === 'void')
    return { label: 'Void', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' };
  if (charge.status === 'waived')
    return { label: 'Waived', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' };
  if (outstanding <= EPS)
    return { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };
  if (paid > EPS)
    return { label: 'Partial', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };
  return { label: 'Outstanding', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' };
};

const SummaryTile: React.FC<{ icon: React.ElementType; label: string; value: string; valueClass?: string }> = ({
  icon: Icon,
  label,
  value,
  valueClass = 'text-slate-800 dark:text-slate-100',
}) => (
  <div className="rounded-2xl border border-border dark:border-slate-700 bg-white dark:bg-slate-800 shadow-card p-4">
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <Icon size={16} className="text-slate-400" />
    </div>
    <p className={`text-2xl font-black mt-1.5 ${valueClass}`}>{value}</p>
  </div>
);

const BillingLedger: React.FC<BillingLedgerProps> = ({ clientId, canRecord = false, showSummary = true }) => {
  const [balance, setBalance] = useState(0);
  const [charges, setCharges] = useState<LedgerCharge[]>([]);
  const [payments, setPayments] = useState<LedgerPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordCharge, setRecordCharge] = useState<LedgerCharge | null>(null);
  // Client identity for receipts — read here (one source) so both the staff and
  // portal mounts get it without the parent threading extra props.
  const [clientName, setClientName] = useState('');
  const [clientIsDemo, setClientIsDemo] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<LedgerPayment | null>(null);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const [clientRes, chargeRes, payRes] = await Promise.all([
        supabase.from('clients').select('balance, name, is_demo').eq('id', clientId).single(),
        supabase.from('charges').select('*').eq('client_id', clientId).order('created_at', { ascending: true }),
        supabase.from('payments').select('*').eq('client_id', clientId).order('payment_date', { ascending: false }),
      ]);
      if (clientRes.error) throw clientRes.error;
      if (chargeRes.error) throw chargeRes.error;
      if (payRes.error) throw payRes.error;
      setBalance(Number(clientRes.data?.balance ?? 0));
      setClientName(String(clientRes.data?.name ?? ''));
      setClientIsDemo(clientRes.data?.is_demo === true);
      setCharges((chargeRes.data as LedgerCharge[]) || []);
      setPayments((payRes.data as LedgerPayment[]) || []);
    } catch (e: any) {
      setError(e?.message || 'Could not load billing.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-300 text-sm">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
    );
  }

  const totalCharges = charges
    .filter((c) => !['waived', 'void'].includes(c.status))
    .reduce((s, c) => s + Number(c.amount), 0);
  const totalPaid = payments.filter((p) => p.status === 'succeeded').reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      {showSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryTile
            icon={Wallet}
            label="Outstanding"
            value={money(balance)}
            valueClass={balance > EPS ? 'text-primary dark:text-dark-primary' : 'text-emerald-600 dark:text-emerald-400'}
          />
          <SummaryTile icon={CheckCircle2} label="Paid" value={money(totalPaid)} />
          <SummaryTile icon={Receipt} label="Total Charges" value={money(totalCharges)} />
        </div>
      )}

      {/* Charges (debits) — warm tiles inside a white card for clear definition */}
      <Card title="Charges" noPadding>
        <div className="p-4 space-y-3">
          {charges.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500 italic">No charges on file.</p>
          )}
          {charges.map((charge) => {
            const paid = paidForCharge(charge.id, payments);
            const outstanding = Number(charge.amount) - paid;
            const pill = chargePill(charge, paid);
            const recordable = canRecord && !['waived', 'void'].includes(charge.status) && outstanding > EPS;
            return (
              <div
                key={charge.id}
                className="rounded-2xl border border-border dark:border-slate-700 bg-background dark:bg-slate-900/40 shadow-card p-4"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                      {charge.description || charge.charge_type}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {charge.is_pass_through && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          Pass-through
                        </span>
                      )}
                      {charge.satop_level && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                          SATOP {charge.satop_level}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-black text-slate-800 dark:text-slate-100">{money(charge.amount)}</p>
                    {paid > EPS && outstanding > EPS && (
                      <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                        {money(paid)} paid · {money(outstanding)} left
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 mt-3">
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${pill.cls}`}
                  >
                    {pill.label}
                  </span>
                  {recordable && (
                    <button
                      onClick={() => setRecordCharge(charge)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-focus text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-sm transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <Plus size={13} /> Record Payment
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Payments (credits) */}
      <Card title="Payment History" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border dark:border-slate-700">
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Method</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                  Amount
                </th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                  Receipt
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 dark:divide-slate-800">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-sm font-bold text-slate-500 whitespace-nowrap">{fmtDate(p.payment_date)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{prettyMethod(p.payment_method)}</td>
                  <td className="px-4 py-3 text-[11px] text-slate-400 font-medium">
                    {p.external_payment_id || p.id.substring(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    +{money(p.amount)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {/* Reprintable proof of THIS payment. Only successful payments get a
                        receipt — a void/refunded row isn't a "payment received". */}
                    {p.status === 'succeeded' && (
                      <button
                        onClick={() => setReceiptPayment(p)}
                        title="Preview and download a receipt for this payment"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition"
                      >
                        <Receipt size={13} /> Receipt
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-slate-500 italic">
                    No payments recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {recordCharge && (
        <RecordPaymentModal
          isOpen={!!recordCharge}
          onClose={() => setRecordCharge(null)}
          clientId={clientId}
          clientName={clientName}
          clientIsDemo={clientIsDemo}
          charge={recordCharge}
          outstanding={Number(recordCharge.amount) - paidForCharge(recordCharge.id, payments)}
          onRecorded={() => {
            setRecordCharge(null);
            load(); // refetch the real ledger — never optimistically hand-set
          }}
        />
      )}

      {/* Reprint a receipt for any past payment. Same preview-then-save modal as the
          certificate — the previewed blob is the saved blob (zero drift). */}
      {receiptPayment && (
        <DocumentPreviewModal
          kind="receipt"
          isOpen={!!receiptPayment}
          onClose={() => setReceiptPayment(null)}
          title="Payment Receipt"
          fileName={receiptFileName(clientName, receiptPayment)}
          rebuildKey={receiptPayment.id}
          build={() =>
            buildPaymentReceiptDoc({
              payment: receiptPayment,
              charge: charges.find((c) => c.id === receiptPayment.charge_id) ?? null,
              clientName,
              isDemo: clientIsDemo,
            })
          }
        />
      )}
    </div>
  );
};

export default BillingLedger;
