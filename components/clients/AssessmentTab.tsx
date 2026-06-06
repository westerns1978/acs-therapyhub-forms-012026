import React, { useEffect, useMemo, useState } from 'react';
import Card from '../ui/Card';
import { supabase } from '../../services/supabase';
import {
  computePlacement,
  screeningValidity,
  SATOP_LEVEL_META,
  SROP_BAC_THRESHOLD,
  SROP_MIN_DUI_ARRESTS,
  type PlacementInputs,
  type UpgradeFactor,
} from '../../services/placementEngine';
import { Loader2, AlertTriangle, CheckCircle2, XCircle, Save, Info } from 'lucide-react';

/**
 * WS1 capture screen — typed assessment inputs + LIVE placement recommendation.
 *
 * The recommendation calls computePlacement() (the single source of truth) on every
 * keystroke; the rule is NEVER re-implemented here. WS1 commits no determination —
 * there is no sign-off button. The panel is labeled unmistakably as a recommendation.
 * No AI anywhere in this path.
 */

interface Props {
  client: { id: string; name?: string };
}

interface FormState {
  screening_date: string;
  offense_count: string;
  dui_arrest_count: string;
  bac: string;
  sud_diagnosis: boolean;
  dri2_result: string;
  dri2_date: string;
  prior_treatment: boolean;
  other_arrests: string;
  life_issues: boolean;
  notes: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const emptyForm = (): FormState => ({
  screening_date: todayLocal(),
  offense_count: '0',
  dui_arrest_count: '0',
  bac: '',
  sud_diagnosis: false,
  dri2_result: '',
  dri2_date: '',
  prior_treatment: false,
  other_arrests: '0',
  life_issues: false,
  notes: '',
});

const UPGRADE_LABELS: Record<UpgradeFactor, string> = {
  high_bac: 'High BAC',
  other_arrests: 'Other arrests',
  dri2_result: 'DRI-2 result on file',
  prior_treatment: 'Prior treatment',
  life_issues: 'Life issues',
};

const inputCls =
  'w-full px-3 py-2 rounded-xl border border-border dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40';
const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5';

const Toggle: React.FC<{ label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, hint, checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left transition ${
      checked
        ? 'border-primary/40 bg-primary/5'
        : 'border-border dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/40'
    }`}
  >
    <span>
      <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{label}</span>
      {hint && <span className="block text-[11px] text-slate-400 font-medium">{hint}</span>}
    </span>
    <span className={`shrink-0 w-10 h-6 rounded-full transition relative ${checked ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
    </span>
  </button>
);

const Condition: React.FC<{ met: boolean; label: string }> = ({ met, label }) => (
  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold ${
    met
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
  }`}>
    {met ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {label}
  </div>
);

const AssessmentTab: React.FC<Props> = ({ client }) => {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSavedAt(null);
  };

  // Load the latest captured inputs for this client (prefill), if any.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('assessment_inputs')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) setError(error.message);
      else if (data)
        setForm({
          screening_date: data.screening_date ?? todayLocal(),
          offense_count: String(data.offense_count ?? 0),
          dui_arrest_count: String(data.dui_arrest_count ?? 0),
          bac: data.bac == null ? '' : String(data.bac),
          sud_diagnosis: data.sud_diagnosis === true,
          dri2_result: data.dri2_result ?? '',
          dri2_date: data.dri2_date ?? '',
          prior_treatment: data.prior_treatment === true,
          other_arrests: String(data.other_arrests ?? 0),
          life_issues: data.life_issues === true,
          notes: data.notes ?? '',
        });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [client.id]);

  // LIVE recommendation — recomputed from the engine as fields change.
  const inputs: PlacementInputs = useMemo(
    () => ({
      offense_count: Number(form.offense_count) || 0,
      dui_arrest_count: Number(form.dui_arrest_count) || 0,
      bac: form.bac.trim() === '' ? null : Number(form.bac),
      sud_diagnosis: form.sud_diagnosis,
      prior_treatment: form.prior_treatment,
      other_arrests: Number(form.other_arrests) || 0,
      life_issues: form.life_issues,
      dri2_result: form.dri2_result,
    }),
    [form],
  );
  const result = useMemo(() => computePlacement(inputs), [inputs]);
  const validity = useMemo(() => screeningValidity(form.screening_date, new Date()), [form.screening_date]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) throw new Error('Your session expired — sign in again to save.');
      const { error: insErr } = await supabase.from('assessment_inputs').insert({
        client_id: client.id,
        screening_date: form.screening_date || todayLocal(),
        offense_count: Number(form.offense_count) || 0,
        dui_arrest_count: Number(form.dui_arrest_count) || 0,
        bac: form.bac.trim() === '' ? null : Number(form.bac),
        sud_diagnosis: form.sud_diagnosis,
        dri2_result: form.dri2_result.trim() || null,
        dri2_date: form.dri2_date || null,
        prior_treatment: form.prior_treatment,
        other_arrests: Number(form.other_arrests) || 0,
        life_issues: form.life_issues,
        notes: form.notes.trim() || null,
        created_by: uid, // attribution only
      });
      if (insErr) throw insErr;
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(e?.message || 'Could not save the assessment inputs.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const meta = SATOP_LEVEL_META[result.recommendedFloor];
  const baseMeta = SATOP_LEVEL_META[result.baseLevel];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* ── Inputs ── */}
      <div className="lg:col-span-3 space-y-6">
        <Card title="Screening Inputs">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Screening date</label>
                <input type="date" value={form.screening_date} onChange={(e) => set('screening_date', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Offense count</label>
                <input type="number" min="0" step="1" value={form.offense_count} onChange={(e) => set('offense_count', e.target.value)} className={inputCls} />
                <p className="text-[11px] text-slate-400 font-medium mt-1">1 → OEP · 2 → WIP · ≥3 → CIP</p>
              </div>
              <div>
                <label className={labelCls}>DUI arrests (w/ DOR administrative action)</label>
                <input type="number" min="0" step="1" value={form.dui_arrest_count} onChange={(e) => set('dui_arrest_count', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>BAC <span className="text-slate-300">(optional)</span></label>
                <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="e.g. 0.15" value={form.bac} onChange={(e) => set('bac', e.target.value)} className={inputCls} />
              </div>
            </div>

            <Toggle label="SUD diagnosis" hint="Clinical substance-use-disorder diagnosis present" checked={form.sud_diagnosis} onChange={(v) => set('sud_diagnosis', v)} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>DRI-2 result <span className="text-slate-300">(captured, never computed)</span></label>
                <input type="text" value={form.dri2_result} onChange={(e) => set('dri2_result', e.target.value)} placeholder="e.g. elevated" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>DRI-2 date</label>
                <input type="date" value={form.dri2_date} onChange={(e) => set('dri2_date', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Other arrests</label>
                <input type="number" min="0" step="1" value={form.other_arrests} onChange={(e) => set('other_arrests', e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Toggle label="Prior treatment" checked={form.prior_treatment} onChange={(v) => set('prior_treatment', v)} />
              <Toggle label="Life issues" checked={form.life_issues} onChange={(v) => set('life_issues', v)} />
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className={inputCls} />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-[12px] bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-2.5 text-rose-700 dark:text-rose-300">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              {savedAt && <span className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">Saved at {savedAt}</span>}
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm bg-primary text-white hover:bg-primary-focus transition disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save inputs
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Live recommendation ── */}
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-3 text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <Info size={16} className="shrink-0 mt-0.5" />
            <p className="text-[12px] font-bold leading-snug">
              Engine recommendation — <span className="underline">not a determination</span>. A clinician confirms or escalates this at sign-off (coming next).
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border dark:border-slate-700 bg-white dark:bg-slate-800 shadow-card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recommended floor</p>
          <p className="text-3xl font-black mt-1 text-primary dark:text-dark-primary">{meta.code}</p>
          <p className="text-sm font-bold text-slate-500 mt-0.5">{meta.label}</p>
          <p className="text-[11px] text-slate-400 mt-2">
            Base from offense count: <span className="font-bold">{baseMeta.code}</span> (Level {result.baseLevel}). A clinician may escalate above this floor at sign-off, never below it.
          </p>

          <div className="mt-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              SROP floor (Level IV) — {result.sropFloorApplies ? 'APPLIES' : 'not met'}
            </p>
            <div className="space-y-1.5">
              <Condition met={result.sropConditions.highBac} label={`BAC ≥ ${SROP_BAC_THRESHOLD}`} />
              <Condition met={result.sropConditions.repeatDuiArrests} label={`≥ ${SROP_MIN_DUI_ARRESTS} DUI arrests`} />
              <Condition met={result.sropConditions.sudDiagnosis} label="SUD diagnosis" />
            </div>
            <p className="text-[11px] text-slate-400 mt-2">All three required for the SROP hard floor.</p>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Upgrade factors (for clinician escalation)</p>
            {result.upgradeFactorsPresent.length === 0 ? (
              <p className="text-[12px] text-slate-400 italic">None present.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {result.upgradeFactorsPresent.map((f) => (
                  <span key={f} className="text-[11px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-primary/10 text-primary dark:text-dark-primary">
                    {UPGRADE_LABELS[f]}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Screening validity (separate from the placement decision) */}
        {validity && (
          <div
            className={`rounded-2xl border px-4 py-3 text-[12px] font-bold ${
              validity.expired
                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800'
                : 'bg-slate-50 text-slate-600 border-border dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
            }`}
          >
            <div className="flex items-start gap-2">
              {validity.expired ? <AlertTriangle size={15} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={15} className="shrink-0 mt-0.5" />}
              <span>
                {validity.expired
                  ? `Screening expired — re-screen required (valid through ${validity.validUntil}). Exceptions (judicial-review motion / second opinion) are applied by the clinician at sign-off.`
                  : `Screening valid through ${validity.validUntil} (${validity.daysRemaining} days remaining).`}
              </span>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border dark:border-slate-700 bg-background dark:bg-slate-900/40 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Rationale (facts)</p>
          <ul className="space-y-1">
            {result.rationale.map((r, i) => (
              <li key={i} className="text-[11px] font-medium text-slate-600 dark:text-slate-300 leading-snug">• {r}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AssessmentTab;
