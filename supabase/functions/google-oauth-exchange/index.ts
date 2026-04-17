// Supabase Edge Function: google-oauth-exchange
//
// Trades an OAuth authorization code for access+refresh tokens, then
// persists them in public.user_integrations (service-role only).
//
// Expected secrets (set via `supabase secrets set`):
//   GOOGLE_CLIENT_ID        — same value as VITE_GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET    — from Google Cloud Console
//   SUPABASE_URL            — auto-injected
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected
//
// Request body (POST, JSON):
//   { code: string, code_verifier: string, redirect_uri: string,
//     user_id: string }
//
// NOTE on trust model: the caller passes user_id because this app uses a
// custom sessionStorage-based auth, not Supabase Auth. Anyone with the anon
// key could POST here with an arbitrary user_id, so treat this function as
// a single-tenant write endpoint for the internal practice. If multi-tenant
// security is needed, migrate to Supabase Auth and read user_id from JWT.
//
// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: cors });
    }
    if (req.method !== "POST") {
        return json({ error: "method not allowed" }, 405);
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return json({ error: "invalid json" }, 400);
    }

    const { code, code_verifier, redirect_uri, user_id } = body ?? {};
    if (!code || !code_verifier || !redirect_uri || !user_id) {
        return json(
            {
                error:
                    "missing fields: code, code_verifier, redirect_uri, user_id required",
            },
            400,
        );
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
        return json({ error: "server missing GOOGLE_CLIENT_ID/SECRET" }, 500);
    }

    // Exchange code for tokens with Google.
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri,
            grant_type: "authorization_code",
            code_verifier,
        }),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
        return json(
            { error: "google token exchange failed", details: tokenJson },
            400,
        );
    }

    const {
        access_token,
        refresh_token,
        expires_in,
        scope,
    } = tokenJson;

    // Fetch user email for display in Settings.
    let accountEmail: string | null = null;
    try {
        const uinfo = await fetch(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            { headers: { Authorization: `Bearer ${access_token}` } },
        );
        if (uinfo.ok) {
            const u = await uinfo.json();
            accountEmail = u?.email ?? null;
        }
    } catch {
        // ignore; email is cosmetic
    }

    const expiresAt = expires_in
        ? new Date(Date.now() + expires_in * 1000).toISOString()
        : null;

    const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Upsert row keyed on (user_id, provider).
    // Only overwrite refresh_token if Google returned one (it's omitted on
    // subsequent consents unless prompt=consent + access_type=offline).
    const upsertPayload: Record<string, unknown> = {
        user_id,
        provider: "google",
        access_token,
        expires_at: expiresAt,
        scopes: scope ?? null,
        account_email: accountEmail,
        updated_at: new Date().toISOString(),
    };
    if (refresh_token) upsertPayload.refresh_token = refresh_token;

    const { error: upsertErr } = await admin
        .from("user_integrations")
        .upsert(upsertPayload, { onConflict: "user_id,provider" });

    if (upsertErr) {
        return json({ error: "db upsert failed", details: upsertErr.message }, 500);
    }

    return json({
        ok: true,
        account_email: accountEmail,
        scopes: scope ?? null,
    });
});

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
    });
}
