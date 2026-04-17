// Supabase Edge Function: google-calendar-freebusy
//
// Queries Google Calendar freeBusy API for a time window and returns a list
// of busy intervals on the user's primary calendar. Used by the scheduler
// to warn about overlap with personal calendar events before a session is
// saved.
//
// Request body (POST, JSON):
//   {
//     user_id: string,
//     time_min_iso: string,
//     time_max_iso: string,
//     calendar_id?: string,   // defaults to "primary"
//   }
//
// Response: { ok: true, busy: [{ start, end }] } | { error }
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

    const { user_id, time_min_iso, time_max_iso, calendar_id } = body ?? {};
    if (!user_id || !time_min_iso || !time_max_iso) {
        return json({ error: "missing user_id / time_min_iso / time_max_iso" }, 400);
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

    const target = calendar_id || "primary";
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            timeMin: time_min_iso,
            timeMax: time_max_iso,
            items: [{ id: target }],
        }),
    });
    const resJson = await res.json();
    if (!res.ok) return json({ error: "freebusy failed", details: resJson }, res.status);

    const busy = resJson?.calendars?.[target]?.busy ?? [];
    return json({ ok: true, busy });
});

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
    });
}
