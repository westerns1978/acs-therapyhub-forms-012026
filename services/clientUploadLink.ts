/**
 * Client Upload Link — thin client for the acs-request-upload edge function.
 *
 * mint requires a signed-in STAFF Supabase session (the app already holds it); we
 * pass that session's access_token explicitly as the Bearer, which is exactly what
 * makes mint succeed and an anon caller fail (Phase A). resolve/submit are public
 * (token-gated) and send the publishable anon key.
 */
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

const FN_URL = `${SUPABASE_URL}/functions/v1/acs-request-upload`;

export interface MintResult {
  ok: true;
  token: string;
  url: string;
  expiresAt: string;
  expiresInDays: number;
  requestedLabel: string;
}

export interface ResolveResult {
  ok: true;
  valid: true;
  requestedDocumentType: string;
  requestedLabel: string;
  expiresAt: string;
}

export interface SubmitFile {
  filename: string;
  mimeType: string;
  base64: string;
}

async function call<T>(body: Record<string, unknown>, opts?: { staffAuth?: boolean }): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
  };
  if (opts?.staffAuth) {
    // The logged-in staff session's JWT — REQUIRED for mint. No anon fallback:
    // if there's no session, we send no Bearer and the function rejects (401),
    // which is the correct behavior (only staff mint).
    const { data } = await supabase.auth.getSession();
    const jwt = data.session?.access_token;
    if (jwt) headers.Authorization = `Bearer ${jwt}`;
  } else {
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const res = await fetch(FN_URL, { method: 'POST', headers, body: JSON.stringify(body) });
  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    throw new Error(`Upload service returned ${res.status}`);
  }
  if (!res.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Upload service returned ${res.status}`);
  }
  return payload as T;
}

/** Staff: mint a 7-day upload link for a client + a requested document type. */
export function mintClientUploadLink(args: {
  clientId: string;
  requestedDocumentType: string;
}): Promise<MintResult> {
  return call<MintResult>(
    { action: 'mint', clientId: args.clientId, requestedDocumentType: args.requestedDocumentType },
    { staffAuth: true },
  );
}

/** Public: validate a token + load ONLY the requested-document label + expiry. */
export function resolveUploadToken(token: string): Promise<ResolveResult> {
  return call<ResolveResult>({ action: 'resolve', token });
}

/** Public: ingest files server-side; the target client comes from the token, not here. */
export function submitUpload(args: {
  token: string;
  files: SubmitFile[];
  note?: string;
}): Promise<{ ok: true; uploaded: number; message: string }> {
  return call({ action: 'submit', token: args.token, files: args.files, note: args.note || '' });
}

/**
 * Parse `/upload/{token}` from the current path (token = base64url, ≥24 chars).
 * Path-based (not hash) so the link a client receives is a clean, single URL that
 * the edge function itself returns. Intercepted in App.tsx before the HashRouter.
 */
export function uploadTokenFromPath(pathname = window.location.pathname): string | null {
  const m = pathname.match(/^\/upload\/([A-Za-z0-9_-]{24,})\/?$/);
  return m?.[1] ?? null;
}
