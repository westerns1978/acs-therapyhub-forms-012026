import React, { useState, useEffect } from 'react';
import PortalLayout from '../../layouts/PortalLayout';
import Header from '../../components/ui/Header';
import Card from '../../components/ui/Card';
import { usePortalClient } from '../../hooks/usePortalClient';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import PortalErrorCard from '../../components/ui/PortalErrorCard';
import { fetchOwnProgress } from '../../services/displayProgress';

// Portal honesty pass (2026-06-11): this page used to render a "Days Clean" card
// reading clients.days_clean and a "Required Tasks" card reading client_assignments
// (plus an unused srop_data query) — NONE of which exist in the database. A client
// saw a fabricated permanent "Days Clean 0" and an always-empty task list with a
// no-op "Complete" button. Both cards and their dead queries are REMOVED, not
// placeholdered. If a real sobriety-date source / assignments table ever ships,
// rebuild them as real features (SECURITY_BACKLOG #14).
const PortalCompliance: React.FC = () => {
    const portalClient = usePortalClient();
    const [progress, setProgress] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!portalClient) return;
        const fetchCompliance = async () => {
            setIsLoading(true);
            setLoadError(false);
            try {
                // WS-DisplayTruth: own authoritative progress (accrual + level via my_progress() RPC).
                const p = await fetchOwnProgress(portalClient.id);
                setProgress(p);
            } catch (err) {
                console.warn('Failed to fetch compliance:', err);
                setLoadError(true);
            }
            setIsLoading(false);
        };
        fetchCompliance();
    }, [portalClient, reloadKey]);

    if (isLoading || !portalClient) return <PortalLayout><div className="flex justify-center items-center h-64"><LoadingSpinner /></div></PortalLayout>;

    return (
        <PortalLayout>
            <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
                <Header title="My Progress" subtitle="Track your program requirements." />

                {loadError ? (
                    <PortalErrorCard
                        message="Your progress could not be loaded."
                        onRetry={() => setReloadKey(k => k + 1)}
                    />
                ) : (
                    <Card title="Program Completion">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Overall Progress</p>
                            <p className="text-4xl font-black text-primary">{progress?.established ? `${progress.progressPct ?? 0}%` : '—'}</p>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-6 overflow-hidden shadow-inner">
                            <div className="bg-gradient-to-r from-primary via-accent to-indigo-500 h-full transition-all duration-1000" style={{ width: `${progress?.established ? (progress.progressPct ?? 0) : 0}%` }}></div>
                        </div>
                        <div className="mt-8">
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{progress?.established ? `Hours (Level ${progress.determinedLevel})` : 'Hours Completed'}</p>
                                <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{progress?.established ? `${progress.completedTotal} / ${progress.requiredTotal}` : `${progress?.completedTotal ?? 0} hrs`}</p>
                                {progress?.established
                                    ? (progress.isSrop && <p className="text-[11px] font-bold text-slate-400 mt-1">Counseling {progress.counselingCompleted}/{progress.counselingRequired}</p>)
                                    : <p className="text-[11px] font-bold text-slate-400 mt-1">Your required hours will be set by your counselor after your screening.</p>}
                            </div>
                        </div>
                    </Card>
                )}
            </div>
        </PortalLayout>
    );
};

export default PortalCompliance;
