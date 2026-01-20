import React, { useState } from 'react';

const DownloadIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>;

interface ReportPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    reportTitle: string;
    children: React.ReactNode;
}

const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({ isOpen, onClose, reportTitle, children }) => {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = () => {
        setIsExporting(true);
        setTimeout(() => {
            setIsExporting(false);
            onClose();
            // In a real app, you would trigger a PDF download here.
        }, 1500);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in-up" style={{ animationDuration: '0.3s'}}>
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                <header className="flex justify-between items-center p-4 border-b border-black/10 dark:border-white/10 flex-shrink-0">
                    <h2 className="text-lg font-semibold">{reportTitle}</h2>
                    <button onClick={onClose} className="text-2xl font-light text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-white" aria-label="Close modal">&times;</button>
                </header>
                
                <main className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-slate-800/50">
                    <div className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-slate-900 p-8 rounded-md shadow-lg">
                        {children}
                    </div>
                </main>

                <footer className="p-4 border-t border-black/10 dark:border-white/10 flex-shrink-0 flex justify-end">
                    <button 
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex items-center gap-2 bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-primary-focus transition disabled:bg-gray-400"
                    >
                        <DownloadIcon className="h-5 w-5" />
                        {isExporting ? 'Exporting...' : 'Export as PDF'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default ReportPreviewModal;