/**
 * RiskMonitor — actionable alerts inbox.
 *
 * Replaces the empty "Risk Monitor" card on the Dashboard. Every alert here
 * has a real CTA — outreach, task, schedule, or probation notification —
 * so high-risk clients don't die in a dashboard widget.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, RefreshCw, Loader2, Users, Shield, AlertCircle } from 'lucide-react';
import { fetchAlerts, summarizeAlerts, type ClientAlert, type AlertTier } from '../services/alertsService';
import OutreachModal from '../components/OutreachModal';
import { programLabel } from '../config/programVocab';

// Restructured 2026-07-28: filled badges + 2px coloured card borders turned the
// list into four competing colour blocks. Now every card is a neutral surface with
// a hairline and a 3px left rule; the tier badge is an outline chip in the same
// ink, and `dot` drives the filter tiles. MODERATE lost its blue (blue left the
// status system entirely) and reads as warm neutral, which is what it means.
const TIER_STYLE: Record<AlertTier, { badge: string; rule: string; icon: string; dot: string }> = {
  CRITICAL: { badge: 'border border-danger-600 text-danger-700 dark:text-danger-400',   rule: 'bg-danger-600 dark:bg-danger-400',  icon: 'text-danger-600',  dot: 'bg-danger-600 dark:bg-danger-400' },
  HIGH:     { badge: 'border border-orange-600 text-orange-700 dark:text-orange-400',   rule: 'bg-orange-600 dark:bg-orange-400',  icon: 'text-orange-600',  dot: 'bg-orange-600 dark:bg-orange-400' },
  ELEVATED: { badge: 'border border-warning-600 text-warning-700 dark:text-warning-400', rule: 'bg-warning-600 dark:bg-warning-400', icon: 'text-warning-600', dot: 'bg-warning-600 dark:bg-warning-400' },
  MODERATE: { badge: 'border border-neutral-400 text-neutral-600 dark:text-neutral-300', rule: 'bg-neutral-400 dark:bg-neutral-500', icon: 'text-neutral-500', dot: 'bg-neutral-400 dark:bg-neutral-500' },
};

const TIER_LABEL: Record<AlertTier, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  ELEVATED: 'Elevated',
  MODERATE: 'Moderate',
};

// Program display goes through the canonical config/programVocab labels. The old
// private formatProgram here had an acronym list missing CIP/OEP/WIP, so those
// title-cased to "Cip"/"Oep"/"Wip" (fixed 2026-07-28 — never re-implement labels
// per-component; see CLAUDE.md).

const RiskMonitor: React.FC = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<ClientAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tierFilter, setTierFilter] = useState<AlertTier | 'ALL'>('ALL');
  const [selected, setSelected] = useState<ClientAlert | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const summary = useMemo(() => summarizeAlerts(alerts), [alerts]);

  // Fail-visibly (2026-07-28): fetchAlerts THROWS on failure now. Without this catch
  // the page rendered its green "All clear at this tier" shield over a failed query.
  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchAlerts();
      setAlerts(data);
    } catch (e: any) {
      console.warn('[RiskMonitor] load failed:', e);
      setAlerts([]);
      setLoadError(e?.message || 'Unknown error');
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = tierFilter === 'ALL' ? alerts : alerts.filter(a => a.tier === tierFilter);

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8 animate-fade-in-up">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tighter dark:text-white">Alerts</h1>
          <p className="text-sm text-slate-500 mt-2">Actionable alerts computed from attendance, deadlines, and compliance state. Advisory verdicts live on Compliance Readiness.</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 disabled:opacity-50"
        >
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button
          onClick={() => setTierFilter('ALL')}
          className={`p-4 rounded-2xl border text-left transition bg-white dark:bg-slate-900 ${tierFilter === 'ALL' ? 'border-slate-900 dark:border-white' : 'border-hairline dark:border-slate-700/60 hover:bg-neutral-50 dark:hover:bg-slate-800/60'}`}
        >
          <div className="text-3xl font-black tabular-nums tracking-tighter text-slate-900 dark:text-white">{loadError ? '—' : summary.total}</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mt-1">All alerts</div>
        </button>
        {(['CRITICAL', 'HIGH', 'ELEVATED', 'MODERATE'] as const).map(t => {
          const count = summary[t.toLowerCase() as 'critical' | 'high' | 'elevated' | 'moderate'];
          const s = TIER_STYLE[t];
          const live = !loadError && count > 0;
          return (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`p-4 rounded-2xl border text-left transition bg-white dark:bg-slate-900 ${tierFilter === t ? 'border-slate-900 dark:border-white' : 'border-hairline dark:border-slate-700/60 hover:bg-neutral-50 dark:hover:bg-slate-800/60'}`}
            >
              <div className={`text-3xl font-black tabular-nums tracking-tighter ${live ? s.icon : 'text-neutral-400 dark:text-neutral-600'}`}>{loadError ? '—' : count}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${live ? s.dot : 'bg-neutral-300 dark:bg-neutral-700'}`} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">{TIER_LABEL[t]}</span>
              </div>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 size={24} className="animate-spin mr-3" />
          <span className="text-sm font-bold uppercase tracking-widest">Computing alerts…</span>
        </div>
      ) : loadError ? (
        <div className="text-center py-20 bg-rose-50 dark:bg-rose-900/20 rounded-3xl border border-rose-200 dark:border-rose-800">
          <AlertCircle size={48} className="mx-auto mb-4 text-rose-500" />
          <p className="text-sm font-black uppercase tracking-widest text-rose-700 dark:text-rose-300">Alerts could not be computed</p>
          <p className="text-xs text-rose-600 dark:text-rose-400 mt-2 max-w-md mx-auto">This is a loading failure, not an all-clear. ({loadError})</p>
          <button
            onClick={() => load(true)}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-black uppercase tracking-widest text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        /* Zero state is NEUTRAL (2026-07-28). A green celebration card for "nothing
           here" competed with real findings for attention and, on a compliance
           surface, edges toward asserting an all-clear the page didn't verify. */
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-hairline dark:border-slate-700/60">
          <Shield size={40} className="mx-auto mb-4 text-neutral-300 dark:text-neutral-600" />
          <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">No alerts at this tier</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">Nothing requires attention right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(alert => {
            const s = TIER_STYLE[alert.tier];
            return (
              <div
                key={alert.id}
                className={`relative overflow-hidden p-5 pl-6 bg-white dark:bg-slate-900 border border-hairline dark:border-slate-700/60 rounded-2xl shadow-sm hover:shadow-md transition-all`}
              >
                <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${s.rule}`} />
                <div className="flex items-start gap-4">
                  <AlertTriangle size={20} className={`${s.icon} mt-1 shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${s.badge}`}>{TIER_LABEL[alert.tier]}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{programLabel(alert.program)}</span>
                    </div>
                    <h3 className="font-black text-lg tracking-tight mt-1.5 dark:text-white">{alert.clientName}</h3>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-0.5">{alert.headline}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{alert.detail}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => setSelected(alert)}
                      className="px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition"
                    >
                      Take action
                    </button>
                    <button
                      onClick={() => navigate(`/clients/${alert.clientId}`)}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition flex items-center justify-center gap-1"
                    >
                      <Users size={12} /> View
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <OutreachModal
        alert={selected}
        onClose={() => setSelected(null)}
        onActionComplete={() => load(true)}
      />
    </div>
  );
};

export default RiskMonitor;
