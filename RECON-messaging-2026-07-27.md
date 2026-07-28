# RECON — Messaging / delivery layer — 2026-07-27

Read-only. No build, no branch, no dependencies installed, no writes.
Code facts from the worktree at `main @ fbca08d`; data facts from live Supabase `ldzzlndsspkyohvzfiiu`.
Facts first. Recommendations are one sentence each and marked ▸.

**Bottom line:** there is no outbound message capability of any kind — no Twilio, no SMS, no email,
no scaffolding, not even an unused dependency. Five of the six events that should notify a client
are **browser-side writes**, so there is no server-side seam to hang a send on. The one exception
is the upload-link edge function, which is already correctly shaped for it. There is **no consent
capture anywhere**, and nothing in the schema could answer "did this message reach this recipient."

---

## 4a · TRIGGER POINTS

| Event | Where the DB write happens | Runs | Server-side hook today? |
|---|---|---|---|
| Appointment **created** | `addAppointment` — [services/api.ts:517-529](services/api.ts) | browser | **NO** |
| Appointment created (**recurring series**) | `createRecurringSeries` — [services/api.ts:763-827](services/api.ts) | browser | **NO** |
| Appointment **rescheduled** | `updateAppointment` — [services/api.ts:581-668](services/api.ts) (reschedule detected `:605`) | browser | **NO** |
| Appointment **cancelled** | `updateAppointmentStatus` — [services/api.ts:675-687](services/api.ts); `cancelSeries` `:832-845`; `deleteAppointment` `:689-694` | browser | **NO** |
| **Upload-link minted** | `acs-request-upload` mint — [supabase/functions/acs-request-upload/index.ts:192-204](supabase/functions/acs-request-upload/index.ts) | **edge function** | **YES — the only one** |
| **Form assigned** | `assignForm` — [services/api.ts:1520-1548](services/api.ts) | browser | **NO** |
| **Determination signed** | inline insert in the component — [components/clients/AssessmentTab.tsx:416-427](components/clients/AssessmentTab.tsx) (not in `api.ts` at all) | browser | **NO** |
| **Payment — manual** | inline insert — [components/billing/RecordPaymentModal.tsx:104-119](components/billing/RecordPaymentModal.tsx) | browser | **NO** |
| **Payment — Stripe** | [supabase/functions/acs-stripe-webhook/index.ts:60-69](supabase/functions/acs-stripe-webhook/index.ts) | **edge function** | **YES** (Stripe path only) |
| Balance changed | No app-level event; derived via `client_balance()` + a DB trigger | — | **NO** — trigger body is not in repo migrations, so hookability is **UNKNOWN** |
| **Group note posted** | `distributeGroupNote` — [services/api.ts:1224-1283](services/api.ts) → N× `saveClinicalNote` | browser | **NO** |

**The structural fact:** an SMS fired from any of the browser-side rows would require a send
credential in the client bundle. Those writes must move server-side first, or the send must be
triggered from something that already runs server-side.

Two edge functions already run with service-role and know the `client_id`:
`acs-request-upload` and `acs-stripe-webhook`.

▸ The cheapest genuine first send is the upload link, because it is already server-side, already
has the client, and already audits.

**Audit coverage is thin and unrelated to delivery:** only three client-side `logAudit` callers
exist repo-wide — `appointment.rescheduled` ([api.ts:652](services/api.ts)), `note.signed`
(`:1186`), `client.updated`/`client.archived` (`:1912`). Form assignment, determinations, and
payments write no audit row at all.

---

## 4b · CONSENT — none exists

Searched the entire live `public` schema for any column matching `consent`, `opt_in`, `optin`,
`sms`, `text_ok`, `contact_pref`, `notify`, `subscri`:

> **NONE FOUND** — zero columns, across every table in the database.

No form captures it either. The only phone-adjacent field in the form set is
[SatopClientIntakeForm.tsx:100](components/forms/SatopClientIntakeForm.tsx) — `{ id: 'clientPhone',
label: 'Mobile number', type: 'tel', required: true }` — which collects a number but asks nothing
about permission to use it.

