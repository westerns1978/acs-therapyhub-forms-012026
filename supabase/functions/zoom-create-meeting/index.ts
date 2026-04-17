// Supabase Edge Function: zoom-create-meeting
//
// Creates a scheduled meeting on the user's Zoom account using their stored
// refresh token. Refreshes the access token on-the-fly if expired.
//
// Request body (POST, JSON):
//   {
//     user_id: string,
//     meeting: {
//       topic: string,
//       start_iso: string,        // ISO 8601
//       duration_minutes: number,
//       timezone?: string,
//       agenda?: string,
//     }
//   }
//
// Response: { ok: true, meeting_id, join_url, start_url, password } | { error }
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
    try {
        body = await req.json();
    } catch {
        return json({ error: "invalid json" }, 400);
    }

    const { user_id, meeting } = body ?? {};
    if (
        !user_id ||
        !meeting?.topic ||
        !meeting?.start_iso ||
        typeof meeting?.duration_minutes !== "number"
    ) {
        return json(
            {
                error:
                    "missing required: user_id, meeting.topic/start_iso/duration_minutes",
            },
            400,
        );
    }

    const clientId = Deno.env.get("ZOOM_CLIENT_ID");
    const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
        return json({ error: "server missing ZOOM_CLIENT_ID/SECRET" }, 500);
    }

    const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error: selErr } = await admin
        .from("user_integrations")
        .select("access_token, refresh_token, expires_at")
        .eq("user_id", user_id)
        .eq("provider", "zoom")
        .maybeSingle();

    if (selErr) {
        return json({ error: "db read failed", details: selErr.message }, 500);
    }
    if (!row || !row.refresh_token) {
        return json({ error: "zoom not connected for this user" }, 404);
    }

    // Refresh if expired or within 60s of expiry.
    let accessToken: string | null = row.access_token;
    const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
    if (!accessToken || Date.now() > expiresAt - 60_000) {
        const basic = btoa(`${clientId}:${clientSecret}`);
        const refreshRes = await fetch("https://zoom.us/oauth/token", {
            method: "POST",
            headers: {
                Authorization: `Basic ${basic}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: row.refresh_token,
            }),
        });
        const refreshJson = await refreshRes.json();
        if (!refreshRes.ok) {
            return json({ error: "refresh failed", details: refreshJson }, 401);
        }
        accessToken = refreshJson.access_token;
        const newExpiresAt = refreshJson.expires_in
            ? new Date(Date.now() + refreshJson.expires_in * 1000).toISOString()
            : null;
        // Zoom issues a new refresh_token on every refresh — persist it.
        const updatePayload: Record<string, unknown> = {
            access_token: accessToken,
            expires_at: newExpiresAt,
            updated_at: new Date().toISOString(),
        };
        if (refreshJson.refresh_token) {
            updatePayload.refresh_token = refreshJson.refresh_token;
        }
        await admin
            .from("user_integrations")
            .update(updatePayload)
            .eq("user_id", user_id)
            .eq("provider", "zoom");
    }

    const zoomPayload: Record<string, unknown> = {
        topic: meeting.topic,
        type: 2, // scheduled meeting
        start_time: meeting.start_iso,
        duration: meeting.duration_minutes,
        timezone: meeting.timezone ?? "America/Chicago",
        agenda: meeting.agenda ?? undefined,
        settings: {
            join_before_host: true,
            jbh_time: 5,
            waiting_room: true,
            mute_upon_entry: true,
            auto_recording: "none",
        },
    };

    const createRes = await fetch(
        "https://api.zoom.us/v2/users/me/meetings",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(zoomPayload),
        },
    );
    const createJson = await createRes.json();
    if (!createRes.ok) {
        return json(
            { error: "zoom create failed", details: createJson },
            createRes.status,
        );
    }

    return json({
        ok: true,
        meeting_id: createJson.id,
        join_url: createJson.join_url,
        start_url: createJson.start_url,
        password: createJson.password,
    });
});

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
    });
}
