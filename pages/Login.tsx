
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
// FIX: Corrected casing to match file name 'iValtMfaModal.tsx'
import IValtMfaModal from '../components/iValtMfaModal';
import { Smartphone, Lock, ShieldCheck, Mail, AlertTriangle, Zap, Loader2, UserCheck } from 'lucide-react';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    
    const [authMode, setAuthMode] = useState<'password' | 'biometric'>('password');
    const [email, setEmail] = useState('admin@therapyhub.com');
    const [password, setPassword] = useState('demo123');
    const [mobile, setMobile] = useState('8163089206');
    const [isDemoMode, setIsDemoMode] = useState(false);
    
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isMfaOpen, setIsMfaOpen] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<{email?: boolean, password?: boolean, mobile?: boolean}>({});

    const validateFields = () => {
        const errors: {email?: boolean, password?: boolean, mobile?: boolean} = {};
        if (authMode === 'password') {
            if (!email) errors.email = true;
            if (!password) errors.password = true;
        }
        if (!mobile || mobile.length < 10) errors.mobile = true;
        
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (!validateFields()) {
            setError('Please correct your access markers.');
            return;
        }

        setIsLoading(true);
        
        try {
            if (authMode === 'password' && !isDemoMode) {
                const { error: authError } = await supabase.auth.signInWithPassword({
                    email,
                    password: password,
                });
                if (authError) throw authError;
            }
            setIsMfaOpen(true);
        } catch (err: any) {
            setError(err.message || 'Platform access denied.');
            setIsLoading(false);
        }
    };
    
    const handleMfaSuccess = async () => {
        setIsMfaOpen(false);
        const role = email.includes('admin') ? 'Admin' : 'Clinical';
        const mockUser = { 
          id: 'u1', 
          name: role === 'Admin' ? 'Lead Admin' : 'Dr. Anya Sharma', 
          email: email, 
          role: role as 'Admin' | 'Clinical' 
        };
        login(mockUser);
        navigate('/dashboard');
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(139,30,36,0.15)_0%,transparent_50%)] animate-pulse"></div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
            
            <div className="w-full max-w-md relative z-10 animate-fade-in-up">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-gradient-to-br from-[#8B1538] to-[#601026] p-5 rounded-[2rem] shadow-2xl mb-6 border border-white/20">
                        <ShieldCheck className="text-white w-14 h-14" />
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tighter">TherapyHub</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <Zap size={12} className="text-red-500 fill-red-500" />
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">Clinical Orchestrator 3.0</p>
                    </div>
                </div>

                <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-1 mb-6 flex border border-white/10 shadow-2xl">
                    <button 
                      onClick={() => setAuthMode('password')}
                      className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${authMode === 'password' ? 'bg-white text-[#8B1538] shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Lock size={14}/> Password + MFA
                    </button>
                    <button 
                      onClick={() => setAuthMode('biometric')}
                      className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${authMode === 'biometric' ? 'bg-white text-[#8B1538] shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <UserCheck size={14}/> Biometric Only
                    </button>
                </div>

                <div className="bg-white/10 backdrop-blur-2xl rounded-[3rem] p-8 shadow-2xl border border-white/10 relative overflow-hidden">
                    {isDemoMode && (
                        <div className="mb-6 p-3 bg-amber-500/20 border border-amber-500/50 rounded-2xl flex items-center justify-center gap-2 text-amber-200 text-[10px] font-black uppercase tracking-widest animate-pulse">
                            <Zap size={14} className="fill-current"/> DEMO ACTIVE
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-shake">
                            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
                            <p className="text-red-200 text-xs font-bold leading-relaxed">{error}</p>
                        </div>
                    )}

                    <form className="space-y-6" onSubmit={handleLogin}>
                        {authMode === 'password' && (
                            <>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Staff ID</label>
                                    <div className="relative">
                                        <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 ${fieldErrors.email ? 'text-red-400' : 'text-slate-500'}`} size={18} />
                                        <input
                                            type="email"
                                            className={`w-full pl-12 pr-4 py-4 bg-slate-900/50 border ${fieldErrors.email ? 'border-red-500' : 'border-white/10'} rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-[#8B1538]/50 transition-all font-medium`}
                                            placeholder="admin@therapyhub.com"
                                            value={email}
                                            onChange={(e) => {
                                                setEmail(e.target.value);
                                                setFieldErrors(prev => ({...prev, email: false}));
                                            }}
                                        />
                                    </div>
                                </div>
                                
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cipher</label>
                                    <div className="relative">
                                        <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 ${fieldErrors.password ? 'text-red-400' : 'text-slate-500'}`} size={18} />
                                        <input
                                            type="password"
                                            className={`w-full pl-12 pr-4 py-4 bg-slate-900/50 border ${fieldErrors.password ? 'border-red-500' : 'border-white/10'} rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-[#8B1538]/50 transition-all font-medium`}
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => {
                                                setPassword(e.target.value);
                                                setFieldErrors(prev => ({...prev, password: false}));
                                            }}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Uplink Mobile <span className="text-[#8B1538]">*iVALT MFA</span></label>
                            <div className="relative">
                                <Smartphone className={`absolute left-4 top-1/2 -translate-y-1/2 ${fieldErrors.mobile ? 'text-red-400' : 'text-slate-500'}`} size={18} />
                                <div className="absolute left-10 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm border-r border-white/10 pr-2 ml-1">+1</div>
                                <input
                                    type="tel"
                                    maxLength={10}
                                    className={`w-full pl-20 pr-4 py-4 bg-slate-900/50 border ${fieldErrors.mobile ? 'border-red-500' : 'border-white/10'} rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-[#8B1538]/50 transition-all font-mono`}
                                    placeholder="8163089206"
                                    value={mobile}
                                    onChange={(e) => {
                                        setMobile(e.target.value.replace(/\D/g, ''));
                                        setFieldErrors(prev => ({...prev, mobile: false}));
                                    }}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-5 bg-gradient-to-r from-[#8B1538] to-[#B11A46] hover:from-[#B11A46] hover:to-[#8B1538] text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 border border-white/10"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                            {authMode === 'password' ? 'Authorize Access' : 'Verify Identity'}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-white/5 flex flex-col items-center gap-4">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={isDemoMode}
                            onChange={(e) => setIsDemoMode(e.target.checked)}
                            className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#8B1538] focus:ring-[#8B1538]/50"
                          />
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-300 transition-colors">🎭 Demo Mode</span>
                        </label>
                    </div>
                </div>
            </div>
            
            <IValtMfaModal 
                isOpen={isMfaOpen} 
                onClose={() => {
                    setIsMfaOpen(false);
                    setIsLoading(false);
                }} 
                onSuccess={handleMfaSuccess}
                mobileNumber={mobile} 
                demoMode={isDemoMode}
            />
        </div>
    );
};

export default Login;
