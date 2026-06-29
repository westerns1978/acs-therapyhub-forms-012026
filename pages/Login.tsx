import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import IValtMfaModal from '../components/IValtMfaModal';
import { Mail, Lock, AlertTriangle, ChevronLeft, ArrowRight } from 'lucide-react';
import type { StaffRole } from '../types';

const ACS_LOGO_URL = 'https://storage.googleapis.com/gemynd-public/projects/acs-therapyhub/ACS%20Full%20Logomark.svg';

// The three live ACS staff accounts, shown as the real people who use them.
// Each maps to a REAL Supabase Auth account (pilot password); picking a role
// signs into that account (see services/authService.ts).
const demoRoles: { role: StaffRole; name: string }[] = [
  { role: 'Director',  name: 'David Yoder' },
  { role: 'Therapist', name: 'Karen Ventimiglia' },
  { role: 'Admin',     name: 'Jessica' },
];

const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  Director: 'Full access — clinical, financial, settings.',
  Therapist: 'Clinical work — notes, treatment plans, sessions.',
  Admin: 'Office work — intake, scheduling, billing.',
};

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithPassword, loginDemo, logout } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showDemoPicker, setShowDemoPicker] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // iVALT second-factor state. `mfaPhone` is the registered phone (if the
  // account carries one); empty → the modal runs its demo handshake.
  const [isMfaOpen, setIsMfaOpen] = useState(false);
  const [mfaPhone, setMfaPhone] = useState('');

  // PRIMARY FACTOR: real Supabase email/password sign-in. On success a real
  // session already exists; we then run iVALT as the secondary factor.
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }

    setIsLoading(true);
    const res = await loginWithPassword(email, password);
    if (res.error) {
      setError(res.error);
      setIsLoading(false);
      return;
    }

    // ─────────────────────────────────────────────────────────────────────
    // iVALT SECONDARY FACTOR ATTACHES HERE.
    // The primary Supabase session was just created by loginWithPassword()
    // above. If the account carries a registered phone, iVALT runs on top of
    // it as a real second factor before we land in the app. Accounts WITHOUT
    // a registered phone get NO MFA ceremony at all — the old fallback ran the
    // modal's demo handshake, a spinner that verified nothing and always
    // granted access (pre-provisioning honesty pass, 2026-06-11). (Hard
    // MFA-gating + phone enrollment is a later hardening step.)
    // ─────────────────────────────────────────────────────────────────────
    if (res.phone) {
      setMfaPhone(res.phone);
      setIsMfaOpen(true);
    } else {
      setIsLoading(false);
      navigate('/dashboard');
    }
  };

  const handleMfaSuccess = () => {
    setIsMfaOpen(false);
    setIsLoading(false);
    navigate('/dashboard');
  };

  // If the user abandons the second factor, drop the half-authenticated
  // session so they don't remain signed in without completing iVALT.
  const handleMfaClose = () => {
    setIsMfaOpen(false);
    setIsLoading(false);
    void logout();
  };

  // DEMO PATH: bypasses iVALT (as before) but now produces a REAL test session.
  const handleDemoLogin = async (role: StaffRole) => {
    setError('');
    setIsLoading(true);
    const res = await loginDemo(role);
    if (res.error) {
      setError(res.error);
      setIsLoading(false);
      return;
    }
    setIsLoading(false);
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
            roles={demoRoles}
            isLoading={isLoading}
            onPick={handleDemoLogin}
            onBack={() => { setShowDemoPicker(false); setError(''); }}
          />
        ) : (
          <RealSignInForm
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
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

      {/* Only opens when the account has a registered phone, so this is always
          the REAL handshake — demoMode is no longer passed (no-phone logins
          skip MFA entirely; see handleSignIn). */}
      <IValtMfaModal
        isOpen={isMfaOpen}
        onClose={handleMfaClose}
        onSuccess={handleMfaSuccess}
        mobileNumber={mfaPhone.replace(/\D/g, '')}
      />
    </div>
  );
};

interface RealSignInFormProps {
  email: string;
  setEmail: (s: string) => void;
  password: string;
  setPassword: (s: string) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onSwitchToDemo: () => void;
}

const RealSignInForm: React.FC<RealSignInFormProps> = ({
  email, setEmail, password, setPassword, isLoading, onSubmit, onSwitchToDemo,
}) => (
  <form onSubmit={onSubmit} className="space-y-5">
    <div>
      <label htmlFor="email" className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
        Work email
      </label>
      <div className="relative">
        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@acs-therapy.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="block w-full pl-12 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-base"
        />
      </div>
    </div>

    <div>
      <label htmlFor="password" className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
        Password
      </label>
      <div className="relative">
        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="block w-full pl-12 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-base"
        />
      </div>
      <p className="text-xs text-slate-500 mt-2">If your account has iVALT enrolled, you'll approve the sign-in on your phone.</p>
    </div>

    <button
      type="submit"
      disabled={isLoading}
      className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-primary hover:bg-primary-focus text-white font-bold text-sm rounded-2xl shadow-lg shadow-primary/20 transition-all disabled:opacity-50 active:scale-[0.98]"
    >
      {isLoading ? 'Signing in…' : 'Sign in to ACS TherapyHub'}
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
  roles: { role: StaffRole; name: string }[];
  isLoading: boolean;
  onPick: (role: StaffRole) => void;
  onBack: () => void;
}

const DemoRolePicker: React.FC<DemoRolePickerProps> = ({ roles, isLoading, onPick, onBack }) => (
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
        Pick a role to enter the trial without iVALT. Each role signs into a real (test) account scoped to that role.
      </p>
    </div>

    <div className="space-y-2">
      {roles.map(s => (
        <button
          key={s.role}
          type="button"
          disabled={isLoading}
          onClick={() => onPick(s.role)}
          className="w-full text-left p-4 bg-slate-50 dark:bg-slate-800 hover:bg-primary/5 dark:hover:bg-primary/10 border border-slate-200 dark:border-slate-700 hover:border-primary/30 rounded-2xl transition-all group disabled:opacity-50"
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
