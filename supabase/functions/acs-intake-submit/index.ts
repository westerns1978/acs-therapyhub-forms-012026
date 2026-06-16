// ACS TherapyHub — Public Intake Submit (front-door demo). Deployed as
// `acs-intake-submit`, verify_jwt=false (it's the PUBLIC intake endpoint).
//
// THE TRUST BOUNDARY. This function is public + service-role, so it is the only
// place an unauthenticated caller can create a clients row. It therefore:
//   • accepts ONLY name / phone / email / interest (a strict whitelist),
//   • HARDCODES status='prospect' and program_type=NULL — never spread from the
//     body, so a caller can't POST status='active' or a balance and skip every
//     placement/compliance gate,
//   • validates presence + length, and returns ONLY the new prospect id.
// The real program_type is set later by STAFF at "Place & Activate", derived from
// a clinician-SIGNED placement determination — never by the prospect.
//
// PRODUCTION GATE (do NOT rely on for real PHI): this endpoint has NO rate-limiting
// or captcha. Before a real public front door, add abuse protection + an isolated
// project + audit logging (see ACS-TherapyHub-MAP.md production gate).
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (platform-provided).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Trim + cap a string field; returns null for empty.
const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return j({ error: 'POST only' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return j({ error: 'invalid_json' }, 400); }

  // Strict whitelist — read ONLY these four fields off the body. Nothing else from
  // the request can reach the insert.
  const name = clean(body?.name, 120);
  const phone = clean(body?.phone, 40);
  const email = clean(body?.email, 200);
  const interest = clean(body?.interest, 1000);

  if (!name) return j({ error: 'name_required' }, 400);
  if (!phone) return j({ error: 'phone_required' }, 400);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return j({ error: 'email_invalid' }, 400);

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  // The insert is an EXPLICIT object — status/program are hardcoded, never spread.
  const { data, error } = await sb
    .from('clients')
    .insert({
      name,
      primary_phone: phone,
      email,
      intake_interest: interest,
      status: 'prospect',     // hardcoded — public callers can never set this
      program_type: null,     // set by staff at placement, from a signed determination
    })
    .select('id')
    .single();

  if (error) {
    console.error('[acs-intake-submit] insert failed:', error.message);
    return j({ error: 'insert_failed', detail: error.message }, 500);
  }
  return j({ prospect_id: data.id });
});
