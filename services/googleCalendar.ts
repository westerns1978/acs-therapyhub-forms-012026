// Client-side wrapper for Google Calendar integration.
//
// OAuth flow is PKCE + redirect. We cannot store the client secret in a
// browser, so the token exchange happens in an edge function. The browser
// only handles:
//   1. Generating a code_verifier + code_challenge, stashing verifier in
//      sessionStorage.
//   2. Redirecting to Google's consent screen.
//   3. Receiving the code on /oauth/callback and POSTing it to the
//      google-oauth-exchange edge function (with the stashed verifier).
//
// Actual Calendar writes also go through an edge function so the refresh
// token never touches the browser.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as
    | string
    | undefined;

const SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

const VERIFIER_KEY = 'google_oauth_code_verifier';
const STATE_KEY = 'google_oauth_state';
const CONNECTED_KEY = 'google_calendar_connected';
const CONNECTED_EMAIL_KEY = 'google_calendar_email';

export const isGoogleOAuthConfigured = (): boolean => !!GOOGLE_CLIENT_ID;

export const getConnectedGoogleAccountEmail = (): string | null => {
    try {
        return localStorage.getItem(CONNECTED_EMAIL_KEY);
    } catch {
        return null;
    }
};

export const isGoogleCalendarLinked = (): boolean => {
    try {
        return localStorage.getItem(CONNECTED_KEY) === 'true';
    } catch {
        return false;
    }
};

export const markGoogleCalendarLinked = (email: string | null) => {
    try {
        localStorage.setItem(CONNECTED_KEY, 'true');
        if (email) localStorage.setItem(CONNECTED_EMAIL_KEY, email);
    } catch {
        /* ignore */
    }
};

export const clearGoogleCalendarLink = () => {
    try {
        localStorage.removeItem(CONNECTED_KEY);
        localStorage.removeItem(CONNECTED_EMAIL_KEY);
    } catch {
        /* ignore */
    }
};

const getRedirectUri = (): string => {
    // HashRouter app — Google's redirect lands before the hash, so the
    // callback route sits at `/oauth/callback` under the hash. Google only
    // sees the origin+path+query, so the actual registered URI must match
    // what the browser sends. We use `<origin>/oauth-callback.html` pattern
    // by redirecting to index with a query flag, then the hash router picks
    // it up. Simplest approach: register `<origin>/` as redirect_uri and
    // let /#/oauth/callback read params from window.location.search.
    //
    // For cleanliness we use `<origin>/oauth-callback` which a tiny static
    // HTML file forwards into the hash router. But since we have no static
    // hosting layer that resolves that path, we instead use origin itself
    // and route on a `?oauth=google` marker. See OAuthCallback.tsx.
    const origin = window.location.origin;
    return `${origin}/`;
};

