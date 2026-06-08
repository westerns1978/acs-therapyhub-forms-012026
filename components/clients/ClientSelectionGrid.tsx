
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getClients } from '../../services/api';
import { fetchAllClientProgress, type ClientProgress } from '../../services/displayProgress';
import { Client } from '../../types';
import LoadingSpinner from '../ui/LoadingSpinner';
import ClientAvatar from './ClientAvatar';
import { Search, UserPlus } from 'lucide-react';

const programDisplayLabel = (program: Client['program']) => {
    if (program === 'GAMBLING_RECOVERY') return 'Gambling Recovery';
    if (program === 'OPIOID_RECOVERY') return 'Opioid Recovery';
    return program;
};

const ClientCard: React.FC<{ client: Client; progress?: ClientProgress | null }> = ({ client, progress }) => {
    const navigate = useNavigate();
    // WS-DisplayTruth: the bar reads AUTHORITATIVE progress (accrual + signed determination),
    // never the neutralized client.completionPercentage. No determination → empty track, no
    // fabricated number (no-phantom).
    const pct = progress?.established ? (progress.progressPct ?? 0) : 0;
    return (
        <div
            onClick={() => navigate(`/clients/${client.id}`)}
            className="bg-white/70 dark:bg-dark-surface/70 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-xl shadow-md p-4 flex flex-col items-center text-center cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
        >
            <ClientAvatar client={client} className="w-20 h-20 text-3xl mb-3" />
            <h3 className="font-bold">{client.name}</h3>
            <p className="text-sm text-surface-secondary-content">{programDisplayLabel(client.program)}</p>
            <div className="w-full bg-gray-200 rounded-full h-2 my-3">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }}></div>
            </div>
            <p className="text-xs text-surface-secondary-content">{progress?.established ? <>Progress: <span className="font-semibold">{progress.progressPct ?? 0}%</span></> : <span className="text-slate-400">Not yet established</span>}</p>
        </div>
    );
};

const ClientSelectionGrid: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [progressById, setProgressById] = useState<Map<string, ClientProgress>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [programFilter, setProgramFilter] = useState('All');
    const location = useLocation();

    useEffect(() => {
        const fetchClients = async () => {
            setIsLoading(true);
            const clientsData = await getClients();
            const visible = clientsData.filter(c => c.status !== 'Archived');
            setClients(visible);
            setIsLoading(false);
            // WS-DisplayTruth: authoritative progress per client (one batched call, the same
            // surface alertsService uses) — the grid bar reads this, not the neutralized column.
            setProgressById(await fetchAllClientProgress(visible.map(c => c.id)));
        };
        fetchClients();
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const search = params.get('search');
        if (search) {
            setSearchTerm(search);
        }
    }, [location.search]);

    const filteredClients = useMemo(() => {
        // Most-recent-activity sort: use Supabase created_at (preserved in the row
        // spread by mapClientToApp) so freshly-onboarded clients land at the top.
        const recency = (c: Client) => {
            const t = (c as any).created_at || c.enrollmentDate || c.lastSession;
            const ms = t ? new Date(t).getTime() : 0;
            return Number.isFinite(ms) ? ms : 0;
        };
        const programMatches = (client: Client) => {
            if (programFilter === 'All') return true;
            if (programFilter === 'GAMBLING_RECOVERY') {
                return client.program === 'GAMBLING_RECOVERY' || client.program === 'Compulsive Gambling';
            }
            return client.program === programFilter;
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

    if (isLoading) {
        return <LoadingSpinner />;
    }

    return (
        <div>
            <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
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
                            <option value="REACT">REACT</option>
                            <option value="GAMBLING_RECOVERY">Gambling Recovery</option>
                            <option value="OPIOID_RECOVERY">Opioid Recovery</option>
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {filteredClients.map(client => (
                    <ClientCard key={client.id} client={client} progress={progressById.get(client.id) ?? null} />
                ))}
            </div>
            {filteredClients.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    <p className="text-sm">No clients match the current filter.</p>
                </div>
            )}
        </div>
    );
};

export default ClientSelectionGrid;
