# ACS TherapyHub — Billing Brief (WS-Billing)

Claude Code brief. Companion to the kickoff brief + WS6/WS7 addendum.
Project: `acs-therapyhub-forms-012026` · Supabase `ldzzlndsspkyohvzfiiu`
Sequencing: **starts after the WS0 RLS pass lands** (new billing tables need the same role-scoped policies).

---

## The framing that changes everything

David has **no QuickBooks and no financial system — everything is paper and manual.** So TherapyHub is not integrating with an accounting system; **it *is* the system of record for SATOP fees.** That raises the bar and clarifies the design:

- The ledger TherapyHub holds (charges minus payments) is the **single source of truth** for what every client owes. There's nothing to reconcile against.
- The `balance == 0` certificate gate (already wired in WS7) currently rests on a **stubbed `clients.balance` column**. This brief is what makes that gate real.
- Because clients pay cash and money orders constantly, **manual payment recording is a first-class feature, equal to Stripe** — not an afterthought.

---

## Agent first step (recon before building)

1. Read Story Scribe / Wissums Stripe implementation: the checkout-session-create edge function and the `checkout.session.completed` webhook (note the `story_payments` idempotency pattern keyed on `stripe_event_id`).
2. Read the existing ACS `payments` table usage and `PortalBilling.tsx`.
3. Confirm live columns on `payments` (it already has `payment_method`, `external_payment_id`, `status`, `amount`, `client_id`, `payment_date`, `description`) and that `clients.balance` exists (added in WS6/WS7).
4. Report findings + proposed schema, then STOP for approval before any migration. Present-then-apply to the live DB — no auto-apply.

---

## Data model — the ledger

`payments` already exists (the credits side). The missing half is **charges** (the debits side). Balance derives from the two; it is not hand-set.

### New: `charges` table
```sql
CREATE TABLE public.charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id),
  charge_type text NOT NULL,            -- 'assessment_fee' | 'level_fee' | 'supplemental_fee' | 'other'
  satop_level text,                     -- OEP/WIP/CIP/SROP when applicable
  description text,
  amount numeric NOT NULL,
  is_pass_through boolean DEFAULT false, -- TRUE for the $249 state supplemental fee
  status text DEFAULT 'pending',        -- 'pending' | 'paid' | 'waived' | 'void'
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
```

### Extend `payments` (link to charge, identify method)
- Add `charge_id uuid REFERENCES public.charges(id)` (nullable — a payment can cover a balance generally or a specific charge).
- `payment_method` already exists — use values `'stripe' | 'cash' | 'check' | 'money_order'`.
- Add `recorded_by uuid` (who entered a manual payment) and ensure `external_payment_id` holds the Stripe session/payment id for card payments.

### Balance must DERIVE from the ledger
- `balance = SUM(charges.amount WHERE status NOT IN ('waived','void')) − SUM(payments.amount WHERE status = 'succeeded')`.
- Keep `clients.balance` as a cache updated by a trigger on `charges`/`payments` writes (or compute via a SQL function/view `client_balance(client_id)`), so the WS7 cert gate reads a real number. **Do not leave `clients.balance` hand-set.**

### Stripe idempotency
- Add a `stripe_events` table (or unique constraint on a `stripe_event_id` column) so the webhook can't double-apply a payment — same pattern as Story Scribe's `story_payments`.

---

## Stripe integration (lift from Story Scribe, point at ACS)

1. **create-checkout-session** edge function: takes a `client_id` + one or more `charge_id`s, creates a Stripe Checkout session using **dynamic `price_data`** (amounts come from the charge — see means-testing below — not fixed Price IDs), returns the hosted Checkout URL. Used by the client portal AND as the "send a payment link" path for Admin.
2. **stripe-webhook** edge function: on `checkout.session.completed`, idempotently insert a `payments` row (`payment_method='stripe'`, `status='succeeded'`, `external_payment_id=session id`, linked `charge_id`), mark the charge paid, refresh balance.
3. Stripe keys live in **Supabase secrets / edge-function env**, never in the client bundle. Edge functions run as `service_role` (bypass RLS) — consistent with the WS0 design.

