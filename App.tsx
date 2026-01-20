
import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

import ErrorBoundary from './components/ErrorBoundary';
import ScrollToTop from './components/ScrollToTop';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import PageLoader from './components/ui/PageLoader';
import PortalLayout from './layouts/PortalLayout';

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
const Financials = lazy(() => import('./pages/Financials'));
const VideoSessions = lazy(() => import('./pages/VideoSessions'));
const VideoGreenRoom = lazy(() => import('./pages/VideoGreenRoom'));
const Resources = lazy(() => import('./pages/Resources')); 

// Admin Pages
const Reporting = lazy(() => import('./pages/Reporting'));
const FormsManagement = lazy(() => import('./pages/FormsManagement'));
const Settings = lazy(() => import('./pages/Settings'));
const NetworkScanners = lazy(() => import('./pages/NetworkScanners'));

// Client Portal Pages
const ClientLogin = lazy(() => import('./pages/portal/ClientLogin'));
const PortalDashboard = lazy(() => import('./pages/portal/PortalDashboard'));
const PortalDocuments = lazy(() => import('./pages/portal/PortalDocuments'));
const PortalBilling = lazy(() => import('./pages/portal/PortalBilling'));
const PortalSignDocument = lazy(() => import('./pages/portal/PortalSignDocument'));
const PortalCompliance = lazy(() => import('./pages/portal/PortalCompliance'));
const PortalAppointments = lazy(() => import('./pages/portal/PortalAppointments'));
const RecoveryPlanForm = lazy(() => import('./pages/portal/RecoveryPlanForm'));

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
                  <Route path="/portal/login" element={<ClientLogin />} />
                  <Route path="/visitor-resources" element={<PortalLayout><Resources /></PortalLayout>} />

                  {/* Counselor-facing App */}
                  <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/clients" element={<ProtectedRoute><ClientWorkspace /></ProtectedRoute>} />
                  <Route path="/clients/:clientId" element={<ProtectedRoute><ClientWorkspace /></ProtectedRoute>} />
                  <Route path="/communication-center" element={<ProtectedRoute><CommunicationCenter /></ProtectedRoute>} />
                  <Route path="/session-management" element={<ProtectedRoute><SessionManagement /></ProtectedRoute>} />
                  <Route path="/video-sessions" element={<ProtectedRoute><VideoSessions /></ProtectedRoute>} />
                  <Route path="/video-sessions/:sessionId/green-room" element={<ProtectedRoute><VideoGreenRoom /></ProtectedRoute>} />
                  <Route path="/program-compliance/:clientId" element={<ProtectedRoute><ProgramCompliance /></ProtectedRoute>} />
                  <Route path="/compliance-assistant" element={<ProtectedRoute><ComplianceAssistant /></ProtectedRoute>} />
                  <Route path="/assessments/:clientId" element={<ProtectedRoute><AsamAssessment /></ProtectedRoute>} />
                  <Route path="/sign/:documentType/:clientId" element={<ProtectedRoute><SignaturePage /></ProtectedRoute>} />
                  <Route path="/compliance" element={<ProtectedRoute><Compliance /></ProtectedRoute>} />
                  <Route path="/program-plan/:clientId" element={<ProtectedRoute><ProgramPlan /></ProtectedRoute>} />
                  <Route path="/fee-ledger/:clientId" element={<ProtectedRoute><FeeLedger /></ProtectedRoute>} />
                  <Route path="/financials" element={<ProtectedRoute><Financials /></ProtectedRoute>} />
                  <Route path="/forms" element={<ProtectedRoute><Forms /></ProtectedRoute>} />
                  
                  {/* Admin-only Routes */}
                  <Route path="/reporting" element={<AdminRoute><Reporting /></AdminRoute>} />
                  <Route path="/forms-management" element={<AdminRoute><FormsManagement /></AdminRoute>} />
                  <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
                  <Route path="/network-scanners" element={<AdminRoute><NetworkScanners /></AdminRoute>} />

                  {/* Client-facing Portal */}
                  <Route path="/portal/dashboard" element={<PortalDashboard />} />
                  <Route path="/portal/documents" element={<PortalDocuments />} />
                  <Route path="/portal/billing" element={<PortalBilling />} />
                  <Route path="/portal/documents/sign/:docId" element={<PortalSignDocument />} />
                  <Route path="/portal/compliance" element={<PortalCompliance />} />
                  <Route path="/portal/appointments" element={<PortalAppointments />} />
                  <Route path="/portal/recovery-plan" element={<RecoveryPlanForm />} />
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
