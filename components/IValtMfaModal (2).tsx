
import React, { useState, useEffect, useRef } from 'react';
import { iValtService, IValtAuthStatus } from '../services/iValtService';
import { ShieldCheck, Loader2, CheckCircle, ScanFace, Lock, Wifi } from 'lucide-react';

interface IValtMfaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mobileNumber: string;
  demoMode?: boolean;
}

const IValtMfaModal: React.FC<IValtMfaModalProps> = ({ isOpen, onClose, onSuccess, mobileNumber, demoMode = false }) => {
  const [authStatus, setAuthStatus] = useState<IValtAuthStatus>({ 
    step: 1, 
    message: 'Initializing Secure Link...', 
    status: 'pending' 
  });
  
  // The 'isLocked' Ref is the key to preventing UI flickering during async polling
  const isLockedRef = useRef(false);

  useEffect(() => {
    let stopPolling: (() => void) | undefined;
    isLockedRef.current = false;

    const startHandshake = async () => {
        if (!isOpen || !mobileNumber) return;

        console.log('[WestFlow Auth] Initiating secure mobile uplink...');
        setAuthStatus({ step: 1, message: 'Pushing Biometric Request...', status: 'pending' });

        try {
            const reqId = await iValtService.startAuthentication(mobileNumber, demoMode);
            
            stopPolling = iValtService.pollStatus(reqId, mobileNumber, (status) => {
                // Ignore any packets that arrive after we've locked a success or error
                if (isLockedRef.current) return;

                // --- TERMINAL SUCCESS DETECTION ---
                if (status.status === 'success') {
                    console.log('%c[Auth Node] Success Detected. Locking State.', 'color: white; background: #16a34a; font-weight: bold;');
                    
                    isLockedRef.current = true;
                    setAuthStatus({
                      step: 7,
                      status: 'success',
                      message: 'Identity Verified Successfully',
                      request_id: status.request_id || reqId
                    });

                    // Professional 300ms transition delay
                    setTimeout(() => {
                        onSuccess();
                    }, 300);
                    return;
                }

                // --- TERMINAL ERROR DETECTION ---
                if (status.status === 'error') {
                    isLockedRef.current = true;
                    setAuthStatus(status);
                    return;
                }

                // --- PENDING UPDATE ---
                setAuthStatus(status);
            }, demoMode);
        } catch (error: any) {
            setAuthStatus({ step: 0, message: error.message || 'Gateway offline.', status: 'error' });
        }
    };

    if (isOpen) {
        startHandshake();
    }

    return () => {
        if (stopPolling) stopPolling();
        isLockedRef.current = true; // Cleanup lock
    };
  }, [isOpen, mobileNumber, demoMode, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl z-[100] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-white/10 animate-fade-in-up">
            <div className={`p-10 text-white text-center transition-all duration-700 ${authStatus.status === 'error' ? 'bg-red-600' : authStatus.status === 'success' ? 'bg-emerald-600' : 'bg-gradient-to-b from-[#8B1E24] to-[#601026]'}`}>
                <div className="mx-auto w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center mb-6 backdrop-blur-md border border-white/20 shadow-inner group">
                    {authStatus.status === 'error' ? (
                      <Lock className="w-12 h-12 text-white" />
                    ) : authStatus.status === 'success' ? (
                      <CheckCircle className="w-12 h-12 text-white animate-bounce" />
                    ) : (
                      <ScanFace className="w-12 h-12 text-white animate-pulse" />
                    )}
                </div>
                <h2 className="text-3xl font-black tracking-tighter">
                    {authStatus.status === 'success' ? 'ACCESS GRANTED' : 'iVALT SECURE'}
                </h2>
                <div className="flex items-center justify-center gap-2 mt-3">
                  <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-ping"></div>
                  <p className="text-white/60 text-[9px] font-black uppercase tracking-[0.2em]">+1 {mobileNumber}</p>
                </div>
            </div>
            
            <div className="p-10 bg-slate-50 dark:bg-slate-950 text-center min-h-[180px] flex flex-col justify-center items-center">
                {authStatus.status === 'pending' ? (
                  <div className="space-y-4">
                    <div className="flex justify-center gap-1.5 h-6 items-end">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-1 bg-primary rounded-full animate-bounce" style={{ height: '60%', animationDelay: `${i * 0.15}s` }}></div>
                      ))}
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{authStatus.message}</p>
                  </div>
                ) : authStatus.status === 'success' ? (
                  <div className="animate-fade-in-up">
                    <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Synchronizing Encrypted Sessions...</p>
                    <div className="mt-4 flex justify-center gap-2">
                       <Wifi className="w-4 h-4 text-emerald-500" />
                       <span className="text-[10px] font-mono text-emerald-600 font-bold">UPLINK_STABLE</span>
                    </div>
                  </div>
                ) : (
                  <div className="animate-shake">
                    <p className="text-red-600 font-black text-lg uppercase tracking-tight">Security Halt</p>
                    <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-widest">{authStatus.message}</p>
                    <button onClick={onClose} className="mt-6 px-6 py-2 bg-slate-200 dark:bg-slate-800 rounded-xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-300 transition-all">Retry</button>
                  </div>
                )}
            </div>

            <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                <button 
                  onClick={onClose} 
                  className="text-[9px] font-black text-slate-400 hover:text-slate-900 dark:hover:text-white uppercase tracking-[0.2em] transition-colors"
                >
                    TERMINATE HANDSHAKE
                </button>
            </div>
        </div>
    </div>
  );
};

export default IValtMfaModal;
