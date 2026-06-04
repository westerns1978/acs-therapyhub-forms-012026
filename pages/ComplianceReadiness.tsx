import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import { AlertTriangle, ShieldCheck, CheckCircle2, HelpCircle, ChevronRight } from 'lucide-react';
import { fetchComplianceReadiness, type ComplianceReadiness } from '../services/complianceEngine';

const StatTile: React.FC<{ label: string; value: number; tone: string }> = ({ label, value, tone }) => (
  <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-slate-800/50 p-4">
    <p className={`text-3xl font-black ${tone}`}>{value}</p>
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{label}</p>
  </div>
);

const ComplianceReadiness: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<ComplianceReadiness | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const r = await fetchComplianceReadiness();
        if (!cancelled) setData(r);
      } catch (e) {
        console.warn('[ComplianceReadiness] load failed:', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (isLoading) {
    return <div className="max-w-6xl mx-auto py-16 text-center text-slate-400 text-sm font-bold uppercase tracking-widest">Computing compliance readiness…</div>;
  }
  if (!data) {
    return <div className="max-w-6xl mx-auto py-16 text-center text-slate-400 text-sm">Couldn’t load compliance readiness.</div>;
  }

  const { counts, flags, notEnforceable, clientsEvaluated, packId, packVersion } = data;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">Compliance Readiness</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-3xl">
          Deterministic Missouri compliance checks across {clientsEvaluated} active client{clientsEvaluated === 1 ? '' : 's'}.
          Every verdict is computed in code from the <span className="font-mono">{packId}</span> pack (v{packVersion}) — no AI. Advisory only.
        </p>
      </div>

      {/* Practice-wide counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Violations" value={counts.violation} tone="text-red-600" />
        <StatTile label="Warnings" value={counts.warning} tone="text-amber-600" />
        <StatTile label="Met" value={counts.met} tone="text-emerald-600" />
        <StatTile label="Not yet verifiable" value={counts.not_enforceable} tone="text-slate-400" />
      </div>

      {/* Surfaced flags — warning/violation */}
      <Card title="Active Compliance Flags" subtitle="Warnings and violations from real client data. Click to open the client.">
        <div className="space-y-3">
          {flags.length > 0 ? flags.map(f => {
            const isViolation = f.status === 'violation';
            const accent = isViolation ? 'text-red-600' : 'text-amber-600';
            const box = isViolation
              ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/20'
              : 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/20';
            return (
              <button
                key={f.id}
                onClick={() => navigate(`/clients/${f.clientId}`)}
                className={`w-full text-left flex items-start gap-4 p-4 border rounded-2xl transition-colors ${box}`}
              >
                <AlertTriangle className={`shrink-0 mt-1 ${accent}`} size={20} />
                <div className="min-w-0 flex-1">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${accent}`}>{f.status} · {f.clientName} · {f.program}</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">{f.headline}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{f.detail}</p>
                  <p className="text-[10px] font-mono text-slate-400 mt-1.5">{f.citation}</p>
                </div>
                <ChevronRight className="shrink-0 mt-1 text-slate-300 dark:text-slate-600" size={18} />
              </button>
            );
          }) : (
            <div className="flex items-center gap-3 py-6 justify-center text-emerald-600">
              <CheckCircle2 size={20} />
              <span className="text-xs font-bold uppercase tracking-widest">No active flags — every enforceable rule is met.</span>
            </div>
          )}
        </div>
      </Card>

      {/* Honest roadmap — what the engine can't verify yet and why */}
      <Card
        title="Not Yet Verifiable"
        subtitle="Rules the engine is ready to enforce but that need data the system doesn’t capture yet. Shown for transparency — not a compliance claim."
      >
        <div className="space-y-2">
          {notEnforceable.length > 0 ? notEnforceable.map(n => (
            <div key={n.ruleId} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-black/5 dark:border-white/5">
              <HelpCircle className="shrink-0 mt-0.5 text-slate-400" size={16} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {n.label}
                  <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400">{n.primitive}</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{n.reason}</p>
                <p className="text-[10px] font-mono text-slate-400 mt-1">{n.citation} · would apply to {n.clientCount} active client{n.clientCount === 1 ? '' : 's'}</p>
              </div>
            </div>
          )) : (
            <div className="text-center py-4 text-slate-400 text-xs font-bold uppercase tracking-widest">Nothing pending — all evaluated rules are backed by data.</div>
          )}
        </div>
      </Card>

      <p className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
        <ShieldCheck size={14} /> Verdicts are deterministic (engine-computed). Clara may explain a rule, but never decides compliance.
      </p>
    </div>
  );
};

export default ComplianceReadiness;
