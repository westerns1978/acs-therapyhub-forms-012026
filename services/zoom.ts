// Client-side wrapper for Zoom integration.
//
// Mirrors googleCalendar.ts — PKCE OAuth via edge-function token exchange,
// meeting creation through an edge function so the refresh token never
// touches the browser.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

const ZOOM_CLIENT_ID = (import.meta as any).env?.VITE_ZOOM_CLIENT_ID as
    | string
    | undefined;

const VERIFIER_KEY = 'zoom_oauth_code_verifier';
const STATE_KEY = 'zoom_oauth_state';
const CONNECTED_KEY = 'zoom_connected';
const CONNECTED_EMAIL_KEY = 'zoom_account_email';

export const isZoomOAuthConfigured = (): boolean => !!ZOOM_CLIENT_ID;

export const getConnectedZoomAccountEmail = (): string | null => {
    try {
        return localStorage.getItem(CONNECTED_EMAIL_KEY);
    } catch {
        return null;
    }
};

export const isZoomLinked = (): boolean => {
    try {
        return localStorage.getItem(CONNECTED_KEY) === 'true';
    } catch {
        return false;
    }
};

export const markZoomLinked = (email: string | null) => {
    try {
        localStorage.setItem(CONNECTED_KEY, 'true');
        if (email) localStorage.setItem(CONNECTED_EMAIL_KEY, email);
    } catch {
        /* ignore */
    }
};

export const clearZoomLink = () => {
    try {
        localStorage.removeItem(CONNECTED_KEY);
        localStorage.removeItem(CONNECTED_EMAIL_KEY);
    } catch {
        /* ignore */
    }
};

const getRedirectUri = (): string => `${window.location.origin}/`;

const b64url = (buf: ArrayBuffer): string => {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const sha256 = async (input: string): Promise<ArrayBuffer> =>
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
const randomString = (len = 64): string => {
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    return b64url(bytes.buffer).slice(0, len);
};

/**
 * Step 1: redirect the browser to Zoom's consent screen.
 * Zoom OAuth supports PKCE (S256).
 */
export const beginZoomOAuth = async (): Promise<void> => {
    if (!ZOOM_CLIENT_ID) {
        throw new Error('Zoom OAuth not configured: set VITE_ZOOM_CLIENT_ID in env');
    }
    const verifier = randomString(64);
    const challenge = b64url(await sha256(verifier));
    const state = randomString(32);

    sessionStorage.setItem(VERIFIER_KEY, verifier);
    sessionStorage.setItem(STATE_KEY, state);

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: ZOOM_CLIENT_ID,
        redirect_uri: getRedirectUri(),
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: `zoom:${state}`,
    });

    window.location.href = `https://zoom.us/oauth/authorize?${params.toString()}`;
};

/** Step 2: OAuthCallback hands us the code; exchange via edge fn. */
export const completeZoomOAuth = async (
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

    const res = await fetch(`${SUPABASE_URL}/functions/v1/zoom-oauth-exchange`, {
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
    });
    const body = await res.json();
    if (!res.ok || body.error) {
        throw new Error(body.error || `exchange failed (${res.status})`);
    }
    markZoomLinked(body.account_email ?? null);
    return { email: body.account_email ?? null };
};

export interface ZoomMeetingInput {
    topic: string;
    startIso: string;
    durationMinutes: number;
    timezone?: string;
    agenda?: string;
}

export interface ZoomMeetingResult {
    meetingId: string;
    joinUrl: string;
    startUrl?: string;
    password?: string;
}

export const createZoomMeeting = async (
    userId: string,
    input: ZoomMeetingInput,
): Promise<ZoomMeetingResult> => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/zoom-create-meeting`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
            user_id: userId,
            meeting: {
                topic: input.topic,
                start_iso: input.startIso,
                duration_minutes: input.durationMinutes,
                timezone: input.timezone,
                agenda: input.agenda,
            },
        }),
    });
    const body = await res.json();
    if (!res.ok || body.error) {
        throw new Error(body.error || `zoom create failed (${res.status})`);
    }
    return {
        meetingId: String(body.meeting_id),
        joinUrl: body.join_url,
        startUrl: body.start_url,
        password: body.password,
    };
};
