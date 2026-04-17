// Supabase Edge Function: google-calendar-update-event
//
// Updates (PATCH) an existing Google Calendar event using the user's stored
// refresh token. Pass only the fields that changed; undefined fields are
// dropped so Google leaves them alone.
//
// Request body (POST, JSON):
//   {
//     user_id: string,
//     event_id: string,
//     calendar_id?: string,
//     event: {
//       summary?: string, description?: string, location?: string,
//       start_iso?: string, end_iso?: string, timezone?: string,
//       attendees?: string[],
//       status?: "confirmed" | "cancelled",
//     }
//   }
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

    const { user_id, event_id, calendar_id, event } = body ?? {};
    if (!user_id || !event_id || !event) {
        return json({ error: "missing user_id, event_id, or event" }, 400);
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

    const token = await getAccessToken(admin, user_id, clientId, clientSecret);
    if ("error" in token) return json(token, token.status);

    const tz = event.timezone ?? "America/Chicago";
    const payload: Record<string, unknown> = {};
    if (event.summary !== undefined) payload.summary = event.summary;
    if (event.description !== undefined) payload.description = event.description;
    if (event.location !== undefined) payload.location = event.location;
    if (event.start_iso) payload.start = { dateTime: event.start_iso, timeZone: tz };
    if (event.end_iso) payload.end = { dateTime: event.end_iso, timeZone: tz };
    if (Array.isArray(event.attendees)) {
        payload.attendees = event.attendees.map((e: string) => ({ email: e }));
    }
    if (event.status) payload.status = event.status;

    const target = encodeURIComponent(calendar_id || "primary");
    const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${target}/events/${encodeURIComponent(event_id)}?sendUpdates=all`,
        {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        },
    );
    const resJson = await res.json();
    if (!res.ok) return json({ error: "calendar update failed", details: resJson }, res.status);

    return json({ ok: true, event_id: resJson.id, html_link: resJson.htmlLink });
});

async function getAccessToken(
    admin: any,
    userId: string,
    clientId: string,
    clientSecret: string,
): Promise<{ accessToken: string } | { error: string; details?: unknown; status: number }> {
    const { data: row, error } = await admin
        .from("user_integrations")
        .select("access_token, refresh_token, expires_at")
        .eq("user_id", userId)
        .eq("provider", "google")
        .maybeSingle();
    if (error) return { error: "db read failed", details: error.message, status: 500 };
    if (!row?.refresh_token) return { error: "google not connected", status: 404 };

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
        if (!r.ok) return { error: "refresh failed", details: j, status: 401 };
        accessToken = j.access_token;
        const newExp = j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : null;
        await admin.from("user_integrations")
            .update({ access_token: accessToken, expires_at: newExp, updated_at: new Date().toISOString() })
            .eq("user_id", userId).eq("provider", "google");
    }
    return { accessToken: accessToken! };
}

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
    });
}
