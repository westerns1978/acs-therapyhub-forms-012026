
import React, { useState, useEffect, useCallback } from 'react';
import { DocumentFile, Client, NetworkScanner, ClientFolderType } from '../../types';
import { processDocument, getNetworkScanners } from '../../services/api';
import { X, ArrowLeft, BrainCircuit, Loader2, HardDrive, FileText, Scan, CheckCircle, AlertTriangle, RotateCw, Trash2, Plus } from 'lucide-react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (file: File) => void;
  client: Client;
}

type ModalStep = 'jobSetup' | 'scannerSettings' | 'scanning' | 'review' | 'analysis' | 'complete';

const StepIndicator: React.FC<{ steps: string[], currentStepIndex: number }> = ({ steps, currentStepIndex }) => (
    <div className="flex justify-between items-center mb-6">
        {steps.map((step, index) => (
            <React.Fragment key={step}>
                <div className="flex flex-col items-center text-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${currentStepIndex >= index ? 'bg-primary border-primary text-white' : 'bg-surface border-border'}`}>
                        {currentStepIndex > index ? <CheckCircle size={16} /> : <span>{index + 1}</span>}
                    </div>
                    <p className={`mt-1 text-xs font-semibold ${currentStepIndex >= index ? 'text-primary' : 'text-on-surface-secondary'}`}>{step}</p>
                </div>
                {index < steps.length - 1 && <div className={`flex-1 h-0.5 mx-2 mt-[-1rem] ${currentStepIndex > index ? 'bg-primary' : 'bg-border'}`}></div>}
            </React.Fragment>
        ))}
    </div>
);

