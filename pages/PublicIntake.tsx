import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../services/supabase';
import { INTAKE_FEE } from '../config/satopFees';
import { CheckCircle2, Loader2, AlertTriangle, ArrowRight, Lock } from 'lucide-react';

/**
 * Public front door (recon step 2–3): the unauthenticated self-serve intake.
 *
 * Flow (prospect-first — no orphan payment, no Stripe-function changes):
 *   1) POST name/phone/email/interest to `acs-intake-submit` (the service-role
 *      TRUST BOUNDARY) → it hardcodes status='prospect', program_type=NULL and
 *      returns the new prospect id.
 *   2) POST that id as client_id to the existing `acs-create-checkout` (TEST mode)
 *      with the flat INTAKE_FEE → redirect to Stripe test checkout.
 *   3) On return the webhook has linked the payment to the prospect via
 *      metadata.client_id; the prospect appears in the staff intake-queue tile.
 *
 * No clinical detail is collected here. The real program/level is set by a
 * clinician at placement — a prospect can never self-place. DEMO / synthetic only.
 */
const fnHeaders = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

const PublicIntake: React.FC = () => {
    const [form, setForm] = useState({ name: '', phone: '', email: '', interest: '' });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Return state from the Stripe round-trip (?payment=success|cancelled lands in
    // the query BEFORE the hash; HashRouter keeps #/intake in the fragment).
    const payment = useMemo(() => new URLSearchParams(window.location.search).get('payment'), []);

    const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!form.name.trim()) { setError('Please enter your name.'); return; }
        if (!form.phone.trim()) { setError('Please enter a phone number.'); return; }
        setSubmitting(true);
        try {
            // 1) Create the prospect (service-role edge function).
            const subRes = await fetch(`${SUPABASE_URL}/functions/v1/acs-intake-submit`, {
                method: 'POST',
                headers: fnHeaders,
                body: JSON.stringify({
                    name: form.name,
                    phone: form.phone,
                    email: form.email,
                    interest: form.interest,
                }),
            });
            const sub = await subRes.json();
            if (!subRes.ok || !sub.prospect_id) {
                throw new Error(sub?.detail || sub?.error || 'Could not submit your intake.');
            }

            // 2) Start the intake-fee checkout for that prospect (payment auto-links
            //    to the prospect via metadata.client_id — no orphan).
            const coRes = await fetch(`${SUPABASE_URL}/functions/v1/acs-create-checkout`, {
                method: 'POST',
                headers: fnHeaders,
                body: JSON.stringify({
                    client_id: sub.prospect_id,
                    client_email: form.email || undefined,
                    amount_cents: Math.round(INTAKE_FEE * 100),
                    description: 'ACS Intake / Assessment Fee',
                    return_url: window.location.href,
                }),
            });
            const co = await coRes.json();
            if (!coRes.ok || !co.checkout_url) {
                throw new Error(co?.detail || co?.error || 'Could not start the intake payment.');
            }
            window.location.href = co.checkout_url;
        } catch (err: any) {
            setError(err?.message || 'Something went wrong. Please try again.');
            setSubmitting(false);
        }
    };

    // ── Return states ─────────────────────────────────────────────────────────
    if (payment === 'success') {
        return (
            <Shell>
                <div className="text-center space-y-3">
                    <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 size={30} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Intake received</h1>
                    <p className="text-slate-600 leading-relaxed">
                        Thank you — your intake and assessment fee have been received. A member of
                        the ACS team will reach out to schedule your assessment and confirm your
                        program placement.
                    </p>
                    <Link to="/website" className="inline-flex items-center gap-1.5 text-primary font-semibold hover:underline">
                        Back to home <ArrowRight size={16} />
                    </Link>
                </div>
            </Shell>
        );
    }
    if (payment === 'cancelled') {
        return (
            <Shell>
                <div className="text-center space-y-3">
                    <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                        <AlertTriangle size={28} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Payment not completed</h1>
                    <p className="text-slate-600 leading-relaxed">
                        Your intake was saved but the assessment fee wasn’t completed, so your
                        enrollment is on hold. You can restart the payment any time.
                    </p>
                    <a href={`${window.location.origin}${window.location.pathname}#/intake`} onClick={() => window.location.reload()} className="inline-flex items-center gap-1.5 text-primary font-semibold hover:underline cursor-pointer">
                        Start over <ArrowRight size={16} />
                    </a>
                </div>
            </Shell>
        );
    }

    // ── Intake form ───────────────────────────────────────────────────────────
    return (
        <Shell>
            <div className="space-y-6">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-900">Start your intake</h1>
                    <p className="mt-2 text-slate-600 text-sm leading-relaxed">
                        Tell us a little about yourself and pay your one-time intake &amp; assessment
                        fee. A counselor confirms your program placement after a brief assessment.
                    </p>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <p className="text-xs font-medium leading-relaxed">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <Field label="Full name" required>
                        <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Jordan Smith" autoComplete="name" />
                    </Field>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Phone" required>
                            <input className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(555) 123-4567" autoComplete="tel" inputMode="tel" />
                        </Field>
                        <Field label="Email">
                            <input className={inputCls} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" autoComplete="email" />
                        </Field>
                    </div>
                    <Field label="What brings you here?">
                        <textarea className={`${inputCls} min-h-[88px] resize-y`} value={form.interest} onChange={(e) => set('interest', e.target.value)} placeholder="e.g. Court-referred for SATOP, or what you were told you need." />
                    </Field>

                    <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                        <span className="text-sm font-medium text-slate-600">Intake &amp; assessment fee</span>
                        <span className="text-lg font-bold text-slate-900">${INTAKE_FEE.toFixed(2)}</span>
                    </div>

                    <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white bg-primary hover:bg-primary-focus font-bold shadow-lg shadow-primary/20 transition disabled:opacity-60">
                        {submitting ? <Loader2 className="animate-spin" size={18} /> : <Lock size={16} />}
                        {submitting ? 'Starting secure checkout…' : 'Continue to payment'}
                    </button>
                    <p className="text-center text-[11px] text-slate-400">Secure payment via Stripe (test mode). No account needed.</p>
                </form>

                <div className="text-center text-sm border-t border-slate-200 pt-4">
                    <Link to="/portal/login" className="font-medium text-primary hover:underline">Already a client? Sign in</Link>
                </div>
            </div>
        </Shell>
    );
};

const inputCls = 'w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition';

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
    <div className="space-y-1">
        <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">{label}{required && <span className="text-red-500"> *</span>}</label>
        {children}
    </div>
);

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 p-4">
        <div className="w-full max-w-lg p-8 bg-white rounded-2xl shadow-xl border border-slate-200">
            <div className="text-center mb-6">
                <img src="https://storage.googleapis.com/gemynd-public/projects/acs-therapyhub/ACS%20Full%20Logomark.svg" alt="ACS" className="mx-auto h-12 object-contain" />
            </div>
            {children}
        </div>
    </div>
);

export default PublicIntake;
