
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Phone, Clock, FileText, CreditCard, BarChart, CheckCircle2, Lock, Users, Award, CalendarDays, ClipboardCheck } from 'lucide-react';

/**
 * The pane of glass, pass 2 — a near-exact match to stlacs.com.
 *
 * Every token below is EXTRACTED from the live site (stlacs.com/styles.css :root,
 * fetched 2026-06-10), not approximated:
 *   --red #c62828 · --red-dark #8f1717 · --red-soft #f4dfdc · --ink #242321 ·
 *   --muted #6d6760 · --footer-teal #073746 · --paper #fbf7ef · --white #fffdfa ·
 *   --line rgba(36,35,33,.14) · --radius 8px ·
 *   --shadow 0 18px 44px rgba(74,43,31,.11), 0 8px 18px rgba(36,35,33,.07) ·
 *   --display "Encode Sans" (h1 weight 600, clamp(2.45rem,3.95vw,3.85rem), 13.8ch) ·
 *   --body "Anuphan" (16px / 1.65) — both via the same Google Fonts css2 URL the
 *   site loads. Anatomy mirrored from their header/hero()/footer markup: sticky
 *   8px-radius header bar (rgba(246,246,244,.96) + blur), pill nav links, the red
 *   999px call capsule, .eyebrow with red "/" pseudo-slashes, .hero-actions pill
 *   pair (red primary / line-bordered secondary), .proof-strip chips, the
 *   floating-note inset on the hero photo, and the TEAL rounded footer card with
 *   their grid (mark · tagline+h2 · services · contact block).
 *
 * Mission unchanged (this is the portal's front door, not their marketing page):
 * headline "Finish what you started.", three doors (new prospect primary → /intake,
 * returning client → /portal/login, quieter staff → /login), and the HONEST portal card — real engine hours framing
 * (16/75 incl. 16/35 counseling), real FORM_REGISTRY titles, the real completion
 * gate. No fabricated metrics, no dead features, no unconfirmed domain.
 *
 * Assets are all local (public/brand/ — Dan's downloads + the official logomark
 * SVGs); zero render-time hotlinks to stlacs.com. Nav/footer LINKS point back
 * into the real site — this page is its satellite. Image_fx-57.jpg is the same
 * photo their live homepage hero uses (their script.js renderHome imageA).
 */

const FONTS_LINK_ID = 'acs-landing-stlacs-fonts';
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Anuphan:wght@300;400;500;600;700&family=Encode+Sans:wght@500;600;700;800&display=swap';

// stlacs.com :root tokens (literal).
const RED = '#c62828';
const RED_DARK = '#8f1717';
const RED_SOFT = '#f4dfdc';
const INK = '#242321';
const MUTED = '#6d6760';
const TEAL = '#073746';
const PAPER = '#fbf7ef';
const WHITE = '#fffdfa';
const LINE = 'rgba(36, 35, 33, 0.14)';
const RADIUS = '8px';
const SHADOW = '0 18px 44px rgba(74, 43, 31, 0.11), 0 8px 18px rgba(36, 35, 33, 0.07)';
const DISPLAY = "'Encode Sans', 'Arial Narrow', sans-serif";
const BODY = "'Anuphan', 'Helvetica Neue', sans-serif";

/** Their .eyebrow: uppercase, 0.76rem/600/.075em, red "/" on both ends. */
const Eyebrow: React.FC<{ children: React.ReactNode; light?: boolean }> = ({ children, light }) => (
    <p className="inline-flex items-center uppercase" style={{ gap: '0.45rem', fontSize: '0.76rem', fontWeight: 600, letterSpacing: '0.075em', color: light ? 'rgba(255,255,255,0.72)' : '#333333', margin: 0 }}>
        <span style={{ color: RED }}>/</span>{children}<span style={{ color: RED }}>/</span>
    </p>
);

