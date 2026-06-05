// ACS TherapyHub — Stripe Checkout (TEST MODE). Deployed as `acs-create-checkout` (v14),
// verify_jwt=false. Creates a Stripe Checkout Session for ACS client payments:
//   • charge_ids[]: bills each charge's OUTSTANDING (amount − succeeded payments already
//     linked to it), so a partially-paid charge bills only its remainder. metadata.charge_ids
//     flows to acs-stripe-webhook, which marks them paid.
//   • amount_cents: fallback for a raw balance payment (no itemized charges).
// Returns { checkout_url, mode:'test', amount_total }.
// Secrets: STRIPE_SECRET_KEY_TEST (shared Stripe account test key).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';

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

  const clientId = (body.client_id || '').trim();
  const returnUrl = (body.return_url || '').trim();
  if (!returnUrl) return j({ error: 'return_url_required' }, 400);

  const testKey = Deno.env.get('STRIPE_SECRET_KEY_TEST');
  if (!testKey) return j({ error: 'stripe_not_configured', detail: 'STRIPE_SECRET_KEY_TEST missing' }, 500);
  const stripe = new Stripe(testKey, { apiVersion: '2024-06-20', httpClient: Stripe.createFetchHttpClient() });

  let lineItems: any[] = [];
  let chargeIds: string[] = Array.isArray(body.charge_ids) ? body.charge_ids.filter(Boolean) : [];

  if (chargeIds.length) {
    if (!clientId) return j({ error: 'client_id_required_with_charges' }, 400);
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
    const { data: charges, error } = await sb
      .from('charges')
      .select('id, client_id, description, charge_type, amount, status')
      .in('id', chargeIds)
      .eq('client_id', clientId);
    if (error) return j({ error: 'charge_lookup_failed', detail: error.message }, 500);
    if (!charges || charges.length !== chargeIds.length) return j({ error: 'charges_not_found_or_wrong_client' }, 400);
    const payable = charges.filter((c: any) => !['paid', 'waived', 'void'].includes(c.status));
    // Per-charge OUTSTANDING = amount - sum(succeeded payments already linked to it),
    // so a partially-paid charge bills only its remaining balance.
    const ids = payable.map((c: any) => c.id);
    const applied: Record<string, number> = {};
    if (ids.length) {
      const { data: pays } = await sb.from('payments').select('charge_id, amount').eq('status', 'succeeded').in('charge_id', ids);
      for (const p of (pays || [])) applied[p.charge_id] = (applied[p.charge_id] || 0) + Number(p.amount);
    }
    const items = payable
      .map((c: any) => ({ c, outstanding: Number(c.amount) - (applied[c.id] || 0) }))
      .filter((x: any) => x.outstanding > 0.005);
    if (!items.length) return j({ error: 'nothing_to_pay' }, 400);
    lineItems = items.map(({ c, outstanding }: any) => ({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(outstanding * 100),
        product_data: { name: c.description || `SATOP ${c.charge_type}`, description: 'Assessment & Counseling Solutions — TEST MODE' },
      },
    }));
    chargeIds = items.map((x: any) => x.c.id);
  } else {
    const amountCents = Number(body.amount_cents);
    if (!Number.isFinite(amountCents) || amountCents <= 0 || amountCents > 1000000) return j({ error: 'amount_cents_required', detail: 'Must be 1-1000000' }, 400);
    lineItems = [{ quantity: 1, price_data: { currency: 'usd', unit_amount: amountCents, product_data: { name: (body.description || 'ACS Session Balance').trim(), description: 'Assessment & Counseling Solutions — TEST MODE' } } }];
  }

  const totalCents = lineItems.reduce((s: number, li: any) => s + (li.price_data.unit_amount * (li.quantity || 1)), 0);
  const successUrl = appendQueryParams(returnUrl, { payment: 'success', session_id: '{CHECKOUT_SESSION_ID}' });
  const cancelUrl = appendQueryParams(returnUrl, { payment: 'cancelled' });
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: body.client_email || undefined,
      metadata: { org: 'acs', client_id: clientId, charge_ids: chargeIds.join(','), stripe_mode: 'test' },
    });
    if (!session.url) return j({ error: 'stripe_no_url' }, 502);
    return j({ checkout_url: session.url, mode: 'test', amount_total: totalCents });
  } catch (e: any) {
    console.error('[acs-create-checkout] Stripe error:', e?.message || e);
    return j({ error: 'stripe_create_failed', detail: e?.message || String(e) }, 502);
  }
});

function appendQueryParams(baseUrl: string, params: Record<string, string>): string {
  const [head, hash] = baseUrl.split('#', 2);
  const sep = head.includes('?') ? '&' : '?';
  const tail = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${v === '{CHECKOUT_SESSION_ID}' ? v : encodeURIComponent(v)}`).join('&');
  return `${head}${sep}${tail}${hash ? `#${hash}` : ''}`;
}
