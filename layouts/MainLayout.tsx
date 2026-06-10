import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import NavigationSidebar from '../components/ui/NavigationSidebar';
import CommandPalette from '../components/ui/CommandPalette';
import { useAuth } from '../contexts/AuthContext';
import { useClara } from '../contexts/ClaraContext';
import MobileDrawer from '../components/ui/MobileDrawer';
import SynapseChatPopover from '../components/ai/SynapseChatPopover';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import GlobalHeader from '../components/ui/GlobalHeader';
import ScheduleSessionModal from '../components/sessions/ScheduleSessionModal';
import { getClients } from '../services/api';
import { Client } from '../types';
import NotificationContainer from '../components/ui/NotificationContainer';
import NoteStudioDock from '../components/notes/NoteStudioDock';
import CreateClientModal from '../components/clients/CreateClientModal';
import EditClientModal from '../components/clients/EditClientModal';
import CustomizeTreatmentPlanModal, { type CustomizeModalMode } from '../components/clients/CustomizeTreatmentPlanModal';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const [isSidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [isMobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  // Clara v2: open-state + session live in the app-level ClaraProvider, so the
  // panel (and any active voice session) survives navigation — this layout is
  // re-instantiated per route wrapper and must not own Clara state.
  const clara = useClara();
  const [isScheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [isNoteModalOpen, setNoteModalOpen] = useState(false); 
  const [isCreateClientModalOpen, setCreateClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [treatmentPlanMode, setTreatmentPlanMode] = useState<CustomizeModalMode | null>(null);
  const [preselectedClientId, setPreselectedClientId] = useState<string | undefined>(undefined);
  const [preselectedScheduleClient, setPreselectedScheduleClient] = useState<Client | null>(null);
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

  // Open Create Client modal from anywhere — mirrors the open-note-modal pattern
  // so deeper components (ClientSelectionGrid) don't need props threaded down.
  useEffect(() => {
    const handler = () => setCreateClientModalOpen(true);
    window.addEventListener('open-create-client-modal', handler);
    return () => window.removeEventListener('open-create-client-modal', handler);
  }, []);

  // Open Edit Client modal. Caller passes the client in event.detail.
  useEffect(() => {
    const handler = (e: any) => {
      if (e?.detail?.client) setEditingClient(e.detail.client);
    };
    window.addEventListener('open-edit-client-modal', handler);
    return () => window.removeEventListener('open-edit-client-modal', handler);
  }, []);

  // Open Treatment Plan customize modal — apply-template or edit-plan mode.
  useEffect(() => {
    const handler = (e: any) => {
      if (e?.detail?.mode) setTreatmentPlanMode(e.detail.mode as CustomizeModalMode);
    };
    window.addEventListener('open-treatment-plan-modal', handler);
    return () => window.removeEventListener('open-treatment-plan-modal', handler);
  }, []);

  // Open Schedule modal pre-scoped to a client (e.g. from the client header).
  // Reuses ScheduleSessionModal's existing preselectedClient prop.
  useEffect(() => {
    const handler = (e: any) => {
      setPreselectedScheduleClient(e?.detail?.client ?? null);
      setScheduleModalOpen(true);
    };
    window.addEventListener('open-schedule-modal', handler);
    return () => window.removeEventListener('open-schedule-modal', handler);
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
        clara.close(); // provider-owned: also stops voice (close-means-stop)
        setScheduleModalOpen(false);
        // Note: the Note Studio dock is intentionally NOT closed on Escape — it is a
        // persistent, non-blocking panel and closing it mid-session would discard an
        // unsaved note. Close it via its own Minimize/Close controls instead.
        setCreateClientModalOpen(false);
        setMobileDrawerOpen(false);
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
        onScheduleSession={() => { setPreselectedScheduleClient(null); setScheduleModalOpen(true); }}
        onOpenNote={() => { setPreselectedClientId(undefined); setNoteModalOpen(true); }}
        onNewIntake={() => setCreateClientModalOpen(true)}
        onMobileMenuToggle={() => setMobileDrawerOpen(prev => !prev)}
        onClaraToggle={clara.toggle}
        isClaraOpen={clara.isOpen}
      />
      
      <NotificationContainer />

      {/* Mobile Drawer */}
      <MobileDrawer isOpen={isMobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)} />

      <div className="relative z-10 flex w-full">
        {/* Desktop sidebar - hidden on mobile */}
        <NavigationSidebar 
            isCollapsed={isSidebarCollapsed} 
            setIsCollapsed={setSidebarCollapsed} 
        />
        <div className={`flex flex-col flex-1 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} ${clara.isOpen ? 'lg:mr-[420px]' : ''}`}>
            <main className="flex-1 p-4 sm:p-6 pt-20 pb-8 lg:pt-20 lg:p-8 motion-safe:animate-fade-in-up">
                <Breadcrumbs />
                {children}
            </main>
        </div>
      </div>
      
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />

      {/* Clara on staff surfaces is launched from the header (GlobalHeader → onClaraToggle)
          and opens as a docked right-side panel that PUSHES the content (lg:mr above),
          so she never floats over the ledger. The portal keeps the floating bubble
          (PortalLayout, unchanged). Same shared brain — only the shell differs. */}
      <SynapseChatPopover variant="panel" />
      
      {isScheduleModalOpen && (
          <ScheduleSessionModal
            isOpen={isScheduleModalOpen}
            onClose={() => { setScheduleModalOpen(false); setPreselectedScheduleClient(null); }}
            onSave={(newApt) => console.log('New appointment scheduled:', newApt)}
            clients={clients}
            preselectedClient={preselectedScheduleClient ?? undefined}
          />
      )}

      {/* Dockable, non-blocking Note Studio — sits beside a Zoom window during a live
          session (replaces the old blocking centered modal). */}
      <NoteStudioDock
          isOpen={isNoteModalOpen}
          onClose={() => setNoteModalOpen(false)}
          clientId={preselectedClientId}
      />

      <CreateClientModal isOpen={isCreateClientModalOpen} onClose={() => setCreateClientModalOpen(false)} />

      <EditClientModal
        isOpen={!!editingClient}
        onClose={() => setEditingClient(null)}
        client={editingClient}
        onSaved={(updated) => {
          // Broadcast so any open ClientWorkspace can refresh without us
          // having to thread props down through ProtectedRoute → children.
          window.dispatchEvent(new CustomEvent('client-updated', { detail: { client: updated } }));
        }}
      />

      <CustomizeTreatmentPlanModal
        isOpen={!!treatmentPlanMode}
        onClose={() => setTreatmentPlanMode(null)}
        mode={treatmentPlanMode}
      />
    </div>
  );
};

export default MainLayout;
