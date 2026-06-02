import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import PageLoader from './ui/PageLoader';

interface PortalProtectedRouteProps {
  children: React.ReactElement;
}

/**
 * Route guard for /portal/* — gates on the REAL Supabase Auth session.
 * Signed-out visitors are redirected to /portal/login. Parallel to the
 * counselor app's ProtectedRoute, but redirects to the portal login.
 *
 * NOTE (flagged to maintainer): counselor and portal share one Supabase
 * session. Telling the two apart (so a portal client can't reach counselor
 * routes, and vice-versa) is part of the portal-user provisioning decision
 * still pending approval — see the report. No portal auth users exist yet, so
 * there is no live cross-access today.
 */
const PortalProtectedRoute: React.FC<PortalProtectedRouteProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <PageLoader />;
  }
  if (!session) {
    return <Navigate to="/portal/login" state={{ from: location }} replace />;
  }
  return children;
};

export default PortalProtectedRoute;