Note the adjacent trap: the **Authorization for Release of Information** form does capture consent
to disclose *to DMH / DOR / courts* — that is disclosure authorisation under 42 CFR Part 2, and it
is **not** consent to be contacted by SMS. They must not be conflated.

▸ Contact consent is the first schema addition, and it needs a captured-at timestamp and a
revocation path, not just a boolean.

---

## 4c · CONTACT DATA

`clients.primary_phone` (`text`, nullable in schema) plus `secondary_phone` and `email`.
Required at creation in app code ([services/api.ts:1813-1814](services/api.ts)) but not enforced
by a DB constraint.

Live coverage across all **34** client rows:

| Measure | Count |
|---|---|
| Rows total | 34 |
| `primary_phone` not null | **34** |
| Non-blank after trim | **34** |
| **≥ 10 digits once punctuation is stripped** | **33** |
| Distinct values | 30 |

So **33 of 34 rows carry a plausibly dialable number; one does not** and would fail at send time.

**Formats are inconsistent — there is no normalisation on the write path.** Live sample:
`314-555-0194`, `314-555-1003`, `314-849-2800` (dashed) alongside `3333333333` and `5553265847`
(raw digits). The only formatting code in the repo is display-time input masking inside one form
([SatopClientIntakeForm.tsx:18](components/forms/SatopClientIntakeForm.tsx) `formatPhoneNumber`),
which never touches the `clients` write path. There is no E.164 conversion, no validation, and no
country-code handling anywhere.

▸ Twilio needs E.164, so normalisation-on-write plus a one-off backfill is a prerequisite, and the
one short number needs a human to look at it.

---

## 4d · EXISTING DELIVERY — there is none; the link is copy-pasted by hand

The tokenized upload link is the closest thing to an outbound artifact, and it has **no send path**.

1. The edge function returns the raw token and URL to the caller —
   [acs-request-upload/index.ts:217-224](supabase/functions/acs-request-upload/index.ts):
   `return j({ ok: true, token: raw, url: `${publicBase(req)}/upload/${raw}`, expiresAt: … })`
2. [services/clientUploadLink.ts:66-74](services/clientUploadLink.ts) is a plain `fetch` wrapper —
   it returns the result and does nothing else. The request body carries only `clientId` and
   `requestedDocumentType`; **there is no recipient/phone parameter in the mint path at all.**
3. The staff modal puts it in a read-only input beside a Copy button —
   [RequestUploadLinkModal.tsx:98-110](components/clients/RequestUploadLinkModal.tsx), with
   `navigator.clipboard.writeText(link)` at `:55-63`.
4. The UI says so plainly — `:76`: *"You'll get a private link to text or send them — no sign-in
   needed on their end."* and `:113`: *"…text or WhatsApp it to the client…"*

The edge function never reads a phone number and makes no external HTTP call other than to Supabase.

---

## 4e · LOGGING — nothing today could answer "did it arrive"

### `client_communications` — real, but it is a message log, not a delivery log

Live columns (queried directly; the repo has no `CREATE TABLE` for it, only RLS policies at
[20260605_ws0_3_scoped_policies.sql:41-44](supabase/migrations/20260605_ws0_3_scoped_policies.sql)):

| Column | Type | Null |
|---|---|---|
| `id` | uuid | no |
| `client_id` | uuid | **yes** |
| `type` | text | no |
| `message` | text | yes |
| `appointment_details` | jsonb | yes |
| `sent_at` | timestamptz | yes |
| `sent_by` | text | yes |
| `created_at` | timestamptz | yes |

Live contents — **3 rows total**: `type='message'` ×2 (both with a `client_id`), `type='support'`
×1 (`client_id` null). `sent_by` holds a free-text staff display name (`"Karen (Demo Therapist)"`,
`"Jessica (Demo Admin)"`), not a uuid.

Written by `sendClientMessage` ([api.ts:1326-1342](services/api.ts)) and `sendSupportMessage`
(`:1383-1398`), both called only from `pages/CommunicationCenter.tsx` — which is **trial-hidden**,
because Send persists a row but reaches no client.

