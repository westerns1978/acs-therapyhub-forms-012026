// Supabase Edge Function: google-calendar-delete-event
//
// Deletes an event from the user's Google Calendar using the stored refresh
// token. sendUpdates=all notifies attendees of the cancellation.
//
// Request body (POST, JSON):
//   { user_id: string, event_id: string, calendar_id?: string }
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
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

    const { user_id, event_id, calendar_id } = body ?? {};
    if (!user_id || !event_id) {
        return json({ error: "missing user_id or event_id" }, 400);
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
        return json({ error: "server missing GOOGLE_CLIENT_ID/SECRET" }, 500);
    }

    const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error } = await admin
        .from("user_integrations")
        .select("access_token, refresh_token, expires_at")
        .eq("user_id", user_id).eq("provider", "google").maybeSingle();
    if (error) return json({ error: "db read failed", details: error.message }, 500);
    if (!row?.refresh_token) return json({ error: "google not connected" }, 404);

    let accessToken = row.access_token as string | null;
    const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
    if (!accessToken || Date.now() > expiresAt - 60_000) {
        const r = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: row.refresh_token,
                grant_type: "refresh_token",
            }),
        });
        const j = await r.json();
        if (!r.ok) return json({ error: "refresh failed", details: j }, 401);
        accessToken = j.access_token;
        const newExp = j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : null;
        await admin.from("user_integrations")
            .update({ access_token: accessToken, expires_at: newExp, updated_at: new Date().toISOString() })
            .eq("user_id", user_id).eq("provider", "google");
    }

    const target = encodeURIComponent(calendar_id || "primary");
    const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${target}/events/${encodeURIComponent(event_id)}?sendUpdates=all`,
        {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
        },
    );

    // Google returns 204 on success; 410 if already deleted (idempotent-ish).
    if (!res.ok && res.status !== 410) {
        let details: unknown = null;
        try { details = await res.json(); } catch { /* no body */ }
        return json({ error: "calendar delete failed", details }, res.status);
    }

    return json({ ok: true });
});

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
    });
}
