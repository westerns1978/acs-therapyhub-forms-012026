import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthContextType, User, StaffRole } from '../types';
import { supabase } from '../services/supabase';
import { initDemoVisibility } from '../config/demoData';
import {
  mapSupabaseUser,
  signInWithPassword,
  signInDemo,
  signOut,
} from '../services/authService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Auth state is now derived from the REAL Supabase Auth session — not
 * sessionStorage. On mount we read the persisted session and then subscribe to
 * `onAuthStateChange`, so the client's Postgres role is `authenticated` (not
 * `anon`) whenever `user` is set. Role comes from the authenticated user's JWT
 * metadata via `mapSupabaseUser` (see services/authService.ts).
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // 1. Hydrate from any persisted session (survives reloads).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      // Prime the per-user demo-visibility store BEFORE any page queries, so
      // applyDemoFilter (called from plain service fns with no React context)
      // reads this user's setting rather than a stale one. See config/demoData.
      initDemoVisibility(session?.user?.id ?? null);
      setUser(session?.user ? mapSupabaseUser(session.user) : null);
      setLoading(false);
    });

    // 2. Keep in sync with sign-in / sign-out / token refresh. Keep this
    //    callback synchronous (no awaited supabase calls) per SDK guidance.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      initDemoVisibility(session?.user?.id ?? null);   // re-key on sign-in/sign-out
      setUser(session?.user ? mapSupabaseUser(session.user) : null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loginWithPassword = (email: string, password: string) => signInWithPassword(email, password);
  const loginDemo = (role: StaffRole) => signInDemo(role);
  const logout = async () => { await signOut(); };

  const value: AuthContextType = { user, loading, loginWithPassword, loginDemo, logout };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return {
      user: null,
      loading: false,
      loginWithPassword: async () => ({ error: 'Auth provider unavailable' }),
      loginDemo: async () => ({ error: 'Auth provider unavailable' }),
      logout: async () => {},
    };
  }
  return context;
};
