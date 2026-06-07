import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';

import { supabase } from './services/supabase';
import ErrorBoundary from './components/ErrorBoundary';
import ScrollToTop from './components/ScrollToTop';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import PortalProtectedRoute from './components/PortalProtectedRoute';
import RequireRole from './components/RequireRole';
import PageLoader from './components/ui/PageLoader';
import PortalLayout from './layouts/PortalLayout';
import { isTrialHidden } from './config/trialMode';
import { FINANCIAL_ROLES } from './types';

// Lazy-loaded Page imports
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ClientWorkspace = lazy(() => import('./pages/ClientWorkspace'));
const CommunicationCenter = lazy(() => import('./pages/CommunicationCenter'));
const SessionManagement = lazy(() => import('./pages/SessionManagement'));
const ActiveSession = lazy(() => import('./pages/ActiveSession'));
const ProgramCompliance = lazy(() => import('./pages/ProgressTracking'));
const ComplianceAssistant = lazy(() => import('./pages/ComplianceAssistant'));
const AsamAssessment = lazy(() => import('./pages/AsamAssessment'));
const Compliance = lazy(() => import('./pages/Compliance'));
const ProgramPlan = lazy(() => import('./pages/TreatmentPlan'));
// Mock fee-ledger page (pages/Billing.tsx) retired in WS-RecordPayment 2b — it had a
// state-only "Record Payment" that wrote nothing to the ledger. Real billing is the
// ClientWorkspace "Billing" tab; redirect any stale /fee-ledger link there.
const FeeLedgerRedirect = () => {
  const { clientId } = useParams();
  return <Navigate to={clientId ? `/clients/${clientId}` : '/clients'} replace />;
};
const Forms = lazy(() => import('./pages/Forms'));
const TreatmentPlanLibrary = lazy(() => import('./pages/TreatmentPlanLibrary'));
const Financials = lazy(() => import('./pages/Financials'));
const VideoSessions = lazy(() => import('./pages/VideoSessions'));
const VideoGreenRoom = lazy(() => import('./pages/VideoGreenRoom'));
const Resources = lazy(() => import('./pages/Resources')); 
const DocumentIntelligence = lazy(() => import('./pages/DocumentIntelligence'));
const RiskMonitor = lazy(() => import('./pages/RiskMonitor'));
const OAuthCallback = lazy(() => import('./pages/OAuthCallback'));

// Admin Pages
const Reporting = lazy(() => import('./pages/Reporting'));
const Settings = lazy(() => import('./pages/Settings'));
const ComplianceReadiness = lazy(() => import('./pages/ComplianceReadiness'));

// Client Portal Pages
const ClientLogin = lazy(() => import('./pages/portal/ClientLogin'));
const PortalDashboard = lazy(() => import('./pages/portal/PortalDashboard'));
const PortalDocuments = lazy(() => import('./pages/portal/PortalDocuments'));
const PortalBilling = lazy(() => import('./pages/portal/PortalBilling'));
const PortalCompliance = lazy(() => import('./pages/portal/PortalCompliance'));
const PortalFormPage = lazy(() => import('./pages/portal/PortalFormPage'));
const PortalAppointments = lazy(() => import('./pages/portal/PortalAppointments'));
const RecoveryPlanForm = lazy(() => import('./pages/portal/RecoveryPlanForm'));
const WebsitePortalBridge = lazy(() => import('./pages/WebsitePortalBridge'));

// Public Help & Training (no auth — readable while signed out)
const HelpLayout = lazy(() => import('./pages/help/HelpLayout'));
const HelpHome = lazy(() => import('./pages/help/HelpHome'));
const HelpPage = lazy(() => import('./pages/help/HelpPage'));

