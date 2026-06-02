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
import type { User, UserRole, StaffRole } from '../types';

// Demo/trial STAFF accounts. The demo login self-provisions these as REAL
// Supabase Auth users on first use (signUp), so the demo path produces a real
// session rather than a stub. Clearly namespaced so they never collide with
// real staff accounts. (Reported to the maintainer; safe to delete post-trial.)
export const DEMO_PASSWORD = 'acs-demo-trial-2026!';
export const DEMO_ACCOUNTS: Record<StaffRole, { email: string; name: string }> = {
  Director:  { email: 'demo.director@acs-therapyhub.com',  name: 'David Yoder (Demo Director)' },
  Therapist: { email: 'demo.therapist@acs-therapyhub.com', name: 'Karen (Demo Therapist)' },
  Admin:     { email: 'demo.admin@acs-therapyhub.com',     name: 'Jessica (Demo Admin)' },
};

/**
 * Map the role string on the authenticated user to our UserRole.
 *
 * Anything that is not an explicit staff role resolves to 'Client' (non-staff).
 * This INCLUDES users with no role at all. Previously unknown users defaulted to
 * 'Therapist', which let any authenticated account into clinical routes — that
 * hole is closed: counselor guards now require an explicit StaffRole.
 */
export function resolveRole(u: SupabaseUser | null | undefined): UserRole {
  const raw = (u?.app_metadata?.role ?? u?.user_metadata?.role ?? '')
    .toString().trim().toLowerCase();
  switch (raw) {
    case 'director':  return 'Director';
    case 'admin':     return 'Admin';
    case 'therapist': return 'Therapist';
    case 'client':    return 'Client';
    default:
      if (raw) {
        console.warn(`[auth] Unrecognized role "${raw}" on ${u?.email ?? 'user'}; treating as non-staff (Client).`);
      }
      return 'Client';
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
export async function signInDemo(role: StaffRole): Promise<{ error?: string }> {
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
