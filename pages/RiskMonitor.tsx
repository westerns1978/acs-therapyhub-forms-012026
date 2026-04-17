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

const TIER_STYLE: Record<AlertTier, { badge: string; card: string; icon: string }> = {
  CRITICAL: { badge: 'bg-red-600 text-white',     card: 'border-red-200 dark:border-red-900/50',    icon: 'text-red-600' },
  HIGH:     { badge: 'bg-orange-500 text-white',  card: 'border-orange-200 dark:border-orange-900/50', icon: 'text-orange-600' },
  ELEVATED: { badge: 'bg-amber-400 text-slate-900', card: 'border-amber-200 dark:border-amber-900/50',  icon: 'text-amber-600' },
  MODERATE: { badge: 'bg-blue-400 text-white',    card: 'border-blue-200 dark:border-blue-900/50',    icon: 'text-blue-600' },
};

const TIER_LABEL: Record<AlertTier, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  ELEVATED: 'Elevated',
  MODERATE: 'Moderate',
};

const RiskMonitor: React.FC = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<ClientAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tierFilter, setTierFilter] = useState<AlertTier | 'ALL'>('ALL');
  const [selected, setSelected] = useState<ClientAlert | null>(null);

  const summary = useMemo(() => summarizeAlerts(alerts), [alerts]);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const data = await fetchAlerts();
    setAlerts(data);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = tierFilter === 'ALL' ? alerts : alerts.filter(a => a.tier === tierFilter);

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8 animate-fade-in-up">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tighter dark:text-white">Risk Monitor</h1>
          <p className="text-sm text-slate-500 mt-2">Actionable alerts computed from attendance, deadlines, and compliance state.</p>
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
          className={`p-4 rounded-2xl border-2 text-left transition ${tierFilter === 'ALL' ? 'border-slate-900 dark:border-white' : 'border-slate-100 dark:border-slate-800'}`}
        >
          <div className="text-3xl font-black tracking-tighter dark:text-white">{summary.total}</div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">All alerts</div>
        </button>
        {(['CRITICAL', 'HIGH', 'ELEVATED', 'MODERATE'] as const).map(t => {
          const count = summary[t.toLowerCase() as 'critical' | 'high' | 'elevated' | 'moderate'];
          const s = TIER_STYLE[t];
          return (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`p-4 rounded-2xl border-2 text-left transition ${tierFilter === t ? 'border-slate-900 dark:border-white' : 'border-slate-100 dark:border-slate-800'}`}
            >
              <div className={`text-3xl font-black tracking-tighter ${s.icon}`}>{count}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{TIER_LABEL[t]}</div>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 size={24} className="animate-spin mr-3" />
          <span className="text-sm font-bold uppercase tracking-widest">Computing alerts…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-emerald-50 dark:bg-emerald-900/10 rounded-3xl border border-emerald-100 dark:border-emerald-900/30">
          <Shield size={48} className="mx-auto mb-4 text-emerald-500" />
          <p className="text-sm font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">All clear at this tier</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">No alerts require attention right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(alert => {
            const s = TIER_STYLE[alert.tier];
            return (
              <div
                key={alert.id}
                className={`p-5 bg-white dark:bg-slate-900 border-2 ${s.card} rounded-2xl shadow-sm hover:shadow-md transition-all`}
              >
                <div className="flex items-start gap-4">
                  <AlertTriangle size={20} className={`${s.icon} mt-1 shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${s.badge}`}>{TIER_LABEL[alert.tier]}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{alert.program}</span>
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