const ScannerModal: React.FC<ScannerModalProps> = ({ isOpen, onClose, onSave, client }) => {
    const [step, setStep] = useState<ModalStep>('jobSetup');
    const [scanners, setScanners] = useState<NetworkScanner[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Scan Job State
    const [jobName, setJobName] = useState(`Scan for ${client.name} - ${new Date().toLocaleDateString()}`);
    const [category, setCategory] = useState<ClientFolderType>('Intake');
    const [selectedScannerId, setSelectedScannerId] = useState<string>('');
    const [dpi, setDpi] = useState(300);
    const [colorMode, setColorMode] = useState<'color' | 'grayscale' | 'blackwhite'>('color');
    const [isDuplex, setIsDuplex] = useState(false);
    const [format, setFormat] = useState<'pdf' | 'jpeg' | 'tiff'>('pdf');
    const [scanProgress, setScanProgress] = useState(0);
    const [scannedPages, setScannedPages] = useState<string[]>([]);
    const [analysisResult, setAnalysisResult] = useState<Partial<DocumentFile['extractedData']>>({});
    const [finalFilename, setFinalFilename] = useState('');

    const resetState = () => {
        setStep('jobSetup');
        setIsLoading(false);
        setError('');
        setScannedPages([]);
        setScanProgress(0);
        setJobName(`Scan for ${client.name} - ${new Date().toLocaleDateString()}`);
        setCategory('Intake');
    };

    useEffect(() => {
        if (isOpen) {
            const fetchScanners = async () => {
                setIsLoading(true);
                try {
                    const availableScanners = await getNetworkScanners();
                    const onlineScanners = availableScanners.filter(s => s.status === 'Online');
                    setScanners(onlineScanners);
                    if (onlineScanners.length > 0) {
                        setSelectedScannerId(onlineScanners[0].id);
                    }
                } catch (err) {
                    setError('Could not fetch available scanners.');
                } finally {
                    setIsLoading(false);
                }
            };
            fetchScanners();
        } else {
            resetState();
        }
    }, [isOpen, client.name]);
    
    const handleSimulatedScan = () => {
        setStep('scanning');
        let progress = 0;
        const totalPages = Math.floor(Math.random() * 5) + 1; // 1 to 5 pages
        const interval = setInterval(() => {
            progress += 10;
            setScanProgress(progress);
            if (progress >= 100) {
                clearInterval(interval);
                // Simulate paper jam error
                if (Math.random() > 0.8) {
                    setError('Paper jam detected on page ' + (scannedPages.length + 1) + '. Please clear the scanner and try again.');
                    return;
                }
                const newPage = `https://storage.googleapis.com/acs-therapy-hub-sample-docs/Sample-Court-Order.pdf`;
                setScannedPages(prev => [...prev, newPage]);
                
                if (scannedPages.length + 1 < totalPages) {
                    setScanProgress(0); // Reset for next page
                } else {
                    setStep('review');
                }
            }
        }, 200);
    };
    
    const handleAnalyze = async () => {
        if (scannedPages.length === 0) return;
        setStep('analysis');
        setIsLoading(true);
        setError('');
        try {
            const blob = await fetch(scannedPages[0]).then(res => res.blob());
            const file = new File([blob], "scanned_document.pdf", { type: "application/pdf" });
            // FIX: Added a no-op progress callback to satisfy the 5 arguments expected by `processDocument`.
            const result = await processDocument(file, process.env.API_KEY!, client.id, client.name, () => {});
            setAnalysisResult(result.extractedData);
            setFinalFilename(`${client.name.replace(' ', '_')}_${result.documentType}_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Analysis failed");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleFinalSave = async () => {
        if (scannedPages.length === 0) return;
        const blob = await fetch(scannedPages[0]).then(res => res.blob());
        const file = new File([blob], finalFilename, { type: "application/pdf" });
        onSave(file);
        setStep('complete');
    };

    const renderContent = () => {
        const steps = ['Setup', 'Settings', 'Scan', 'Review', 'Analyze'];
        const stepIndex = ['jobSetup', 'scannerSettings', 'scanning', 'review', 'analysis'].indexOf(step);

        if (step === 'complete') {
            return (
                 <div className="text-center p-8">
                    <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold">Scan Complete!</h3>
                    <p className="text-on-surface-secondary mt-2">The document has been processed and saved to {client.name}'s record under the '{category}' category.</p>
                </div>
            );
        }

        return (
            <>
                <StepIndicator steps={steps} currentStepIndex={stepIndex} />
                <div className="min-h-[300px]">
                    {step === 'jobSetup' && (
                        <div className="space-y-4">
                            <div><label className="block text-sm font-medium mb-1">Job Name</label><input type="text" value={jobName} onChange={e => setJobName(e.target.value)} className="w-full p-2 border rounded-md dark:bg-slate-700"/></div>
                            <div><label className="block text-sm font-medium mb-1">Client</label><input type="text" value={client.name} readOnly className="w-full p-2 border rounded-md bg-gray-100 dark:bg-slate-800"/></div>
                            <div><label className="block text-sm font-medium mb-1">File Under Category</label><select value={category} onChange={e => setCategory(e.target.value as ClientFolderType)} className="w-full p-2 border rounded-md dark:bg-slate-700"><option>Intake</option><option>Compliance</option><option>Progress</option><option>Financial</option><option>DMV</option><option>Insurance</option></select></div>
                        </div>
                    )}
                    {step === 'scannerSettings' && (
                        <div className="space-y-4">
                             <div><label className="block text-sm font-medium mb-1">Select Scanner</label><select value={selectedScannerId} onChange={e => setSelectedScannerId(e.target.value)} className="w-full p-2 border rounded-md dark:bg-slate-700" disabled={scanners.length === 0}>{scanners.length > 0 ? scanners.map(s => <option key={s.id} value={s.id}>{s.name} ({s.location})</option>) : <option>No Online Scanners Found</option>}</select></div>
                             <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Resolution (DPI)</label><select value={dpi} onChange={e => setDpi(Number(e.target.value))} className="w-full p-2 border rounded-md dark:bg-slate-700"><option>150</option><option>300</option><option>600</option></select></div>
                                <div><label className="block text-sm font-medium mb-1">Color Mode</label><select value={colorMode} onChange={e => setColorMode(e.target.value as any)} className="w-full p-2 border rounded-md dark:bg-slate-700"><option value="color">Color</option><option value="grayscale">Grayscale</option><option value="blackwhite">B&W</option></select></div>
                            </div>
                            <div className="flex items-center gap-2"><input type="checkbox" id="duplex" checked={isDuplex} onChange={e => setIsDuplex(e.target.checked)} /><label htmlFor="duplex">Duplex (2-sided) Scan</label></div>
                            <div className="flex items-center gap-2"><label className="text-sm font-medium">Output Format:</label><span>{format.toUpperCase()}</span></div>
                        </div>
                    )}
                     {step === 'scanning' && (
                        <div className="text-center p-8">
                            {error ? (
                                <>
                                    <AlertTriangle size={48} className="text-red-500 mx-auto mb-4"/>
                                    <p className="font-semibold text-red-700">{error}</p>
                                    <button onClick={() => { setError(''); setScanProgress(0); }} className="mt-4 bg-gray-200 px-4 py-2 rounded-lg">Retry</button>
                                </>
                            ) : (
                                <>
                                    <Loader2 size={48} className="text-primary mx-auto animate-spin mb-4"/>
                                    <p className="font-semibold">Scanning page {scannedPages.length + 1}...</p>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4"><div className="bg-primary h-2.5 rounded-full" style={{width: `${scanProgress}%`}}></div></div>
                                </>
                            )}
                        </div>
                    )}
                    {step === 'review' && (
                        <div className="space-y-4">
                            <h3 className="font-semibold">Review Scanned Pages ({scannedPages.length})</h3>
                            <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto bg-gray-100 dark:bg-slate-900/50 p-2 rounded-lg">
                                {scannedPages.map((page, index) => (
                                <div key={index} className="relative group border p-1 bg-white rounded">
                                    <FileText size={48} className="mx-auto" />
                                    <p className="text-xs text-center truncate">Page {index + 1}.pdf</p>
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                        <button onClick={() => {}} className="p-1.5 bg-white/80 text-black rounded-full"><RotateCw size={12}/></button>
                                        <button onClick={() => {}} className="p-1.5 bg-red-600 text-white rounded-full"><Trash2 size={12}/></button>
                                    </div>
                                </div>
                                ))}
                            </div>
                            <button className="w-full border-2 border-dashed p-4 text-center text-on-surface-secondary hover:bg-gray-50 rounded-lg">
                                <Plus size={20} className="mx-auto mb-1" /> Add more pages
                            </button>
                        </div>
                    )}
                     {step === 'analysis' && (
                        <div className="text-center p-4">
                            {isLoading ? ( <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" /> ) : error ? (
                                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
                            ) : (
                                <div className="text-left space-y-3 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg max-h-72 overflow-y-auto">
                                    <h3 className="font-semibold text-center mb-2">AI Analysis Complete</h3>
                                    <div><strong>File Name:</strong> <input type="text" value={finalFilename} onChange={e => setFinalFilename(e.target.value)} className="w-full text-sm p-1 border rounded" /></div>
                                    <div><strong>Category:</strong> <span className="font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{analysisResult.suggestedSubfolder}</span></div>
                                    <div><strong>Summary:</strong><p className="text-sm italic">"{analysisResult.summary}"</p></div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </>
        )
    };
    
    const getNextButtonText = () => {
        switch (step) {
            case 'jobSetup': return 'Next: Settings';
            case 'scannerSettings': return 'Start Scan';
            case 'review': return 'Process with AI';
            case 'analysis': return 'Save to Client Record';
            default: return 'Next';
        }
    };

    const handleNext = () => {
        setError('');
        switch (step) {
            case 'jobSetup': setStep('scannerSettings'); break;
            case 'scannerSettings': handleSimulatedScan(); break;
            case 'review': handleAnalyze(); break;
            case 'analysis': handleFinalSave(); break;
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in-up">
            <div className="bg-background dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col">
                <header className="flex justify-between items-center p-4 border-b border-border dark:border-slate-700">
                    <h2 className="text-lg font-bold">Professional Scan Workflow</h2>
                    <button onClick={onClose}><X size={24} /></button>
                </header>
                <main className="p-6">{renderContent()}</main>
                 <footer className="p-4 border-t border-border dark:border-slate-700 flex justify-between items-center">
                    <div>
                        {step !== 'jobSetup' && step !== 'complete' && <button onClick={() => setStep('jobSetup')} className="text-sm font-semibold">Restart</button>}
                    </div>
                    <div>
                        <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-200 dark:bg-slate-700 rounded-md hover:bg-gray-300 dark:hover:bg-slate-600 mr-2">Cancel</button>
                        {step !== 'scanning' && step !== 'complete' && (
                            <button onClick={handleNext} disabled={isLoading || (step === 'scannerSettings' && !selectedScannerId)} className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-focus transition disabled:bg-gray-400">
                                {isLoading ? 'Processing...' : getNextButtonText()}
                            </button>
                        )}
                        {step === 'complete' && <button onClick={onClose} className="px-6 py-2 bg-primary text-white font-bold rounded-lg">Done</button>}
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default ScannerModal;