**Absent for delivery purposes:** recipient number/address, channel, direction, provider message
SID, status (queued/sent/delivered/failed/undelivered), error code, delivery timestamp distinct
from send, consent reference, retry count. `sent_at` records when staff clicked, not when anything
was delivered. The code already warns the table has no read/unread flag ([api.ts:1346-1347](services/api.ts)).

### `audit_logs` — append-only, and deliberately so

Hardened by [20260708_audit1_append_only_foundation.sql](supabase/migrations/20260708_audit1_append_only_foundation.sql):
RLS on, staff-only SELECT, self-attributed INSERT, `revoke update, delete, truncate`, and **no
UPDATE policy by design**. It has no `client_id` column ([services/auditLog.ts:24-26](services/auditLog.ts) —
`details.client_id` is the only per-client handle), and it is fire-and-forget, never awaited.

That immutability is correct for an audit ledger and **directly incompatible** with delivery
status, which must mutate as carrier webhooks arrive.

▸ Delivery status needs its own mutable table; do not extend `audit_logs`.

### `outreach_log` and `tasks` — dead ends

Written by `logOutreach` / `createTask` ([services/alertsService.ts:231-283](services/alertsService.ts)),
where `method` already includes an `'SMS'` label — but that is **staff manually recording that they
texted someone**, not a sender. Neither table is created by any migration, `DEFERRED.md:811-819`
records a live check finding neither exists, and both have zero readers.

### To answer "verify communications" (David 7/21) you would need, net new:
recipient identity captured at send time · channel · provider message SID · a **mutable** status
column · a webhook receiver edge function for carrier status callbacks · consent reference at time
of send. None of these exist in any form.

---

## 4f · SECRETS / SCAFFOLDING — zero Twilio anywhere

Searched the whole repo (`supabase/functions/**`, `.env*`, `scripts/`, `docs/`, all markdown) for
`twilio | ACCOUNT_SID | accountSid | AUTH_TOKEN | messagingService | 10DLC | A2P | short code |
sendSms | send_sms`.

**No Twilio package, env var, edge function, client, or table.** The single `twilio` substring in
`package-lock.json` is a base64 integrity hash, not a dependency.

**Env var names present** (names only, no values):
- `.env` — `VITE_GOOGLE_CLIENT_ID`, `VITE_ZOOM_CLIENT_ID`. That is the entire file, plus a comment
  noting `VITE_API_KEY` was removed 2026-06-15. No other env file exists.
- Edge functions (`Deno.env.get`) — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`,
  `STRIPE_SECRET_KEY_TEST`, `ACS_STRIPE_WEBHOOK_SECRET_TEST`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `GEMINI_API_KEY`.

**Prose-only mentions** (aspiration, not code): `ACS-TherapyHub-MAP.md:177` "Clara after-hours phone
intake (Twilio + Gemini Live, server-side)" and `:180` "Proactive milestone messaging … SMS/email
keyed to milestones".

**Fake SMS already shipped in the UI** — the reason this recon exists:
[ClientFormsTab.tsx:187-193](components/clients/ClientFormsTab.tsx) `handleSendReminder` is a
1-second `setTimeout` followed by `alert('Reminder sent to client via Push & SMS.')`. No network
call. Logged as a sweep finding; still live.

**Adjacent, not SMS:** [PushNotificationButton.tsx](components/ui/PushNotificationButton.tsx) does a
Web Push permission prompt with no `pushManager.subscribe`, no VAPID key, no persistence and no
sender — and is mounted nowhere. In-app toasts (`NotificationContext`) are UI-only.

---

## Summary of what stands between here and a first SMS

1. **Consent capture** — nothing exists; needs captured-at and revocation.
2. **Phone normalisation to E.164** — plus a backfill; 1 of 34 rows is unusable today.
3. **A server-side seam** — five of six trigger events are browser-only writes.
4. **A delivery log** — net new; cannot live in `audit_logs`.
5. **10DLC / A2P registration** — external, unverified, and gates everything.

▸ Upload-link delivery is the one end-to-end slice that could be built without moving any existing
write server-side.

*Not addressed here, deliberately: whether SMS to a 42 CFR Part 2 client population carries
disclosure constraints beyond ordinary consent — that is a compliance question, not a code one.*
