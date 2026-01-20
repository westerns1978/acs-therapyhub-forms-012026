

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Icons
const HomeIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const UsersIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const VideoIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>;
const DollarSignIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const BarChart3Icon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>;

const clinicalItems = [
  { to: '/dashboard', icon: HomeIcon, label: 'Home' },
  { to: '/clients', icon: UsersIcon, label: 'Clients' },
  { to: '/session-management', icon: VideoIcon, label: 'Sessions' },
  { to: '/financials', icon: DollarSignIcon, label: 'Billing' },
];

const adminItems = [
  { to: '/dashboard', icon: HomeIcon, label: 'Home' },
  { to: '/clients', icon: UsersIcon, label: 'Clients' },
  { to: '/reporting', icon: BarChart3Icon, label: 'Reporting' },
  { to: '/financials', icon: DollarSignIcon, label: 'Billing' },
];

const BottomNavItem: React.FC<{ to: string; icon: React.ElementType; label: string; }> = ({ to, icon: Icon, label }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center w-full pt-2 pb-1 transition-colors duration-200 ${
          isActive ? 'text-primary' : 'text-on-surface-secondary hover:text-primary'
        }`
      }
    >
      <Icon className="h-6 w-6 mb-1" />
      <span className="text-xs font-medium">{label}</span>
    </NavLink>
);

const BottomNavBar: React.FC = () => {
    const { user } = useAuth();
    const navItems = user?.role === 'Admin' ? adminItems : clinicalItems;
    
    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-black/10 dark:border-slate-700/50 z-20 flex justify-around items-start pt-1 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
            {navItems.map(item => <BottomNavItem key={item.to} {...item} />)}
        </nav>
    );
};

export default BottomNavBar;