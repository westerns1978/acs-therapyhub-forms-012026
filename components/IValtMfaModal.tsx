
import React, { useState, useRef, useEffect } from 'react';
import { IValtService, IValtAuthStatus } from '../services/iValtService';
import { CheckCircle, ScanFace, Lock, Wifi } from 'lucide-react';

interface IValtMfaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mobileNumber: string;
  demoMode?: boolean;
}

const IValtMfaModal: React.FC<IValtMfaModalProps> = ({ isOpen, onClose, onSuccess, mobileNumber, demoMode = false }) => {
  const [status, setStatus] = useState<IValtAuthStatus>({
    status: 'pending',
    message: 'Initializing Secure Link...',
  });

  const locked = useRef(false);
  const service = useRef(new IValtService());
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    locked.current = false;
    hasStarted.current = false;
    service.current = new IValtService();
    setStatus({ status: 'pending', message: 'Initializing Secure Link...' });

    const runAuth = async () => {
      if (hasStarted.current) return;
      hasStarted.current = true;

      if (demoMode) {
        setStatus({ status: 'pending', message: 'Demo: Sending biometric request...' });
        setTimeout(() => {
          if (!locked.current) setStatus({ status: 'pending', message: 'Demo: Awaiting biometric scan...' });
        }, 1000);
        setTimeout(() => {
          if (!locked.current) setStatus({ status: 'pending', message: 'Demo: Verifying identity...' });
        }, 2000);
        setTimeout(() => {
          if (!locked.current) {
            locked.current = true;
            setStatus({ status: 'success', message: 'Access Granted' });
            setTimeout(onSuccess, 300);
          }
        }, 3500);
        return;
      }

      try {
        await service.current.initiateHandshake(mobileNumber);
        setStatus({ status: 'pending', message: 'Check your phone now' });

        service.current.startPolling(
          (s) => {
            if (locked.current) return;
            if (s.status === 'success') locked.current = true;
            setStatus(s);
          },
          onSuccess,
          (err) => {
            if (!locked.current) {
              setStatus({ status: 'failed', message: err });
            }
          }
        );
      } catch (err) {
        setStatus({
          status: 'failed',
          message: err instanceof Error ? err.message : 'Handshake failed',
        });
      }
    };

    runAuth();

    return () => {
      service.current.cancel();
      locked.current = true;
    };
  }, [isOpen, mobileNumber, demoMode]);

  if (!isOpen) return null;

  const isFailed = status.status === 'failed';
  const isSuccess = status.status === 'success';

  return (
    <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-white/10 animate-fade-in-up">
        <div className={`p-10 text-white text-center transition-all duration-700 ${isFailed ? 'bg-red-600' : isSuccess ? 'bg-emerald-600' : 'bg-gradient-to-b from-[#8B1E24] to-[#601026]'}`}>
          <div className="mx-auto w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center mb-6 backdrop-blur-md border border-white/20 shadow-inner">
            {isFailed ? (
              <Lock className="w-12 h-12 text-white" />
            ) : isSuccess ? (
              <CheckCircle className="w-12 h-12 text-white animate-bounce" />
            ) : (
              <ScanFace className="w-12 h-12 text-white animate-pulse" />
            )}
          </div>
          <h2 className="text-3xl font-black tracking-tighter">
            {isSuccess ? 'ACCESS GRANTED' : 'iVALT SECURE'}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-ping"></div>
            <p className="text-white/60 text-[9px] font-black uppercase tracking-[0.2em]">+1 {mobileNumber}</p>
          </div>
        </div>

        <div className="p-10 bg-slate-50 dark:bg-slate-950 text-center min-h-[180px] flex flex-col justify-center items-center">
          {status.status === 'pending' && (
            <div className="space-y-4">
              <div className="flex justify-center gap-1.5 h-6 items-end">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1 bg-primary rounded-full animate-bounce" style={{ height: '60%', animationDelay: `${i * 0.15}s` }}></div>
                ))}
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{status.message}</p>
            </div>
          )}
          {isSuccess && (
            <div className="animate-fade-in-up">
              <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Authentication Successful</p>
              <div className="mt-4 flex justify-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px] font-mono text-emerald-600 font-bold">VERIFIED</span>
              </div>
            </div>
          )}
          {isFailed && (
            <div className="animate-shake">
              <p className="text-red-600 font-black text-lg uppercase tracking-tight">Security Halt</p>
              <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-widest">{status.message}</p>
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
