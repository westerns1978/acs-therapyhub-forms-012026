import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import { AlertTriangle, ShieldCheck, CheckCircle2, HelpCircle, ChevronRight, RefreshCw } from 'lucide-react';
import { fetchComplianceReadiness, type ComplianceReadiness } from '../services/complianceEngine';
import { programLabel } from '../config/programVocab';

// Raw verdict tokens ('violation') must never print — mapped labels only (2026-07-28).
const VERDICT_LABEL: Record<'warning' | 'violation', string> = { warning: 'Warning', violation: 'Violation' };

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setLoadError(null);
      // Fail-visibly: the engine THROWS on query failure (2026-07-28). A failed load
      // must render as a failed load — never as "0 violations / every rule met".
      try {
        const r = await fetchComplianceReadiness();
        if (!cancelled) setData(r);
      } catch (e: any) {
        console.warn('[ComplianceReadiness] load failed:', e);
        if (!cancelled) { setData(null); setLoadError(e?.message || 'Unknown error'); }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  if (isLoading) {
    return <div className="max-w-6xl mx-auto py-16 text-center text-slate-400 text-sm font-bold uppercase tracking-widest">Computing compliance readiness…</div>;
  }
  if (!data) {
    return (
      <div className="max-w-6xl mx-auto py-16">
        <div className="flex flex-col items-center gap-3 p-8 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl text-center">
          <AlertTriangle size={24} className="text-rose-600" />
          <p className="text-sm font-bold text-rose-700 dark:text-rose-300">Compliance readiness could not be computed — the data didn’t load.</p>
          <p className="text-xs text-rose-600/80 dark:text-rose-400/80 max-w-md">No verdicts are being shown because none were evaluated. This is a loading failure, not a clean bill of health.{loadError ? ` (${loadError})` : ''}</p>
          <button
            onClick={() => setReloadKey(k => k + 1)}
            className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-black uppercase tracking-widest text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
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
        <StatTile label="Violations" value={counts.violation} tone="text-danger-600" />
        <StatTile label="Warnings" value={counts.warning} tone="text-warning-600" />
        <StatTile label="Met" value={counts.met} tone="text-success-600" />
        <StatTile label="Not yet verifiable" value={counts.not_enforceable} tone="text-slate-400" />
      </div>

      {/* Surfaced flags — warning/violation */}
      <Card title="Active Guardrails" subtitle="Warnings and violations from real client data. Click to open the client.">
        <div className="space-y-3">
          {flags.length > 0 ? flags.map(f => {
            const isViolation = f.status === 'violation';
            const accent = isViolation ? 'text-danger-600' : 'text-warning-600';
            const box = isViolation
              ? 'bg-danger-50 dark:bg-danger-900/10 border-danger-100 dark:border-danger-900/30 hover:bg-danger-100 dark:hover:bg-danger-900/20'
              : 'bg-warning-50 dark:bg-warning-900/10 border-warning-100 dark:border-warning-900/30 hover:bg-warning-100 dark:hover:bg-warning-900/20';
            return (
              <button
                key={f.id}
                onClick={() => navigate(`/clients/${f.clientId}`)}
                className={`w-full text-left flex items-start gap-4 p-4 border rounded-2xl transition-colors ${box}`}
              >
                <AlertTriangle className={`shrink-0 mt-1 ${accent}`} size={20} />
                <div className="min-w-0 flex-1">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${accent}`}>{VERDICT_LABEL[f.status]} · {f.clientName} · {programLabel(f.program)}</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">{f.headline}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{f.detail}</p>
                  <p className="text-[10px] font-mono text-slate-400 mt-1.5">{f.citation}</p>
                </div>
                <ChevronRight className="shrink-0 mt-1 text-slate-300 dark:text-slate-600" size={18} />
              </button>
            );
          }) : (
            <div className="flex items-center gap-3 py-6 justify-center text-success-600">
              <CheckCircle2 size={20} />
              <span className="text-xs font-bold uppercase tracking-widest">No guardrails triggered — every enforceable rule is met.</span>
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
