import React, { useState, useEffect, useRef } from 'react';
import { iValtService, IValtAuthStatus } from '../services/iValtService';
import { ShieldCheck, Smartphone, Loader2, CheckCircle, Wifi, ScanFace, Cpu, MapPin, Check, AlertCircle } from 'lucide-react';

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
    message: 'Initializing Handshake...', 
    status: 'pending' 
  });
  
  // isTerminalRef prevents background simulations from overwriting final success/error states
  const isTerminalRef = useRef(false);
  const stepTimerRef = useRef<number | null>(null);

  const steps = [
      { id: 1, label: 'Push Notification', icon: Wifi },
      { id: 2, label: 'Biometric Scan', icon: ScanFace },
      { id: 3, label: 'Data Capture', icon: Smartphone },
      { id: 4, label: 'Geo-Fence Evaluation', icon: MapPin },
      { id: 5, label: 'Device Trust Score', icon: ShieldCheck },
      { id: 6, label: 'Neural Rules Engine', icon: Cpu },
      { id: 7, label: 'Access Approved', icon: CheckCircle },
  ];

  const clearInternalTimers = () => {
    if (stepTimerRef.current) {
      window.clearInterval(stepTimerRef.current);
      stepTimerRef.current = null;
    }
  };

  useEffect(() => {
    let stopPolling: (() => void) | undefined;
    isTerminalRef.current = false;

    const startFlow = async () => {
        if (!isOpen || !mobileNumber) return;

        console.log('[iVALT UI] INIT_FLOW:', mobileNumber);
        setAuthStatus({ step: 1, message: 'Initiating secure handshake...', status: 'pending' });
        clearInternalTimers();

        try {
            const reqId = await iValtService.startAuthentication(mobileNumber, demoMode);
            
            // UX Progress simulation (Slow crawl to keep UI alive during wait)
            if (!demoMode) {
              stepTimerRef.current = window.setInterval(() => {
                // If we hit success or error via polling, stop the simulation immediately
                if (isTerminalRef.current) return;
                
                setAuthStatus(prev => {
                    // Only increment if we are still pending and haven't reached the end
                    if (prev.status !== 'pending' || prev.step >= 6) return prev;
                    const nextStep = prev.step + 1;
                    return { 
                      ...prev, 
                      step: nextStep,
                      message: `${steps.find(s => s.id === nextStep)?.label || 'Verification'} in progress...`
                    };
                });
              }, 8000);
            }

            stopPolling = iValtService.pollStatus(reqId, mobileNumber, (status) => {
                // If we've already reached a terminal state (Success/Error), ignore further polling updates
                if (isTerminalRef.current) return;

                console.log('[iVALT UI] CALLBACK RECEIVED:', JSON.stringify(status, null, 2));

                // 1. TERMINAL SUCCESS: Force Step 7 and execute redirection
                if (status.status === 'success' && status.step === 7) {
                    console.log('%c[iVALT UI] *** SUCCESS HANDOVER: STEP 7 DETECTED ***', 'color: white; background: #059669; font-weight: bold; padding: 4px;');
                    
                    isTerminalRef.current = true;
                    clearInternalTimers();

                    // Lock the final success state
                    setAuthStatus({
                      step: 7,
                      status: 'success',
                      message: 'Identity Verified – Access Granted',
                      request_id: status.request_id
                    });

                    // 2s Visual confirmation for user before parent callback/redirect
                    setTimeout(() => {
                        console.log('[iVALT UI] Redirection sequence started.');
                        onSuccess();
                    }, 2000);

                    return;
                }

                // 2. TERMINAL ERROR
                if (status.status === 'error') {
                    isTerminalRef.current = true;
                    clearInternalTimers();
                    setAuthStatus({ ...status });
                    return;
                }

                // 3. PENDING UPDATE: Sync UI with backend progress (but only if not in terminal state)
                if (!isTerminalRef.current) {
                    setAuthStatus(prev => {
                        // Always move forward, never backward in UI steps
                        const newStep = Math.max(prev.step, status.step || 1);
                        return {
                            ...prev,
                            ...status,
                            step: newStep,
                        };
                    });
                }
            }, demoMode);
        } catch (error: any) {
            clearInternalTimers();
            setAuthStatus({ step: 0, message: error.message || 'Connection failed.', status: 'error' });
        }
    };

    if (isOpen) {
        startFlow();
    }

    return () => {
        if (stopPolling) stopPolling();
        clearInternalTimers();
        isTerminalRef.current = true;
    };
  }, [isOpen, mobileNumber, demoMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 animate-fade-in-up">
            <div className={`p-6 text-white text-center transition-colors duration-500 ${authStatus.status === 'error' ? 'bg-red-600' : authStatus.status === 'success' ? 'bg-green-600' : 'bg-gradient-to-r from-red-800 to-[#8B1538]'}`}>
                {demoMode && (
                  <div className="mb-2 px-3 py-1 bg-amber-500 text-amber-900 text-[10px] font-black rounded-full inline-block uppercase tracking-widest">
                    🎭 Demo Mode Active
                  </div>
                )}
                <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm shadow-inner">
                    {authStatus.status === 'error' ? (
                      <AlertCircle className="w-10 h-10 text-white" />
                    ) : authStatus.status === 'success' ? (
                      <CheckCircle className="w-10 h-10 text-white animate-bounce" />
                    ) : (
                      <ScanFace className="w-10 h-10 text-white" />
                    )}
                </div>
                <h2 className="text-xl font-bold tracking-tight">iValt Identity Vault</h2>
                <p className="text-red-100 text-sm opacity-80">Securing session for +1 {mobileNumber}</p>
            </div>
            
            <div className="p-6 bg-slate-50 dark:bg-slate-950">
                <div className="mb-6 text-center min-h-[64px]">
                    <h3 className={`text-lg font-black uppercase tracking-tight mb-1 transition-colors ${authStatus.status === 'success' ? 'text-green-600' : authStatus.status === 'error' ? 'text-red-600' : 'text-slate-800 dark:text-white'}`}>
                        {authStatus.status === 'success' ? 'TRUST ESTABLISHED' : authStatus.status === 'error' ? 'VERIFICATION FAILED' : 'ANALYZING BIOMETRIC FEED'}
                    </h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {authStatus.message}
                    </p>
                </div>

                <div className="space-y-2">
                    {steps.map((step) => {
                        const isCompleted = authStatus.step > step.id || (authStatus.step === 7 && step.id === 7 && authStatus.status === 'success');
                        const isCurrent = authStatus.step === step.id && authStatus.status === 'pending';

                        return (
                            <div key={step.id} className={`flex items-center gap-3 p-2.5 rounded-xl transition-all duration-500 ${isCurrent || isCompleted ? 'opacity-100 scale-[1.02]' : 'opacity-40 grayscale-[0.5]'}`}>
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all duration-500 ${isCompleted ? 'bg-green-100 border-green-200 text-green-600' : isCurrent ? 'bg-[#8B1538] border-[#8B1538] text-white shadow-lg shadow-[#8B1538]/20' : 'bg-slate-200 border-slate-300 text-slate-400'}`}>
                                    {isCompleted ? <Check size={18} /> : <step.icon size={18} className={isCurrent ? 'animate-spin' : ''} />}
                                </div>
                                <div className="flex-1">
                                    <p className={`text-xs font-black uppercase tracking-widest ${isCompleted ? 'text-green-700 dark:text-green-400' : isCurrent ? 'text-[#8B1538] dark:text-red-400' : 'text-slate-500'}`}>
                                        {step.label}
                                    </p>
                                </div>
                                {isCurrent && <Loader2 className="w-4 h-4 text-[#8B1538] animate-spin" />}
                                {isCompleted && <Check size={14} className="text-green-500" />}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${authStatus.status === 'error' ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        {authStatus.status === 'error' ? 'UPLINK_INTERRUPTED' : 'UPLINK_STABLE'}
                    </span>
                </div>
                <button 
                  onClick={onClose} 
                  className="px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                >
                    {authStatus.status === 'success' ? 'Close' : 'Cancel'}
                </button>
            </div>
        </div>
    </div>
  );
};

export default IValtMfaModal;