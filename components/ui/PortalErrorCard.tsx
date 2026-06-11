import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Visible portal error state — rendered INSTEAD of an empty list when a query
 * fails. An empty state must mean "really empty", never "the load failed"
 * (portal honesty pass, 2026-06-11). Mirrors the staff-side <ErrorFallback>
 * in ClientWorkspace, which is local to that file.
 */
const PortalErrorCard: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
    <div className="text-center py-12 px-6 bg-red-50 dark:bg-red-950/30 rounded-3xl border border-red-200 dark:border-red-900">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
        <p className="text-sm font-bold text-red-800 dark:text-red-300">{message}</p>
        <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
            Nothing has been lost — your records are safe. Please try again.
        </p>
        <button
            onClick={onRetry}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded-xl text-xs font-black uppercase tracking-widest text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition"
        >
            <RefreshCw size={14} /> Retry
        </button>
    </div>
);

export default PortalErrorCard;
