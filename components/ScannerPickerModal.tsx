import React, { useEffect, useRef, useState } from 'react';
import { X, ScanLine, Loader2, Camera, AlertCircle, WifiOff } from 'lucide-react';
import { ScannerClient, type Scanner, type ScannerProtocol } from '../services/scannerClient';

interface ScannerPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (imageBase64: string, mimeType: string) => void;
  onCameraFallback: () => void;
}

type Phase =
  | 'idle'
  | 'discovering'
  | 'ready'
  | 'no_scanners'
  | 'bridge_offline'
  | 'scanning'
  | 'scan_error';

const PROTOCOL_LABEL: Record<ScannerProtocol, string> = {
  twain: 'TWAIN',
  eSCL: 'eSCL',
  twainDirect: 'TWAIN Direct',
};

const ScannerPickerModal: React.FC<ScannerPickerModalProps> = ({
  isOpen,
  onClose,
  onScanComplete,
  onCameraFallback,
}) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [scanners, setScanners] = useState<Scanner[]>([]);
  const [activeScanner, setActiveScanner] = useState<Scanner | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clientRef = useRef<ScannerClient | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPhase('idle');
      setScanners([]);
      setActiveScanner(null);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setPhase('discovering');
    setScanners([]);
    setActiveScanner(null);
    setErrorMessage(null);

    const client = new ScannerClient();
    clientRef.current = client;

    (async () => {
      const result = await client.discover();
      if (cancelled) return;
      if (!result.bridgeUrl) {
        setErrorMessage(result.error);
        setPhase('bridge_offline');
      } else if (result.scanners.length === 0) {
        setPhase('no_scanners');
      } else {
        setScanners(result.scanners);
        setPhase('ready');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleScannerClick = async (scanner: Scanner) => {
    if (!scanner.available || phase === 'scanning') return;
    setActiveScanner(scanner);
    setPhase('scanning');
    setErrorMessage(null);
    try {
      const client = clientRef.current ?? new ScannerClient();
      const result = await client.scan({
        scannerId: scanner.id,
        resolution: 300,
        colorMode: 'color',
        format: 'jpeg',
        duplex: false,
      });
      onScanComplete(result.imageBase64, result.mimeType);
    } catch (err: any) {
      setErrorMessage(err?.message ?? 'Scan failed');
      setPhase('scan_error');
    }
  };

  const runDiscovery = async () => {
    setPhase('discovering');
    setErrorMessage(null);
    setActiveScanner(null);
    const client = clientRef.current ?? new ScannerClient();
    clientRef.current = client;
    const result = await client.discover();
    if (!result.bridgeUrl) {
      setErrorMessage(result.error);
      setPhase('bridge_offline');
    } else if (result.scanners.length === 0) {
      setPhase('no_scanners');
    } else {
      setScanners(result.scanners);
      setPhase('ready');
    }
  };

  if (!isOpen) return null;

  const headerCancellable = phase !== 'scanning';
  const showCameraFallback =
    phase === 'ready' ||
    phase === 'no_scanners' ||
    phase === 'bridge_offline' ||
    phase === 'scan_error';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in-up"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanner-picker-title"
      style={{ animationDuration: '0.25s' }}
    >
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col border border-white/20 dark:border-slate-700">
        <header className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <ScanLine className="text-primary" size={20} />
            <h2 id="scanner-picker-title" className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              Scan Document
            </h2>
          </div>
          {headerCancellable && (
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 transition-all"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {phase === 'idle' && <div className="h-32" />}

          {phase === 'discovering' && (
            <div className="flex flex-col items-center justify-center py-10 text-slate-500 dark:text-slate-400">
              <Loader2 size={32} className="animate-spin text-primary mb-4" />
              <p className="text-sm font-bold uppercase tracking-widest text-center">
                Looking for FlowHub Bridge...
              </p>
            </div>
          )}

          {phase === 'ready' && (
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Available scanners
              </p>
              {scanners.map((scanner) => (
                <button
                  key={scanner.id}
                  onClick={() => handleScannerClick(scanner)}
                  disabled={!scanner.available}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                    scanner.available
                      ? 'border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-primary/5 cursor-pointer'
                      : 'border-slate-100 dark:border-slate-800 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                      {scanner.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {PROTOCOL_LABEL[scanner.protocol] ?? scanner.protocol}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest ${
                          scanner.available ? 'text-green-600 dark:text-green-400' : 'text-slate-400'
                        }`}
                      >
                        {scanner.available ? 'Available' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {phase === 'no_scanners' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <WifiOff size={32} className="text-slate-400 mb-3" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                No scanners detected on this network
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                FlowHub Bridge is online but no scanners are connected to it.
              </p>
            </div>
          )}

          {phase === 'bridge_offline' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <WifiOff size={32} className="text-slate-400 mb-3" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                FlowHub Bridge not running on this machine
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Start the bridge service or use your camera instead.
              </p>
            </div>
          )}

          {phase === 'scanning' && (
            <div className="flex flex-col items-center justify-center py-10 text-slate-500 dark:text-slate-400">
              <Loader2 size={32} className="animate-spin text-primary mb-4" />
              <p className="text-sm font-bold uppercase tracking-widest text-center">
                Scanning from {activeScanner?.name ?? 'scanner'}...
              </p>
              <p className="text-xs text-slate-400 mt-2 text-center max-w-xs">
                Please don't close this window. This can take up to two minutes.
              </p>
            </div>
          )}

          {phase === 'scan_error' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle size={32} className="text-red-500 mb-3" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Scan failed</p>
              {errorMessage && (
                <p className="text-xs text-slate-500 mt-1 max-w-xs">{errorMessage}</p>
              )}
            </div>
          )}
        </div>

        {(phase === 'scan_error' || showCameraFallback) && (
          <footer className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-2 flex-shrink-0">
            {phase === 'scan_error' && (
              <button
                onClick={runDiscovery}
                className="w-full px-4 py-2.5 bg-primary text-white font-bold text-sm rounded-xl hover:opacity-90 transition-all"
              >
                Try Again
              </button>
            )}
            {showCameraFallback && (
              <button
                onClick={onCameraFallback}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                <Camera size={16} /> Use Camera Instead
              </button>
            )}
          </footer>
        )}
      </div>
    </div>
  );
};

export default ScannerPickerModal;