function App() {
  return (
    <HashRouter>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              <ScrollToTop />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public & Login Routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/oauth/callback" element={<OAuthCallback />} />
                  <Route path="/portal/login" element={<ClientLogin />} />
                  <Route path="/website" element={<WebsitePortalBridge />} />
                  <Route path="/visitor-resources" element={<PortalLayout><Resources /></PortalLayout>} />

                  {/* Public Help & Training — no auth required, readable while signed out */}
                  <Route path="/help" element={<HelpLayout />}>
                    <Route index element={<HelpHome />} />
                    <Route path=":slug" element={<HelpPage />} />
                  </Route>

                  {/* Public Landing Page */}
                  <Route path="/" element={<WebsitePortalBridge />} />

                  {/* Counselor-facing App — open to all signed-in roles unless gated below */}
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/clients" element={<ProtectedRoute><ClientWorkspace /></ProtectedRoute>} />
                  <Route path="/clients/:clientId" element={<ProtectedRoute><ClientWorkspace /></ProtectedRoute>} />
                  {/* Messages — hidden for the team test (Send reaches no client; fabricated
                      ONLINE/read cues). Redirect when hidden, mirroring /video-sessions. Role
                      gate + component kept intact for when delivery is scoped + re-enabled. */}
                  <Route path="/communication-center" element={isTrialHidden('/communication-center')
                    ? <Navigate to="/dashboard" replace />
                    : <ProtectedRoute><CommunicationCenter /></ProtectedRoute>} />
                  <Route path="/session-management" element={<ProtectedRoute><SessionManagement /></ProtectedRoute>} />
                  <Route path="/session/:clientId" element={<RequireRole roles={['Director', 'Therapist']}><ActiveSession /></RequireRole>} />
                  <Route path="/forms" element={<ProtectedRoute><Forms /></ProtectedRoute>} />
                  <Route path="/fee-ledger/:clientId" element={<FeeLedgerRedirect />} />

                  {/* Clinical-only routes — Director + Therapist */}
                  {/* /video-sessions (+green-room) is a MOCK (getVideoSessions = hardcoded array;
                      writers no-op). Hidden for the team test — redirect to dashboard; the real
                      session spine is `appointments`. Role gate kept for when it's rebuilt. */}
                  <Route path="/video-sessions" element={isTrialHidden('/video-sessions')
                    ? <Navigate to="/dashboard" replace />
                    : <RequireRole roles={['Director', 'Therapist']}><VideoSessions /></RequireRole>} />
                  <Route path="/video-sessions/:sessionId/green-room" element={isTrialHidden('/video-sessions')
                    ? <Navigate to="/dashboard" replace />
                    : <RequireRole roles={['Director', 'Therapist']}><VideoGreenRoom /></RequireRole>} />
                  <Route path="/program-compliance/:clientId" element={<RequireRole roles={['Director', 'Therapist']}><ProgramCompliance /></RequireRole>} />
                  <Route path="/compliance-assistant" element={<RequireRole roles={['Director', 'Therapist']}><ComplianceAssistant /></RequireRole>} />
                  <Route path="/assessments/:clientId" element={<RequireRole roles={['Director', 'Therapist']}><AsamAssessment /></RequireRole>} />
                  <Route path="/compliance" element={<RequireRole roles={['Director', 'Therapist']}><Compliance /></RequireRole>} />
                  <Route path="/program-plan/:clientId" element={<RequireRole roles={['Director', 'Therapist']}><ProgramPlan /></RequireRole>} />
                  <Route path="/treatment-plan-library" element={<RequireRole roles={['Director', 'Therapist']}><TreatmentPlanLibrary /></RequireRole>} />
                  <Route path="/risk-monitor" element={<RequireRole roles={['Director', 'Therapist']}><RiskMonitor /></RequireRole>} />

                  {/* Director Reports — Financials, un-hidden for day-30 and gated to
                      Director/Admin (isFinancialRole == DB private.is_financial_staff()). */}
                  <Route path="/financials" element={<RequireRole roles={FINANCIAL_ROLES}><Financials /></RequireRole>} />

                  {/* TRIAL_MODE-hidden routes (redirect when on) — role gates kept for when flag flips */}
                  <Route
                    path="/document-intelligence"
                    element={isTrialHidden('/document-intelligence')
                      ? <Navigate to="/dashboard" replace />
                      : <ProtectedRoute><DocumentIntelligence supabase={supabase as any} /></ProtectedRoute>}
                  />
                  <Route
                    path="/reporting"
                    element={isTrialHidden('/reporting')
                      ? <Navigate to="/dashboard" replace />
                      : <RequireRole roles={['Director']}><Reporting /></RequireRole>}
                  />

                  {/* Director-only superuser routes */}
                  <Route path="/compliance-readiness" element={<RequireRole roles={['Director']}><ComplianceReadiness /></RequireRole>} />
                  <Route path="/settings" element={<RequireRole roles={['Director']}><Settings /></RequireRole>} />

                  {/* Client-facing Portal — gated on a real Supabase session (PortalProtectedRoute).
                      /portal/login stays public (defined above). */}
                  <Route path="/portal/dashboard" element={<PortalProtectedRoute><PortalDashboard /></PortalProtectedRoute>} />
                  <Route path="/portal/documents" element={<PortalProtectedRoute><PortalDocuments /></PortalProtectedRoute>} />
                  <Route path="/portal/billing" element={<PortalProtectedRoute><PortalBilling /></PortalProtectedRoute>} />
                  <Route path="/portal/compliance" element={<PortalProtectedRoute><PortalCompliance /></PortalProtectedRoute>} />
                  <Route path="/portal/appointments" element={<PortalProtectedRoute><PortalAppointments /></PortalProtectedRoute>} />
                  <Route path="/portal/forms/:formId" element={<PortalProtectedRoute><PortalFormPage /></PortalProtectedRoute>} />
                  <Route path="/portal/recovery-plan" element={<PortalProtectedRoute><RecoveryPlanForm /></PortalProtectedRoute>} />
                  <Route path="/portal" element={<Navigate to="/portal/dashboard" replace />} />
                </Routes>
              </Suspense>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </HashRouter>
  );
}

export default App;
