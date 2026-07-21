/**
 * Public, login-free client upload page at /upload/{token}.
 *
 * 42 CFR Part 2: this page is unauthenticated and touches a treatment record, so it
 * exposes NO client identity — no name, no program, no level, nothing but the
 * requested-document label. It is standalone: mounted in App.tsx BEFORE the router,
 * with no staff shell, no nav, no session. Cream/maroon, mobile-first (opens on a phone).
 */
import React, { useEffect, useState } from 'react';
import { UploadCloud, CheckCircle2, Loader2, X, ShieldCheck } from 'lucide-react';
import { resolveUploadToken, submitUpload, type SubmitFile } from '../services/clientUploadLink';

const ACCEPT = 'image/*,application/pdf';
const MAX_FILES = 5;
const MAX_FILE_MB = 15;

type Phase = 'loading' | 'ready' | 'submitting' | 'done' | 'inactive';

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const ClientUploadPage: React.FC<{ token: string }> = ({ token }) => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [requestedLabel, setRequestedLabel] = useState('a document');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [inactiveMsg, setInactiveMsg] = useState('This link is no longer active. Please contact your counselor.');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await resolveUploadToken(token);
        if (cancelled) return;
        setRequestedLabel(res.requestedLabel || 'a document');
        setExpiresAt(res.expiresAt);
        setPhase('ready');
      } catch (e) {
        if (cancelled) return;
        // resolve returns a plain, PHI-free message for 404/410 — surface it as-is.
        setInactiveMsg(e instanceof Error ? e.message : 'This link is no longer active. Please contact your counselor.');
        setPhase('inactive');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setError('');
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!(f.type.startsWith('image/') || f.type === 'application/pdf')) {
        setError('Please use a photo or a PDF.');
        continue;
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`Each file must be under ${MAX_FILE_MB} MB.`);
        continue;
      }
      if (next.length >= MAX_FILES) { setError(`You can upload up to ${MAX_FILES} files.`); break; }
      next.push(f);
    }
    setFiles(next);
  };

  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!files.length) { setError('Please attach at least one file.'); return; }
    setPhase('submitting');
    try {
      const encoded: SubmitFile[] = await Promise.all(
        files.map(async f => ({ filename: f.name, mimeType: f.type, base64: await fileToBase64(f) })),
      );
      await submitUpload({ token, files: encoded });
      setPhase('done');
    } catch (err) {
      // A 410/404 mid-flight (link revoked/expired while the page was open) → inactive.
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      if (/no longer active|not valid/i.test(msg)) { setInactiveMsg(msg); setPhase('inactive'); return; }
      setError(msg);
      setPhase('ready');
    }
  };

  const expiryLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-background text-slate-800 flex flex-col font-sans antialiased">
      <header className="px-5 pt-10 pb-5 border-b border-hairline">
        <div className="max-w-lg mx-auto w-full">
          <div className="flex items-center gap-2 text-primary">
            <div className="p-2 bg-primary/10 rounded-xl"><UploadCloud size={18} /></div>
            <span className="text-[11px] font-black uppercase tracking-widest">Document upload</span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 py-7 max-w-lg mx-auto w-full">
        {phase === 'loading' && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm font-semibold">Checking your link…</p>
          </div>
        )}

        {phase === 'inactive' && (
          <div className="rounded-2xl border border-border bg-white p-6 space-y-2 shadow-card">
            <h1 className="text-lg font-black text-slate-900">Link no longer active</h1>
            <p className="text-sm text-slate-600 leading-relaxed">{inactiveMsg}</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 space-y-3 text-center shadow-card">
            <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-3xl flex items-center justify-center mx-auto">
              <CheckCircle2 size={30} className="text-[#1F7A4D]" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900">Received</h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              You can close this page. Your counselor will see it.
            </p>
          </div>
        )}

        {(phase === 'ready' || phase === 'submitting') && (
          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                You've been asked to upload a document:
              </h1>
              <p className="text-2xl font-black text-primary mt-1">{requestedLabel}</p>
              <p className="text-sm text-slate-500 mt-3">Takes a minute · no sign-in needed.</p>
              {expiryLabel && <p className="text-xs text-slate-400 mt-1">This link works until {expiryLabel}.</p>}
            </div>

            <div className="space-y-2">
              <label className="flex flex-col items-center justify-center min-h-[140px] px-4 py-6 rounded-2xl border-2 border-dashed border-border bg-white cursor-pointer hover:border-primary/40 transition-colors text-center">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary mb-2"><UploadCloud size={26} /></div>
                <span className="text-sm font-bold text-slate-800">Tap to add a photo or file</span>
                <span className="text-xs text-slate-500 mt-1">Photo or PDF · up to {MAX_FILES} files · {MAX_FILE_MB} MB each</span>
                <input
                  type="file"
                  accept={ACCEPT}
                  capture="environment"
                  multiple
                  disabled={phase === 'submitting'}
                  className="hidden"
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
                />
              </label>

              {files.length > 0 && (
                <ul className="space-y-2">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white border border-border text-sm">
                      <span className="truncate font-medium text-slate-700">{f.name}</span>
                      <button type="button" disabled={phase === 'submitting'} onClick={() => removeFile(i)} className="p-1 rounded-full text-slate-400 hover:text-primary shrink-0" aria-label={`Remove ${f.name}`}>
                        <X size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="flex items-start gap-2 text-xs text-slate-500 leading-relaxed">
              <ShieldCheck size={15} className="text-primary shrink-0 mt-0.5" />
              By uploading, you confirm this document is yours to share.
            </p>

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={phase === 'submitting' || files.length === 0}
              className="w-full min-h-[52px] rounded-2xl bg-primary hover:bg-primary-focus text-white text-[15px] font-black tracking-wide shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {phase === 'submitting' ? (<><Loader2 size={18} className="animate-spin" /> Sending…</>) : 'Send to my counselor'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
};

export default ClientUploadPage;
