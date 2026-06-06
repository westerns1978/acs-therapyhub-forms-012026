import React, { useEffect, useMemo, useState } from 'react';
import Card from '../ui/Card';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { isClinicianRole } from '../../types';
import type { SatopLevel } from '../../config/satopFees';
import {
  computePlacement,
  screeningValidity,
  SATOP_LEVEL_META,
  SATOP_LEVEL_ORDER,
  SROP_BAC_THRESHOLD,
  SROP_MIN_DUI_ARRESTS,
  type PlacementInputs,
  type UpgradeFactor,
} from '../../services/placementEngine';
import { Loader2, AlertTriangle, CheckCircle2, XCircle, Save, Info, ShieldCheck, Lock, PenLine, ArrowUp, Ban, History, FileCheck } from 'lucide-react';
import DocumentPreviewModal from './DocumentPreviewModal';
import { buildCimorPacketDoc, cimorPacketFileName, fetchCimorNarrative, type NarrativeContext } from '../../services/cimorPacket';

/**
 * WS1 capture screen + WS2 clinician sign-off.
 *
 * The recommendation calls computePlacement() (the single source of truth) on every
 * keystroke; the rule is NEVER re-implemented here. The DETERMINATION is a separate,
 * deliberate clinical act: a clinician confirms the engine floor or escalates ABOVE
 * it (reason required). Below-floor is NOT available in-app (a §3(E) department
 * approval, not a free-text downgrade) — no downgrade control is rendered at all.
 *
 * Narrate-only: the level comes ONLY from computePlacement. There is NO AI anywhere
 * in this file. Append-only: a change is a NEW determination that supersedes the
 * prior via supersedes_id — the UI never edits or voids a signed row. The clinician
 * gate (isClinicianRole) mirrors the table's pd_insert_clinician RLS policy exactly.
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

type Disposition = 'confirmed' | 'escalated' | 'exception_below_floor';

interface Determination {
  id: string;
  client_id: string;
  assessment_input_id: string;
  engine_recommended_level: SatopLevel;
  determined_level: SatopLevel;
  basis_snapshot: any;
  disposition: Disposition;
  deviation_reason: string | null;
  exception_ref: string | null;
  determined_by: string | null;
  determined_at: string;
  status: 'signed' | 'voided';
  supersedes_id: string | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const fmtDateTime = (s?: string | null): string => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
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

const LevelPill: React.FC<{ level: SatopLevel; tone?: 'primary' | 'amber' | 'slate' }> = ({ level, tone = 'slate' }) => {
  const m = SATOP_LEVEL_META[level];
  const cls =
    tone === 'primary'
      ? 'bg-primary/10 text-primary dark:text-dark-primary'
      : tone === 'amber'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black ${cls}`}>{m.code} · Level {level}</span>;
};

const DispositionBadge: React.FC<{ d: Disposition }> = ({ d }) =>
  d === 'confirmed' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Confirmed</span>
  ) : d === 'escalated' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"><ArrowUp size={11} /> Escalated</span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">Below-floor</span>
  );

const AssessmentTab: React.FC<Props> = ({ client }) => {
  const { user } = useAuth();
  const isClinician = isClinicianRole(user?.role);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Save-then-sign tracking: which persisted assessment_inputs row the live form
  // currently corresponds to, and whether there are unsaved edits since then.
  const [loadedInputId, setLoadedInputId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Determinations (WS2).
  const [determinations, setDeterminations] = useState<Determination[]>([]);
  const [detsError, setDetsError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [escalateLevel, setEscalateLevel] = useState<SatopLevel | ''>('');
  const [escalateReason, setEscalateReason] = useState('');

  // CIMOR packet (Phase 3) — built from the SIGNED determination only.
  const [packetOpen, setPacketOpen] = useState(false);
  const [packetBusy, setPacketBusy] = useState(false);
  const [packetClient, setPacketClient] = useState<any>(null);
  const [packetDet, setPacketDet] = useState<Determination | null>(null);
  const [packetSummary, setPacketSummary] = useState<string | null>(null);
  const [packetError, setPacketError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSavedAt(null);
    setDirty(true);
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
      else if (data) {
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
        setLoadedInputId(data.id);
      } else {
        setLoadedInputId(null);
      }
      setDirty(false);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [client.id]);

  const loadDeterminations = async () => {
    setDetsError(null);
    const { data, error } = await supabase
      .from('placement_determinations')
      .select('*')
      .eq('client_id', client.id)
      .order('determined_at', { ascending: false });
    if (error) setDetsError(error.message);
    else setDeterminations((data ?? []) as Determination[]);
  };

  useEffect(() => {
    loadDeterminations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // "Current" determination = the latest signed row with NO successor (derived,
  // never a stored mutation). A row is superseded iff some other row points at it.
  const supersededIds = useMemo(
    () => new Set(determinations.filter((d) => d.supersedes_id).map((d) => d.supersedes_id as string)),
    [determinations],
  );
  const current = useMemo(
    () => determinations.find((d) => d.status === 'signed' && !supersededIds.has(d.id)) ?? null,
    [determinations, supersededIds],
  );

  // Levels strictly above the engine floor (the only legal escalation targets).
  const higherLevels = useMemo(
    () =>
      (Object.keys(SATOP_LEVEL_ORDER) as SatopLevel[])
        .filter((l) => SATOP_LEVEL_ORDER[l] > SATOP_LEVEL_ORDER[result.recommendedFloor])
        .sort((a, b) => SATOP_LEVEL_ORDER[a] - SATOP_LEVEL_ORDER[b]),
    [result.recommendedFloor],
  );

  /** Insert the current form as a NEW assessment_inputs row; returns its id. */
  const persistInputs = async (): Promise<string> => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) throw new Error('Your session expired — sign in again to save.');
    const { data, error: insErr } = await supabase
      .from('assessment_inputs')
      .insert({
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
      })
      .select('id')
      .single();
    if (insErr) throw insErr;
    setLoadedInputId(data.id);
    setDirty(false);
    return data.id;
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await persistInputs();
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(e?.message || 'Could not save the assessment inputs.');
    } finally {
      setSaving(false);
    }
  };

  /** Ensure the signed determination binds to a persisted basis (save-then-sign). */
  const ensureSavedBasis = async (): Promise<string> => {
    if (loadedInputId && !dirty) return loadedInputId;
    return await persistInputs();
  };

  const signDetermination = async (disposition: Disposition, determinedLevel: SatopLevel, reason: string) => {
    setSigning(true);
    setSignError(null);
    setSignedAt(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) throw new Error('Your session expired — sign in again to sign.');

      // Save-then-sign: bind to a concrete persisted assessment_inputs row.
      const basisId = await ensureSavedBasis();

      // Immutable provenance frozen at sign time (so a later inputs edit can't
      // change what was signed). The level comes ONLY from the engine result.
      const basis_snapshot = {
        screening_date: form.screening_date,
        inputs: {
          offense_count: Number(form.offense_count) || 0,
          dui_arrest_count: Number(form.dui_arrest_count) || 0,
          bac: form.bac.trim() === '' ? null : Number(form.bac),
          sud_diagnosis: form.sud_diagnosis,
          prior_treatment: form.prior_treatment,
          other_arrests: Number(form.other_arrests) || 0,
          life_issues: form.life_issues,
          dri2_result: form.dri2_result.trim() || null,
        },
        engine: {
          baseLevel: result.baseLevel,
          recommendedFloor: result.recommendedFloor,
          sropFloorApplies: result.sropFloorApplies,
          sropConditions: result.sropConditions,
          upgradeFactorsPresent: result.upgradeFactorsPresent,
          rationale: result.rationale,
        },
        signed_by: { id: uid, name: user?.name ?? null },
      };

      const { error: insErr } = await supabase.from('placement_determinations').insert({
        client_id: client.id,
        assessment_input_id: basisId,
        engine_recommended_level: result.recommendedFloor,
        determined_level: determinedLevel,
        basis_snapshot,
        disposition,
        deviation_reason: disposition === 'escalated' ? reason.trim() : null,
        determined_by: uid,
        supersedes_id: current?.id ?? null, // append-only supersede; null for the first
      });
      if (insErr) throw insErr;

      setEscalateLevel('');
      setEscalateReason('');
      setSignedAt(new Date().toLocaleTimeString());
      await loadDeterminations();
    } catch (e: any) {
      setSignError(e?.message || 'Could not sign the determination.');
    } finally {
      setSigning(false);
    }
  };

  /** Prepare the CIMOR packet for the CURRENT signed determination (never an unsigned state). */
  const openCimorPacket = async () => {
    if (!current) return;
    setPacketBusy(true);
    setPacketError(null);
    try {
      // Client identifiers for the packet (is_staff can read clients).
      const { data: cli } = await supabase.from('clients').select('*').eq('id', client.id).maybeSingle();
      const inp = (current.basis_snapshot && current.basis_snapshot.inputs) || {};
      const ctx: NarrativeContext = {
        multipleOffenses: Number(inp.offense_count) > 1,
        repeatDuiArrests: Number(inp.dui_arrest_count) >= 2,
        elevatedBac: inp.bac != null && Number(inp.bac) >= 0.15,
        sudDiagnosis: inp.sud_diagnosis === true,
        priorTreatment: inp.prior_treatment === true,
        lifeIssues: inp.life_issues === true,
      };
      // The ONE AI touch — guarded + ephemeral; null on AI-down or a guard trip, in
      // which case the packet renders deterministic-only.
      const summary = await fetchCimorNarrative(ctx);
      setPacketClient(cli || { id: client.id, name: client.name });
      setPacketDet(current);
      setPacketSummary(summary);
      setPacketOpen(true);
    } catch (e: any) {
      setPacketError(e?.message || 'Could not prepare the packet.');
    } finally {
      setPacketBusy(false);
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
  const recCode = meta.code;
  const canSignEscalation = !!escalateLevel && escalateReason.trim().length > 0 && !signing;

  return (
    <div className="space-y-6">
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
                {dirty && !savedAt && <span className="text-[12px] font-bold text-amber-600 dark:text-amber-400">Unsaved changes</span>}
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
                Engine recommendation — <span className="underline">not a determination</span>. A clinician confirms or escalates it in the sign-off panel below.
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

      {/* ── WS2: Clinical determination (sign-off) ── */}
      <Card title="Clinical Determination — Sign-off">
        <div className="space-y-5">
          {/* Demo / Karen-LPC gate */}
          <div className="flex items-start gap-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-amber-900 dark:text-amber-200">
            <ShieldCheck size={15} className="shrink-0 mt-0.5" />
            <p className="text-[12px] font-bold leading-snug">
              Demo only — sample clients. This signed-determination workflow, including the escalation and below-floor handling, must be reviewed and approved by <span className="underline">Karen Ventimiglia, LPC</span> before use with any real client. The level is taken only from the deterministic engine; no AI is involved.
            </p>
          </div>

          {detsError && (
            <div className="flex items-start gap-2 text-[12px] bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-2.5 text-rose-700 dark:text-rose-300">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span className="leading-snug">{detsError}</span>
            </div>
          )}

          {/* Current determination */}
          {current ? (
            <div className="rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-900/15 p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Current determination</span>
                <DispositionBadge d={current.disposition} />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{SATOP_LEVEL_META[current.determined_level].code}</span>
                <span className="text-sm font-bold text-slate-500">{SATOP_LEVEL_META[current.determined_level].label}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Engine recommended <LevelPill level={current.engine_recommended_level} tone="slate" /> at sign time.
              </p>
              {current.disposition === 'escalated' && current.deviation_reason && (
                <p className="text-[12px] text-slate-700 dark:text-slate-200 mt-2 leading-snug">
                  <span className="font-black uppercase tracking-widest text-[10px] text-slate-400">Reason</span><br />
                  {current.deviation_reason}
                </p>
              )}
              <p className="text-[11px] text-slate-400 mt-2">
                Signed by {current.basis_snapshot?.signed_by?.name ?? 'clinician'} · {fmtDateTime(current.determined_at)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={openCimorPacket}
                  disabled={packetBusy}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm bg-primary text-white hover:bg-primary-focus transition disabled:opacity-60"
                >
                  {packetBusy ? <Loader2 size={15} className="animate-spin" /> : <FileCheck size={15} />} CIMOR packet
                </button>
                <span className="text-[11px] text-slate-400">Deterministic packet from this signed determination — preview before saving.</span>
              </div>
              {packetError && (
                <div className="mt-2 flex items-start gap-2 text-[12px] bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-2.5 text-rose-700 dark:text-rose-300">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span className="leading-snug">{packetError}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 text-[12px] text-slate-500 dark:text-slate-400 font-medium">
              No determination signed yet — the engine recommendation above is a recommendation, not a determination of record.
            </div>
          )}

          {/* Sign controls — clinician only (mirrors pd_insert_clinician RLS) */}
          {isClinician ? (
            <div className="rounded-2xl border border-border dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <PenLine size={16} className="text-primary" />
                <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {current ? 'Supersede the current determination' : 'Sign a determination'}
                </h4>
              </div>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-snug">
                Engine recommends <LevelPill level={result.recommendedFloor} tone="primary" />.
                {current ? ' Signing again creates a new determination of record; the prior is kept and marked superseded (never edited).' : ' Confirm the floor, or escalate above it with a required reason.'}
                {dirty && ' Unsaved input edits will be saved first so the determination binds to a persisted basis.'}
              </p>

              {/* Confirm */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/15 px-3 py-3">
                <div className="text-[12px] font-bold text-slate-700 dark:text-slate-200">
                  Confirm at the engine floor — <LevelPill level={result.recommendedFloor} tone="primary" />
                </div>
                <button
                  onClick={() => signDetermination('confirmed', result.recommendedFloor, '')}
                  disabled={signing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-60 shrink-0"
                >
                  {signing ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Confirm {recCode}
                </button>
              </div>

              {/* Escalate */}
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10 px-3 py-3 space-y-3">
                <div className="flex items-center gap-1.5 text-[12px] font-black text-amber-800 dark:text-amber-200">
                  <ArrowUp size={14} /> Escalate above the floor
                </div>
                {higherLevels.length === 0 ? (
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 italic">
                    Already at the SROP ceiling (Level IV) — there is no higher level to escalate to.
                  </p>
                ) : (
                  <>
                    <div>
                      <label className={labelCls}>Escalate to</label>
                      <div className="flex flex-wrap gap-2">
                        {higherLevels.map((l) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setEscalateLevel(l)}
                            className={`px-3 py-1.5 rounded-xl text-[12px] font-black border transition ${
                              escalateLevel === l
                                ? 'border-amber-400 bg-amber-100 text-amber-900 dark:bg-amber-800/40 dark:text-amber-100'
                                : 'border-border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                            }`}
                          >
                            {SATOP_LEVEL_META[l].code} · Level {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Reason for escalation <span className="text-rose-400">(required)</span></label>
                      <textarea
                        value={escalateReason}
                        onChange={(e) => setEscalateReason(e.target.value)}
                        rows={2}
                        placeholder="Clinical rationale for placing above the engine floor…"
                        className={inputCls}
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => escalateLevel && signDetermination('escalated', escalateLevel, escalateReason)}
                        disabled={!canSignEscalation}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm bg-amber-600 text-white hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {signing ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={15} />}
                        Sign escalation{escalateLevel ? ` to ${SATOP_LEVEL_META[escalateLevel].code}` : ''}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Below recommendation — BLOCKED (no control rendered) */}
              <div className="flex items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-3 text-slate-600 dark:text-slate-300">
                <Ban size={15} className="shrink-0 mt-0.5 text-slate-400" />
                <p className="text-[12px] leading-snug">
                  <span className="font-black">Below the engine recommendation is not available in-app.</span> A determination below the recommended floor requires a <span className="font-bold">§3(E) department-approval exception</span> (9 CSR 30-3.206) — a structured, gated pathway, not a free-text downgrade. There is intentionally no in-app control to place below the floor.
                </p>
              </div>

              {signError && (
                <div className="flex items-start gap-2 text-[12px] bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-2.5 text-rose-700 dark:text-rose-300">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span className="leading-snug">{signError}</span>
                </div>
              )}
              {signedAt && (
                <p className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400 text-right">Determination signed at {signedAt}.</p>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-3 text-slate-600 dark:text-slate-300">
              <Lock size={15} className="shrink-0 mt-0.5 text-slate-400" />
              <p className="text-[12px] leading-snug">
                <span className="font-black">Sign-off is clinician-only (Director / Therapist).</span> You can review the determination history below, but signing a determination is restricted to a clinician — the same rule the database enforces.
              </p>
            </div>
          )}

          {/* History */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <History size={14} className="text-slate-400" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Determination history</p>
            </div>
            {determinations.length === 0 ? (
              <p className="text-[12px] text-slate-400 italic">No determinations yet.</p>
            ) : (
              <ul className="space-y-2">
                {determinations.map((d) => {
                  const isCurrent = d.id === current?.id;
                  const isSuperseded = supersededIds.has(d.id);
                  return (
                    <li
                      key={d.id}
                      className={`rounded-xl border px-3 py-2.5 ${
                        isCurrent
                          ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-900/10'
                          : 'border-border dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <LevelPill level={d.determined_level} tone={d.disposition === 'escalated' ? 'amber' : 'primary'} />
                          <DispositionBadge d={d.disposition} />
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white">Current</span>
                          )}
                          {isSuperseded && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-300 text-slate-700 dark:bg-slate-600 dark:text-slate-200">Superseded</span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">{fmtDateTime(d.determined_at)}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Engine recommended {SATOP_LEVEL_META[d.engine_recommended_level].code} · signed by {d.basis_snapshot?.signed_by?.name ?? 'clinician'}
                      </p>
                      {d.disposition === 'escalated' && d.deviation_reason && (
                        <p className="text-[12px] text-slate-700 dark:text-slate-200 mt-1 leading-snug">{d.deviation_reason}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Card>

      {packetOpen && packetDet && packetClient && (
        <DocumentPreviewModal
          kind="cimor"
          isOpen={packetOpen}
          onClose={() => setPacketOpen(false)}
          build={() => buildCimorPacketDoc({ client: packetClient, determination: packetDet!, aiSummary: packetSummary })}
          fileName={cimorPacketFileName(packetClient, packetDet)}
          title="CIMOR Submission Packet"
          rebuildKey={packetDet.id + (packetSummary ? ':p' : ':n')}
        />
      )}
    </div>
  );
};

export default AssessmentTab;
