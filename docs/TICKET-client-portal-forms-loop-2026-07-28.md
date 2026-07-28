# TICKET — Close the client-forms loop (authenticated portal)

**Status:** SCOPED, NOT STARTED. Awaiting David's greenlight.
**Estimate:** 1–2 days.
**Written:** 2026-07-28, from the form-assignment recon.

---

## Why this is smaller than it sounds

The headline for David: **most of this is already built and working.** The portal
is not a greenfield "Walk phase" feature — it is a finished mechanism with three
gaps, one of which is the only real blocker.

Already shipped and verified in code today:

| Piece | State |
|---|---|
| `/portal/login`, real `signInWithPassword` | Built. Arbitrary credentials are rejected by Supabase. |
| `PortalProtectedRoute` on every portal route | Built. |
| Session → client-record mapping (`usePortalClient`) | Built, by email. |
| RLS scoping (`private.my_client_ids()`) | Built; `form_submissions` client-self-read is live. |
| `PortalDocuments` — pending vs completed, required vs optional | Built, handles both status casings. |
| `PortalFormPage` → `BaseFormTemplate` for the logged-in client | Built. |
| **Signature write-back** | **Built.** `BaseFormTemplate` finds the assigned `Not Started` row and UPDATES it to `status: 'Completed'` (insert only if absent). |
| **Gate movement** | **Built.** `fetchClientSignedForms` counts exactly `completed`/`reviewed`, so a portal signature moves the completion gate with no new code. |

So the chain *assign → client signs → gate moves* is wired end to end. What is
missing is a way for a real client to get in the door, and one list reading the
wrong source.

---

## Gap 1 — Account provisioning · **~0.5–1 day** · THE ONLY REAL BLOCKER

**What's wrong:** there is no invite flow. Portal accounts exist today only
because demo client rows were hand-made with matching emails and passwords set
by direct SQL. A real client cannot obtain credentials by any supported path.
Related to SECURITY_BACKLOG #6 (staff provisioning) — same missing capability,
different audience.

**Smallest version:** staff-triggered invite from the client record → Supabase
`inviteUserByEmail` (or a magic-link/OTP sign-in, which removes password
handling entirely and is likely the better fit for this population) → client
lands authenticated on `/portal/documents`.

**Why the range:** magic link is the low end — no password reset, no lockout
support burden, and Supabase does the sending. The high end is if ACS wants
passwords, which drags in reset + lockout + a support story. **Recommend magic
link.**

**Depends on:** outbound email. The app has NO email provider today (ROADMAP
"Client messaging / delivery layer" — `mailto:` links only). Supabase Auth can
send its own invite/OTP mail, which is why this stays half a day; if ACS wants
branded delivery it becomes a provider decision and grows.

---

## Gap 2 — `PortalDocuments` lists the catalog, not the assignment · **~0.25 day**

**What's wrong:** the pending list is computed from the static
`CLIENT_REGISTRY_FORMS` catalog minus completed ids — **not** from the client's
assigned `form_submissions` rows. A client therefore sees every client-facing
form in the registry as "pending" regardless of what staff actually assigned.
The progress line ("N of 14 complete") counts the catalog too.

**Consequence:** staff assign a 6-form packet; the client logs in and is shown
~14 forms. The packet the counselor built is invisible, and the client cannot
tell which forms are theirs.

**Smallest version:** read the client's `form_submissions` rows as the source of
truth for "your forms"; keep the registry only for titles/definitions. Required
vs optional then derives from the same `REQUIRED_FORMS_BY_LEVEL` the staff-side
picker now uses, so both sides agree.

**Why it's cheap:** the query already runs in that component; only the list
derivation changes.

---

## Gap 3 — Email identity hardening · **~0.25–0.5 day**

**What's wrong:** `usePortalClient` and `private.my_client_ids()` both map an
auth session to a client row **by email string match**. There is no
`clients.auth_user_id` FK. Two known consequences, both already documented:

- SECURITY_BACKLOG #10 multi-client nuance: if one auth email ever maps to
  multiple `clients` rows, the level shown can come from a different row than
  the hours.
- A client's email changing (or being entered differently) silently detaches
  their portal from their chart.

**Smallest version:** add nullable `clients.auth_user_id uuid` + FK, populate it
at invite time (Gap 1 already has the user id in hand), and prefer it in
`my_client_ids()` with the email match retained as fallback for existing rows.
Non-destructive, no backfill required.

**Why not skip it:** Gap 1 is the moment the id is available for free. Doing it
later means a backfill and a second RLS edit.

---

## Estimate roll-up

| Gap | Low | High |
|---|---|---|
| 1. Account provisioning (magic link) | 0.5 d | 1.0 d |
| 2. PortalDocuments reads assignments | 0.25 d | 0.25 d |
| 3. `auth_user_id` FK + RLS preference | 0.25 d | 0.5 d |
| Witness pass (real client signs, gate moves, revert) | 0.25 d | 0.25 d |
| **Total** | **1.25 d** | **2.0 d** |

---

## Explicitly NOT in this ticket

- **The anonymous upload link stays exactly as it is.** Confirmed architecturally
  separate today: `acs_upload_tokens` + the `acs-request-upload` edge function
  write to `uploaded_files` and **never touch `form_submissions`** (verified by
  grep across the edge function and the modal). It is the right tool for ad-hoc
  document drops and the wrong tool for signatures — anonymous, single-use,
  single-document, no identity behind the signature. Keep both.
- Branded/templated client email, reminders, nudges.
- Any change to the signature design.

## Risks / unknowns

- Supabase Auth email deliverability to real client addresses is unproven here
  (no outbound mail has ever been sent from this project). Worth a single live
  send before committing to the low estimate.
- Portal RLS is written for the current email mapping; Gap 3 touches
  `my_client_ids()`, which several policies depend on. Change it with the same
  present-then-apply + witness discipline used for WS0.
