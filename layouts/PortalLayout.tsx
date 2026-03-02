
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import SynapseChatPopover from '../components/ai/SynapseChatPopover';
import { Menu, X, Home, FileText, Calendar, CreditCard, BarChart, LogOut } from 'lucide-react';

const LogOutIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>;

interface PortalLayoutProps {
  children: React.ReactNode;
}

const PortalHeader: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const logoUrl = "https://storage.googleapis.com/westerns1978-digital-assets/Websites/acs-therapy/ACS-Logo1.svg";
    
    const navLinks = [
        { name: 'Dashboard', path: '/portal/dashboard', icon: Home },
        { name: 'My Forms', path: '/portal/documents', icon: FileText },
        { name: 'Appointments', path: '/portal/appointments', icon: Calendar },
        { name: 'Billing', path: '/portal/billing', icon: CreditCard },
        { name: 'My Progress', path: '/portal/compliance', icon: BarChart },
    ];

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    // Prevent body scroll when menu open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isMobileMenuOpen]);

    const handleLogout = () => {
        sessionStorage.removeItem('portal_client');
        navigate('/portal/login');
    };

    return (
        <>
            <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-white/20 dark:border-slate-700/50 z-20 flex items-center justify-between px-4 sm:px-6">
                <div className="flex items-center gap-3">
                    {/* Hamburger - mobile */}
                    <button 
                        onClick={() => setMobileMenuOpen(true)}
                        className="md:hidden p-2 -ml-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Open menu"
                    >
                        <Menu size={22} className="text-slate-600 dark:text-slate-300" />
                    </button>
                    <Link to="/portal/dashboard">
                        <img src={logoUrl} alt="ACS Logo" className="h-10 object-contain dark:bg-white/90 dark:p-1 dark:rounded" />
                    </Link>
                    {/* Desktop nav */}
                    <nav className="hidden md:flex items-center gap-6 ml-6">
                        {navLinks.map(link => (
                            <Link 
                                key={link.path} 
                                to={link.path}
                                className={`text-sm font-bold uppercase tracking-widest transition-colors ${location.pathname === link.path ? 'text-primary' : 'text-slate-500 hover:text-primary'}`}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </nav>
                </div>
                <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-colors">
                    <LogOutIcon className="w-5 h-5" />
                    <span className="hidden sm:inline">Logout</span>
                </button>
            </header>

            {/* Mobile Drawer */}
            <div 
                className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity duration-300 md:hidden ${
                    isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={() => setMobileMenuOpen(false)}
            />
            <div className={`fixed top-0 left-0 h-full w-72 bg-white dark:bg-slate-900 z-50 shadow-2xl transform transition-transform duration-300 ease-out md:hidden ${
                isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
                {/* Drawer Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                    <img src={logoUrl} alt="ACS" className="h-8" />
                    <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Nav Links */}
                <nav className="py-4 px-3">
                    <ul className="space-y-1">
                        {navLinks.map(link => (
                            <li key={link.path}>
                                <Link
                                    to={link.path}
                                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                                        location.pathname === link.path 
                                            ? 'bg-primary/10 text-primary' 
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <link.icon size={18} />
                                    {link.name}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Footer */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 dark:border-slate-800">
                    <button 
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        <LogOut size={18} /> Sign Out
                    </button>
                </div>
            </div>
        </>
    );
};

const PortalLayout: React.FC<PortalLayoutProps> = ({ children }) => {
  const [isClaraOpen, setClaraOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-surface dark:bg-slate-950">
      <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] dark:bg-slate-950 dark:bg-[radial-gradient(rgba(255,255,255,0.1)_1px,transparent_1px)]"></div>
      
      <PortalHeader />
      <main className="flex-1 p-4 pt-20 sm:p-6 sm:pt-24">
        {children}
      </main>
      <footer className="text-center p-4 text-xs text-on-surface-secondary dark:text-slate-400">
        &copy; {new Date().getFullYear()} Assessment & Counseling Solutions. All rights reserved.
      </footer>

      {/* Floating Clara Button for Clients */}
      <button 
        onClick={() => setClaraOpen(prev => !prev)}
        className="fixed bottom-8 right-8 z-40 w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ease-in-out hover:scale-110 hover:shadow-indigo-500/50 focus:outline-none focus:ring-4 focus:ring-indigo-300" 
        aria-label="Open Clara AI Assistant"
      >
          <img src="https://storage.googleapis.com/westerns1978-digital-assets/ACS%20TherapyHub/clara2.png" alt="Clara AI" className="w-full h-full object-cover rounded-full border-2 border-white/20" />
      </button>

      <SynapseChatPopover isOpen={isClaraOpen} onClose={() => setClaraOpen(false)} mode="client" />
    </div>
  );
};

export default PortalLayout;
