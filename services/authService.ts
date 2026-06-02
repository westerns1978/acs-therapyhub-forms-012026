/**
 * ACS TherapyHub — Authentication service (Supabase Auth).
 *
 * STEP 1 of the trust-layer rebuild. This replaces the old client-side
 * `sessionStorage` auth stub with REAL Supabase Auth sessions. After a
 * successful sign-in, `supabase.auth.getSession()` returns a real session and
 * the Postgres role the client presents becomes `authenticated` (the JWT
 * `role` claim), not `anon`.
 *
 * DELIBERATELY OUT OF SCOPE here (separate later steps — do NOT add here):
 *   - No tenancy / org_id, no RLS policies, no storage or billing changes.
 *   - Role is read from the authenticated user's OWN JWT metadata
 *     (`app_metadata.role`, then `user_metadata.role`). We intentionally do
 *     NOT read or write `public.users` (FieldDispatcher-shaped, `fd_agent_id`
 *     NOT NULL, shared with another live app) or `public.profiles` (shared,
 *     RLS-off, unknown role semantics). Sourcing role from auth metadata is
 *     the intended design recorded in SECURITY_BACKLOG.md and keeps this work
 *     decoupled from tables other apps depend on.
 *
 * iVALT: the biometric handshake stays as a SECONDARY factor. It attaches in
 * `pages/Login.tsx` AFTER the primary email/password session is established —
 * see the marked block there.
 */
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { User, UserRole } from '../types';

// Fallback role for an authenticated user whose record carries no role yet.
// Least-privileged sensible default (NOT Director, which unlocks financials +
// settings). Real staff accounts should carry `app_metadata.role` set by an
// admin; provisioning real staff is out of scope for this step.
const DEFAULT_ROLE: UserRole = 'Therapist';

// Demo/trial accounts. The demo login self-provisions these as REAL Supabase
// Auth users on first use (signUp), so the demo path produces a real session
// rather than a stub. Clearly namespaced so they never collide with real
// staff accounts. (Reported to the maintainer; safe to delete post-trial.)
export const DEMO_PASSWORD = 'acs-demo-trial-2026!';
export const DEMO_ACCOUNTS: Record<UserRole, { email: string; name: string }> = {
  Director:  { email: 'demo.director@acs-therapyhub.com',  name: 'David Yoder (Demo Director)' },
  Therapist: { email: 'demo.therapist@acs-therapyhub.com', name: 'Karen (Demo Therapist)' },
  Admin:     { email: 'demo.admin@acs-therapyhub.com',     name: 'Jessica (Demo Admin)' },
};

/** Map the role string carried on the authenticated user to our UserRole. */
export function resolveRole(u: SupabaseUser | null | undefined): UserRole {
  const raw = (u?.app_metadata?.role ?? u?.user_metadata?.role ?? '')
    .toString().trim().toLowerCase();
  switch (raw) {
    case 'director':  return 'Director';
    case 'admin':     return 'Admin';
    case 'therapist': return 'Therapist';
    default:
      console.warn(
        `[auth] No recognized role on ${u?.email ?? 'user'} ` +
        `(saw "${raw || 'none'}"); defaulting to ${DEFAULT_ROLE}.`
      );
      return DEFAULT_ROLE;
  }
}

/** Translate a Supabase auth user into the app's User shape. */
export function mapSupabaseUser(u: SupabaseUser): User {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const name = (meta.full_name as string)
    || (meta.name as string)
    || u.email?.split('@')[0]
    || 'User';
  return { id: u.id, email: u.email ?? '', name, role: resolveRole(u) };
}

/** Primary factor: real email/password sign-in → real Supabase session. */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ error?: string; phone?: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { error: error.message };
  const u = data.user;
  const phone = (u?.phone || (u?.user_metadata as any)?.phone || '') as string;
  return { phone: phone || undefined };
}

/**
 * Demo login. Produces a REAL (test) Supabase session — not a stub. Tries to
 * sign in; on first run self-provisions the demo account via signUp with the
 * chosen role in `user_metadata`, then signs in.
 */
export async function signInDemo(role: UserRole): Promise<{ error?: string }> {
  const acct = DEMO_ACCOUNTS[role];
  let res = await supabase.auth.signInWithPassword({
    email: acct.email,
    password: DEMO_PASSWORD,
  });
  if (res.error) {
    const signUp = await supabase.auth.signUp({
      email: acct.email,
      password: DEMO_PASSWORD,
      options: { data: { role, full_name: acct.name } },
    });
    if (signUp.error && !/already registered|already exists/i.test(signUp.error.message)) {
      return { error: signUp.error.message };
    }
    res = await supabase.auth.signInWithPassword({
      email: acct.email,
      password: DEMO_PASSWORD,
    });
    if (res.error) {
      // Most likely cause: the project has "Confirm email" enabled, so a
      // freshly signed-up account can't password-sign-in until confirmed.
      // That is a project setting, not a code change.
      return { error: `${res.error.message} (demo account: ${acct.email})` };
    }
  }
  return {};
}

/** Sign out of the real Supabase session. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
