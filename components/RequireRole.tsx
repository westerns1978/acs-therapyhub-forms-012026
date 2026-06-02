import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MainLayout from '../layouts/MainLayout';
import PageLoader from './ui/PageLoader';
import { isStaffRole, type UserRole } from '../types';

interface RequireRoleProps {
  roles: readonly UserRole[];
  children: React.ReactElement;
}

const RequireRole: React.FC<RequireRoleProps> = ({ roles, children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Resolve the real session first (see ProtectedRoute).
  if (loading) {
    return <PageLoader />;
  }

  // Require an explicit STAFF role first — denies 'Client' and no-role users.
  if (!user || !isStaffRole(user.role)) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated staff, but not one of the roles this route allows.
  if (!roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <MainLayout>{children}</MainLayout>;
};

export default RequireRole;
