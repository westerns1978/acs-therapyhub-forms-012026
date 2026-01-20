import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ThemeToggle from './ThemeToggle';
import GemyndFlowLogo from './GemyndFlowLogo';
import { checkSupabaseConnection } from '../../services/api';
import { 
    Home, Users, MessageSquare, Calendar, ShieldCheck, 
    DollarSign, LogOut, X, BarChart3, FileText, Settings, 
    HardDrive, ClipboardList, Zap, Activity
} from 'lucide-react';

const adminNavItems = [
    { to: '/reporting', icon: BarChart3, label: 'Analytics' },
    { to: '/forms-management', icon: FileText, label: 'Forms Library' },
    { to: '/network-scanners', icon: HardDrive, label: 'Scanners' },
    { to: '/settings', icon: Settings, label: 'Settings' },
]

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
  const [uplinkLatency, setUplinkLatency] = useState<number | null>(null);
  
  useEffect(() => {
    const check = async () => {
      const start = Date.now();
      await checkSupabaseConnection();
      setUplinkLatency(Date.now() - start);
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const baseNavItems = [
    { to: '/dashboard', icon: Home, label: 'Dashboard' },
    { to: '/clients', icon: Users, label: 'Clients' },
    { to: '/session-management', icon: Calendar, label: 'Calendar' },
    { to: '/communication-center', icon: MessageSquare, label: 'Messages', notifications: 3 },
    { to: '/forms', icon: ClipboardList, label: 'Forms' },
    { to: '/financials', icon: DollarSign, label: 'Financials' },
  ];

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
        {user?.role === 'Admin' && (
            <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-4">
                {!isCollapsed && <div className="px-4 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Infrastructure</div>}
                <ul className="space-y-1">
                  {adminNavItems.map(item => <NavItem key={item.to} {...item} isCollapsed={isCollapsed} />)}
                </ul>
            </div>
        )}
      </nav>

      <div className="p-4 border-t border-black/5 dark:border-white/10 bg-slate-50/50 dark:bg-black/20">
        <div className={`mb-4 px-2 flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
           <div className={`w-2 h-2 rounded-full ${uplinkLatency ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
           {!isCollapsed && (
             <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Uplink: Lexington Stable</p>
                <p className="text-[9px] font-mono text-primary">{uplinkLatency || '---'}ms latency</p>
             </div>
           )}
        </div>
        <ThemeToggle isCollapsed={isCollapsed} className="mb-3" />
        <button onClick={() => { logout(); navigate('/login'); }} className="w-full flex items-center justify-center p-3 rounded-xl text-primary hover:bg-red-50 dark:hover:bg-red-900/20 transition-all font-bold text-sm">
          <LogOut size={18} />
          {!isCollapsed && <span className="ml-2">Terminate Session</span>}
        </button>
      </div>
    </aside>
  );
};

export default NavigationSidebar;