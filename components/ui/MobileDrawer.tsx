import React, { useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ThemeToggle from './ThemeToggle';
import {
    Home, Users, MessageSquare, Calendar,
    DollarSign, LogOut, X, BarChart3, FileText, Settings,
    HardDrive, ClipboardList, Zap, ShieldCheck, BookOpen, HelpCircle
} from 'lucide-react';
import { isTrialHidden } from '../../config/trialMode';
import type { UserRole } from '../../types';

type DrawerItemDef = {
    to: string;
    icon: React.ElementType;
    label: string;
    roles: readonly UserRole[];
};

const ALL_ROLES: readonly UserRole[] = ['Director', 'Therapist', 'Admin'];
const CLINICAL_ROLES: readonly UserRole[] = ['Director', 'Therapist'];
const DIRECTOR_ONLY: readonly UserRole[] = ['Director'];

interface MobileDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Close drawer on route change
    useEffect(() => {
        onClose();
    }, [location.pathname]);

    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const handleLogout = () => {
        logout();
        navigate('/login');
        onClose();
    };

    const navItems: DrawerItemDef[] = ([
        { to: '/dashboard', icon: Home, label: 'Dashboard', roles: ALL_ROLES },
        { to: '/clients', icon: Users, label: 'Clients', roles: ALL_ROLES },
        { to: '/session-management', icon: Calendar, label: 'Calendar', roles: ALL_ROLES },
        { to: '/communication-center', icon: MessageSquare, label: 'Messages', roles: ALL_ROLES },
        { to: '/forms', icon: ClipboardList, label: 'Forms', roles: ALL_ROLES },
        { to: '/treatment-plan-library', icon: BookOpen, label: 'Treatment Plan Library', roles: CLINICAL_ROLES },
        { to: '/document-intelligence', icon: Zap, label: 'AI Documents', roles: ALL_ROLES },
        { to: '/financials', icon: DollarSign, label: 'Financials', roles: DIRECTOR_ONLY },
        { to: '/compliance', icon: ShieldCheck, label: 'Compliance', roles: CLINICAL_ROLES },
        { to: '/help', icon: HelpCircle, label: 'Help & Training', roles: ALL_ROLES },
    ] satisfies DrawerItemDef[])
        .filter(item => !isTrialHidden(item.to))
        .filter(item => !user || item.roles.includes(user.role));

    const adminItems: DrawerItemDef[] = ([
        { to: '/reporting', icon: BarChart3, label: 'Analytics', roles: DIRECTOR_ONLY },
        { to: '/compliance-readiness', icon: ShieldCheck, label: 'Compliance Readiness', roles: DIRECTOR_ONLY },
        { to: '/settings', icon: Settings, label: 'Settings', roles: DIRECTOR_ONLY },
    ] satisfies DrawerItemDef[])
        .filter(item => !isTrialHidden(item.to))
        .filter(item => !user || item.roles.includes(user.role));

    return (
        <>
            {/* Backdrop */}
            <div 
                className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity duration-300 ${
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={onClose}
            />

            {/* Drawer */}
            <div className={`fixed top-0 left-0 h-full w-72 bg-white dark:bg-slate-900 z-50 shadow-2xl transform transition-transform duration-300 ease-out ${
                isOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <img 
                            src="https://storage.googleapis.com/westerns1978-digital-assets/Websites/acs-therapy/ACS-Logo1.svg" 
                            alt="ACS" 
                            className="h-8"
                        />
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* User Info */}
                {user && (
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                        <p className="font-black text-sm text-slate-800 dark:text-white">{user.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{user.role}</p>
                    </div>
                )}

                {/* Nav Items */}
                <nav className="flex-1 overflow-y-auto py-3 px-3">
                    <ul className="space-y-0.5">
                        {navItems.map(item => (
                            <li key={item.to}>
                                <NavLink
                                    to={item.to}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                                            isActive 
                                                ? 'bg-primary/10 text-primary' 
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`
                                    }
                                >
                                    <item.icon size={18} />
                                    {item.label}
                                </NavLink>
                            </li>
                        ))}
                    </ul>

                    {/* Admin Section — visible only if at least one item survives the role/trial filter above */}
                    {adminItems.length > 0 && (
                        <>
                            <div className="px-4 pt-6 pb-2">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Administration</p>
                            </div>
                            <ul className="space-y-0.5">
                                {adminItems.map(item => (
                                    <li key={item.to}>
                                        <NavLink
                                            to={item.to}
                                            className={({ isActive }) =>
                                                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                                                    isActive 
                                                        ? 'bg-primary/10 text-primary' 
                                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`
                                            }
                                        >
                                            <item.icon size={18} />
                                            {item.label}
                                        </NavLink>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between px-2">
                        <ThemeToggle />
                        <button 
                            onClick={handleLogout}
                            className="flex items-center gap-2 text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
                        >
                            <LogOut size={16} /> Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default MobileDrawer;
