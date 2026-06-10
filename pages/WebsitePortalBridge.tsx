
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Phone, Shield, Clock, FileText, CreditCard, BarChart, Heart, CheckCircle2, MapPin, Lock, Users, Award, CalendarDays, ClipboardCheck } from 'lucide-react';

/**
 * The pane of glass — the public seam between stlacs.com and TherapyHub.
 *
 * Their website says "Start your SATOP license reinstatement here." This page is
 * the other side of that sentence: FINISH here. Two doors — the client completing
 * a program (primary) and ACS staff (quieter secondary) — sharing one goal: program
 * completion (a certificate in most cases, or honest reporting back to a court,
 * employer, or probation officer).
 *
 * Design language adopted from ACS's 2026 site redesign (reference a01.PNG):
 *   ink #242321 · red #C62828 (CTAs/accents ONLY, never headline words) ·
 *   warm off-white #F6F6F4 · pill nav with the red phone capsule · trust chips
 *   (State-certified · Court-accepted · Confidential) · the Since-2003 line.
 * Typeface: IBM Plex Sans (closest clean match to the reference's editorial
 * headline), injected below — scoped to this page; the woff2 only downloads here.
 *
 * HONESTY RULE (this is the product's front door): the portal mockup card shows
 * ONLY real product shapes — the engine's actual hours framing (16/75 incl.
 * counseling — the real demo baseline), real FORM_REGISTRY titles, and the real
 * completion-gate story. No fabricated percentages, no dead features, no browser
 * chrome claiming an unconfirmed domain.
 */

const PLEX_LINK_ID = 'acs-landing-plex-font';
const RED = '#C62828';
const INK = '#242321';

