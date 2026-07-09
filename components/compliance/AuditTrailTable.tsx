import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AuditLog, Client } from '../../types';
import { getAuditLogs } from '../../services/api';
import Card from '../ui/Card';

const SearchIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>;
const DownloadIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>;

interface AuditTrailTableProps {
    clients: Client[];
}

// audit_logs has no pagination UI yet — cap the display query so a growing ledger never
// dumps thousands of rows unbounded. The facet fetch (for the User/Action dropdowns) is
// a separate, larger, ONE-TIME unfiltered read on mount so those options don't shrink as
// other filters narrow the displayed rows.
const DISPLAY_LIMIT = 200;
const FACET_LIMIT = 500;

const selectClasses = "px-3 py-2 border border-border bg-white/50 dark:bg-slate-700/50 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary transition";

const AuditTrailTable: React.FC<AuditTrailTableProps> = ({ clients }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [clientId, setClientId] = useState('');
    const [userId, setUserId] = useState('');
    const [action, setAction] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actorOptions, setActorOptions] = useState<{ id: string; name: string }[]>([]);
    const [actionOptions, setActionOptions] = useState<string[]>([]);

    // Facet lists: fetched once, unfiltered, so picking a User/Action filter always shows
    // every option that has EVER appeared — not just the ones in the currently-filtered set.
    useEffect(() => {
        (async () => {
            const master = await getAuditLogs({ limit: FACET_LIMIT });
            const actors = new Map<string, string>();
            const actions = new Set<string>();
            master.forEach(l => {
                if (l.userId) actors.set(l.userId, l.user);
                actions.add(l.action);
            });
            setActorOptions([...actors.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
            setActionOptions([...actions].sort());
        })();
    }, []);

    const fetchFiltered = useCallback(async () => {
        setIsLoading(true);
        const data = await getAuditLogs({
            userId: userId || undefined,
            clientId: clientId || undefined,
            action: action || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            limit: DISPLAY_LIMIT,
        });
        setLogs(data);
        setIsLoading(false);
    }, [userId, clientId, action, dateFrom, dateTo]);

    useEffect(() => { fetchFiltered(); }, [fetchFiltered]);

    const clientNameById = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);

    // Free-text search stays a client-side pass on top of the server-side structured
    // filters — same "Search logs..." behavior as before, just applied to a narrower set.
    const visibleLogs = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return logs;
        return logs.filter(log => {
            const clientName = log.clientId ? (clientNameById.get(log.clientId) || '') : '';
            return log.user.toLowerCase().includes(term) ||
                log.action.toLowerCase().includes(term) ||
                log.details.toLowerCase().includes(term) ||
                clientName.toLowerCase().includes(term);
        });
    }, [searchTerm, logs, clientNameById]);

    const handleExport = () => {
        const headers = ["Timestamp", "User", "Action", "Client", "Entity Type", "Entity ID", "Details"];
        const rows = visibleLogs.map(log => {
            const clientName = log.clientId ? (clientNameById.get(log.clientId) || log.clientId) : '';
            return [
                log.timestamp.toISOString(),
                log.user,
                log.action,
                clientName,
                log.entityType || '',
                log.entityId || '',
                log.details,
            ].join(',');
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `audit_trail_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const sortedClients = useMemo(() => [...clients].sort((a, b) => a.name.localeCompare(b.name)), [clients]);

    return (
        <Card title="System Audit Trail" noPadding>
             <div className="p-4 border-b border-black/10 dark:border-white/10 flex flex-wrap gap-3 items-end">
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-secondary dark:text-slate-400"><SearchIcon className="h-5 w-5"/></span>
                    <input
                        type="text"
                        placeholder="Search logs..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full sm:w-56 pl-10 pr-4 py-2 border border-border bg-white/50 dark:bg-slate-700/50 rounded-full focus:ring-2 focus:ring-primary focus:border-primary transition"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-on-surface-secondary dark:text-slate-400">Client</label>
                    <select value={clientId} onChange={e => setClientId(e.target.value)} className={selectClasses}>
                        <option value="">All Clients</option>
                        {sortedClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-on-surface-secondary dark:text-slate-400">User</label>
                    <select value={userId} onChange={e => setUserId(e.target.value)} className={selectClasses}>
                        <option value="">All Users</option>
                        {actorOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-on-surface-secondary dark:text-slate-400">Action</label>
                    <select value={action} onChange={e => setAction(e.target.value)} className={selectClasses}>
                        <option value="">All Actions</option>
                        {actionOptions.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-on-surface-secondary dark:text-slate-400">From</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={selectClasses} />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-on-surface-secondary dark:text-slate-400">To</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={selectClasses} />
                </div>
                {(clientId || userId || action || dateFrom || dateTo) && (
                    <button
                        onClick={() => { setClientId(''); setUserId(''); setAction(''); setDateFrom(''); setDateTo(''); }}
                        className="text-xs font-semibold text-primary dark:text-dark-primary hover:underline"
                    >
                        Clear filters
                    </button>
                )}
                <button
                    onClick={handleExport}
                    disabled={visibleLogs.length === 0}
                    className="ml-auto flex items-center gap-2 px-4 py-2 bg-surface dark:bg-dark-surface-secondary rounded-lg hover:bg-surface-secondary dark:hover:bg-dark-surface-secondary/50 transition font-semibold text-sm text-surface-secondary-content dark:text-dark-surface-secondary-content disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <DownloadIcon className="h-4 w-4" /> Export CSV
                </button>
            </div>
            <div className="overflow-x-auto max-h-96">
                <table className="min-w-full divide-y divide-black/10 dark:divide-white/10">
                    <thead className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl sticky top-0">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Timestamp</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">User</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Action</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Client</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10 dark:divide-white/10">
                        {isLoading ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-on-surface-secondary dark:text-slate-400">Loading…</td></tr>
                        ) : visibleLogs.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-on-surface-secondary dark:text-slate-400">No matching audit events.</td></tr>
                        ) : visibleLogs.map(log => (
                            <tr key={log.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-secondary dark:text-slate-400">{log.timestamp.toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-on-surface dark:text-slate-200">{log.user}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface dark:text-slate-300">{log.action}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface dark:text-slate-300">{log.clientId ? (clientNameById.get(log.clientId) || log.clientId) : '—'}</td>
                                <td className="px-6 py-4 text-sm text-on-surface-secondary dark:text-slate-400">{log.details}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {!isLoading && logs.length >= DISPLAY_LIMIT && (
                <p className="px-4 py-2 text-xs text-on-surface-secondary dark:text-slate-400 border-t border-black/10 dark:border-white/10">
                    Showing the most recent {DISPLAY_LIMIT} matching rows — narrow the filters to see more.
                </p>
            )}
        </Card>
    );
};

export default AuditTrailTable;