const WebsitePortalBridge: React.FC = () => {
    const navigate = useNavigate();

    // Page-scoped webfonts — the SAME css2 URL stlacs.com loads (Encode Sans +
    // Anuphan). Injected once, id-guarded; other routes never download the woff2s.
    useEffect(() => {
        if (document.getElementById(FONTS_LINK_ID)) return;
        const link = document.createElement('link');
        link.id = FONTS_LINK_ID;
        link.rel = 'stylesheet';
        link.href = FONTS_HREF;
        document.head.appendChild(link);
    }, []);

    // Their nav, pointing back into the real site — this page is its satellite.
    const siteNav = [
        { label: 'Home', href: 'https://stlacs.com/' },
        { label: 'Services', href: 'https://stlacs.com/services/' },
        { label: 'Resources', href: 'https://stlacs.com/resources/' },
        { label: 'About', href: 'https://stlacs.com/about-us/' },
        { label: 'Contact', href: 'https://stlacs.com/contact-us/' },
    ];

    const pillButton: React.CSSProperties = {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
        minHeight: '3rem', padding: '0.58rem 1.35rem', borderRadius: '999px',
        background: RED, color: 'white', fontWeight: 700, lineHeight: 1,
        border: '1px solid rgba(198, 40, 40, 0.18)', boxShadow: '0 16px 34px rgba(198, 40, 40, 0.22)',
    };
    const pillButtonSecondary: React.CSSProperties = {
        ...pillButton, background: 'transparent', color: INK, borderColor: LINE, boxShadow: 'none',
    };

    return (
        <div id="top" className="min-h-screen" style={{ background: '#ffffff', color: INK, fontFamily: BODY, fontSize: '16px', lineHeight: 1.65 }}>

            {/* ── Header — their .site-header: sticky 8px-radius bar, pill nav, red call capsule ── */}
            <header className="sticky z-50" style={{ top: '0.55rem' }}>
                <div className="mx-auto flex items-center justify-between gap-4" style={{ width: 'min(1320px, calc(100% - 1.5rem))', padding: '0.5rem 0.65rem', borderRadius: RADIUS, background: 'rgba(246, 246, 244, 0.96)', backdropFilter: 'blur(12px)' }}>
                    <a href="https://stlacs.com/" aria-label="ACS home" className="shrink-0 pl-2">
                        <img src="/brand/ACS-Full-Logomark.svg" alt="Assessment & Counseling Solutions" className="h-10 w-auto object-contain" />
                    </a>
                    <nav className="hidden md:flex items-center" aria-label="Main navigation">
                        {/* The portal's own entry — active pill */}
                        <span className="bg-white shadow-sm" style={{ padding: '0.42rem 0.82rem', borderRadius: '999px', fontWeight: 600, fontSize: '0.95rem' }}>Client Portal</span>
                        {siteNav.map((l) => (
                            <a key={l.label} href={l.href} style={{ padding: '0.42rem 0.82rem', borderRadius: '999px', fontSize: '0.95rem', color: INK }}
                               onMouseEnter={(e) => (e.currentTarget.style.color = RED)} onMouseLeave={(e) => (e.currentTarget.style.color = INK)}>
                                {l.label}
                            </a>
                        ))}
                    </nav>
                    <a href="tel:3148492800" style={{ ...pillButton, minHeight: '2.75rem', padding: '0.5rem 1.05rem' }}>
                        <Phone size={15} /> 314-849-2800
                    </a>
                </div>
            </header>

            {/* ── Hero — their .hero grid + eyebrow + h1 scale; our message + two doors ── */}
            <section className="mx-auto grid lg:grid-cols-[minmax(0,1.02fr)_minmax(20rem,0.98fr)] items-center" style={{ width: 'min(1320px, calc(100% - 1.5rem))', gap: 'clamp(1.8rem, 4vw, 4rem)', paddingTop: 'clamp(2rem, 4vw, 3.5rem)', paddingBottom: 'clamp(2.5rem, 4vw, 4rem)' }}>
                <div>
                    <Eyebrow>Client portal — St. Louis &amp; Jefferson County</Eyebrow>
                    <h1 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 'clamp(2.45rem, 3.95vw, 3.85rem)', lineHeight: 1.08, color: INK, maxWidth: 'min(13.8ch, 100%)', textWrap: 'balance' as any, margin: '1rem 0 0' }}>
                        The hardest step is behind you.
                    </h1>
                    <p style={{ color: MUTED, fontSize: '1.06rem', maxWidth: '48ch', marginTop: '1.25rem' }}>
                        You've already taken it. The ACS client portal helps you take the rest —
                        track your hours, complete your forms, and earn your completion
                        certificate — accepted by courts, employers, and probation officers. We
                        understand most people come to us during stressful times; the portal is built
                        to make finishing simpler.
                    </p>

                    {/* Three doors — their .hero-actions pill style. The new-prospect door is
                        PRIMARY (a first-time visitor's path); the returning-client and staff
                        doors are secondary. Routing for the existing two is unchanged. */}
                    <div className="flex flex-wrap items-center" style={{ gap: '0.8rem', marginTop: '2rem' }}>
                        <button onClick={() => navigate('/intake')} style={pillButton} className="hover:opacity-95 transition-all">
                            I'm new — get started <ArrowRight size={18} />
                        </button>
                        <button onClick={() => navigate('/portal/login')} style={pillButtonSecondary} className="transition-all"
                                onMouseEnter={(e) => (e.currentTarget.style.color = RED)} onMouseLeave={(e) => (e.currentTarget.style.color = INK)}>
                            I'm completing a program
                        </button>
                        <button onClick={() => navigate('/login')} style={pillButtonSecondary} className="transition-all"
                                onMouseEnter={(e) => (e.currentTarget.style.color = RED)} onMouseLeave={(e) => (e.currentTarget.style.color = INK)}>
                            ACS staff sign-in
                        </button>
                    </div>
                    <p style={{ color: MUTED, fontSize: '0.9rem', marginTop: '0.9rem' }}>
                        Track progress &nbsp;·&nbsp; complete forms &nbsp;·&nbsp; earn your certificate
                    </p>

                    {/* Their .proof-strip chips, verbatim */}
                    <div className="flex flex-wrap" style={{ gap: '0.6rem', marginTop: '1.4rem' }}>
                        {['State-certified', 'Court-accepted', 'Confidential'].map((chip) => (
                            <span key={chip} style={{ background: WHITE, border: `1px solid ${LINE}`, borderRadius: '999px', padding: '0.45rem 1rem', fontSize: '0.88rem', fontWeight: 600, color: INK }}>
                                {chip}
                            </span>
                        ))}
                    </div>
                    <p style={{ color: MUTED, fontSize: '0.88rem', marginTop: '1.1rem' }}>
                        <strong style={{ color: INK }}>Since 2003</strong> — trusted by clients, courts, attorneys, and referral partners.
                    </p>
                </div>

                {/* Photo-led media column — their hero photo, our honest card as the inset */}
                <div className="relative">
                    <img src="/brand/Image_fx-57.jpg" alt="A counseling session at ACS" className="w-full object-cover h-[300px] sm:h-[380px] lg:h-[640px]" style={{ borderRadius: RADIUS, boxShadow: SHADOW }} />
                    {/* The honest portal card — the floating-note treatment, carrying ONLY real product shapes */}
                    <div className="relative -mt-20 mx-3 lg:absolute lg:bottom-5 lg:right-5 lg:left-auto lg:mx-0 lg:mt-0 lg:w-[400px] bg-white p-5" style={{ borderRadius: RADIUS, boxShadow: SHADOW }}>
                        <div className="flex items-center justify-between mb-3">
                            <p className="uppercase" style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.16em', color: MUTED }}>Client portal · My progress</p>
                            <Lock size={13} style={{ color: MUTED }} />
                        </div>
                        <div className="space-y-3">
                            <div className="p-4 text-white" style={{ borderRadius: RADIUS, background: `linear-gradient(135deg, ${RED} 0%, ${RED_DARK} 100%)` }}>
                                <p className="uppercase" style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.14em', opacity: 0.8 }}>Welcome back</p>
                                <p style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: '1.3rem', marginTop: '0.15rem' }}>SATOP — Level IV</p>
                                <div className="mt-2.5 w-full rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.25)' }}>
                                    <div className="bg-white h-1.5 rounded-full" style={{ width: '21%' }}></div>
                                </div>
                                <p style={{ fontSize: '0.74rem', opacity: 0.9, marginTop: '0.45rem' }}>16 / 75 hours completed · incl. 16 / 35 counseling</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2.5">
                                <div className="p-2.5" style={{ background: PAPER, borderRadius: RADIUS }}>
                                    <p className="uppercase flex items-center gap-1" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em', color: MUTED }}><CalendarDays size={10} /> Next session</p>
                                    <p style={{ fontWeight: 700, fontSize: '0.84rem', marginTop: '0.2rem' }}>Thursday · 2:00 PM</p>
                                </div>
                                <div className="p-2.5" style={{ background: PAPER, borderRadius: RADIUS }}>
                                    <p className="uppercase flex items-center gap-1" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em', color: MUTED }}><ClipboardCheck size={10} /> Required forms</p>
                                    <p style={{ fontWeight: 700, fontSize: '0.84rem', marginTop: '0.2rem' }}>1 of 6 signed</p>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                {[
                                    { name: 'Consent for Treatment', done: true },
                                    { name: 'HIPAA Notice Acknowledgement', done: false },
                                    { name: 'Telehealth Informed Consent', done: false },
                                ].map((f) => (
                                    <div key={f.name} className="flex items-center gap-2 px-2.5 py-1.5" style={{ borderRadius: RADIUS, background: f.done ? '#eef6ef' : 'white', border: `1px solid ${f.done ? '#cfe0d2' : LINE}` }}>
                                        <CheckCircle2 size={13} style={{ color: f.done ? '#3e7a4d' : '#cfc9bf' }} />
                                        <span style={{ fontSize: '0.76rem', fontWeight: 600, color: f.done ? '#2e5c3a' : MUTED }}>{f.name}</span>
                                        <span className="ml-auto uppercase" style={{ fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.12em', color: f.done ? '#3e7a4d' : '#a39d93' }}>{f.done ? 'Signed' : 'To do'}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-start gap-2.5 p-3" style={{ borderRadius: RADIUS, background: PAPER, border: `1px solid ${LINE}` }}>
                                <Award size={15} className="shrink-0 mt-0.5" style={{ color: RED }} />
                                <p style={{ fontSize: '0.74rem', color: MUTED, lineHeight: 1.5 }}>
                                    <strong style={{ color: INK }}>Completion certificate</strong> — issues when your
                                    hours, required forms, balance, and clinician sign-off are all met.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── About split — mirrors their "About our center" band; our portal message ── */}
            <section className="mx-auto grid lg:grid-cols-2 items-center" style={{ width: 'min(1320px, calc(100% - 1.5rem))', gap: 'clamp(1.8rem, 4vw, 4rem)', padding: 'clamp(2.5rem, 5vw, 5rem) 0' }}>
                <img src="/brand/Image_fx-62.jpg" alt="The ACS waiting room" className="w-full object-cover h-[280px] lg:h-[420px]" style={{ borderRadius: RADIUS, boxShadow: SHADOW }} />
                <div>
                    <Eyebrow>About the portal</Eyebrow>
                    <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 'clamp(1.7rem, 2.6vw, 2.4rem)', lineHeight: 1.15, margin: '1rem 0 0', maxWidth: '22ch' }}>
                        Counselor-connected from enrollment to completion.
                    </h2>
                    <p style={{ color: MUTED, marginTop: '1.1rem', maxWidth: '52ch' }}>
                        Most people who come to ACS are navigating a stressful season. The portal keeps
                        the path visible: every form, every session hour, and every requirement in one
                        place — so nothing about finishing is a mystery.
                    </p>
                    <p style={{ color: MUTED, marginTop: '0.8rem', maxWidth: '52ch' }}>
                        Your counselor sees the same progress you do. When your requirements are met,
                        your completion documentation is ready for the people who need it.
                    </p>
                    <div className="flex flex-wrap" style={{ gap: '0.55rem', marginTop: '1.4rem' }}>
                        {['Missouri DBH certified', 'DOR accepted', 'Licensed counselors', 'Confidential process'].map((s) => (
                            <span key={s} style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: '999px', padding: '0.4rem 0.9rem', fontSize: '0.82rem', fontWeight: 600, color: INK }}>{s}</span>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Features — paper band, white 8px cards ── */}
            <section id="features" style={{ background: PAPER, padding: 'clamp(2.5rem, 5vw, 5rem) 0' }}>
                <div className="mx-auto" style={{ width: 'min(1320px, calc(100% - 1.5rem))' }}>
                    <div className="text-center mb-12">
                        <Eyebrow>The portal</Eyebrow>
                        <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 'clamp(1.7rem, 2.6vw, 2.4rem)', margin: '0.9rem 0 0' }}>Everything you need to finish</h2>
                        <p style={{ color: MUTED, marginTop: '0.7rem' }}>Your secure portal puts your entire program in one place — no phone calls, no paper shuffling.</p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[
                            { icon: FileText, title: 'Complete forms online', desc: 'Fill out intake paperwork, consent forms, and program documents from any device — before you even walk in.' },
                            { icon: BarChart, title: 'Track your progress', desc: 'See exactly where you stand — session hours completed, what your program requires, and what\'s left to finish.' },
                            { icon: Clock, title: 'Manage your schedule', desc: 'View upcoming sessions, see your appointment history, and know exactly when you need to be there.' },
                            { icon: CreditCard, title: 'Handle payments', desc: 'View your balance, see payment history, and keep your account squared away — it\'s one of the completion requirements.' },
                            { icon: Users, title: 'Stay connected', desc: 'Your counselor sees your progress in real time. No chasing paperwork, no calling the office to check a box.' },
                            { icon: Lock, title: 'Private & secure', desc: 'Your information is protected with the same level of security used by healthcare providers nationwide.' },
                        ].map((feature, i) => (
                            <div key={i} className="bg-white p-7 transition-all duration-300 hover:-translate-y-0.5" style={{ borderRadius: RADIUS, border: `1px solid ${LINE}` }}>
                                <div className="w-11 h-11 flex items-center justify-center mb-4" style={{ borderRadius: RADIUS, background: RED_SOFT, color: RED }}>
                                    <feature.icon size={20} />
                                </div>
                                <h3 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: '1.1rem' }}>{feature.title}</h3>
                                <p style={{ color: MUTED, fontSize: '0.92rem', marginTop: '0.45rem' }}>{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── How it works ── */}
            <section id="how" style={{ padding: 'clamp(2.5rem, 5vw, 5rem) 0' }}>
                <div className="mx-auto" style={{ width: 'min(1100px, calc(100% - 1.5rem))' }}>
                    <div className="text-center mb-12">
                        <Eyebrow>The process</Eyebrow>
                        <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 'clamp(1.7rem, 2.6vw, 2.4rem)', margin: '0.9rem 0 0' }}>From enrollment to your certificate</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { step: '1', title: 'Enroll with ACS', desc: 'New clients book an assessment with a licensed counselor — by phone or through stlacs.com.' },
                            { step: '2', title: 'Get portal access', desc: 'After enrollment, your counselor sends you a secure sign-in link for your personal portal.' },
                            { step: '3', title: 'Finish your program', desc: 'Complete forms, attend sessions, watch your hours add up — and earn the completion certificate your court, employer, or probation officer needs.' },
                        ].map((item, i) => (
                            <div key={i} className="text-center space-y-3">
                                <div className="w-12 h-12 mx-auto rounded-full text-white flex items-center justify-center" style={{ background: RED, fontFamily: DISPLAY, fontWeight: 700, fontSize: '1.15rem', boxShadow: '0 16px 34px rgba(198,40,40,0.22)' }}>
                                    {item.step}
                                </div>
                                <h3 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: '1.2rem' }}>{item.title}</h3>
                                <p style={{ color: MUTED, fontSize: '0.92rem' }}>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Programs ── */}
            <section id="programs" style={{ background: PAPER, padding: 'clamp(2.5rem, 5vw, 5rem) 0' }}>
                <div className="mx-auto" style={{ width: 'min(1320px, calc(100% - 1.5rem))' }}>
                    <div className="text-center mb-10">
                        <Eyebrow>Our programs</Eyebrow>
                        <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 'clamp(1.7rem, 2.6vw, 2.4rem)', margin: '0.9rem 0 0' }}>Certified by the Missouri Division of Behavioral Health</h2>
                        <p style={{ color: MUTED, marginTop: '0.7rem' }}>All programs are accepted by the Department of Revenue and the courts.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {['SATOP', 'REACT Program', 'DWI Court', 'Individual Counseling', 'Substance Use Assessment', 'Drug Testing', 'Anger Management', 'General Assessments'].map((program, i) => (
                            <div key={i} className="flex items-center gap-3 p-4 bg-white" style={{ borderRadius: RADIUS, border: `1px solid ${LINE}` }}>
                                <CheckCircle2 size={17} className="flex-shrink-0" style={{ color: RED }} />
                                <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{program}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA band — the two doors, again ── */}
            <section style={{ padding: 'clamp(2rem, 4vw, 3.5rem) 0' }}>
                <div className="mx-auto text-center text-white" style={{ width: 'min(1320px, calc(100% - 1.5rem))', borderRadius: RADIUS, background: `linear-gradient(135deg, ${RED} 0%, ${RED_DARK} 100%)`, padding: 'clamp(2.5rem, 5vw, 4rem) 1.5rem' }}>
                    <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 'clamp(1.8rem, 2.8vw, 2.6rem)' }}>Ready to finish?</h2>
                    <p className="mx-auto" style={{ color: 'rgba(255,255,255,0.85)', marginTop: '0.7rem', maxWidth: '48ch' }}>If you're enrolled in a program with ACS, sign in below. New clients should call our office to schedule an assessment.</p>
                    <div className="flex flex-col sm:flex-row justify-center" style={{ gap: '0.8rem', marginTop: '1.8rem' }}>
                        <button onClick={() => navigate('/portal/login')} style={{ ...pillButton, background: 'white', color: RED, border: '1px solid rgba(255,255,255,0.4)', boxShadow: '0 16px 34px rgba(0,0,0,0.18)' }}>
                            <CheckCircle2 size={18} /> Sign in to the portal
                        </button>
                        <button onClick={() => navigate('/login')} style={{ ...pillButton, background: 'transparent', border: '1px solid rgba(255,255,255,0.45)', boxShadow: 'none', fontWeight: 600 }} className="hover:bg-white/10 transition-all">
                            ACS staff sign-in
                        </button>
                    </div>
                </div>
            </section>

            {/* ── Footer — their teal rounded card, their grid, their bottom line ── */}
            <footer id="contact" className="text-white" style={{ width: 'min(1320px, calc(100% - 1.5rem))', margin: '0 auto clamp(1rem, 2vw, 1.5rem)', padding: 'clamp(1.5rem, 3vw, 2.25rem)', borderRadius: RADIUS, background: TEAL }}>
                <div className="mb-8">
                    <img src="/brand/ACS-Logo-W.svg" alt="ACS" className="h-10 w-auto object-contain" />
                </div>
                <div className="grid md:grid-cols-3 gap-10">
                    <div>
                        <Eyebrow light>Moving forward, together</Eyebrow>
                        <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 'clamp(1.4rem, 2vw, 1.9rem)', lineHeight: 1.2, marginTop: '0.9rem', maxWidth: '18ch' }}>
                            Clear guidance. Certified care. A completed program.
                        </h2>
                    </div>
                    <div>
                        <h3 className="uppercase" style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.6)', marginBottom: '0.9rem' }}>Services</h3>
                        <ul className="space-y-2" style={{ fontSize: '0.95rem' }}>
                            <li><a href="https://stlacs.com/services/satop/" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>SATOP</a></li>
                            <li><a href="https://stlacs.com/services/react-program/" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>REACT</a></li>
                            <li><a href="https://stlacs.com/services/dwi/" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>DWI Court</a></li>
                            <li><a href="https://stlacs.com/services/individual-counseling/" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>Counseling</a></li>
                            <li><a href="https://stlacs.com/resources/" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>Resources</a></li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="uppercase" style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.6)', marginBottom: '0.9rem' }}>Contact</h3>
                        <ul className="space-y-2" style={{ fontSize: '0.95rem' }}>
                            <li style={{ opacity: 0.85 }}>11648 Gravois, Suite 245<br />St. Louis, MO 63126</li>
                            <li><a href="tel:3148492800" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>314-849-2800</a></li>
                            <li><a href="mailto:info@stlacs.com" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>info@stlacs.com</a></li>
                            <li style={{ paddingTop: '0.6rem' }}>
                                <button onClick={() => navigate('/portal/login')} style={{ fontWeight: 700, color: '#f2b8b5' }} className="hover:text-white transition-colors">
                                    Access the client portal →
                                </button>
                            </li>
                            <li>
                                <button onClick={() => navigate('/login')} className="hover:text-white transition-colors" style={{ opacity: 0.85 }}>
                                    ACS staff sign-in
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 justify-between mt-10 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.14)', fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)' }}>
                    <span>&copy; 2026 STL ACS. All Rights Reserved.</span>
                    <span>State-certified care for St. Louis and Jefferson County.</span>
                </div>
            </footer>
        </div>
    );
};

export default WebsitePortalBridge;
