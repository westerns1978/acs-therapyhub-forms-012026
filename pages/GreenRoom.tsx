import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Video, Mic, MicOff, Camera, ArrowLeft, ChevronDown, AlertCircle,
  FileText, ShieldAlert, Info, ArrowRight, Loader2,
  ClipboardList, Send, CheckSquare, Square, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { fetchGreenRoomSession, type GreenRoomData, type GreenRoomAttendee, type GreenRoomSession } from '../services/greenRoom';
import { distributeGroupNote } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

/* ── time helpers ───────────────────────────────────────────────────────────── */
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  if (sameDay(d, now)) return 'Today';
  if (sameDay(d, tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
};

const fmtCountdown = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};

/* ── tech check (real getUserMedia — honest failure state) ──────────────────── */
const TechCheck: React.FC = () => {
  const [state, setState] = useState<'idle' | 'checking' | 'ready' | 'denied'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [micLevel, setMicLevel] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    streamRef.current = null;
    audioCtxRef.current = null;
  };
  useEffect(() => stop, []);

  const run = async () => {
    setState('checking'); setErrMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
      // real mic level via AnalyserNode
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser(); analyser.fftSize = 256;
        src.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(buf);
          const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
          setMicLevel(Math.min(100, Math.round((avg / 140) * 100)));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch { /* meter is best-effort; camera/mic still "ready" */ }
      setState('ready');
    } catch (e: any) {
      setErrMsg(e?.name === 'NotAllowedError'
        ? 'Camera/microphone blocked — allow access in your browser, then run the check again.'
        : (e?.message || 'Could not access camera/microphone on this device.'));
      setState('denied');
    }
  };

  return (
    <div className="mt-5 border-t border-border/60 dark:border-slate-700/50 pt-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">Camera &amp; mic check</span>
        <button
          onClick={run}
          disabled={state === 'checking'}
          className="px-4 py-2 text-xs font-bold rounded-lg border border-border dark:border-slate-600 hover:border-primary hover:text-primary transition disabled:opacity-60"
        >
          {state === 'idle' ? 'Run check' : state === 'checking' ? 'Checking…' : state === 'ready' ? 'All good ✓' : 'Try again'}
        </button>
      </div>

      {state === 'denied' && (
        <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300">
          <MicOff size={15} className="mt-0.5 shrink-0" />
          <p className="text-xs font-medium leading-relaxed">{errMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className={`rounded-xl p-3 border ${state === 'ready' ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/15 dark:border-emerald-900/40' : 'border-border/60 dark:border-slate-700/50 bg-slate-50/60 dark:bg-slate-800/40'}`}>
          <div className={`flex items-center gap-2 text-xs font-bold ${state === 'ready' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}`}>
            <Camera size={13} /> Camera
          </div>
          {state === 'ready'
            ? <video ref={videoRef} muted playsInline className="mt-2 w-full h-20 object-cover rounded-lg bg-black -scale-x-100" />
            : <p className="text-xs text-slate-400 mt-1.5">{state === 'denied' ? 'Blocked' : 'Not tested'}</p>}
        </div>
        <div className={`rounded-xl p-3 border ${state === 'ready' ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/15 dark:border-emerald-900/40' : 'border-border/60 dark:border-slate-700/50 bg-slate-50/60 dark:bg-slate-800/40'}`}>
          <div className={`flex items-center gap-2 text-xs font-bold ${state === 'ready' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}`}>
            <Mic size={13} /> Microphone
          </div>
          {state === 'ready' ? (
            <>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1.5">Input detected</p>
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-2 overflow-hidden">
                <div className="h-full bg-emerald-500 transition-[width] duration-100" style={{ width: `${Math.max(4, micLevel)}%` }} />
              </div>
            </>
          ) : <p className="text-xs text-slate-400 mt-1.5">{state === 'denied' ? 'Blocked' : 'Not tested'}</p>}
        </div>
      </div>
    </div>
  );
};

/* ── roster card ────────────────────────────────────────────────────────────── */
const Chip: React.FC<{ tone: 'warn' | 'due' | 'muted'; children: React.ReactNode }> = ({ tone, children }) => {
  const cls = tone === 'warn'
    ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-900/15 dark:text-amber-300 dark:border-amber-900/40'
    : tone === 'due'
      ? 'bg-primary/10 text-primary border-primary/30'
      : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700';
  return <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border ${cls}`}>{children}</span>;
};

const Metric: React.FC<{ label: string; value: number; total: number; suffix?: string }> = ({ label, value, total, suffix }) => (
  <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-border/50 dark:border-slate-700/50 rounded-xl p-3">
    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div>
    <div className="font-black text-lg mt-0.5 tabular-nums">{value}<span className="text-xs font-medium text-slate-400">/{total}{suffix}</span></div>
    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-2 overflow-hidden">
      <div className="h-full bg-primary rounded-full" style={{ width: `${total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0}%` }} />
    </div>
  </div>
);

const ClientCard: React.FC<{ a: GreenRoomAttendee; defaultOpen: boolean }> = ({ a, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen);
  const p = a.progress;
  const established = p.established;
  const hoursToGo = p.requiredTotal != null ? Math.max(0, p.requiredTotal - p.completedTotal) : null;
  const counselingToGo = p.isSrop && p.counselingRequired != null ? Math.max(0, p.counselingRequired - p.counselingCompleted) : null;
  const daysToGo = p.isSrop && a.daysSinceEnrollment != null ? Math.max(0, 90 - a.daysSinceEnrollment) : null;

  return (
    <div className="border border-border/60 dark:border-slate-700/50 rounded-2xl my-2 overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
        <span className={`w-9 h-9 rounded-lg grid place-items-center text-sm font-black shrink-0 ${established ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>{a.initials}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-[15px] truncate">{a.name}</span>
          <span className="block text-xs text-slate-500 truncate">{a.programLabel}</span>
        </span>
        <ChevronDown size={18} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <div className="px-3.5 pb-3 flex flex-wrap gap-1.5">
        {established ? (
          <>
            {hoursToGo != null && hoursToGo > 0 && <Chip tone="warn">{hoursToGo} hrs to go</Chip>}
            {counselingToGo != null && counselingToGo > 0 && <Chip tone="warn">{counselingToGo} counseling to go</Chip>}
            {daysToGo != null && daysToGo > 0 && <Chip tone="warn">{daysToGo} days to go</Chip>}
            {a.balance > 0 && <Chip tone="due">Balance ${a.balance.toFixed(0)}</Chip>}
            {hoursToGo === 0 && counselingToGo !== null && counselingToGo === 0 && a.balance <= 0 && <Chip tone="muted">Hours &amp; balance met</Chip>}
          </>
        ) : (
          <Chip tone="muted">No determination on file</Chip>
        )}
      </div>

      {open && (
        <div className="px-3.5 pb-4 border-t border-border/50 dark:border-slate-700/50 pt-3">
          {established ? (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <Metric label="Total hours" value={p.completedTotal} total={p.requiredTotal ?? 0} />
                {p.isSrop && p.counselingRequired != null && (
                  <Metric label="Counseling" value={p.counselingCompleted} total={p.counselingRequired} />
                )}
                {p.isSrop && a.daysSinceEnrollment != null && (
                  <Metric label="Program days" value={a.daysSinceEnrollment} total={90} />
                )}
                <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-border/50 dark:border-slate-700/50 rounded-xl p-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Balance</div>
                  <div className="font-black text-lg mt-0.5 tabular-nums">${a.balance.toFixed(0)}<span className="text-xs font-medium text-slate-400"> {a.balance > 0 ? 'open' : 'clear'}</span></div>
                </div>
              </div>

              {a.lastNote ? (
                <div className="mt-3 bg-slate-50/70 dark:bg-slate-800/40 border border-border/50 dark:border-slate-700/50 border-l-[3px] border-l-primary rounded-lg p-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                    <FileText size={11} /> {a.lastNote.isSigned ? 'Last signed note' : 'Last note'} · {a.lastNote.noteType}
                  </div>
                  <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-4">{a.lastNote.snippet}</p>
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-400 italic">No clinical notes on file yet.</p>
              )}
              {!a.hasTreatmentPlan && <p className="mt-2 text-xs text-slate-400 italic">No treatment plan on file yet.</p>}
              <Link to={`/clients/${a.clientId}`} className="inline-block mt-3 text-[13px] font-bold text-primary hover:underline">Open full profile →</Link>
            </>
          ) : (
            <>
              <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-dashed border-border dark:border-slate-600 rounded-xl p-3.5 text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                <b className="text-slate-800 dark:text-slate-100">Placement not yet established.</b> Compliance tracking stays closed until a signed determination sets the level — so no hours target or progress shows. This is the gate failing safe, not missing data.
              </div>
              <Link to={`/clients/${a.clientId}`} className="inline-block mt-3 text-[13px] font-bold text-primary hover:underline">Begin determination →</Link>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/* ── group check-in → distribute one note to each present chart (WS2) ─────────── */
const GroupCheckInCard: React.FC<{ session: GreenRoomSession; attendees: GreenRoomAttendee[] }> = ({ session, attendees }) => {
  const { user } = useAuth();
  // "Who's in the room" — default everyone present. Toggling excludes an absent client.
  const [present, setPresent] = useState<Set<string>>(() => new Set(attendees.map((a) => a.clientId)));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ posted: string[]; alreadyPosted: string[]; failed: string[] } | null>(null);

  const nameOf = (cid: string) => attendees.find((a) => a.clientId === cid)?.name ?? 'a client';
  const toggle = (cid: string) =>
    setPresent((prev) => { const n = new Set(prev); if (n.has(cid)) n.delete(cid); else n.add(cid); return n; });

  const presentIds = attendees.map((a) => a.clientId).filter((cid) => present.has(cid));
  const failedIds = result?.failed ?? [];
  // Retry re-posts ONLY the failed set; already-posted seats stay skipped by the unique index.
  const retryMode = failedIds.length > 0;
  const targetIds = retryMode ? failedIds : presentIds;
  const canPost = !busy && note.trim().length > 0 && targetIds.length > 0;

  const post = async () => {
    if (!canPost) return;
    setBusy(true);
    try {
      const r = await distributeGroupNote(session.groupId!, session.startTime, note.trim(), targetIds, {
        therapistId: user?.id ?? null,
      });
      // Merge on retry so earlier successes/already-posted persist; only the failed set narrows.
      setResult((prev) => (retryMode && prev)
        ? {
            posted: Array.from(new Set([...prev.posted, ...r.posted])),
            alreadyPosted: Array.from(new Set([...prev.alreadyPosted, ...r.alreadyPosted])),
            failed: r.failed,
          }
        : r);
    } catch (e) {
      // Whole-call failure (e.g. roster resolve) — keep prior successes, mark the target set failed
      // so the panel stays open and offers a retry. Never silently swallow.
      console.error('[GreenRoom] distributeGroupNote failed:', e);
      setResult((prev) => ({ posted: prev?.posted ?? [], alreadyPosted: prev?.alreadyPosted ?? [], failed: targetIds }));
    } finally {
      setBusy(false);
    }
  };

  const postedCount = result?.posted.length ?? 0;
  const alreadyCount = result?.alreadyPosted.length ?? 0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-border dark:border-slate-700/50 rounded-2xl shadow-card p-5">
      <div className="flex gap-3 items-start">
        <span className="w-9 h-9 rounded-xl bg-primary/10 grid place-items-center text-primary shrink-0"><ClipboardList size={17} /></span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[13.5px]">Group check-in &amp; note</div>
          <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">Select who’s in the room, write one note, and post it to each present client’s chart. Re-posting is safe — a chart that already has this session’s note is skipped, never duplicated.</p>

          {/* who's in the room */}
          <div className="mt-3 space-y-1.5">
            {attendees.map((a) => {
              const on = present.has(a.clientId);
              return (
                <button
                  key={a.clientId}
                  type="button"
                  onClick={() => toggle(a.clientId)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition ${on ? 'border-primary/40 bg-primary/5' : 'border-border/60 dark:border-slate-700/50 bg-slate-50/60 dark:bg-slate-800/40 opacity-70'}`}
                >
                  {on ? <CheckSquare size={16} className="text-primary shrink-0" /> : <Square size={16} className="text-slate-400 shrink-0" />}
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-bold truncate">{a.name}</span>
                    <span className="block text-[11px] text-slate-500 truncate">{a.programLabel}</span>
                  </span>
                  <span className={`text-[10px] font-black uppercase tracking-wide ${on ? 'text-primary' : 'text-slate-400'}`}>{on ? 'Present' : 'Absent'}</span>
                </button>
              );
            })}
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="Group session note — posts to each present client’s chart…"
            className="mt-3 w-full px-3 py-2 rounded-xl border border-border dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
          />

          {/* result banners */}
          {result && (postedCount > 0 || alreadyCount > 0) && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
              <p className="text-xs font-medium leading-relaxed">
                Posted to {postedCount} chart{postedCount === 1 ? '' : 's'}.
                {alreadyCount > 0 && ` ${alreadyCount} already on chart.`}
              </p>
            </div>
          )}
          {result && failedIds.length > 0 && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <p className="text-xs font-medium leading-relaxed">
                Couldn’t post to: {failedIds.map(nameOf).join(', ')}. Retry to re-post just these.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={post}
            disabled={!canPost}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-primary text-white hover:bg-primary-focus transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {retryMode
              ? `Retry ${failedIds.length} failed`
              : `Post to ${targetIds.length} chart${targetIds.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── page ───────────────────────────────────────────────────────────────────── */
const GreenRoom: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<GreenRoomData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    fetchGreenRoomSession(appointmentId!)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e?.message || 'Could not load this session.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [appointmentId]);

  // 1s tick for the live countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return <div className="max-w-5xl mx-auto py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" size={20} /> Loading the green room…</div>;
  }
  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <AlertCircle className="mx-auto text-primary mb-4" size={40} />
        <h2 className="text-xl font-black">Couldn’t open this session</h2>
        <p className="text-slate-500 mt-2 text-sm">{error || 'This appointment could not be found.'}</p>
        <button onClick={() => navigate('/dashboard')} className="mt-6 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-focus transition">Back to Dashboard</button>
      </div>
    );
  }

  const { session, attendees } = data;
  const start = new Date(session.startTime).getTime();
  const end = session.endTime ? new Date(session.endTime).getTime() : start + 60 * 60000;
  const msToStart = start - now;
  const started = now >= start;
  const ended = now > end;
  const joinable = msToStart <= 2 * 60000; // within 2 min of start, during, or after
  const hasRoom = !!session.zoomLink;

  const joinLabel = !hasRoom ? 'No room link on file' : ended ? 'Open room' : started ? 'Join the room now' : joinable ? 'Join now' : 'Opens shortly';
  const cdText = ended ? '—' : started ? 'LIVE' : fmtCountdown(msToStart);
  const cdSub = ended ? 'This session’s scheduled time has passed.' : started ? 'Room is open.' : joinable ? 'You can enter the room early.' : 'Your permanent room is ready.';

  return (
    <div className="max-w-6xl mx-auto animate-fade-in-up">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-primary transition mb-5">
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      <div className="mb-6">
        <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.13em] text-primary mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Green Room
        </span>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">You’re about to go live.</h1>
        <p className="text-slate-500 mt-2 max-w-xl">Everything you need before this session — who’s in the room, where each client stands, and a one-tap join.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-5 items-start">
        {/* LEFT */}
        <div className="space-y-5">
          <div className="relative overflow-hidden bg-white dark:bg-slate-900 border border-border dark:border-slate-700/50 rounded-2xl shadow-card">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-primary-focus" />
            <div className="p-6 pt-7">
              <div className="flex justify-between items-start gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-black">{session.title}</h2>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[13px] text-slate-500">
                    <span>{dayLabel(session.startTime)}, {new Date(session.startTime).toLocaleDateString('en-US', { weekday: 'long' })} · <b className="text-slate-700 dark:text-slate-200">{fmtTime(session.startTime)}{session.endTime ? `–${fmtTime(session.endTime)}` : ''}</b></span>
                    {session.counselorName && <span>Counselor: <b className="text-slate-700 dark:text-slate-200">{session.counselorName}</b></span>}
                    <span><b className="text-slate-700 dark:text-slate-200">{attendees.length}</b> enrolled</span>
                  </div>
                </div>
                {session.serviceType === 'counseling' && (
                  <span className="text-[11px] font-black uppercase tracking-wide px-2.5 py-1.5 rounded-full bg-primary/10 text-primary whitespace-nowrap">Counts as counseling hrs</span>
                )}
              </div>

              <div className="my-6 p-5 bg-slate-50/70 dark:bg-slate-800/40 border border-border/60 dark:border-slate-700/50 rounded-2xl flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400">{ended ? 'Session' : started ? 'In session' : 'Session starts in'}</div>
                  <div className={`text-4xl font-black tabular-nums leading-none mt-1 ${started && !ended ? 'text-primary' : ''}`}>{cdText}</div>
                  <div className="text-[13px] text-slate-500 mt-1.5">{cdSub}</div>
                </div>
                <a
                  href={hasRoom ? session.zoomLink! : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!hasRoom || !joinable}
                  onClick={(e) => { if (!hasRoom || !joinable) e.preventDefault(); }}
                  className={`inline-flex items-center gap-2.5 font-black text-[15px] px-6 py-3.5 rounded-xl transition ${hasRoom && joinable ? 'bg-primary text-white hover:bg-primary-focus shadow-lg shadow-primary/25 cursor-pointer' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-default'}`}
                >
                  <Video size={18} /> {joinLabel}
                </a>
              </div>
              {hasRoom && (
                <p className="text-[12.5px] text-slate-400">
                  Permanent room · <code className="font-semibold text-slate-500">zoom.us/j/{session.zoomMeetingId || session.zoomLink?.split('/').pop()}</code> — the same room every week, no link to send.
                </p>
              )}

              <TechCheck />
            </div>
          </div>

          {/* presence — the honesty panel */}
          <div className="bg-white dark:bg-slate-900 border border-border dark:border-slate-700/50 rounded-2xl shadow-card p-5">
            <div className="flex gap-3 items-start">
              <span className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 border border-border/60 dark:border-slate-700/50 grid place-items-center text-slate-400 shrink-0"><Info size={17} /></span>
              <div>
                <div className="font-bold text-[13.5px]">Live attendance isn’t available yet</div>
                <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">We show the <b>enrolled roster</b> from the schedule. Who has actually joined the Zoom room would appear here only once a live participant feed is connected — we don’t guess or show a status we can’t confirm.</p>
                <span className="inline-block mt-2.5 text-[11px] font-black uppercase tracking-wide text-slate-400 bg-slate-50 dark:bg-slate-800 border border-border/60 dark:border-slate-700/50 px-2.5 py-1 rounded-md">Roster from schedule · live join pending</span>
              </div>
            </div>
          </div>

          {/* WS2 — group check-in: mark who's present, post one note to each present chart.
              Group sessions only; the individual note path stays SessionWrapUpModal. */}
          {session.isGroup && session.groupId && attendees.length > 0 && (
            <GroupCheckInCard session={session} attendees={attendees} />
          )}
        </div>

        {/* RIGHT — roster */}
        <div className="bg-white dark:bg-slate-900 border border-border dark:border-slate-700/50 rounded-2xl shadow-card">
          <div className="flex items-baseline justify-between px-5 pt-5 pb-1">
            <h2 className="text-base font-black">In this session</h2>
            <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">{attendees.length} client{attendees.length === 1 ? '' : 's'}</span>
          </div>
          <div className="px-3.5 pb-4">
            {attendees.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-10">No clients are enrolled in this session yet.</p>
            ) : (
              attendees.map((a, i) => <ClientCard key={a.clientId} a={a} defaultOpen={attendees.length <= 2 || i === 0} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GreenRoom;