---

## Manual payments (first-class — this is a cash/money-order practice)

- **Admin (Jessica) action: "Record payment."** Inserts a `payments` row with `payment_method` of cash/check/money_order, `status='succeeded'`, `recorded_by`, optional `charge_id`. Writes the same ledger Stripe writes; counts toward balance identically.
- This is the primary path for in-office and phone payments. Treat it with the same prominence as the card flow.

---

## SATOP fee specifics

### Fees (verify against the CURRENT DMH/ACS schedule before going live — these are starting figures)
| Charge | Type | Amount | Notes |
|---|---|---|---|
| Assessment screening | assessment_fee | ~$375 ($126 + $249) | collected at funnel/booking |
| OEP / ADEP (Level I) | level_fee | ~$200 | fixed |
| WIP (Level II) | level_fee | ~$467 | means-tested |
| CIP (Level III) | level_fee | ~$1,067 | means-tested |
| SROP (Level IV) | level_fee | means-tested | staff-entered amount |
| Supplemental | supplemental_fee | $249 | **state pass-through** |

### Means-testing → dynamic amounts
WIP/CIP/SROP can be reduced by the DMH Standard Means Test, so those charges carry **staff-entered amounts**, not fixed prices. That's why Checkout uses dynamic `price_data` for everything — one code path handles fixed and means-tested fees alike.

### Supplemental fee = state pass-through (handle distinctly)
- The $249 supplemental is owed to DMH's Mental Health Earnings Fund — **never book it as ACS revenue.** Tag with `is_pass_through = true`.
- **Decision for David:** does ACS collect-and-remit the supplemental, or does the client pay the state directly? (The regulation's comparable-program path has the client paying DMH directly; standard SATOP may differ.) Build to support collect-and-remit, but make it a config flag.

---

## Reports (the QuickBooks replacement David now needs)

Fall out of the ledger almost for free; Director-only:
1. **Daily payments taken** — by method (cash/check/money-order/stripe), date range.
2. **Outstanding balances by client** — who owes what.
3. **Supplemental-fee remittance total** — how much pass-through has been collected and is owed to the state (only meaningful if collect-and-remit).
4. **Revenue** — payments excluding `is_pass_through` charges.

---

## Role-shaped access (not "everyone gets a cash register")
- **Admin (Jessica):** create charges, record manual payments, generate/send payment links, view billing.
- **Client:** view own charges + balance, pay via Stripe from the portal.
- **Therapist (Karen):** view paid-status only (it gates her completion sign-off) — not full financials.
- **Director (David):** everything + reports.

---

## RLS for the new tables (match the WS0 pass)
- `charges`: enable RLS; staff full access via `private.is_staff()`; client self-read via `client_id in (select private.my_client_ids())`.
- `payments`: already scoped in WS0 — confirm the new `charge_id`/`recorded_by` columns don't need policy changes.
- No `Allow all` policies on any new table.

---

## Fix PortalBilling while you're here
`PortalBilling.tsx` currently selects a non-existent `clients.payment_method` and silently reads balance 0. Fix it **properly**: query the real ledger — `clients.balance` (derived), the client's `charges`, and their `payments` (using `payments.payment_method`). Render real balance + payment history. Do **not** just strip the bad column to silence the error. Verify the page loads with no console error and shows the seeded client's real balance/payments.

---

## Guardrails
- Present-then-apply every migration to the live clinical DB; no auto-apply.
- Stripe secrets only in Supabase secrets; never in the client bundle.
- Balance always derives from the ledger; never hand-set.
- Supplemental fee never counted as revenue.
- New tables ship with scoped RLS, never `Allow all`.

## Definition of done
A charge can be created for a client; the client can pay it via Stripe from the portal OR Jessica can record a cash/check/money-order payment; both write one ledger; `clients.balance` reflects charges − payments; the WS7 `balance == 0` cert gate reads that real number; the supplemental fee is tracked as a non-revenue pass-through; Director can pull the four reports; PortalBilling shows real data with no errors; all billing tables have scoped RLS.
