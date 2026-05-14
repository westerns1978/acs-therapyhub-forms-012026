import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import IValtMfaModal from '../components/IValtMfaModal';
import { Smartphone, Lock, Mail, AlertTriangle, Loader2, ShieldCheck, ChevronDown } from 'lucide-react';
import type { User } from '../types';

const ACS_LOGO_URL = 'https://storage.googleapis.com/westerns1978-digital-assets/Websites/acs-therapy/ACS-Logo1.svg';

const demoStaff: User[] = [
    {
        id: 'staff-david-yoder',
        name: 'David Yoder',
        email: 'david.yoder@acs-therapy.com',
        role: 'Admin',
    },
    {
        id: 'staff-anya-sharma',
        name: 'Dr. Anya Sharma',
        email: 'anya.sharma@acs-therapy.com',
        role: 'Clinical',
    },
];

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mobile, setMobile] = useState('');
    const [useMfa, setUseMfa] = useState(false);

    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isMfaOpen, setIsMfaOpen] = useState(false);

    const handleDemoLogin = (staff: User) => {
        login(staff);
        navigate('/dashboard');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Email and password are required.');
            return;
        }
        if (useMfa && (!mobile || mobile.length < 10)) {
            setError('Enter a 10-digit mobile number for iVALT MFA.');
            return;
        }

        setIsLoading(true);

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (authError) throw authError;

            if (useMfa) {
                setIsMfaOpen(true);
            } else {
                completeLogin();
            }
        } catch (err: any) {
            setError(err.message || 'Sign-in failed. Please try again.');
            setIsLoading(false);
        }
    };

    const completeLogin = () => {
        setIsMfaOpen(false);
        setIsLoading(false);
        const role: User['role'] = email.includes('admin') || email.includes('david') ? 'Admin' : 'Clinical';
        const mockUser: User = {
            id: 'staff-' + email.split('@')[0],
            name: role === 'Admin' ? 'David Yoder' : 'Dr. Anya Sharma',
            email,
            role,
        };
        login(mockUser);
        navigate('/dashboard');
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-surface p-4">
            <div className="w-full max-w-md p-8 space-y-6 bg-background rounded-2xl shadow-lg border border-border">
                <div className="text-center">
                    <img
                        src={ACS_LOGO_URL}
                        alt="ACS Logo"
                        className="mx-auto h-16 object-contain dark:bg-white/90 dark:p-2 dark:rounded-lg"
                    />
                    <h2 className="mt-6 text-2xl font-bold text-on-surface">Staff Portal</h2>
                    <p className="mt-2 text-sm text-on-surface-secondary">
                        Welcome. Sign in to access the clinical workspace.
                    </p>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700">
                        <AlertTriangle className="shrink-0 mt-0.5" size={16} />
                        <p className="text-xs font-medium leading-relaxed">{error}</p>
                    </div>
                )}

                <form className="space-y-4" onSubmit={handleLogin}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="email"
                                autoComplete="email"
                                required
                                className="appearance-none relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-500 text-on-surface rounded-t-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                                placeholder="Staff email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="password"
                                autoComplete="current-password"
                                required
                                className="appearance-none relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-500 text-on-surface rounded-b-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setUseMfa(v => !v)}
                        className="w-full flex items-center justify-between text-xs font-semibold text-on-surface-secondary hover:text-primary transition"
                    >
                        <span className="flex items-center gap-2">
                            <ShieldCheck size={14} />
                            iVALT MFA (optional)
                        </span>
                        <ChevronDown size={14} className={`transition-transform ${useMfa ? 'rotate-180' : ''}`} />
                    </button>

                    {useMfa && (
                        <div className="relative">
                            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <div className="absolute left-9 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pr-2 ml-1 border-r border-gray-200">+1</div>
                            <input
                                type="tel"
                                maxLength={10}
                                className="appearance-none block w-full pl-16 pr-3 py-3 border border-gray-300 placeholder-gray-500 text-on-surface rounded-md focus:outline-none focus:ring-primary focus:border-primary sm:text-sm font-mono"
                                placeholder="10-digit mobile number"
                                value={mobile}
                                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="group relative w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition disabled:opacity-50"
                    >
                        {isLoading && <Loader2 className="animate-spin" size={16} />}
                        Sign In
                    </button>
                </form>

                <div className="pt-4 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center mb-3">
                        Demo Access
                    </p>
                    {demoStaff.map(staff => (
                        <button
                            key={staff.id}
                            onClick={() => handleDemoLogin(staff)}
                            className="w-full text-left px-4 py-3 mb-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all"
                        >
                            <div className="font-semibold text-sm">{staff.name}</div>
                            <div className="text-xs text-gray-500">
                                {staff.role === 'Admin' ? 'Director' : 'Clinical'}
                            </div>
                        </button>
                    ))}
                </div>

                <div className="text-center text-sm space-y-2">
                    <Link to="/portal" className="block font-medium text-primary hover:text-primary-focus">
                        Are you a client? Log in here
                    </Link>
                </div>
            </div>

            <IValtMfaModal
                isOpen={isMfaOpen}
                onClose={() => { setIsMfaOpen(false); setIsLoading(false); }}
                onSuccess={completeLogin}
                mobileNumber={mobile}
                demoMode={false}
            />
        </div>
    );
};

export default Login;
