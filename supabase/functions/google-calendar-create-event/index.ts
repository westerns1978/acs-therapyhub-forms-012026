// Supabase Edge Function: google-calendar-create-event
//
// Creates an event on the user's Google Calendar using their stored refresh
// token. Refreshes the access token on-the-fly if expired.
//
// Request body (POST, JSON):
//   {
//     user_id: string,
//     calendar_id?: string,   // defaults to "primary"
//     event: {
//       summary: string,
//       description?: string,
//       start_iso: string,     // ISO 8601 datetime
//       end_iso: string,       // ISO 8601 datetime
//       timezone?: string,     // e.g. "America/Chicago"
//       attendees?: string[],  // email addresses
//       location?: string,
//     }
//   }
//
// Response: { ok: true, event_id, html_link } | { error, details? }
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

    const { user_id, calendar_id, event } = body ?? {};
    if (!user_id || !event?.summary || !event?.start_iso || !event?.end_iso) {
        return json(
            { error: "missing required: user_id, event.summary/start_iso/end_iso" },
            400,
        );
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

    const { data: row, error: selErr } = await admin
        .from("user_integrations")
        .select("access_token, refresh_token, expires_at, calendar_id")
        .eq("user_id", user_id)
        .eq("provider", "google")
        .maybeSingle();

    if (selErr) {
        return json({ error: "db read failed", details: selErr.message }, 500);
    }
    if (!row || !row.refresh_token) {
        return json({ error: "google not connected for this user" }, 404);
    }

    // Refresh token if expired or about to expire (60s buffer).
    let accessToken: string | null = row.access_token;
    const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
    if (!accessToken || Date.now() > expiresAt - 60_000) {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: row.refresh_token,
                grant_type: "refresh_token",
            }),
        });
        const refreshJson = await refreshRes.json();
        if (!refreshRes.ok) {
            return json(
                { error: "refresh failed", details: refreshJson },
                401,
            );
        }
        accessToken = refreshJson.access_token;
        const newExpiresAt = refreshJson.expires_in
            ? new Date(Date.now() + refreshJson.expires_in * 1000).toISOString()
            : null;
        await admin
            .from("user_integrations")
            .update({
                access_token: accessToken,
                expires_at: newExpiresAt,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", user_id)
            .eq("provider", "google");
    }

    const tz = event.timezone ?? "America/Chicago";
    const targetCalendar = encodeURIComponent(
        calendar_id || row.calendar_id || "primary",
    );

    const gcalPayload: Record<string, unknown> = {
        summary: event.summary,
        description: event.description ?? undefined,
        location: event.location ?? undefined,
        start: { dateTime: event.start_iso, timeZone: tz },
        end: { dateTime: event.end_iso, timeZone: tz },
    };
    if (Array.isArray(event.attendees) && event.attendees.length > 0) {
        gcalPayload.attendees = event.attendees.map((email: string) => ({ email }));
    }

    // sendUpdates=all → Google emails invites to attendees on the appointment.
    const createRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${targetCalendar}/events?sendUpdates=all`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(gcalPayload),
        },
    );
    const createJson = await createRes.json();
    if (!createRes.ok) {
        return json(
            { error: "calendar insert failed", details: createJson },
            createRes.status,
        );
    }

    return json({
        ok: true,
        event_id: createJson.id,
        html_link: createJson.htmlLink,
    });
});

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
    });
}
