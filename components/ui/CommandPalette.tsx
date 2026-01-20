

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getClients } from '../../services/api';
import { Client } from '../../types';

const SearchIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>;
const UserIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const HomeIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const MessageSquareIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;


interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [clients, setClients] = useState<Client[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        if (isOpen) {
            const fetchClients = async () => {
                const data = await getClients();
                setClients(data);
            };
            fetchClients();
            setSearchTerm('');
        }
    }, [isOpen]);

    const commands = useMemo(() => [
        { type: 'Page', title: 'Dashboard', icon: HomeIcon, action: () => navigate('/dashboard') },
        { type: 'Page', title: 'Clients', icon: UserIcon, action: () => navigate('/clients') },
        { type: 'Page', title: 'Messages', icon: MessageSquareIcon, action: () => navigate('/communication-center') },
        ...clients.map(client => ({
            type: 'Client',
            title: `View ${client.name}`,
            icon: () => <img src={client.avatarUrl} alt={client.name} className="w-5 h-5 rounded-full" />,
            action: () => navigate(`/program-compliance/${client.id}`)
        }))
    ], [navigate, clients]);
    
    const filteredCommands = useMemo(() => {
        if (!searchTerm) return commands;
        return commands.filter(cmd => cmd.title.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm, commands]);


    if (!isOpen) return null;

    const handleCommandClick = (action: () => void) => {
        action();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-20" onClick={onClose}>
            <div className="w-full max-w-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="relative">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-on-surface-secondary dark:text-slate-400" />
                    <input
                        type="text"
                        placeholder="Type a command or search..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        autoFocus
                        className="w-full bg-transparent pl-12 pr-4 py-4 text-lg border-b border-black/10 dark:border-white/10 focus:outline-none"
                    />
                </div>
                <div className="max-h-96 overflow-y-auto p-2">
                    {filteredCommands.length > 0 ? (
                        <ul>
                            {filteredCommands.map((cmd, index) => (
                                <li key={index}
                                    onClick={() => handleCommandClick(cmd.action)}
                                    className="flex items-center justify-between p-3 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <cmd.icon className="h-5 w-5 text-on-surface-secondary dark:text-slate-300" />
                                        <span>{cmd.title}</span>
                                    </div>
                                    <span className="text-xs text-on-surface-secondary dark:text-slate-500 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md">{cmd.type}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center p-8 text-on-surface-secondary">No results found.</p>
                    )}
                </div>
                 <div className="p-2 border-t border-black/10 dark:border-white/10 text-xs text-center text-on-surface-secondary dark:text-slate-500">
                    Press <kbd className="font-mono bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded">Ctrl+K</kbd> to toggle.
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;