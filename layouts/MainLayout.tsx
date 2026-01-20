import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import NavigationSidebar from '../components/ui/NavigationSidebar';
import CommandPalette from '../components/ui/CommandPalette';
import { useAuth } from '../contexts/AuthContext';
import BottomNavBar from '../components/ui/BottomNavBar';
import SynapseChatPopover from '../components/ai/SynapseChatPopover';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import GlobalHeader from '../components/ui/GlobalHeader';
import ScheduleSessionModal from '../components/sessions/ScheduleSessionModal';
import { getClients } from '../services/api';
import { Client } from '../types';
import NotificationContainer from '../components/ui/NotificationContainer';
import Modal from '../components/ui/Modal';
import SmartNoteImporter from '../components/notes/SmartNoteImporter';
import CreateClientModal from '../components/clients/CreateClientModal';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const [isSidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isClaraOpen, setClaraOpen] = useState(false);
  const [isScheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [isNoteModalOpen, setNoteModalOpen] = useState(false); 
  const [isCreateClientModalOpen, setCreateClientModalOpen] = useState(false);
  const [preselectedClientId, setPreselectedClientId] = useState<string | undefined>(undefined);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    if (isScheduleModalOpen || isNoteModalOpen) {
      const fetchClientsForModal = async () => {
        try {
          const clientsData = await getClients();
          setClients(clientsData);
        } catch (error) {
          console.error("Failed to fetch clients for modal:", error);
        }
      };
      fetchClientsForModal();
    }
  }, [isScheduleModalOpen, isNoteModalOpen]);

  useEffect(() => {
    const handleOpenNoteModal = (e: any) => {
        if (e.detail && e.detail.clientId) {
            setPreselectedClientId(e.detail.clientId);
        }
        setNoteModalOpen(true);
    };

    window.addEventListener('open-note-modal', handleOpenNoteModal);
    return () => window.removeEventListener('open-note-modal', handleOpenNoteModal);
  }, []);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
      if (event.key === 'Escape') {
        setCommandPaletteOpen(false);
        setClaraOpen(false);
        setScheduleModalOpen(false);
        setNoteModalOpen(false);
        setCreateClientModalOpen(false);
      }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="flex min-h-screen relative overflow-hidden bg-background dark:bg-dark-background transition-colors duration-500">
      {/* Dominant ACS Maroon/Indigo Aurora Background */}
      <div 
        className="fixed inset-0 -z-[1] opacity-70 dark:opacity-40 pointer-events-none animate-aurora" 
        style={{
          backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(139, 30, 36, 0.12) 0%, rgba(79, 70, 229, 0.08) 40%, transparent 100%)',
          backgroundSize: '150% 150%',
          zIndex: -1
        }}
      ></div>
      <div className="fixed top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.04] dark:opacity-[0.06] pointer-events-none -z-[1]" style={{ zIndex: -1 }}></div>

      <GlobalHeader 
        onCommandPaletteToggle={() => setCommandPaletteOpen(prev => !prev)}
        onScheduleSession={() => setScheduleModalOpen(true)}
        onOpenNote={() => setNoteModalOpen(true)}
      />
      
      <NotificationContainer />

      <div className="relative z-10 flex w-full">
        <NavigationSidebar 
            isCollapsed={isSidebarCollapsed} 
            setIsCollapsed={setSidebarCollapsed} 
        />
        <div className={`flex flex-col flex-1 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
            <main className="flex-1 p-4 sm:p-6 pt-24 pb-24 lg:pt-20 lg:p-8 motion-safe:animate-fade-in-up">
                <Breadcrumbs />
                {children}
            </main>
        </div>
      </div>
      
      <BottomNavBar />
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      
      {/* Dominant ACS Primary Floating Button */}
      <button 
        onClick={() => setClaraOpen(prev => !prev)}
        className="fixed bottom-8 right-8 z-50 w-16 h-16 bg-gradient-to-br from-primary to-[#70181D] text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ease-in-out hover:scale-110 hover:shadow-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/30 animate-pulse-shadow" 
        aria-label="Open GeMyndFlow AI Orchestrator"
      >
          <img src="https://storage.googleapis.com/westerns1978-digital-assets/ACS%20TherapyHub/clara2.png" alt="GeMyndFlow Assistant" className="w-full h-full object-cover rounded-full border-2 border-white/20" />
      </button>

      <SynapseChatPopover isOpen={isClaraOpen} onClose={() => setClaraOpen(false)} mode="staff" />
      
      {isScheduleModalOpen && (
          <ScheduleSessionModal
            isOpen={isScheduleModalOpen}
            onClose={() => setScheduleModalOpen(false)}
            onSave={(newApt) => console.log('New appointment scheduled:', newApt)}
            clients={clients}
          />
      )}

      {isNoteModalOpen && (
          <Modal isOpen={isNoteModalOpen} onClose={() => setNoteModalOpen(false)} title="Clinical Smart Note Studio">
              <div className="p-4">
                  <SmartNoteImporter 
                      clientId={preselectedClientId} 
                      onNoteGenerated={() => setNoteModalOpen(false)} 
                  />
              </div>
          </Modal>
      )}

      <CreateClientModal isOpen={isCreateClientModalOpen} onClose={() => setCreateClientModalOpen(false)} />
    </div>
  );
};

export default MainLayout;