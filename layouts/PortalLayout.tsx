
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SynapseChatPopover from '../components/ai/SynapseChatPopover';

const LogOutIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>;

interface PortalLayoutProps {
  children: React.ReactNode;
}

const PortalHeader: React.FC = () => {
    const navigate = useNavigate();
    const logoUrl = "https://storage.googleapis.com/westerns1978-digital-assets/Websites/acs-therapy/ACS-Logo1.svg";
    
    const handleLogout = () => {
        navigate('/portal/login');
    };

    return (
        <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-white/20 dark:border-slate-700/50 z-20 flex items-center justify-between px-4 sm:px-6">
            <img src={logoUrl} alt="ACS Logo" className="h-10 object-contain dark:bg-white/90 dark:p-1 dark:rounded" />
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-medium text-on-surface-secondary hover:text-primary transition-colors">
                <LogOutIcon className="w-5 h-5" />
                <span>Logout</span>
            </button>
        </header>
    );
};

const PortalLayout: React.FC<PortalLayoutProps> = ({ children }) => {
  const [isClaraOpen, setClaraOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-surface dark:bg-slate-950">
      <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] dark:bg-slate-950 dark:bg-[radial-gradient(rgba(255,255,255,0.1)_1px,transparent_1px)]"></div>
      
      <PortalHeader />
      <main className="flex-1 p-6 pt-24 sm:p-8">
        {children}
      </main>
      <footer className="text-center p-4 text-xs text-on-surface-secondary dark:text-slate-400">
        &copy; {new Date().getFullYear()} Assessment & Counseling Solutions. All rights reserved.
      </footer>

      {/* Floating Clara Button for Clients */}
      <button 
        onClick={() => setClaraOpen(prev => !prev)}
        className="fixed bottom-8 right-8 z-50 w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ease-in-out hover:scale-110 hover:shadow-indigo-500/50 focus:outline-none focus:ring-4 focus:ring-indigo-300" 
        aria-label="Open Clara AI Assistant"
      >
          <img src="https://storage.googleapis.com/westerns1978-digital-assets/ACS%20TherapyHub/clara2.png" alt="Clara AI" className="w-full h-full object-cover rounded-full border-2 border-white/20" />
      </button>

      <SynapseChatPopover isOpen={isClaraOpen} onClose={() => setClaraOpen(false)} mode="client" />
    </div>
  );
};

export default PortalLayout;