const WebsitePortalBridge: React.FC = () => {
    const navigate = useNavigate();
    const logoUrl = "https://storage.googleapis.com/westerns1978-digital-assets/Websites/acs-therapy/ACS-Logo1.svg";

    // Page-scoped webfont: inject once, keep (removing on unmount would refetch on
    // every visit). Only this page's font-family matches it, so other routes never
    // download the woff2.
    useEffect(() => {
        if (document.getElementById(PLEX_LINK_ID)) return;
        const link = document.createElement('link');
        link.id = PLEX_LINK_ID;
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap';
        document.head.appendChild(link);
    }, []);

    const navLinks = [
        { label: 'Portal', href: '#top', active: true },
        { label: 'Features', href: '#features', active: false },
        { label: 'How it works', href: '#how', active: false },
        { label: 'Programs', href: '#programs', active: false },
        { label: 'Contact', href: '#contact', active: false },
    ];

    return (
        <div id="top" className="min-h-screen bg-[#F6F6F4] text-[#242321]" style={{ fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" }}>

            {/* ── Pill nav — floating bar, red phone capsule (reference language) ── */}
            <header className="sticky top-0 z-50 px-4 pt-4 pb-2 bg-[#F6F6F4]/90 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto bg-white rounded-full shadow-sm border border-black/5 pl-5 pr-2 py-2 flex items-center justify-between gap-3">
                    <img src={logoUrl} alt="Assessment & Counseling Solutions" className="h-9 object-contain" />
                    <nav className="hidden md:flex items-center gap-1 bg-[#F1F0ED] rounded-full p-1">
                        {navLinks.map((l) => (
                            <a
                                key={l.label}
                                href={l.href}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${l.active
                                    ? 'bg-white text-[#242321] shadow-sm'
                                    : 'text-[#52514E] hover:text-[#242321]'}`}
                            >
                                {l.label}
                            </a>
                        ))}
                    </nav>
                    <a
                        href="tel:3148492800"
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full text-white font-bold text-sm shadow-md hover:opacity-90 transition-all"
                        style={{ backgroundColor: RED }}
                    >
                        <Phone size={15} /> 314-849-2800
                    </a>
                </div>
            </header>

            {/* ── Hero — finish what you started; the two doors ── */}
            <section className="relative">
                <div className="max-w-7xl mx-auto px-6 pt-14 pb-20 grid lg:grid-cols-2 gap-14 items-center">
                    <div className="space-y-7">
                        {/* Eyebrow with the reference's red slashes */}
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#242321]">
                            <span style={{ color: RED }}>/</span>&nbsp; For enrolled clients &amp; ACS staff &nbsp;<span style={{ color: RED }}>/</span>
                        </p>

                        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.04] tracking-[-0.03em] text-[#242321]">
                            Finish what you started.
                        </h1>

                        <p className="text-lg text-[#52514E] leading-relaxed max-w-lg">
                            You've already taken the hardest step. The ACS client portal helps you complete
                            your program requirements, track your hours, and earn your completion
                            certificate — accepted by courts, employers, and probation officers.
                            We understand most people come to us during stressful times; the portal is
                            built to make finishing simpler.
                        </p>

                        {/* The two doors */}
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => navigate('/portal/login')}
                                    className="group flex items-center justify-center gap-3 px-8 py-4 text-white font-bold text-lg rounded-xl shadow-xl hover:opacity-95 hover:scale-[1.01] transition-all"
                                    style={{ backgroundColor: RED, boxShadow: '0 14px 30px rgba(198,40,40,0.25)' }}
                                >
                                    I'm completing a program <ArrowRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
                                </button>
                                <a
                                    href="tel:3148492800"
                                    className="flex items-center justify-center gap-3 px-7 py-4 bg-white text-[#242321] font-semibold text-lg rounded-xl border border-black/10 hover:border-black/25 transition-all"
                                >
                                    <Phone size={19} style={{ color: RED }} /> 314-849-2800
                                </a>
                            </div>
                            <p className="text-sm text-[#52514E] pl-1">
                                Track progress &nbsp;·&nbsp; complete forms &nbsp;·&nbsp; earn your certificate
                            </p>
                            {/* The quieter staff door */}
                            <p className="text-sm pl-1">
                                <button
                                    onClick={() => navigate('/login')}
                                    className="font-semibold text-[#52514E] underline underline-offset-4 decoration-black/20 hover:text-[#242321] hover:decoration-black/50 transition-colors"
                                >
                                    ACS staff — sign in here →
                                </button>
                            </p>
                        </div>

                        {/* Trust chips — verbatim from the reference */}
                        <div className="flex flex-wrap gap-2.5 pt-1">
                            {['State-certified', 'Court-accepted', 'Confidential'].map((chip) => (
                                <span key={chip} className="px-4 py-2 bg-white border border-black/10 rounded-full text-sm font-semibold text-[#242321]">
                                    {chip}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* ── The honest portal card — real shapes, real names, no fabrication ── */}
                    <div className="relative">
                        <div className="bg-white rounded-3xl shadow-2xl border border-black/5 p-7">
                            <div className="flex items-center justify-between mb-5">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9A9892]">Client portal · My progress</p>
                                <Lock size={14} className="text-[#9A9892]" />
                            </div>
                            <div className="space-y-4">
                                {/* Hours — the engine's real framing (the live demo baseline: 16/75 incl. 16/35 counseling) */}
                                <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #C62828 0%, #8B1E24 100%)' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Welcome back</p>
                                    <p className="text-2xl font-bold mt-1">SATOP — Level IV</p>
                                    <div className="mt-3 w-full bg-white/25 rounded-full h-2">
                                        <div className="bg-white h-2 rounded-full" style={{ width: '21%' }}></div>
                                    </div>
                                    <p className="text-xs opacity-90 mt-2">16 / 75 hours completed · incl. 16 / 35 counseling</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-[#F6F6F4] rounded-xl p-3.5">
                                        <p className="text-[9px] font-bold uppercase text-[#9A9892] tracking-widest flex items-center gap-1"><CalendarDays size={11} /> Next session</p>
                                        <p className="font-bold text-sm mt-1 text-[#242321]">Thursday · 2:00 PM</p>
                                    </div>
                                    <div className="bg-[#F6F6F4] rounded-xl p-3.5">
                                        <p className="text-[9px] font-bold uppercase text-[#9A9892] tracking-widest flex items-center gap-1"><ClipboardCheck size={11} /> Required forms</p>
                                        <p className="font-bold text-sm mt-1 text-[#242321]">1 of 6 signed</p>
                                    </div>
                                </div>
                                {/* Real FORM_REGISTRY titles, real states */}
                                <div className="space-y-1.5">
                                    {[
                                        { name: 'Consent for Treatment', done: true },
                                        { name: 'HIPAA Notice Acknowledgement', done: false },
                                        { name: 'Telehealth Informed Consent', done: false },
                                    ].map((f) => (
                                        <div key={f.name} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 border ${f.done ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-black/10'}`}>
                                            <CheckCircle2 size={14} className={f.done ? 'text-emerald-600' : 'text-[#D6CFC2]'} />
                                            <span className={`text-xs font-semibold ${f.done ? 'text-emerald-800' : 'text-[#52514E]'}`}>{f.name}</span>
                                            <span className={`ml-auto text-[9px] font-bold uppercase tracking-widest ${f.done ? 'text-emerald-600' : 'text-[#9A9892]'}`}>{f.done ? 'Signed' : 'To do'}</span>
                                        </div>
                                    ))}
                                </div>
                                {/* The real finish line — the completion gate, framed honestly */}
                                <div className="flex items-start gap-3 rounded-2xl border border-black/10 bg-[#FBFBFA] p-4">
                                    <Award size={18} className="shrink-0 mt-0.5" style={{ color: RED }} />
                                    <p className="text-xs text-[#52514E] leading-relaxed">
                                        <span className="font-bold text-[#242321]">Completion certificate</span> — issues
                                        when your hours, required forms, balance, and clinician sign-off are all met.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Since-2003 trust card — echoes the reference's inset */}
                        <div className="mt-4 bg-white rounded-2xl border border-black/5 shadow-sm px-5 py-4">
                            <p className="text-sm text-[#52514E]">
                                <span className="font-bold text-[#242321]">Since 2003</span> — trusted by clients,
                                courts, attorneys, and referral partners.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── What you can do ── */}
            <section id="features" className="bg-white py-20 border-y border-black/5">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-14">
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] mb-3" style={{ color: RED }}>The portal</p>
                        <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.02em] text-[#242321]">Everything you need to finish</h2>
                        <p className="text-[#52514E] mt-3 max-w-xl mx-auto">Your secure portal puts your entire program in one place — no phone calls, no paper shuffling.</p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { icon: FileText, title: 'Complete forms online', desc: 'Fill out intake paperwork, consent forms, and program documents from any device — before you even walk in.' },
                            { icon: BarChart, title: 'Track your progress', desc: 'See exactly where you stand — session hours completed, what your program requires, and what\'s left to finish.' },
                            { icon: Clock, title: 'Manage your schedule', desc: 'View upcoming sessions, see your appointment history, and know exactly when you need to be there.' },
                            { icon: CreditCard, title: 'Handle payments', desc: 'View your balance, see payment history, and keep your account squared away — it\'s one of the completion requirements.' },
                            { icon: Users, title: 'Stay connected', desc: 'Your counselor sees your progress in real time. No chasing paperwork, no calling the office to check a box.' },
                            { icon: Lock, title: 'Private & secure', desc: 'Your information is protected with the same level of security used by healthcare providers nationwide.' },
                        ].map((feature, i) => (
                            <div key={i} className="bg-[#FBFBFA] rounded-2xl p-7 border border-black/5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(198,40,40,0.08)', color: RED }}>
                                    <feature.icon size={22} />
                                </div>
                                <h3 className="text-lg font-bold text-[#242321]">{feature.title}</h3>
                                <p className="text-sm text-[#52514E] mt-2 leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Commitments ── */}
            <section className="py-20">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="text-center mb-14">
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] mb-3" style={{ color: RED }}>Our commitment</p>
                        <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.02em] text-[#242321]">Every program is guided by four commitments</h2>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[
                            { icon: Lock, title: 'Confidentiality', desc: 'Your privacy is protected at all times' },
                            { icon: Shield, title: 'Professionalism', desc: 'Programs that courts and employers recognize' },
                            { icon: Heart, title: 'Compassion', desc: 'Treatment with care and without judgment' },
                            { icon: MapPin, title: 'Local support', desc: 'Serving St. Louis City and the greater metro area' },
                        ].map((item, i) => (
                            <div key={i} className="text-center space-y-3">
                                <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-black/5 shadow-sm flex items-center justify-center" style={{ color: RED }}>
                                    <item.icon size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-[#242321]">{item.title}</h3>
                                <p className="text-sm text-[#52514E] leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── How it works ── */}
            <section id="how" className="bg-white py-20 border-y border-black/5">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.02em] text-[#242321]">The process is clear</h2>
                        <p className="text-[#52514E] mt-3">From enrollment to your completion certificate.</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { step: '1', title: 'Enroll with ACS', desc: 'New clients book an assessment with a licensed counselor — by phone or through stlacs.com.' },
                            { step: '2', title: 'Get portal access', desc: 'After enrollment, your counselor sends you a secure sign-in link for your personal portal.' },
                            { step: '3', title: 'Finish your program', desc: 'Complete forms, attend sessions, watch your hours add up — and earn the completion certificate your court, employer, or probation officer needs.' },
                        ].map((item, i) => (
                            <div key={i} className="text-center space-y-4">
                                <div className="w-14 h-14 mx-auto rounded-full text-white text-xl font-bold flex items-center justify-center shadow-lg" style={{ backgroundColor: RED, boxShadow: '0 10px 22px rgba(198,40,40,0.25)' }}>
                                    {item.step}
                                </div>
                                <h3 className="text-xl font-bold text-[#242321]">{item.title}</h3>
                                <p className="text-sm text-[#52514E] leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Programs ── */}
            <section id="programs" className="py-20">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] mb-3" style={{ color: RED }}>Our programs</p>
                        <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.02em] text-[#242321]">Certified by the Missouri Division of Behavioral Health</h2>
                        <p className="text-[#52514E] mt-3">All programs are accepted by the Department of Revenue and the courts.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            'SATOP',
                            'REACT Program',
                            'DWI Court',
                            'Individual Counseling',
                            'Substance Use Assessment',
                            'Drug Testing',
                            'Anger Management',
                            'General Assessments',
                        ].map((program, i) => (
                            <div key={i} className="flex items-center gap-3 p-4 bg-white border border-black/5 rounded-xl hover:shadow-md transition-all">
                                <CheckCircle2 size={18} className="flex-shrink-0" style={{ color: RED }} />
                                <span className="font-semibold text-[#242321] text-sm">{program}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA banner — the two doors, again ── */}
            <section className="py-16" style={{ backgroundColor: RED }}>
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.02em]">Ready to finish?</h2>
                    <p className="text-white/85 mt-3 max-w-lg mx-auto">If you're enrolled in a program with ACS, sign in below. New clients should call our office to schedule an assessment.</p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
                        <button
                            onClick={() => navigate('/portal/login')}
                            className="px-10 py-4 bg-white font-bold text-lg rounded-xl shadow-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
                            style={{ color: RED }}
                        >
                            <CheckCircle2 size={20} /> Sign in to the portal
                        </button>
                        <button
                            onClick={() => navigate('/login')}
                            className="px-10 py-4 bg-transparent border-2 border-white/40 text-white font-semibold text-lg rounded-xl hover:bg-white/10 transition-all"
                        >
                            ACS staff sign-in
                        </button>
                    </div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer id="contact" className="bg-[#242321] text-[#B5B3AD] py-12">
                <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-8">
                    <div>
                        <img src={logoUrl} alt="ACS Logo" className="h-10 brightness-0 invert opacity-60 mb-4" />
                        <p className="text-sm leading-relaxed">Assessment &amp; Counseling Solutions provides court-approved substance abuse treatment, DWI education, and individual counseling services in the St. Louis metro area.</p>
                        <p className="text-xs mt-4 text-[#8B8983]">Since 2003 — trusted by clients, courts, attorneys, and referral partners.</p>
                    </div>
                    <div>
                        <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Our services</h4>
                        <ul className="space-y-2 text-sm">
                            <li>SATOP</li>
                            <li>REACT Program</li>
                            <li>DWI Court</li>
                            <li>Individual Counseling</li>
                            <li>Substance Use Assessment</li>
                            <li>Drug Testing</li>
                            <li>Anger Management</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Contact</h4>
                        <ul className="space-y-2 text-sm">
                            <li><a href="tel:3148492800" className="flex items-center gap-2 hover:text-white transition-colors"><Phone size={14} /> 314-849-2800</a></li>
                            <li>St. Louis, Missouri</li>
                            <li className="mt-4">
                                <button
                                    onClick={() => navigate('/portal/login')}
                                    className="font-bold transition-colors hover:text-white"
                                    style={{ color: '#E98A8A' }}
                                >
                                    Access the client portal →
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => navigate('/login')}
                                    className="text-sm hover:text-white transition-colors"
                                >
                                    ACS staff sign-in
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-6 mt-8 pt-8 border-t border-white/10 text-center text-xs">
                    <p>&copy; {new Date().getFullYear()} Assessment &amp; Counseling Solutions. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default WebsitePortalBridge;
