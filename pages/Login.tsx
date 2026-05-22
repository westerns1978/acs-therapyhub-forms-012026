import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import IValtMfaModal from '../components/IValtMfaModal';
import { Smartphone, AlertTriangle, ChevronLeft, ArrowRight } from 'lucide-react';
import type { User, UserRole } from '../types';
import { lookupStaffByPhone } from '../data/staffDirectory';

const ACS_LOGO_URL = 'https://storage.googleapis.com/westerns1978-digital-assets/Websites/acs-therapy/ACS-Logo1.svg';

// Demo personas mirror the trial roster. Demo path never goes through iVALT —
// clicking a role drops the user straight into the role-scoped view.
const demoStaff: { role: UserRole; name: string; id: string; email: string }[] = [
    { id: 'demo-director', role: 'Director', name: 'David Yoder',  email: 'david.yoder@acs-therapy.com' },
    { id: 'demo-therapist', role: 'Therapist', name: 'Karen',       email: 'karen@acs-therapy.com' },
    { id: 'demo-admin', role: 'Admin', name: 'Jessica',      email: 'jessica@acs-therapy.com' },
];

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
    Director: 'Full access — clinical, financial, settings.',
    Therapist: 'Clinical work — notes, treatment plans, sessions.',
    Admin: 'Office work — intake, scheduling, billing.',
};

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [phone, setPhone] = useState('');
    const [showDemoPicker, setShowDemoPicker] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isMfaOpen, setIsMfaOpen] = useState(false);

    const handleSignIn = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const digits = phone.replace(/\D/g, '');
        if (digits.length !== 10) {
            setError('Enter a 10-digit phone number registered with iVALT.');
            return;
        }

        setIsLoading(true);
        setIsMfaOpen(true);
    };

    // Called by IValtMfaModal.onSuccess. Phone is already validated by handleSignIn;
    // here we map iVALT-approved phone → known staff entry. If the phone isn't in
    // the directory we fail closed.
    const completeRealLogin = () => {
        setIsMfaOpen(false);

        const entry = lookupStaffByPhone(phone);
        if (!entry) {
            setError('iVALT approved but this phone number is not registered to a TherapyHub account. Contact your administrator.');
            setIsLoading(false);
            return;
        }

        const realUser: User = {
            id: entry.email,
            name: entry.name,
            email: entry.email,
            role: entry.role,
        };
        login(realUser);
        setIsLoading(false);
        navigate('/dashboard');
    };

    const handleDemoLogin = (staff: typeof demoStaff[number]) => {
        const user: User = {
            id: staff.id,
            name: staff.name,
            email: staff.email,
            role: staff.role,
        };
        login(user);
        navigate('/dashboard');
    };

    const cardClass = 'w-full max-w-md p-8 space-y-6 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-black/5 dark:border-white/5';

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
            <div className={cardClass}>
                <div className="text-center space-y-3">
                    <img
                        src={ACS_LOGO_URL}
                        alt="ACS TherapyHub"
                        className="mx-auto h-14 object-contain dark:bg-white/90 dark:p-2 dark:rounded-lg"
                    />
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">ACS TherapyHub</h1>
                    <p className="text-sm text-slate-500">Clinical operations for Assessment &amp; Counseling Solutions.</p>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-red-700">
                        <AlertTriangle className="shrink-0 mt-0.5" size={16} />
                        <p className="text-xs font-medium leading-relaxed">{error}</p>
                    </div>
                )}

                {showDemoPicker ? (
                    <DemoRolePicker
                        staff={demoStaff}
                        onPick={handleDemoLogin}
                        onBack={() => { setShowDemoPicker(false); setError(''); }}
                    />
                ) : (
                    <RealSignInForm
                        phone={phone}
                        setPhone={setPhone}
                        isLoading={isLoading}
                        onSubmit={handleSignIn}
                        onSwitchToDemo={() => { setShowDemoPicker(true); setError(''); }}
                    />
                )}

                <div className="text-center text-sm pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Link to="/portal" className="font-medium text-primary hover:text-primary-focus">
                        Are you a client? Log in here
                    </Link>
                </div>
            </div>

            <IValtMfaModal
                isOpen={isMfaOpen}
                onClose={() => { setIsMfaOpen(false); setIsLoading(false); }}
                onSuccess={completeRealLogin}
                mobileNumber={phone.replace(/\D/g, '')}
                demoMode={false}
            />
        </div>
    );
};

interface RealSignInFormProps {
    phone: string;
    setPhone: (s: string) => void;
    isLoading: boolean;
    onSubmit: (e: React.FormEvent) => void;
    onSwitchToDemo: () => void;
}

const RealSignInForm: React.FC<RealSignInFormProps> = ({ phone, setPhone, isLoading, onSubmit, onSwitchToDemo }) => (
    <form onSubmit={onSubmit} className="space-y-5">
        <div>
            <label htmlFor="phone" className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                Phone — used for sign-in approval
            </label>
            <div className="relative">
                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <span className="absolute left-12 top-1/2 -translate-y-1/2 text-sm font-mono text-slate-400 pr-3 border-r border-slate-200 dark:border-slate-700">+1</span>
                <input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={14}
                    placeholder="10-digit mobile number"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                    className="block w-full pl-20 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-base font-mono"
                />
            </div>
            <p className="text-xs text-slate-500 mt-2">Approve the request on your phone via iVALT.</p>
        </div>

        <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-primary hover:bg-primary-focus text-white font-bold text-sm rounded-2xl shadow-lg shadow-primary/20 transition-all disabled:opacity-50 active:scale-[0.98]"
        >
            Sign in to ACS TherapyHub
            <ArrowRight size={16} />
        </button>

        <button
            type="button"
            onClick={onSwitchToDemo}
            className="w-full py-3 px-4 bg-transparent border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-sm rounded-2xl transition-all"
        >
            Continue with demo access
        </button>
    </form>
);

interface DemoRolePickerProps {
    staff: typeof demoStaff;
    onPick: (s: typeof demoStaff[number]) => void;
    onBack: () => void;
}

const DemoRolePicker: React.FC<DemoRolePickerProps> = ({ staff, onPick, onBack }) => (
    <div className="space-y-4">
        <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-primary transition-colors"
        >
            <ChevronLeft size={14} /> Back to sign in
        </button>

        <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                Enter the demo as
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
                Pick a role to enter the trial without iVALT. Each role lands in the same view a real login of that role would.
            </p>
        </div>

        <div className="space-y-2">
            {staff.map(s => (
                <button
                    key={s.id}
                    type="button"
                    onClick={() => onPick(s)}
                    className="w-full text-left p-4 bg-slate-50 dark:bg-slate-800 hover:bg-primary/5 dark:hover:bg-primary/10 border border-slate-200 dark:border-slate-700 hover:border-primary/30 rounded-2xl transition-all group"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-black text-slate-900 dark:text-white">{s.role}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{s.name}</div>
                        </div>
                        <ArrowRight size={16} className="text-slate-400 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{ROLE_DESCRIPTIONS[s.role]}</p>
                </button>
            ))}
        </div>
    </div>
);

export default Login;
