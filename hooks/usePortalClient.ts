import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

export interface PortalClient {
  id: string;
  name: string;
  email: string;
  program?: string;
  programLabel?: string;
  [key: string]: any;
}

const PROGRAM_LABELS: Record<string, string> = {
  SATOP: 'SATOP',
  SROP: 'SROP',
  CSTAR: 'CSTAR',
  REACT: 'REACT',
  GAMBLING_RECOVERY: 'Gambling Recovery',
};

function mapClientRow(row: any): PortalClient {
  return {
    ...row,
    id: row.id,
    name: row.name,
    email: row.email,
    program: row.program_type ?? undefined,
    programLabel: row.program_type
      ? (PROGRAM_LABELS[row.program_type] ?? row.program_type)
      : undefined,
  };
}

/**
 * Resolves the portal client from the REAL Supabase Auth session.
 *
 * Step 2 of the trust-layer rebuild: this replaces the old
 * `sessionStorage.portal_client` stub. The authenticated user is mapped to
 * their client record by EMAIL (`clients.email == session email`) — chosen
 * because the `clients` table has no auth-user FK column and adding one would
 * be a schema change (out of scope; see the blocker noted to the maintainer).
 *
 * Returns the client row, or `null` when there is no session OR the signed-in
 * user has no matching client record. We deliberately do NOT fall back to a
 * hardcoded client (that was the old stub). Route access is gated separately
 * by components/PortalProtectedRoute.tsx.
 */
export function usePortalClient(): PortalClient | null {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [client, setClient] = useState<PortalClient | null>(null);

  // Track the real session (sync setState only inside the auth callback).
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // Resolve the client record for the authenticated email.
  useEffect(() => {
    if (session === undefined) return; // still resolving the session
    const email = session?.user?.email;
    if (!email) { setClient(null); return; }
    let cancelled = false;
    supabase
      .from('clients')
      .select('*')
      .eq('email', email)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setClient(data ? mapClientRow(data) : null); });
    return () => { cancelled = true; };
  }, [session]);

  return client;
}
