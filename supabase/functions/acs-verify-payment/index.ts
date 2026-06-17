// ACS TherapyHub — Public, READ-ONLY payment verification for the post-intake
// confirmation page. Deployed as `acs-verify-payment`, verify_jwt=false (it backs
// the unauthenticated /intake return view).
//
// THE HONESTY PRIMITIVE. The confirmation page must NOT trust the ?payment=success
// URL param (anyone can type that). It calls this with the Stripe Checkout
// `session_id` from the return URL; we confirm a real succeeded `payments` row
// exists for it — the `acs-stripe-webhook` records `session.id` as
// `external_payment_id` on a succeeded row — and return ONLY a boolean + the amount.
//
// PRIVACY: returns NO client identity (no name/email/client_id) — the caller is
// unauthenticated. It only ever answers "is THIS checkout session paid, and for how
// much". Uses the service role to read past payments RLS; the SELECT is the only DB op.
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return j({ error: 'POST only' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return j({ error: 'invalid_json' }, 400); }

  const sessionId = (body?.session_id ?? '').toString().trim();
  // Shape guard: only ever look up real Stripe Checkout session ids. An invalid /
  // missing id is honestly "not confirmed", never an error the page must interpret.
  if (!sessionId || !sessionId.startsWith('cs_') || sessionId.length > 200) {
    return j({ confirmed: false });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from('payments')
    .select('amount')
    .eq('external_payment_id', sessionId)
    .eq('status', 'succeeded')
    .limit(1)
    .maybeSingle();

  if (error) {
    // Don't surface a 500 to the page — that would read as "failed". A lookup error
    // is honestly "not yet confirmed"; the page keeps polling / offers the phone.
    console.error('[acs-verify-payment] lookup failed:', error.message);
    return j({ confirmed: false });
  }
  if (!data) return j({ confirmed: false });
  return j({ confirmed: true, amount: Number(data.amount) });
});
