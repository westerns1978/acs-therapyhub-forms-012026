// Supabase Edge Function: zoom-oauth-exchange
//
// Trades a Zoom OAuth authorization code (PKCE) for access+refresh tokens
// and upserts them into public.user_integrations (service-role only).
//
// Required secrets (set via `supabase secrets set`):
//   ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected)
//
// Request body (POST, JSON):
//   { code, code_verifier, redirect_uri, user_id }
//
// Same trust model caveat as google-oauth-exchange — the caller passes
// user_id because this app uses a custom auth context, not Supabase Auth.
// Treat as single-tenant until JWT-scoped auth is wired up.

// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

    let body: any;
    try {
        body = await req.json();
    } catch {
        return json({ error: "invalid json" }, 400);
    }

    const { code, code_verifier, redirect_uri, user_id } = body ?? {};
    if (!code || !code_verifier || !redirect_uri || !user_id) {
        return json(
            { error: "missing fields: code, code_verifier, redirect_uri, user_id required" },
            400,
        );
    }

    const clientId = Deno.env.get("ZOOM_CLIENT_ID");
    const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
        return json({ error: "server missing ZOOM_CLIENT_ID/SECRET" }, 500);
    }

    // Zoom requires Basic auth with client_id:client_secret AND also accepts
    // PKCE code_verifier. Body is form-encoded.
    const basic = btoa(`${clientId}:${clientSecret}`);
    const tokenRes = await fetch("https://zoom.us/oauth/token", {
        method: "POST",
        headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri,
            code_verifier,
        }),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
        return json(
            { error: "zoom token exchange failed", details: tokenJson },
            400,
        );
    }

    const { access_token, refresh_token, expires_in, scope } = tokenJson;

    // Fetch account email via /users/me for display in Settings.
    let accountEmail: string | null = null;
    try {
        const me = await fetch("https://api.zoom.us/v2/users/me", {
            headers: { Authorization: `Bearer ${access_token}` },
        });
        if (me.ok) {
            const u = await me.json();
            accountEmail = u?.email ?? null;
        }
    } catch {
        // cosmetic only
    }

    const expiresAt = expires_in
        ? new Date(Date.now() + expires_in * 1000).toISOString()
        : null;

    const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const upsertPayload: Record<string, unknown> = {
        user_id,
        provider: "zoom",
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