const b64url = (buf: ArrayBuffer): string => {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const sha256 = async (input: string): Promise<ArrayBuffer> => {
    const data = new TextEncoder().encode(input);
    return await crypto.subtle.digest('SHA-256', data);
};

const randomString = (len = 64): string => {
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    return b64url(bytes.buffer).slice(0, len);
};

/**
 * Step 1: redirect the browser to Google's consent screen.
 * Stores code_verifier + state in sessionStorage for the callback to consume.
 */
export const beginGoogleOAuth = async (): Promise<void> => {
    if (!GOOGLE_CLIENT_ID) {
        throw new Error(
            'Google OAuth not configured: set VITE_GOOGLE_CLIENT_ID in env',
        );
    }
    const verifier = randomString(64);
    const challenge = b64url(await sha256(verifier));
    const state = randomString(32);

    sessionStorage.setItem(VERIFIER_KEY, verifier);
    sessionStorage.setItem(STATE_KEY, state);

    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: getRedirectUri(),
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: `google:${state}`,
    });

    window.location.href =
        `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

/**
 * Step 2: called from OAuthCallback after Google redirects back with ?code=...
 * Exchanges the code for tokens via the edge function.
 */
export const completeGoogleOAuth = async (
    code: string,
    state: string,
    userId: string,
): Promise<{ email: string | null }> => {
    const storedState = sessionStorage.getItem(STATE_KEY);
    const verifier = sessionStorage.getItem(VERIFIER_KEY);
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);

    if (!verifier) throw new Error('Missing PKCE verifier; restart connection');
    if (!storedState || !state.endsWith(storedState)) {
        throw new Error('OAuth state mismatch; possible CSRF — aborted');
    }

    const res = await fetch(
        `${SUPABASE_URL}/functions/v1/google-oauth-exchange`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                code,
                code_verifier: verifier,
                redirect_uri: getRedirectUri(),
                user_id: userId,
            }),
        },
    );
    const body = await res.json();
    if (!res.ok || body.error) {
        throw new Error(body.error || `exchange failed (${res.status})`);
    }

    markGoogleCalendarLinked(body.account_email ?? null);
    return { email: body.account_email ?? null };
};

export interface CalendarEventInput {
    summary: string;
    description?: string;
    location?: string;
    startIso: string;
    endIso: string;
    timezone?: string;
    attendees?: string[];
}

export interface CalendarEventResult {
    eventId: string;
    htmlLink?: string;
}

/**
 * Best-effort write-through to Google Calendar. Callers should treat a
 * thrown error as non-fatal and log it; appointment is already saved to
 * Supabase by the time we call this.
 */
export const createGoogleCalendarEvent = async (
    userId: string,
    input: CalendarEventInput,
): Promise<CalendarEventResult> => {
    const res = await fetch(
        `${SUPABASE_URL}/functions/v1/google-calendar-create-event`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                user_id: userId,
                event: {
                    summary: input.summary,
                    description: input.description,
                    location: input.location,
                    start_iso: input.startIso,
                    end_iso: input.endIso,
                    timezone: input.timezone,
                    attendees: input.attendees,
                },
            }),
        },
    );
    const body = await res.json();
    if (!res.ok || body.error) {
        throw new Error(body.error || `calendar create failed (${res.status})`);
    }
    return { eventId: body.event_id, htmlLink: body.html_link };
};

export interface CalendarEventPatch {
    summary?: string;
    description?: string;
    location?: string;
    startIso?: string;
    endIso?: string;
    timezone?: string;
    attendees?: string[];
    status?: 'confirmed' | 'cancelled';
}

export const updateGoogleCalendarEvent = async (
    userId: string,
    eventId: string,
    patch: CalendarEventPatch,
): Promise<CalendarEventResult> => {
    const res = await fetch(
        `${SUPABASE_URL}/functions/v1/google-calendar-update-event`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                user_id: userId,
                event_id: eventId,
                event: {
                    summary: patch.summary,
                    description: patch.description,
                    location: patch.location,
                    start_iso: patch.startIso,
                    end_iso: patch.endIso,
                    timezone: patch.timezone,
                    attendees: patch.attendees,
                    status: patch.status,
                },
            }),
        },
    );
    const body = await res.json();
    if (!res.ok || body.error) {
        throw new Error(body.error || `calendar update failed (${res.status})`);
    }
    return { eventId: body.event_id, htmlLink: body.html_link };
};

export const deleteGoogleCalendarEvent = async (
    userId: string,
    eventId: string,
): Promise<void> => {
    const res = await fetch(
        `${SUPABASE_URL}/functions/v1/google-calendar-delete-event`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ user_id: userId, event_id: eventId }),
        },
    );
    const body = await res.json();
    if (!res.ok || body.error) {
        throw new Error(body.error || `calendar delete failed (${res.status})`);
    }
};

export interface BusyInterval {
    start: string; // ISO
    end: string;   // ISO
}

/**
 * Returns busy intervals on the user's primary Google Calendar within the
 * given window. Callers compute their own overlap decisions.
 */
export const getGoogleFreeBusy = async (
    userId: string,
    timeMinIso: string,
    timeMaxIso: string,
): Promise<BusyInterval[]> => {
    const res = await fetch(
        `${SUPABASE_URL}/functions/v1/google-calendar-freebusy`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                user_id: userId,
                time_min_iso: timeMinIso,
                time_max_iso: timeMaxIso,
            }),
        },
    );
    const body = await res.json();
    if (!res.ok || body.error) {
        throw new Error(body.error || `freebusy failed (${res.status})`);
    }
    return (body.busy || []) as BusyInterval[];
};

export const intervalsOverlap = (
    aStart: string, aEnd: string,
    bStart: string, bEnd: string,
): boolean => {
    const a1 = new Date(aStart).getTime();
    const a2 = new Date(aEnd).getTime();
    const b1 = new Date(bStart).getTime();
    const b2 = new Date(bEnd).getTime();
    return a1 < b2 && b1 < a2;
};
