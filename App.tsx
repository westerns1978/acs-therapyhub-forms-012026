import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

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

// Lazy-loaded Page imports
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ClientWorkspace = lazy(() => import('./pages/ClientWorkspace'));
const CommunicationCenter = lazy(() => import('./pages/CommunicationCenter'));
const SessionManagement = lazy(() => import('./pages/SessionManagement'));
const ProgramCompliance = lazy(() => import('./pages/ProgressTracking'));
const ComplianceAssistant = lazy(() => import('./pages/ComplianceAssistant'));
const AsamAssessment = lazy(() => import('./pages/AsamAssessment'));
const SignaturePage = lazy(() => import('./pages/SignaturePage'));
const Compliance = lazy(() => import('./pages/Compliance'));
const ProgramPlan = lazy(() => import('./pages/TreatmentPlan'));
const FeeLedger = lazy(() => import('./pages/Billing'));
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

// Client Portal Pages
const ClientLogin = lazy(() => import('./pages/portal/ClientLogin'));
const PortalDashboard = lazy(() => import('./pages/portal/PortalDashboard'));
const PortalDocuments = lazy(() => import('./pages/portal/PortalDocuments'));
const PortalBilling = lazy(() => import('./pages/portal/PortalBilling'));
const PortalSignDocument = lazy(() => import('./pages/portal/PortalSignDocument'));
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
                  <Route path="/communication-center" element={<ProtectedRoute><CommunicationCenter /></ProtectedRoute>} />
                  <Route path="/session-management" element={<ProtectedRoute><SessionManagement /></ProtectedRoute>} />
                  <Route path="/forms" element={<ProtectedRoute><Forms /></ProtectedRoute>} />
                  <Route path="/sign/:documentType/:clientId" element={<ProtectedRoute><SignaturePage /></ProtectedRoute>} />
                  <Route path="/fee-ledger/:clientId" element={<ProtectedRoute><FeeLedger /></ProtectedRoute>} />

                  {/* Clinical-only routes — Director + Therapist */}
                  <Route path="/video-sessions" element={<RequireRole roles={['Director', 'Therapist']}><VideoSessions /></RequireRole>} />
                  <Route path="/video-sessions/:sessionId/green-room" element={<RequireRole roles={['Director', 'Therapist']}><VideoGreenRoom /></RequireRole>} />
                  <Route path="/program-compliance/:clientId" element={<RequireRole roles={['Director', 'Therapist']}><ProgramCompliance /></RequireRole>} />
                  <Route path="/compliance-assistant" element={<RequireRole roles={['Director', 'Therapist']}><ComplianceAssistant /></RequireRole>} />
                  <Route path="/assessments/:clientId" element={<RequireRole roles={['Director', 'Therapist']}><AsamAssessment /></RequireRole>} />
                  <Route path="/compliance" element={<RequireRole roles={['Director', 'Therapist']}><Compliance /></RequireRole>} />
                  <Route path="/program-plan/:clientId" element={<RequireRole roles={['Director', 'Therapist']}><ProgramPlan /></RequireRole>} />
                  <Route path="/treatment-plan-library" element={<RequireRole roles={['Director', 'Therapist']}><TreatmentPlanLibrary /></RequireRole>} />
                  <Route path="/risk-monitor" element={<RequireRole roles={['Director', 'Therapist']}><RiskMonitor /></RequireRole>} />

                  {/* TRIAL_MODE-hidden routes (redirect when on) — role gates kept for when flag flips */}
                  <Route
                    path="/financials"
                    element={isTrialHidden('/financials')
                      ? <Navigate to="/dashboard" replace />
                      : <RequireRole roles={['Director']}><Financials /></RequireRole>}
                  />
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
                  <Route path="/settings" element={<RequireRole roles={['Director']}><Settings /></RequireRole>} />

                  {/* Client-facing Portal — gated on a real Supabase session (PortalProtectedRoute).
                      /portal/login stays public (defined above). */}
                  <Route path="/portal/dashboard" element={<PortalProtectedRoute><PortalDashboard /></PortalProtectedRoute>} />
                  <Route path="/portal/documents" element={<PortalProtectedRoute><PortalDocuments /></PortalProtectedRoute>} />
                  <Route path="/portal/billing" element={<PortalProtectedRoute><PortalBilling /></PortalProtectedRoute>} />
                  <Route path="/portal/documents/sign/:docId" element={<PortalProtectedRoute><PortalSignDocument /></PortalProtectedRoute>} />
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
