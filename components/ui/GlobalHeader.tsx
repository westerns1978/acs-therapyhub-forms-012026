import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import GemyndFlowLogo from './GemyndFlowLogo';
import { Search, Plus, Bell, LogOut, Settings, UserPlus, CalendarPlus, FilePlus, Menu } from 'lucide-react';

// Clara's avatar — same image the portal floating bubble uses, for one identity across surfaces.
const CLARA_AVATAR_URL = 'https://storage.googleapis.com/westerns1978-digital-assets/ACS%20TherapyHub/clara2.png';

interface GlobalHeaderProps {
    onCommandPaletteToggle: () => void;
    onScheduleSession: () => void;
    onOpenNote: () => void;
    onNewIntake: () => void;
    onMobileMenuToggle?: () => void;
    /** Opens/closes the docked staff Clara panel. */
    onClaraToggle?: () => void;
    isClaraOpen?: boolean;
}

// CreateClientModal is rendered by MainLayout, not here — keeping the modal
// out of this <header> avoids the backdrop-filter containing-block trap that
// clipped the modal to the header's bounding box.
const GlobalHeader: React.FC<GlobalHeaderProps> = ({ onCommandPaletteToggle, onScheduleSession, onOpenNote, onNewIntake, onMobileMenuToggle, onClaraToggle, isClaraOpen }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isProfileOpen, setProfileOpen] = useState(false);
    const [isCreateMenuOpen, setCreateMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };
    
    return (
        <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-b border-border dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between h-16 px-4 sm:px-6">
                <div className="flex items-center gap-3">
                    {/* Hamburger - mobile only */}
                    {onMobileMenuToggle && (
                        <button 
                            onClick={onMobileMenuToggle}
                            className="lg:hidden p-2 -ml-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            aria-label="Open navigation menu"
                        >
                            <Menu size={22} className="text-slate-600 dark:text-slate-300" />
                        </button>
                    )}
                    <Link to="/" className="hover:opacity-80 transition-opacity">
                        <GemyndFlowLogo />
                    </Link>
                </div>
                
                <div className="hidden sm:flex flex-1 justify-center px-4 max-w-xl mx-auto">
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

                <div className="flex items-center gap-2 sm:gap-3">
                    {/* Search button - mobile only */}
                    <button 
                        onClick={onCommandPaletteToggle}
                        className="sm:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <Search size={20} />
                    </button>

                    <div className="relative">
                        <button 
                            onClick={() => setCreateMenuOpen(!isCreateMenuOpen)}
                            className="flex items-center gap-2 bg-primary hover:bg-primary-focus text-white text-sm font-bold px-3 sm:px-5 py-2 rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-95"
                        >
                            <Plus size={18} />
                            <span className="hidden sm:inline">Schedule</span>
                        </button>

                        {isCreateMenuOpen && (
                            <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-border dark:border-slate-800 py-2 animate-fade-in-up z-50">
                                <button onClick={() => { onScheduleSession(); setCreateMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors">
                                    <div className="p-2 bg-primary/10 text-primary rounded-xl"><CalendarPlus size={18} /></div>
                                    <div><p className="font-bold text-sm">Schedule Session</p></div>
                                </button>
                                <button onClick={() => { onNewIntake(); setCreateMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors">
                                    <div className="p-2 bg-secondary/10 text-secondary rounded-xl"><UserPlus size={18} /></div>
                                    <div><p className="font-bold text-sm">New Intake</p></div>
                                </button>
                                {/* Create Note is clinical work — hidden from the office Admin role (Jess). */}
                                {user?.role !== 'Admin' && (
                                    <button onClick={() => { onOpenNote(); setCreateMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors">
                                        <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><FilePlus size={18} /></div>
                                        <div><p className="font-bold text-sm">Create Note</p></div>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Clara launcher — opens the docked clinical assistant panel (staff).
                        Clara's avatar (same image as the portal bubble) with a live "available"
                        pulse: a maroon ring behind the avatar using Tailwind's core animate-ping
                        (Play-CDN safe — no custom @keyframes, which can silently no-op under the
                        CDN). The avatar itself stays static/crisp on top; only the ring pulses. */}
                    {onClaraToggle && (
                        <button
                            onClick={onClaraToggle}
                            aria-label="Open Clara clinical assistant"
                            aria-pressed={!!isClaraOpen}
                            title="Clara — clinical assistant"
                            className="relative w-[34px] h-[34px] shrink-0 rounded-full transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                            <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping pointer-events-none" aria-hidden="true"></span>
                            <img
                                src={CLARA_AVATAR_URL}
                                alt="Clara"
                                className={`relative w-full h-full rounded-full object-cover border border-white/50 dark:border-white/20 ${isClaraOpen ? 'ring-2 ring-primary' : 'ring-1 ring-primary/30'}`}
                            />
                        </button>
                    )}

                    <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full relative transition-colors">
                        <Bell size={20} />
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-primary rounded-full border-2 border-white dark:border-slate-900"></span>
                    </button>

                    <div className="relative ml-1">
                        <button onClick={() => setProfileOpen(prev => !prev)} className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-2xl transition-colors">
                            <img src={`https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=8B1E24&color=fff`} alt="User" className="w-8 h-8 rounded-xl" />
                        </button>
                        
                        {isProfileOpen && (
                            <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-border dark:border-slate-800 py-2 z-50 animate-fade-in-up">
                                <div className="px-4 py-3 border-b border-border dark:border-slate-800 mb-1">
                                    <p className="text-sm font-bold">{user?.name}</p>
                                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                                </div>
                                {user?.role === 'Director' && (
                                    <Link to="/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                        <Settings size={16} /> Settings
                                    </Link>
                                )}
                                <div className="my-1 border-t border-border dark:border-slate-800"></div>
                                <button onClick={handleLogout} className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-primary hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                    <LogOut size={16} /> Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default GlobalHeader;
