
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getClients, getClientStatusCounts, updateClient } from '../../services/api';
import { fetchAllClientProgress, type ClientProgress } from '../../services/displayProgress';
import {
    fetchClientProgramCardState, type ProgramCardState,
    fetchClientAccrual, fetchClientDetermination, fetchClientSignedForms,
    fetchCompletionSignoff, assessClient,
} from '../../services/complianceEngine';
import { Client, ClientStatus, CLIENT_STATUS_LABELS } from '../../types';
import LoadingSpinner from '../ui/LoadingSpinner';
import ClientAvatar from './ClientAvatar';
import { Search, UserPlus, LayoutGrid, List, CheckCircle2, Archive, ArrowUpDown } from 'lucide-react';
import { normalizeProgram, programLabel, isSatopProgram } from '../../config/programVocab';

const programDisplayLabel = (program: Client['program']) => programLabel(program);

// Tone for a NON-SATOP timeline-program card state (program-aware engine output).
const timelineTone = (status: ProgramCardState['status']) =>
    status === 'violation' ? 'text-rose-600 dark:text-rose-400'
    : status === 'warning' ? 'text-amber-600 dark:text-amber-400'
    : status === 'met' ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-slate-400';

// Lifecycle badge — same palette as ClientProfileHeader (post status-normalization).
const lifecycleBadgeClass = (status: Client['status']) => {
    switch (status) {
        case 'active': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'archived': return 'bg-slate-100 text-slate-600 border-slate-200';
        default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
};

// ── Lifecycle nudges ─────────────────────────────────────────────────────────
// The ENGINE decides eligibility (the real five-gate cert verdict / the 18-month
// completed_at clock); a STAFF member confirms the transition. Never auto-writes.
const EIGHTEEN_MONTHS_MS = 548 * 24 * 60 * 60 * 1000;
const isArchiveEligible = (c: Client): boolean => {
    if (c.status !== 'completed') return false;
    const raw = (c as any).completed_at;
    if (!raw) return false; // pre-normalization completed clients have null — honest: no nudge yet
    const ts = new Date(raw).getTime();
    return Number.isFinite(ts) && Date.now() - ts > EIGHTEEN_MONTHS_MS;
};

const NudgeChip: React.FC<{ kind: 'complete' | 'archive'; onClick: (e: React.MouseEvent) => void }> = ({ kind, onClick }) => (
    <button
        onClick={(e) => { e.stopPropagation(); onClick(e); }}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition hover:scale-105 ${
            kind === 'complete'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
        }`}
        title={kind === 'complete'
            ? 'Every completion gate passes (hours, balance, sign-off, forms). Click to mark this client Completed.'
            : 'Completed more than 18 months ago. Click to archive (reversible; records are retained).'}
    >
        {kind === 'complete' ? <CheckCircle2 size={11} /> : <Archive size={11} />}
        {kind === 'complete' ? 'Mark completed' : 'Eligible to archive'}
    </button>
);

// ── Card ─────────────────────────────────────────────────────────────────────
const ClientCard: React.FC<{
    client: Client;
    progress?: ClientProgress | null;
    nudge?: 'complete' | 'archive' | null;
    onNudge?: (client: Client, kind: 'complete' | 'archive') => void;
}> = ({ client, progress, nudge, onNudge }) => {
    const navigate = useNavigate();
    // SATOP renders the AUTHORITATIVE hours Progress% (accrual + signed determination) — unchanged.
    // NON-SATOP programs are documentation-timeline: the % is meaningless, so we show the
    // program-aware engine's compliance STATE (review due/overdue, or court-determined no-gate).
    const isSatop = isSatopProgram(client.program);  // SROP/CIP route as SATOP too
    const [timeline, setTimeline] = useState<ProgramCardState | null>(null);
    const [timelineLoading, setTimelineLoading] = useState(!isSatop);
    useEffect(() => {
        if (isSatop) return;
        let cancelled = false;
        setTimelineLoading(true);
        fetchClientProgramCardState(client.id)
            .then(s => { if (!cancelled) { setTimeline(s); setTimelineLoading(false); } })
            .catch(() => { if (!cancelled) setTimelineLoading(false); });
        return () => { cancelled = true; };
    }, [client.id, isSatop]);

    const pct = progress?.established ? (progress.progressPct ?? 0) : 0;
    return (
        <div
            onClick={() => navigate(`/clients/${client.id}`)}
            className="bg-white/70 dark:bg-dark-surface/70 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-xl shadow-md p-4 flex flex-col items-center text-center cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
        >
            <ClientAvatar client={client} className="w-20 h-20 text-3xl mb-3" />
            <h3 className="font-bold">{client.name}</h3>
            <p className="text-sm text-surface-secondary-content">{programDisplayLabel(client.program)}</p>
            {isSatop ? (
                <>
                    <div className="w-full bg-gray-200 rounded-full h-2 my-3">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>
                    <p className="text-xs text-surface-secondary-content">{progress?.established ? <>Progress: <span className="font-semibold">{progress.progressPct ?? 0}%</span></> : <span className="text-slate-400">Not yet established</span>}</p>
                </>
            ) : (
                <div className="my-3 w-full min-h-[2.75rem] flex items-center justify-center">
                    {timelineLoading ? (
                        <p className="text-xs text-slate-400">Checking compliance…</p>
                    ) : timeline ? (
                        <p className={`text-xs font-semibold ${timelineTone(timeline.status)}`} title={timeline.detail}>
                            <span className="mr-1">{timeline.kind === 'no_gate' ? '⚖' : timeline.status === 'violation' ? '⚠' : timeline.status === 'warning' ? '◴' : '✓'}</span>
                            {timeline.label}
                        </p>
                    ) : (
                        <p className="text-xs text-slate-400">No compliance gate wired</p>
                    )}
                </div>
            )}
            {client.status !== 'active' && (
                <span className={`mt-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full border ${lifecycleBadgeClass(client.status)}`}>
                    {CLIENT_STATUS_LABELS[client.status] ?? client.status}
                </span>
            )}
            {nudge && onNudge && (
                <div className="mt-2">
                    <NudgeChip kind={nudge} onClick={() => onNudge(client, nudge)} />
                </div>
            )}
        </div>
    );
};

// ── List view ────────────────────────────────────────────────────────────────
type SortKey = 'name' | 'caseNumber' | 'program' | 'status' | 'progress' | 'enrolled';

const enrolledMs = (c: Client) => {
    const t = (c as any).created_at || c.enrollmentDate;
    const ms = t ? new Date(t).getTime() : 0;
    return Number.isFinite(ms) ? ms : 0;
};

const ClientListView: React.FC<{
    clients: Client[];
    progressById: Map<string, ClientProgress>;
    nudgeFor: (c: Client) => 'complete' | 'archive' | null;
    onNudge: (client: Client, kind: 'complete' | 'archive') => void;
}> = ({ clients, progressById, nudgeFor, onNudge }) => {
    const navigate = useNavigate();
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<1 | -1>(1);

    const toggleSort = (key: SortKey) => {
        if (key === sortKey) setSortDir(d => (d === 1 ? -1 : 1));
        else { setSortKey(key); setSortDir(1); }
    };

    const sorted = useMemo(() => {
        const pctOf = (c: Client) => {
            const p = progressById.get(c.id);
            return p?.established ? (p.progressPct ?? 0) : -1; // not-established sorts below 0%
        };
        const cmp: Record<SortKey, (a: Client, b: Client) => number> = {
            name: (a, b) => a.name.localeCompare(b.name),
            caseNumber: (a, b) => (a.caseNumber || '').localeCompare(b.caseNumber || ''),
            program: (a, b) => String(a.program || '').localeCompare(String(b.program || '')),
            status: (a, b) => String(a.status).localeCompare(String(b.status)),
            progress: (a, b) => pctOf(a) - pctOf(b),
            enrolled: (a, b) => enrolledMs(a) - enrolledMs(b),
        };
        return [...clients].sort((a, b) => sortDir * cmp[sortKey](a, b));
    }, [clients, progressById, sortKey, sortDir]);

    const Th: React.FC<{ k: SortKey; children: React.ReactNode }> = ({ k, children }) => (
        <th
            onClick={() => toggleSort(k)}
            className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200"
        >
            <span className="inline-flex items-center gap-1">
                {children}
                <ArrowUpDown size={10} className={sortKey === k ? 'opacity-100' : 'opacity-30'} />
            </span>
        </th>
    );

    return (
        <div className="overflow-x-auto bg-white/70 dark:bg-dark-surface/70 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-xl shadow-md">
            <table className="min-w-full text-sm">
                <thead className="border-b border-black/5 dark:border-white/10">
                    <tr>
                        <Th k="name">Name</Th>
                        <Th k="caseNumber">Case #</Th>
                        <Th k="program">Program</Th>
                        <Th k="status">Status</Th>
                        <Th k="progress">Progress</Th>
                        {/* "Enrolled" (real created_at), NOT a next/last-session date —
                            session dates aren't on the row and won't be fabricated. */}
                        <Th k="enrolled">Enrolled</Th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map(c => {
                        const p = progressById.get(c.id);
                        const nudge = nudgeFor(c);
                        const enrolled = enrolledMs(c);
                        return (
                            <tr
                                key={c.id}
                                onClick={() => navigate(`/clients/${c.id}`)}
                                className="border-b border-black/5 dark:border-white/5 last:border-0 cursor-pointer hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
                            >
                                <td className="px-3 py-1.5">
                                    <span className="inline-flex items-center gap-2">
                                        <ClientAvatar client={c} className="w-7 h-7 text-[10px]" />
                                        <span className="font-semibold">{c.name}</span>
                                        {nudge && <NudgeChip kind={nudge} onClick={() => onNudge(c, nudge)} />}
                                    </span>
                                </td>
                                <td className="px-3 py-1.5 text-slate-500">{c.caseNumber || '—'}</td>
                                <td className="px-3 py-1.5">{programDisplayLabel(c.program)}</td>
                                <td className="px-3 py-1.5">
                                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full border ${lifecycleBadgeClass(c.status)}`}>
                                        {CLIENT_STATUS_LABELS[c.status] ?? c.status}
                                    </span>
                                </td>
                                <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300" title={p?.established ? undefined : 'No hours metric: not established (SATOP) or documentation-timeline program.'}>
                                    {p?.established
                                        ? `${p.progressPct ?? 0}% · ${p.completedTotal}/${p.requiredTotal}`
                                        : '—'}
                                </td>
                                <td className="px-3 py-1.5 text-slate-500">{enrolled ? new Date(enrolled).toLocaleDateString() : '—'}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// ── Page ─────────────────────────────────────────────────────────────────────
type StatusChip = ClientStatus | 'all';
const STATUS_CHIPS: { key: StatusChip; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'archived', label: 'Archived' },
    { key: 'all', label: 'All' },
];

