import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import GemyndFlowLogo from './GemyndFlowLogo';
import ThemeToggle from './ThemeToggle';
import { checkSupabaseConnection } from '../../services/api';
import CreateClientModal from '../clients/CreateClientModal';
import { Zap, Search, Plus, Bell, LogOut, Settings, UserPlus, CalendarPlus, FilePlus } from 'lucide-react';

interface GlobalHeaderProps {
    onCommandPaletteToggle: () => void;
    onScheduleSession: () => void;
    onOpenNote: () => void;
}

const GlobalHeader: React.FC<GlobalHeaderProps> = ({ onCommandPaletteToggle, onScheduleSession, onOpenNote }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isProfileOpen, setProfileOpen] = useState(false);
    const [isCreateMenuOpen, setCreateMenuOpen] = useState(false);
    const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
    const [latency, setLatency] = useState(0);

    useEffect(() => {
        const check = async () => {
            const start = Date.now();
            await checkSupabaseConnection();
            setLatency(Date.now() - start);
        };
        check();
        const interval = setInterval(check, 60000); 
        return () => clearInterval(interval);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };
    
    return (
        <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-b border-border dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between h-16 px-4 sm:px-6">
                <div className="flex items-center gap-6">
                    <Link to="/" className="hover:opacity-80 transition-opacity">
                        <GemyndFlowLogo />
                    </Link>
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-black uppercase tracking-tighter text-slate-500">
                        <Zap size={10} className="text-primary fill-primary animate-pulse" />
                        <span>Flow: {latency}ms</span>
                    </div>
                </div>
                
                <div className="flex-1 flex justify-center px-4 max-w-xl mx-auto">
                    <button onClick={onCommandPaletteToggle} className="w-full">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search size={16} className="text-slate-400 group-hover:text-primary transition-colors" />
                            </div>
                            <div className="block w-full bg-slate-100/50 dark:bg-slate-800/50 h-10 pl-10 pr-3 py-2 rounded-2xl text-slate-500 text-sm group-hover:bg-white group-hover:shadow-md transition-all border border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-700">
                                Search clinical resources...
                            </div>
                        </div>
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <button 
                            onClick={() => setCreateMenuOpen(!isCreateMenuOpen)}
                            className="flex items-center gap-2 bg-primary hover:bg-primary-focus text-white text-sm font-bold px-5 py-2 rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-95"
                        >
                            <Plus size={18} />
                            <span className="hidden sm:inline">Dispatch</span>
                        </button>

                        {isCreateMenuOpen && (
                            <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-border dark:border-slate-800 py-2 animate-fade-in-up z-50">
                                <button onClick={() => { onScheduleSession(); setCreateMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors">
                                    <div className="p-2 bg-primary/10 text-primary rounded-xl"><CalendarPlus size={18} /></div>
                                    <div><p className="font-bold text-sm">Schedule Session</p></div>
                                </button>
                                <button onClick={() => { setIsCreateClientOpen(true); setCreateMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors">
                                    <div className="p-2 bg-secondary/10 text-secondary rounded-xl"><UserPlus size={18} /></div>
                                    <div><p className="font-bold text-sm">New Intake</p></div>
                                </button>
                                <button onClick={() => { onOpenNote(); setCreateMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors">
                                    <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><FilePlus size={18} /></div>
                                    <div><p className="font-bold text-sm">Create Note</p></div>
                                </button>
                            </div>
                        )}
                    </div>

                    <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full relative transition-colors">
                        <Bell size={20} />
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-primary rounded-full border-2 border-white dark:border-slate-900"></span>
                    </button>

                    <div className="relative ml-2">
                        <button onClick={() => setProfileOpen(prev => !prev)} className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-2xl transition-colors">
                            <img src={`https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=8B1E24&color=fff`} alt="User" className="w-8 h-8 rounded-xl" />
                        </button>
                        
                        {isProfileOpen && (
                            <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-border dark:border-slate-800 py-2 z-50 animate-fade-in-up">
                                <div className="px-4 py-3 border-b border-border dark:border-slate-800 mb-1">
                                    <p className="text-sm font-bold">{user?.name}</p>
                                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                                </div>
                                <Link to="/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <Settings size={16} /> Settings
                                </Link>
                                <div className="my-1 border-t border-border dark:border-slate-800"></div>
                                <button onClick={handleLogout} className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-primary hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                    <LogOut size={16} /> Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <CreateClientModal isOpen={isCreateClientOpen} onClose={() => setIsCreateClientOpen(false)} />
        </header>
    );
};

export default GlobalHeader;