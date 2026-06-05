// ACS TherapyHub — Stripe webhook. Deployed as `acs-stripe-webhook` (v4), verify_jwt=false.
// On checkout.session.completed: idempotently insert a payments row (insert-first, keyed on
// the UNIQUE payments.stripe_event_id → 23505 on replay → returns replay:true/200), then mark
// the metadata charge_ids paid; the balance trigger recomputes clients.balance.
//
// Secrets:
//   STRIPE_SECRET_KEY_TEST          — shared Stripe account test key
//   ACS_STRIPE_WEBHOOK_SECRET_TEST  — ACS's OWN endpoint signing secret. NOT
//     STRIPE_WEBHOOK_SECRET_TEST (that belongs to another app in this shared project).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return j({ error: 'POST only' }, 405);

  // Request-shape validation first: a missing signature is a client error (400) regardless
  // of server config, and lets the signature guard be tested even before the secret is set.
  const signature = req.headers.get('stripe-signature') || '';
  if (!signature) return j({ error: 'missing_signature' }, 400);

  const secretKey = Deno.env.get('STRIPE_SECRET_KEY_TEST');
  const webhookSecret = Deno.env.get('ACS_STRIPE_WEBHOOK_SECRET_TEST');
  if (!secretKey || !webhookSecret) return j({ error: 'stripe_misconfigured', detail: 'STRIPE_SECRET_KEY_TEST / ACS_STRIPE_WEBHOOK_SECRET_TEST missing' }, 500);

  const rawBody = await req.text();
  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20', httpClient: Stripe.createFetchHttpClient() });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (e: any) {
    console.error('[acs-stripe-webhook] signature verification failed:', e?.message || e);
    return j({ error: 'signature_invalid', detail: e?.message || String(e) }, 400);
  }

  if (event.type !== 'checkout.session.completed') return j({ ok: true, ignored: event.type });

  const session = event.data.object as Stripe.Checkout.Session;
  const md = (session.metadata || {}) as Record<string, string>;
  if ((md.org || '') !== 'acs') return j({ ok: true, ignored: 'non-acs' });

  const clientId = (md.client_id || '').trim() || null;
  const chargeIds = (md.charge_ids || '').split(',').map((s) => s.trim()).filter(Boolean);
  const amount = (session.amount_total ?? 0) / 100;

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  // Insert-first idempotency: the UNIQUE(stripe_event_id) is the lock. 23505 → replay → 200.
  const { error: insErr } = await sb.from('payments').insert({
    client_id: clientId,
    amount,
    payment_method: 'stripe',
    status: 'succeeded',
    description: 'Stripe payment (ACS portal)',
    external_payment_id: session.id,
    stripe_event_id: event.id,
    charge_id: chargeIds.length === 1 ? chargeIds[0] : null,
  });
  if (insErr) {
    if ((insErr as any).code === '23505') {
      console.log('[acs-stripe-webhook] replay event, already processed:', event.id);
      return j({ ok: true, replay: true });
    }
    console.error('[acs-stripe-webhook] insert failed:', insErr);
    return j({ error: 'insert_failed', detail: insErr.message }, 500);
  }

  if (chargeIds.length && clientId) {
    const { error: upErr } = await sb.from('charges').update({ status: 'paid' }).in('id', chargeIds).eq('client_id', clientId);
    if (upErr) {
      console.error('[acs-stripe-webhook] charge update failed:', upErr);
      return j({ error: 'charge_update_failed', detail: upErr.message }, 500);
    }
  }

  console.log('[acs-stripe-webhook] recorded payment for client', clientId, 'event', event.id);
  return j({ ok: true, client_id: clientId, charges_paid: chargeIds.length });
});