// Namespaced (not a bare/shared key) — survives reloads, per-browser preference.
const VIEW_KEY = 'acs_clients_view';
const loadViewPref = (): 'cards' | 'list' => {
    try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'cards'; } catch { return 'cards'; }
};

const ClientSelectionGrid: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [progressById, setProgressById] = useState<Map<string, ClientProgress>>(new Map());
    const [counts, setCounts] = useState<Record<ClientStatus, number> | null>(null);
    const [eligibleById, setEligibleById] = useState<Map<string, boolean>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [statusFilter, setStatusFilter] = useState<StatusChip>('active');
    const [view, setView] = useState<'cards' | 'list'>(loadViewPref);
    const [searchTerm, setSearchTerm] = useState('');
    const [programFilter, setProgramFilter] = useState('All');
    const location = useLocation();

    useEffect(() => {
        const fetchClients = async () => {
            setIsLoading(true);
            setLoadError(false);
            try {
                // Query-side per-status fetch (getClients choke-point) — only the
                // selected lifecycle set is loaded; counts feed the chips.
                const [clientsData, statusCounts] = await Promise.all([
                    getClients({ status: statusFilter }),
                    getClientStatusCounts(),
                ]);
                setClients(clientsData);
                setCounts(statusCounts);
                setIsLoading(false);
                // WS-DisplayTruth: authoritative progress per client (one batched call, the same
                // surface alertsService uses) — the grid bar reads this, not the neutralized column.
                setProgressById(await fetchAllClientProgress(clientsData.map(c => c.id)));
            } catch (e) {
                // getClients fails VISIBLY (no mock fallback) — show the error,
                // never a phantom-empty grid.
                console.error('[ClientSelectionGrid] load failed:', e);
                setLoadError(true);
                setIsLoading(false);
            }
        };
        fetchClients();
    }, [statusFilter, reloadKey]);

    // Completion-nudge eligibility — the REAL cert gate (assessClient: hours +
    // balance + sign-off + forms), run only for the cheap candidate set: active
    // SATOP clients whose batched authoritative progress is already ≥100%. The
    // hours gate is necessary for eligibility, so anyone below it needs no
    // per-client queries. The engine decides; a staff member confirms.
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            const candidates = clients.filter(c =>
                c.status === 'active'
                && isSatopProgram(c.program)
                && (progressById.get(c.id)?.established ?? false)
                && (progressById.get(c.id)?.progressPct ?? 0) >= 100);
            if (!candidates.length) { if (!cancelled) setEligibleById(new Map()); return; }
            const entries = await Promise.all(candidates.map(async (c) => {
                try {
                    const [accrual, determinedLevel, signedFormIds, completionSignedOff] = await Promise.all([
                        fetchClientAccrual(c.id),
                        fetchClientDetermination(c.id),
                        fetchClientSignedForms(c.id),
                        fetchCompletionSignoff(c.id),
                    ]);
                    const { completion } = assessClient(c, { accrual, determinedLevel, signedFormIds, completionSignedOff });
                    return [c.id, completion.eligible] as const;
                } catch {
                    return [c.id, false] as const; // fail closed — no nudge on unknown
                }
            }));
            if (!cancelled) setEligibleById(new Map(entries));
        };
        run();
        return () => { cancelled = true; };
    }, [clients, progressById]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const search = params.get('search');
        if (search) {
            setSearchTerm(search);
        }
    }, [location.search]);

    const setViewPref = (v: 'cards' | 'list') => {
        setView(v);
        try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
    };

    const nudgeFor = (c: Client): 'complete' | 'archive' | null => {
        if (c.status === 'active' && eligibleById.get(c.id)) return 'complete';
        if (isArchiveEligible(c)) return 'archive';
        return null;
    };

    const handleNudge = async (client: Client, kind: 'complete' | 'archive') => {
        const message = kind === 'complete'
            ? `Mark ${client.name} as Completed?\n\nEvery completion gate passes for this client (hours, balance, clinician sign-off, required forms). This records the lifecycle transition and stamps completed_at. Reversible from Edit Client.`
            : `Archive ${client.name}?\n\nCompleted more than 18 months ago. Archiving removes them from active lists only — every record is retained and this is reversible from Edit Client.`;
        if (!window.confirm(message)) return;
        try {
            await updateClient(client.id, { status: kind === 'complete' ? 'completed' : 'archived' });
            setReloadKey(k => k + 1); // refetch the set + counts
        } catch (e: any) {
            alert(e?.message || 'Could not update the client status.');
        }
    };

    const filteredClients = useMemo(() => {
        // Most-recent-activity sort (cards view): use Supabase created_at (preserved in the
        // row spread by mapClientToApp) so freshly-onboarded clients land at the top.
        const recency = (c: Client) => {
            const t = (c as any).created_at || c.enrollmentDate || c.lastSession;
            const ms = t ? new Date(t).getTime() : 0;
            return Number.isFinite(ms) ? ms : 0;
        };
        const programMatches = (client: Client) => {
            if (programFilter === 'All') return true;
            const norm = normalizeProgram(client.program);
            // 'SATOP' groups the whole SATOP family (incl. SROP/CIP); others match
            // the canonical value (legacy spellings normalize first).
            if (programFilter === 'SATOP') return norm.program === 'SATOP';
            return norm.canonical === programFilter;
        };
        // (OPIOID_RECOVERY uses default exact match on client.program)
        return clients
            .filter(client =>
                client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (client.caseNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
            )
            .filter(programMatches)
            .sort((a, b) => recency(b) - recency(a));
    }, [clients, searchTerm, programFilter]);

    const chipCount = (key: StatusChip): number | null => {
        if (!counts) return null;
        if (key === 'all') return counts.active + counts.completed + counts.archived;
        return counts[key];
    };

    if (isLoading) {
        return <LoadingSpinner />;
    }

    if (loadError) {
        return (
            <div className="text-center py-16 px-6 bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-900">
                <p className="text-sm font-bold text-red-800 dark:text-red-300">The client list could not be loaded.</p>
                <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">Nothing has been lost — please retry.</p>
                <button
                    onClick={() => setReloadKey(k => k + 1)}
                    className="mt-5 px-5 py-2.5 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded-xl text-xs font-black uppercase tracking-widest text-red-700 dark:text-red-300 hover:bg-red-100 transition"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-4 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Select a Client</h1>
                    <p className="text-surface-secondary-content">Choose a client to view their dedicated workspace.</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Program</span>
                        <select
                            value={programFilter}
                            onChange={(e) => setProgramFilter(e.target.value)}
                            className="py-2 pl-3 pr-8 text-sm bg-background dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
                        >
                            <option value="All">All</option>
                            <option value="SATOP">SATOP</option>
                            <option value="GAMBLING_RECOVERY">Gambling Recovery</option>
                            <option value="OPIOID_RECOVERY">Opioid Recovery</option>
                            <option value="ANGER_MANAGEMENT">Anger Management</option>
                        </select>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name or case #"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-64 pl-9 pr-3 py-2 text-sm bg-background dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
                        />
                    </div>
                    {/* Opens the CreateClientModal owned by MainLayout via window event —
                        same modal as the header's "+ Schedule → New Intake" entry point. */}
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('open-create-client-modal'))}
                        className="flex items-center gap-2 bg-primary hover:bg-primary-focus text-white text-sm font-bold px-4 py-2 rounded-lg shadow-md shadow-primary/20 transition-all active:scale-95"
                    >
                        <UserPlus size={16} /> Add Client
                    </button>
                </div>
            </div>

            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {/* Status chips — query-side lifecycle filter (PROGRAM + search compose within) */}
                <div className="inline-flex items-center gap-1 p-1 bg-background dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl" role="tablist" aria-label="Lifecycle status filter">
                    {STATUS_CHIPS.map(chip => {
                        const n = chipCount(chip.key);
                        const active = statusFilter === chip.key;
                        return (
                            <button
                                key={chip.key}
                                role="tab"
                                aria-selected={active}
                                onClick={() => setStatusFilter(chip.key)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    active
                                        ? 'bg-primary text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                {chip.label}
                                {n !== null && (
                                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-black ${active ? 'bg-white/20' : 'bg-black/5 dark:bg-white/10'}`}>
                                        {n}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
                {/* Cards | list view toggle (persisted, namespaced key) */}
                <div className="inline-flex items-center gap-1 p-1 bg-background dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl" role="tablist" aria-label="View mode">
                    <button
                        role="tab"
                        aria-selected={view === 'cards'}
                        onClick={() => setViewPref('cards')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all ${view === 'cards' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                        <LayoutGrid size={13} /> Cards
                    </button>
                    <button
                        role="tab"
                        aria-selected={view === 'list'}
                        onClick={() => setViewPref('list')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all ${view === 'list' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                        <List size={13} /> List
                    </button>
                </div>
            </div>

            {view === 'cards' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {filteredClients.map(client => (
                        <ClientCard
                            key={client.id}
                            client={client}
                            progress={progressById.get(client.id) ?? null}
                            nudge={nudgeFor(client)}
                            onNudge={handleNudge}
                        />
                    ))}
                </div>
            ) : (
                <ClientListView
                    clients={filteredClients}
                    progressById={progressById}
                    nudgeFor={nudgeFor}
                    onNudge={handleNudge}
                />
            )}
            {filteredClients.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    <p className="text-sm">No clients match the current filter.</p>
                </div>
            )}
        </div>
    );
};

export default ClientSelectionGrid;
