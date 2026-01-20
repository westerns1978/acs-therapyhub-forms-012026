import React, { useState, useMemo } from 'react';
import { AuditLog } from '../../types';
import Card from '../ui/Card';

const SearchIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>;

interface AuditTrailTableProps {
    logs: AuditLog[];
}

const AuditTrailTable: React.FC<AuditTrailTableProps> = ({ logs }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredLogs = useMemo(() => {
        return logs
            .filter(log => 
                log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.details.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [searchTerm, logs]);
    
    return (
        <Card title="System Audit Trail" noPadding>
             <div className="p-4 border-b border-black/10 dark:border-white/10">
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-secondary dark:text-slate-400"><SearchIcon className="h-5 w-5"/></span>
                    <input
                        type="text"
                        placeholder="Search logs..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full sm:w-64 pl-10 pr-4 py-2 border border-border bg-white/50 dark:bg-slate-700/50 rounded-full focus:ring-2 focus:ring-primary focus:border-primary transition"
                    />
                </div>
            </div>
            <div className="overflow-x-auto max-h-96">
                <table className="min-w-full divide-y divide-black/10 dark:divide-white/10">
                    <thead className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl sticky top-0">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Timestamp</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">User</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Action</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10 dark:divide-white/10">
                        {filteredLogs.map(log => (
                            <tr key={log.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-secondary dark:text-slate-400">{log.timestamp.toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-on-surface dark:text-slate-200">{log.user}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface dark:text-slate-300">{log.action}</td>
                                <td className="px-6 py-4 text-sm text-on-surface-secondary dark:text-slate-400">{log.details}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

export default AuditTrailTable;