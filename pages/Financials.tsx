import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import { supabase } from '../services/supabase';
import { Loader2, AlertTriangle, DollarSign, Landmark, CircleDashed, Wallet, CheckCircle2 } from 'lucide-react';

/**
 * ACS Director Reports — read-only views over the REAL charges/payments ledger.
 * Every number comes from a deterministic SQL function (acs_report_*), security-
 * invoker so it respects the same RLS staff already read under. No AI, no mock data.
 *
 * The pass-through rule lives in SQL, once. The page never re-derives money; it only
 * displays what the functions return and shows the self-audit cross-check
 * (revenue + remittance + unallocated = total) so the page proves itself.
 */

const usd = (n: number | string) => `$${(Number(n) || 0).toFixed(2)}`;
const pad = (n: number) => String(n).padStart(2, '0');

// Local (Central) YYYY-MM-DD built from local date parts — no UTC parse, so no
// day shift. The RPCs bucket by America/Chicago, so a payment near Central midnight
// lands on the correct Central day regardless of the browser. (If a date-only
// string ever needs a Date, parse it as new Date(d + 'T00:00:00').)
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayLocal = () => toYMD(new Date());
const firstOfMonthLocal = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; };

const prettyMethod = (m?: string | null) =>
  (m || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Unknown';

interface MethodRow { method: string | null; count: number; total: number; }
interface OutRow { client_id: string; client_name: string; outstanding: number; }
interface MoneySummary { revenue: number; remittance: number; unallocated: number; total: number; }

const inputCls =
  'px-3 py-2 rounded-xl border border-border dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40';

const DateRange: React.FC<{ from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }> = ({
  from, to, onFrom, onTo,
}) => (
  <div className="flex items-center gap-2 flex-wrap">
    <input type="date" value={from} max={to} onChange={(e) => onFrom(e.target.value)} className={inputCls} aria-label="From date" />
    <span className="text-slate-400 text-sm font-bold">→</span>
    <input type="date" value={to} min={from} onChange={(e) => onTo(e.target.value)} className={inputCls} aria-label="To date" />
  </div>
);

const StatTile: React.FC<{ icon: React.ElementType; label: string; value: string; sub?: string; accent?: string }> = ({
  icon: Icon, label, value, sub, accent,
}) => (
  <div className="rounded-2xl border border-border dark:border-slate-700 bg-white dark:bg-slate-800 shadow-card p-4">
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <Icon size={16} className="text-slate-400" />
    </div>
    <p className={`text-2xl font-black mt-1.5 ${accent ?? 'text-slate-800 dark:text-slate-100'}`}>{value}</p>
    {sub && <p className="text-[11px] font-bold text-slate-400 mt-0.5 leading-snug">{sub}</p>}
  </div>
);

const SectionError: React.FC<{ msg: string }> = ({ msg }) => (
  <div className="flex items-start gap-2 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-300 text-sm">
    <AlertTriangle size={16} className="shrink-0 mt-0.5" /><span>{msg}</span>
  </div>
);

const Spin: React.FC = () => (
  <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 className="animate-spin" /></div>
);

const Financials: React.FC = () => {
  // Money summary — month-to-date default.
  const [moneyFrom, setMoneyFrom] = useState(firstOfMonthLocal());
  const [moneyTo, setMoneyTo] = useState(todayLocal());
  const [summary, setSummary] = useState<MoneySummary | null>(null);
  const [loadingMoney, setLoadingMoney] = useState(true);
  const [errMoney, setErrMoney] = useState<string | null>(null);

  // Daily payments by method — today default.
  const [dayFrom, setDayFrom] = useState(todayLocal());
  const [dayTo, setDayTo] = useState(todayLocal());
  const [byMethod, setByMethod] = useState<MethodRow[]>([]);
  const [loadingMethod, setLoadingMethod] = useState(true);
  const [errMethod, setErrMethod] = useState<string | null>(null);

  // Outstanding by client — no range.
  const [outstanding, setOutstanding] = useState<OutRow[]>([]);
  const [loadingOut, setLoadingOut] = useState(true);
  const [errOut, setErrOut] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMoney(true); setErrMoney(null);
      const { data, error } = await supabase.rpc('acs_report_money', { p_from: moneyFrom, p_to: moneyTo });
      if (cancelled) return;
      if (error) { setErrMoney(error.message); setSummary(null); }
      else {
        const r = (data ?? [])[0] ?? {};
        setSummary({
          revenue: Number(r.revenue_excl_passthrough ?? 0),
          remittance: Number(r.supplemental_remittance ?? 0),
          unallocated: Number(r.untied ?? 0),
          total: Number(r.total_collected ?? 0),
        });
      }
      setLoadingMoney(false);
    })();
    return () => { cancelled = true; };
  }, [moneyFrom, moneyTo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMethod(true); setErrMethod(null);
      const { data, error } = await supabase.rpc('acs_report_payments_by_method', { p_from: dayFrom, p_to: dayTo });
      if (cancelled) return;
      if (error) { setErrMethod(error.message); setByMethod([]); }
      else setByMethod((data ?? []).map((r: any) => ({ method: r.method, count: Number(r.payment_count), total: Number(r.total) })));
      setLoadingMethod(false);
    })();
    return () => { cancelled = true; };
  }, [dayFrom, dayTo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingOut(true); setErrOut(null);
      const { data, error } = await supabase.rpc('acs_report_outstanding_by_client');
      if (cancelled) return;
      if (error) { setErrOut(error.message); setOutstanding([]); }
      else setOutstanding((data ?? []).map((r: any) => ({ client_id: r.client_id, client_name: r.client_name, outstanding: Number(r.outstanding) })));
      setLoadingOut(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const methodTotal = byMethod.reduce((s, r) => s + r.total, 0);
  const methodCount = byMethod.reduce((s, r) => s + r.count, 0);
  const outTotal = outstanding.reduce((s, r) => s + r.outstanding, 0);

  const crosscheck = summary ? summary.revenue + summary.remittance + summary.unallocated : 0;
  const reconciles = summary ? Math.abs(crosscheck - summary.total) < 0.005 : false;

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">Financial Reports</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Read-only aggregations computed deterministically from the live charges + payments ledger. Money counts succeeded payments only.
        </p>
      </div>

      {/* ── Money summary (revenue / remittance / unallocated / total) ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Money Summary</h2>
          <DateRange from={moneyFrom} to={moneyTo} onFrom={setMoneyFrom} onTo={setMoneyTo} />
        </div>
        {errMoney ? <SectionError msg={errMoney} /> : loadingMoney || !summary ? <Spin /> : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile icon={DollarSign} label="ACS Revenue" value={usd(summary.revenue)} sub="Excl. pass-through · charge-linked" accent="text-emerald-600 dark:text-emerald-400" />
              <StatTile icon={Landmark} label="Supplemental Remittance" value={usd(summary.remittance)} sub="Collected — owed to DMH (liability)" accent="text-amber-600 dark:text-amber-400" />
              <StatTile icon={CircleDashed} label="Unallocated" value={usd(summary.unallocated)} sub="Legacy / pre-itemization · no charge link" accent="text-slate-500 dark:text-slate-300" />
              <StatTile icon={Wallet} label="Total Collected" value={usd(summary.total)} sub="All succeeded payments" accent="text-primary dark:text-dark-primary" />
            </div>
            <div className={`flex items-start gap-2 rounded-xl px-4 py-2.5 text-xs font-bold border ${reconciles
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800'}`}>
              {reconciles ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
              <span>
                Self-audit: {usd(summary.revenue)} + {usd(summary.remittance)} + {usd(summary.unallocated)} = {usd(crosscheck)}
                {reconciles ? ' — reconciles to total collected.' : ` — does NOT match total collected ${usd(summary.total)}.`}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <span className="font-bold">Supplemental remittance</span> is the state pass-through fee already collected — it is a liability owed to the Missouri DMH, not ACS revenue.
              {' '}<span className="font-bold">Unallocated</span> is collected money not linked to a charge (pre-itemization / legacy entries); it is shown separately and never counted as revenue.
            </p>
          </>
        )}
      </section>

      {/* ── Daily payments by method ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Payments by Method</h2>
          <DateRange from={dayFrom} to={dayTo} onFrom={setDayFrom} onTo={setDayTo} />
        </div>
        <Card noPadding>
          {errMethod ? <div className="p-4"><SectionError msg={errMethod} /></div> : loadingMethod ? <Spin /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border dark:border-slate-700">
                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Method</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Count</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 dark:divide-slate-800">
                  {byMethod.map((r) => (
                    <tr key={r.method ?? 'unknown'}>
                      <td className="px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">{prettyMethod(r.method)}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 text-right">{r.count}</td>
                      <td className="px-4 py-3 text-sm font-black text-slate-800 dark:text-slate-100 text-right">{usd(r.total)}</td>
                    </tr>
                  ))}
                  {byMethod.length === 0 && (
                    <tr><td colSpan={3} className="py-10 text-center text-sm text-slate-500 italic">No payments in this range.</td></tr>
                  )}
                </tbody>
                {byMethod.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border dark:border-slate-700">
                      <td className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Total</td>
                      <td className="px-4 py-3 text-sm font-black text-slate-700 dark:text-slate-200 text-right">{methodCount}</td>
                      <td className="px-4 py-3 text-sm font-black text-primary dark:text-dark-primary text-right">{usd(methodTotal)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </Card>
      </section>

      {/* ── Outstanding balances by client (reconciles to client_balance()) ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Outstanding Balances by Client</h2>
          {!loadingOut && !errOut && (
            <p className="text-xs font-bold text-slate-400">{outstanding.length} client{outstanding.length === 1 ? '' : 's'} · {usd(outTotal)} outstanding</p>
          )}
        </div>
        <Card noPadding>
          {errOut ? <div className="p-4"><SectionError msg={errOut} /></div> : loadingOut ? <Spin /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border dark:border-slate-700">
                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 dark:divide-slate-800">
                  {outstanding.map((r) => (
                    <tr key={r.client_id}>
                      <td className="px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">{r.client_name}</td>
                      <td className="px-4 py-3 text-sm font-black text-rose-600 dark:text-rose-400 text-right">{usd(r.outstanding)}</td>
                    </tr>
                  ))}
                  {outstanding.length === 0 && (
                    <tr><td colSpan={2} className="py-10 text-center text-sm text-slate-500 italic">All clients are squared up — no outstanding balances.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
};

export default Financials;
