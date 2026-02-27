
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Phone, Shield, Clock, FileText, CreditCard, BarChart, Heart, CheckCircle2, MapPin, Lock, Users } from 'lucide-react';

const WebsitePortalBridge: React.FC = () => {
    const navigate = useNavigate();
    const logoUrl = "https://storage.googleapis.com/westerns1978-digital-assets/Websites/acs-therapy/ACS-Logo1.svg";

    return (
        <div className="min-h-screen bg-white">
            {/* Website Header - matches stlacs.com */}
            <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <img src={logoUrl} alt="Assessment & Counseling Solutions" className="h-12 object-contain" />
                    <nav className="hidden md:flex items-center gap-8">
                        <span className="text-sm font-semibold text-gray-700 hover:text-red-700 cursor-pointer">Home</span>
                        <span className="text-sm font-semibold text-gray-700 hover:text-red-700 cursor-pointer">Services ▾</span>
                        <span className="text-sm font-semibold text-gray-700 hover:text-red-700 cursor-pointer">Resources</span>
                        <span className="text-sm font-semibold text-gray-700 hover:text-red-700 cursor-pointer">About Us</span>
                        <span className="text-sm font-semibold text-gray-700 hover:text-red-700 cursor-pointer">Contact Us</span>
                    </nav>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate('/portal/login')}
                            className="px-5 py-2.5 bg-red-700 text-white text-sm font-bold rounded-lg hover:bg-red-800 transition-all shadow-md"
                        >
                            Client Portal
                        </button>
                        <span className="hidden lg:flex items-center gap-2 text-red-700 font-bold text-sm">
                            <Phone size={16} /> Call us: 314-849-2800
                        </span>
                    </div>
                </div>
            </header>

            {/* Hero Banner */}
            <section className="relative overflow-hidden">
                {/* Background Image */}
                <div className="absolute inset-0 z-0">
                    <img 
                        src="https://storage.googleapis.com/gemynd-public/projects/acs-therapyhub/acs-background.png" 
                        alt="" 
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/70"></div>
                </div>
                <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 rounded-full text-red-700 text-xs font-bold uppercase tracking-widest">
                            <Shield size={14} /> Now Available Online
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black text-gray-900 leading-[1.1] tracking-tight">
                            Your Program,{' '}
                            <span className="text-red-700">Now at Your Fingertips.</span>
                        </h1>
                        <p className="text-lg text-gray-600 leading-relaxed max-w-lg">
                            We understand that most people who walk through our doors come during stressful times. 
                            Our new client portal makes it easier to complete forms, track your progress, 
                            and stay on top of your program requirements — all from the comfort of home.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button 
                                onClick={() => navigate('/portal/login')}
                                className="flex items-center justify-center gap-3 px-8 py-4 bg-red-700 text-white font-bold text-lg rounded-xl shadow-xl shadow-red-700/20 hover:bg-red-800 hover:scale-[1.02] transition-all"
                            >
                                Access Client Portal <ArrowRight size={20} />
                            </button>
                            <a href="tel:3148492800" className="flex items-center justify-center gap-3 px-8 py-4 bg-white text-gray-700 font-bold text-lg rounded-xl border-2 border-gray-200 hover:border-red-200 hover:text-red-700 transition-all">
                                <Phone size={20} /> Call us at 314-849-2800
                            </a>
                        </div>
                    </div>
                    <div className="relative">
                        {/* Portal Preview Mockup */}
                        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 transform rotate-1 hover:rotate-0 transition-all duration-500">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                                <span className="text-[10px] font-mono text-gray-400 ml-2">portal.stlacs.com</span>
                            </div>
                            <div className="space-y-4">
                                <div className="bg-gradient-to-r from-red-700 to-red-800 rounded-2xl p-5 text-white">
                                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Welcome Back</p>
                                    <p className="text-2xl font-black mt-1">SATOP Level IV</p>
                                    <p className="text-sm opacity-80 mt-1">Program Progress: 85%</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-50 rounded-xl p-3">
                                        <p className="text-[9px] font-bold uppercase text-gray-400 tracking-widest">Next Session</p>
                                        <p className="font-bold text-sm mt-1">Tomorrow, 2pm</p>
                                    </div>
                                    <div className="bg-amber-50 rounded-xl p-3">
                                        <p className="text-[9px] font-bold uppercase text-amber-600 tracking-widest">Pending Forms</p>
                                        <p className="font-bold text-sm text-amber-800 mt-1">3 to complete</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1 bg-green-50 border border-green-100 rounded-xl p-2 text-center">
                                        <p className="text-[9px] font-bold text-green-600">✓ Intake</p>
                                    </div>
                                    <div className="flex-1 bg-green-50 border border-green-100 rounded-xl p-2 text-center">
                                        <p className="text-[9px] font-bold text-green-600">✓ Consent</p>
                                    </div>
                                    <div className="flex-1 bg-amber-50 border border-amber-100 rounded-xl p-2 text-center">
                                        <p className="text-[9px] font-bold text-amber-600">⏳ Recovery Plan</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* What You Can Do */}
            <section className="bg-gray-50 py-20">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Everything You Need, All in One Place</h2>
                        <p className="text-gray-500 mt-3 max-w-xl mx-auto">Your secure portal puts your entire program at your fingertips — no phone calls, no paper shuffling.</p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            { icon: FileText, title: 'Complete Forms Online', desc: 'Fill out intake paperwork, consent forms, and recovery plans from any device — before you even walk in.', color: 'bg-red-50 text-red-700' },
                            { icon: BarChart, title: 'Track Your Progress', desc: 'See exactly where you stand — session hours completed, compliance status, and what\'s left to finish.', color: 'bg-blue-50 text-blue-700' },
                            { icon: Clock, title: 'Manage Your Schedule', desc: 'View upcoming sessions, see your appointment history, and know exactly when you need to be there.', color: 'bg-green-50 text-green-700' },
                            { icon: CreditCard, title: 'Handle Payments', desc: 'View your balance, see payment history, and download statements — all in one place.', color: 'bg-purple-50 text-purple-700' },
                            { icon: Users, title: 'Stay Connected', desc: 'Your counselor can see your progress in real-time. No need to chase down paperwork or call the office.', color: 'bg-indigo-50 text-indigo-700' },
                            { icon: Lock, title: 'Private & Secure', desc: 'Your information is protected with the same level of security used by healthcare providers nationwide.', color: 'bg-amber-50 text-amber-700' },
                        ].map((feature, i) => (
                            <div key={i} className="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                <div className={`w-14 h-14 rounded-2xl ${feature.color} flex items-center justify-center mb-5`}>
                                    <feature.icon size={24} />
                                </div>
                                <h3 className="text-lg font-black text-gray-900">{feature.title}</h3>
                                <p className="text-sm text-gray-500 mt-2 leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Our Commitment - mirrors stlacs.com values */}
            <section className="py-20">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-red-700 mb-3">Our Commitment</p>
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Every program we provide is guided by four commitments</h2>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[
                            { icon: Lock, title: 'Confidentiality', desc: 'Your privacy is protected at all times' },
                            { icon: Shield, title: 'Professionalism', desc: 'Programs that courts and employers recognize' },
                            { icon: Heart, title: 'Compassion', desc: 'Treatment with care and without judgment' },
                            { icon: MapPin, title: 'Local Support', desc: 'Serving St. Louis City and the greater metro area' },
                        ].map((item, i) => (
                            <div key={i} className="text-center space-y-4">
                                <div className="w-16 h-16 mx-auto rounded-2xl bg-red-50 text-red-700 flex items-center justify-center">
                                    <item.icon size={28} />
                                </div>
                                <h3 className="text-lg font-black text-gray-900">{item.title}</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="bg-gray-50 py-20">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">The Process is Clear</h2>
                        <p className="text-gray-500 mt-3">Getting started with your client portal is straightforward.</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { step: '1', title: 'Book Your Assessment', desc: 'Call our office or use the website to schedule your initial assessment with a licensed counselor.' },
                            { step: '2', title: 'Get Portal Access', desc: 'After enrollment, your counselor provides you with secure login credentials to access your personal portal.' },
                            { step: '3', title: 'Complete & Track', desc: 'Fill out required forms, track your session hours, manage payments, and monitor your progress toward completion.' },
                        ].map((item, i) => (
                            <div key={i} className="text-center space-y-4">
                                <div className="w-16 h-16 mx-auto rounded-full bg-red-700 text-white text-2xl font-black flex items-center justify-center shadow-xl shadow-red-700/20">
                                    {item.step}
                                </div>
                                <h3 className="text-xl font-black text-gray-900">{item.title}</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Programs We Serve */}
            <section className="py-20">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-red-700 mb-3">Our Programs</p>
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Certified by the Missouri Division of Behavioral Health</h2>
                        <p className="text-gray-500 mt-3">All programs are accepted by the Department of Revenue and the courts.</p>
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
                            <div key={i} className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:border-red-200 hover:shadow-md transition-all">
                                <CheckCircle2 size={18} className="text-red-700 flex-shrink-0" />
                                <span className="font-bold text-gray-800 text-sm">{program}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Banner */}
            <section className="bg-red-700 py-16">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <h2 className="text-3xl font-black text-white tracking-tight">Ready to Get Started?</h2>
                    <p className="text-red-100 mt-3 max-w-lg mx-auto">If you've been enrolled in a program with ACS, click below to sign in. New clients should call our office to schedule an assessment.</p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
                        <button 
                            onClick={() => navigate('/portal/login')}
                            className="px-10 py-4 bg-white text-red-700 font-black text-lg rounded-xl shadow-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
                        >
                            <CheckCircle2 size={20} /> Sign In to Portal
                        </button>
                        <button 
                            onClick={() => navigate('/login')}
                            className="px-10 py-4 bg-transparent border-2 border-white/40 text-white font-bold text-lg rounded-xl hover:bg-white/10 transition-all"
                        >
                            Staff Login
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-400 py-12">
                <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-8">
                    <div>
                        <img src={logoUrl} alt="ACS Logo" className="h-10 brightness-0 invert opacity-60 mb-4" />
                        <p className="text-sm leading-relaxed">Assessment & Counseling Solutions provides court-approved substance abuse treatment, DWI education, and individual counseling services in the St. Louis metro area.</p>
                    </div>
                    <div>
                        <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Our Services</h4>
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
                            <li className="flex items-center gap-2"><Phone size={14} /> 314-849-2800</li>
                            <li>St. Louis, Missouri</li>
                            <li className="mt-4">
                                <button 
                                    onClick={() => navigate('/portal/login')}
                                    className="text-red-400 font-bold hover:text-red-300 transition-colors"
                                >
                                    Access Client Portal →
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-6 mt-8 pt-8 border-t border-gray-800 text-center text-xs">
                    <p>&copy; {new Date().getFullYear()} Assessment & Counseling Solutions. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default WebsitePortalBridge;
