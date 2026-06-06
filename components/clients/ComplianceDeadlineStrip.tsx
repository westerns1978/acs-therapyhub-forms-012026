import React from 'react';
import type { ComplianceClock, ClockStatus } from '../../services/complianceClock';
import type { SatopLevel } from '../../config/satopFees';
import { SATOP_LEVEL_META } from '../../services/placementEngine';
import { CalendarClock, CheckCircle2, Clock, AlertTriangle, Ban, Minus, Info } from 'lucide-react';

/**
 * WS2.5 — per-client compliance DEADLINE strip (advisory display only).
 *
 * Pure presentational: it renders a precomputed ComplianceClock (services/
 * complianceClock.ts). It is NOT an alert feed — it never writes, never pushes to
 * RiskMonitor/alertsService; it only displays the deterministic windows. The
 * `window_elapsed` items say "confirm…", never "OVERDUE" — there is no in-app
 * issuance/notification record to clear them, so they are reminders to verify.
 */

const STATUS_META: Record<ClockStatus, { label: string; pill: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  ok:             { label: 'On track',   pill: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300', icon: CheckCircle2 },
  due_soon:       { label: 'Due soon',   pill: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',         icon: Clock },
  window_elapsed: { label: 'Verify',     pill: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',         icon: AlertTriangle },
  expired:        { label: 'Re-screen',  pill: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',             icon: AlertTriangle },
  blocked:        { label: 'Outstanding',pill: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',             icon: Ban },
  informational:  { label: 'Automatic',  pill: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',                icon: Info },
  not_applicable: { label: 'N/A',        pill: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',           icon: Minus },
};

interface Props {
  clock: ComplianceClock;
  /** The SIGNED determination level (context only); undefined when not yet signed. */
  signedLevel?: SatopLevel | null;
}

const ComplianceDeadlineStrip: React.FC<Props> = ({ clock, signedLevel }) => {
  return (
    <div className="rounded-2xl border border-border dark:border-slate-700 bg-white dark:bg-slate-800 shadow-card p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarClock size={18} className="text-primary" />
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Compliance Deadlines</h3>
        </div>
        {clock.atRiskCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {clock.atRiskCount} need{clock.atRiskCount === 1 ? 's' : ''} attention
          </span>
        )}
      </div>

      <p className="text-[11px] font-bold text-slate-400 mt-1">
        Advisory — not a clinical determination.
        {signedLevel ? <> Tracking against the signed placement <span className="text-slate-500 dark:text-slate-300">{SATOP_LEVEL_META[signedLevel].code} · Level {signedLevel}</span>.</> : ' No signed determination yet — completion deadlines apply only after a signed placement is completed.'}
        {' '}As of {clock.asOf}.
      </p>

      <ul className="mt-4 space-y-2">
        {clock.items.map((it) => {
          const meta = STATUS_META[it.status];
          const Icon = meta.icon;
          const muted = it.status === 'not_applicable';
          return (
            <li
              key={it.key}
              className={`rounded-xl border px-3 py-2.5 ${
                muted
                  ? 'border-dashed border-border dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30'
                  : it.atRisk
                    ? 'border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10'
                    : 'border-border dark:border-slate-700 bg-white dark:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Icon size={14} className={muted ? 'text-slate-400' : 'text-slate-500 dark:text-slate-300'} />
                  <span className={`text-[13px] font-bold ${muted ? 'text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>{it.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {it.dueDate && !muted && (
                    <span className="text-[11px] font-bold text-slate-400">
                      {it.daysRemaining != null && it.daysRemaining >= 0
                        ? `${it.daysRemaining}d · by ${it.dueDate}`
                        : `by ${it.dueDate}`}
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${meta.pill}`}>
                    {meta.label}
                  </span>
                </div>
              </div>
              <p className={`text-[11px] mt-1 leading-snug ${muted ? 'text-slate-400' : 'text-slate-600 dark:text-slate-300'}`}>{it.detail}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ComplianceDeadlineStrip;
