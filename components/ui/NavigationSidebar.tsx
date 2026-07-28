import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import GemyndFlowLogo from './GemyndFlowLogo';
import {
    Home, Users, MessageSquare, Calendar, Shield,
    DollarSign, LogOut, X, BarChart3, Settings,
    ClipboardList, Zap, Activity, BookOpen, HelpCircle, ShieldCheck
} from 'lucide-react';
import { isTrialHidden } from '../../config/trialMode';
import { FINANCIAL_ROLES, type UserRole } from '../../types';
import { navLabelFor, NAV_SECTIONS } from '../../config/vocab';

type NavItemDef = {
    to: string;
    icon: React.ElementType;
    label: string;
    roles: readonly UserRole[];
    notifications?: number;
};

const ALL_ROLES: readonly UserRole[] = ['Director', 'Therapist', 'Admin'];
const CLINICAL_ROLES: readonly UserRole[] = ['Director', 'Therapist'];
const DIRECTOR_ONLY: readonly UserRole[] = ['Director'];

// Density pass: the lower-prominence cluster sits under a divider, below daily work.
// Renamed "Reports" → "Oversight" (2026-07-28): a work queue, a template picker and
// Settings are not reports, and the old heading made four "compliance"-ish entries read
// as one undifferentiated pile. Settings now has its own Administration group.
// Labels come from config/vocab so the sidebar, the drawer and the breadcrumb agree.
const oversightNavItems: NavItemDef[] = [
    { to: '/risk-monitor', icon: Shield, label: navLabelFor('/risk-monitor'), roles: CLINICAL_ROLES },
    { to: '/treatment-plan-library', icon: BookOpen, label: navLabelFor('/treatment-plan-library'), roles: CLINICAL_ROLES },
    { to: '/compliance-readiness', icon: ShieldCheck, label: navLabelFor('/compliance-readiness'), roles: DIRECTOR_ONLY },
    { to: '/financials', icon: DollarSign, label: navLabelFor('/financials'), roles: FINANCIAL_ROLES },
    { to: '/reporting', icon: BarChart3, label: navLabelFor('/reporting'), roles: DIRECTOR_ONLY },
].filter(item => !isTrialHidden(item.to));

const adminNavItems: NavItemDef[] = [
    { to: '/settings', icon: Settings, label: navLabelFor('/settings'), roles: DIRECTOR_ONLY },
].filter(item => !isTrialHidden(item.to));

const NavItem: React.FC<{ to: string; icon: React.ElementType; label: string; isCollapsed: boolean, notifications?: number }> = ({ to, icon: Icon, label, isCollapsed, notifications }) => (
  <li className="relative px-2">
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center p-3 my-1 rounded-xl transition-all duration-200 group ${
          isActive 
            ? 'bg-primary/10 text-primary font-bold shadow-sm ring-1 ring-primary/20 backdrop-blur-sm' 
            : 'text-surface-secondary hover:bg-white/60 dark:hover:bg-white/5 hover:text-surface-content dark:hover:text-white hover:shadow-sm'
        }`
      }
    >
      <Icon size={20} className={`flex-shrink-0 transition-transform group-hover:scale-110`} />
      {!isCollapsed && <span className="ml-3 font-medium flex-1 truncate">{label}</span>}
      {notifications && !isCollapsed && (
        <span className="ml-2 text-[10px] font-bold w-5 h-5 flex items-center justify-center bg-primary text-white rounded-full shadow-sm">
            {notifications}
        </span>
      )}
    </NavLink>
  </li>
);

const NavigationSidebar: React.FC<{ isCollapsed: boolean; setIsCollapsed: (c: boolean) => void }> = ({ isCollapsed, setIsCollapsed }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Daily-work leads (scheduling-first): Dashboard / Calendar / Clients / Forms, then the rest.
  // Lower-prominence items sit under the Oversight + Administration dividers below.
  const baseNavItems: NavItemDef[] = ([
    { to: '/dashboard', icon: Home, label: navLabelFor('/dashboard'), roles: ALL_ROLES },
    { to: '/session-management', icon: Calendar, label: navLabelFor('/session-management'), roles: ALL_ROLES },
    { to: '/clients', icon: Users, label: navLabelFor('/clients'), roles: ALL_ROLES },
    { to: '/forms', icon: ClipboardList, label: navLabelFor('/forms'), roles: ALL_ROLES },
    { to: '/communication-center', icon: MessageSquare, label: navLabelFor('/communication-center'), roles: ALL_ROLES },
    { to: '/document-intelligence', icon: Zap, label: navLabelFor('/document-intelligence'), roles: ALL_ROLES },
    { to: '/help', icon: HelpCircle, label: navLabelFor('/help'), roles: ALL_ROLES },
  ] satisfies NavItemDef[])
    .filter(item => !isTrialHidden(item.to))
    .filter(item => !user || item.roles.includes(user.role));

  return (
    <aside className={`hidden lg:flex flex-col fixed top-0 left-0 h-full z-30 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'} bg-white/80 dark:bg-dark-surface/80 backdrop-blur-2xl border-r border-white/20 dark:border-white/5 shadow-2xl`}>
      <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} p-4 mb-2 h-20`}>
          {!isCollapsed && <GemyndFlowLogo className="h-8" />}
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-surface-secondary">
              {isCollapsed ? <Activity size={20} /> : <X size={20}/>}
          </button>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        <ul className="space-y-1">
          {baseNavItems.map(item => <NavItem key={item.to} {...item} isCollapsed={isCollapsed} />)}
        </ul>
        {([
            { heading: NAV_SECTIONS.oversight, items: oversightNavItems },
            { heading: NAV_SECTIONS.admin, items: adminNavItems },
        ]).map(({ heading, items }) => {
            const visible = items.filter(item => user && item.roles.includes(user.role));
            if (visible.length === 0) return null;
            return (
                <div key={heading} className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-4">
                    {!isCollapsed && <div className="px-4 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{heading}</div>}
                    <ul className="space-y-1">
                      {visible.map(item => <NavItem key={item.to} {...item} isCollapsed={isCollapsed} />)}
                    </ul>
                </div>
            );
        })}
      </nav>

      {/* Theme control moved to the header (ui-elevate-p1) — this footer now holds
          Sign Out only. Mobile keeps its own control in MobileDrawer. */}
      <div className="p-4 border-t border-black/5 dark:border-white/10 bg-slate-50/50 dark:bg-black/20">
        <button onClick={() => { logout(); navigate('/login'); }} className="w-full flex items-center justify-center p-3 rounded-xl text-primary hover:bg-red-50 dark:hover:bg-red-900/20 transition-all font-bold text-sm">
          <LogOut size={18} />
          {!isCollapsed && <span className="ml-2">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};

export default NavigationSidebar;