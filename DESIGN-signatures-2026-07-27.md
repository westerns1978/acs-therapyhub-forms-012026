# DESIGN — ACS signature model (proposal)

**2026-07-27 · written proposal only. No migration, no code, nothing applied.**
Inputs: `RECON-aiva-signatures-2026-07-27.md` (what to take and leave), `SWEEP-acs-2026-07-27.md`
(what currently renders dishonestly). All counts below are live queries run today.

---

## 1. The governing principle

David (7/21) asked for **a rendering of actual handwriting** for state compliance. That decides the
capture hierarchy, and it is the one place this design departs from AIVA:

> **A script font is a typed signature in a costume.** It is a *font choice applied to a typed
> string* — it carries no biometric trace of the signer, and two people typing the same name in the
> same style produce byte-identical images. Presenting that as handwriting would be exactly the
> class of claim the honesty sweep just spent a night removing.

So: **drawn is the default and the compliance path. Styled is a clearly-labelled fallback.** What we
take wholesale from AIVA is the *architecture* — capture once, persist, apply across many documents
without re-signing — which ACS has nothing for today.

---

## 2. `signature_method` — the load-bearing column

Persisted **at write time**, never inferred. This is the Story Scribe lesson: gating on "has
signature image" would render every historically-signed record as UNSIGNED, and a record that looks
unexecuted is a compliance problem, not a display problem.

| Value | Meaning | Renders as |
|---|---|---|
| `drawn` | Canvas-captured handwriting, PNG in private storage | the image |
| `styled` | Typed name rendered in a script font | the image + **"Typed signature (script style)"** label |
| `typed` | Plain typed name, no image (all of today's live signatures) | the name in a plain face + **"Typed name on file"** |
| `legacy_boolean` | Pre-2026-07 attestation: `is_signed = true`, no signer, no timestamp | **"Signed — signer and time not recorded"** |
| `unsigned` | No signature captured | **"Not signed"** |

Two rules that must survive review:
1. **`unsigned` is only ever written deliberately.** A NULL/missing column means *"this predates the
   signature system"*, and must be backfilled to an explicit value — never rendered as `unsigned`.
2. **`legacy_boolean` and `typed` render as genuinely executed**, just with less provenance. They are
   not failures; they are records made under an earlier standard.

---

## 3. Proposed schema (NOT applied)

Additive only. Nothing dropped, nothing renamed. All 54 `form_submissions` and 22 `clinical_notes`
rows keep rendering.

### 3a. New table — one signature artifact, reused across documents

This is the AIVA architecture, done with storage instead of a jsonb blob.

```
signatures
  id                uuid pk
  client_id         uuid null      -- exactly one of client_id / staff_user_id is set
  staff_user_id     uuid null      -- auth.uid() of the signing clinician
  method            text not null  -- 'drawn' | 'styled'
  storage_path      text not null  -- PRIVATE bucket; never a public URL
  style_id          text null      -- only for 'styled'; the regeneration seed
  captured_at       timestamptz not null default now()   -- SERVER time
  captured_ip       inet null
  captured_user_agent text null
  consent_text      text not null  -- the exact wording shown at capture
  consent_at        timestamptz not null                 -- SERVER time
  superseded_by     uuid null references signatures(id)
  revoked_at        timestamptz null
```

- **Append-only**, superseded rather than edited — the same shape as `placement_determinations`,
  which already works this way and is the precedent to copy.
- `consent_text` stores *what the signer actually agreed to*, not a boolean. AIVA's mistake was
  gating on two checkboxes and persisting neither.
- One artifact per signer, reused. Re-capture creates a new row and sets `superseded_by` on the old.

### 3b. Per-application record — where a signature was *used*

```
signature_applications
  id                 uuid pk
  signature_id       uuid not null references signatures(id)
  subject_table      text not null   -- 'form_submissions' | 'clinical_notes' | 'placement_determinations'
  subject_id         uuid not null
  applied_at         timestamptz not null default now()  -- SERVER time
  applied_by         uuid not null                       -- who caused the application
  document_sha256    text null       -- hash of the rendered PDF, if one was produced
```

Separating *capture* from *application* is what makes "sign once, apply to many" auditable: you can
answer both "whose signature is this and when did they draw it" and "which documents carry it."

### 3c. Additive columns on existing tables

```
form_submissions
  + signature_method    text not null default 'unsigned'   -- backfilled, see §5
  + signature_id        uuid null references signatures(id)
  + signed_at           timestamptz null                   -- SERVER time

clinical_notes
  + signature_method    text not null default 'unsigned'
  + signature_id        uuid null references signatures(id)
  + signed_by           uuid null                          -- closes a real gap: today there is none
  + signed_at           timestamptz null
```

`clinical_notes.is_signed` stays. It becomes a derived convenience, not the source of truth, and
must not be dropped while anything reads it.

### 3d. Storage

- **New private bucket `acs-signatures`.** Not `client-documents` (public, anon read+insert). Not
  `therapyhub-patient-files` — signatures are a different retention class than uploaded documents.
- Reads via **short-lived signed URLs only**. AIVA has zero `createSignedUrl` calls anywhere; ACS
  gets them from day one.
- Path `signatures/<client_or_staff_id>/<signature_id>.png` — the id is the filename, so no
  timestamp guessing.
- RLS mirroring `therapyhub-patient-files`: staff-all via `private.is_staff()`, client-self via
  `private.my_client_ids()`.

### 3e. Server-authoritative time

Every `*_at` above is set **server-side** — DB default or an edge function — never from the browser.
AIVA takes `new Date()` from the client and the server trusts it; a wrong device clock produces a
wrong signing date on a legal document. IP and user-agent are only observable server-side too, which
is a second reason capture must terminate in an edge function rather than a direct client insert.

---

## 4. Client vs staff signatures — **staff must be held to a stricter standard**

Yes, and the reason is about consequence, not seniority.

A **client** signature is *consent* — the client is asserting something about their own rights and
their own information. If it is later disputed, the dispute is between ACS and that one client, and
the surrounding record (portal session, submission timestamp, IP) is corroborating evidence.

A **staff** signature is an *attestation* — a licensed clinician asserting that a professional act
occurred and that a clinical record is true. It is the thing an auditor, a court, or the Department
of Mental Health relies on, it is made *about a third party* who cannot verify it, and under
9 CSR 30-3.206 it is what makes the record admissible at all. A forged or mis-attributed clinician
attestation is a licensure matter.

Concretely, staff signatures get three things client signatures do not:

1. **Re-authentication at signing time**, not merely an active session. Today a clinician's
   attestation is `onClick={() => setIsSigned(true)}` — a boolean with no identity check.
2. **Hard immutability.** No UPDATE/DELETE policy at all, correction by supersession only. Client
   consents may be re-signed; a signed clinical note may not be edited.
3. **Signer identity recorded on the record itself** (`signed_by`), not merely inferred from the
   session. `clinical_notes` has no signer column today, and only 4 of 15 signed notes even carry a
   `therapist_id`.

I'd also **not** offer the `styled` fallback for staff attestations. The device argument ("I'm on a
phone") is real for a client completing intake; a clinician signing a note that gates a state
certificate can use a real input surface.

---

## 5. Backfill plan — counts are live, queried 2026-07-27

Every existing row gets an explicit `signature_method`. Nothing renders as `unsigned` by accident.

### `form_submissions` — 54 rows

| Backfill to | Rows | Basis |
|---|---|---|
| `typed` | **23** | a non-empty typed signature value in `data` (`clientSignature`, `staffSignature`, `witnessSignature`, `therapistSignature`, or snake_case equivalents) |
| `unsigned` | **29** | no signature field present at all — includes every `Not Started` / `In Progress` row |
| `unsigned` | **2** | the `satop-intake` rows whose `signature_data_url` holds the literal strings `demo-signature-marcus` / `demo-signature-emma` — **placeholders, not images; must NOT migrate as real signatures** |

Note the `treatment-plan` phantom row is among the 23 `typed`. It stays untouched — it goes to David
as a finding.

### `clinical_notes` — 22 rows

| Backfill to | Rows | Basis |
|---|---|---|
| `legacy_boolean` | **15** | `is_signed = true`. Only **4** carry a `therapist_id`; the other 11 have no recoverable signer — that is precisely why this state exists rather than inventing one |
| `unsigned` | **7** | `is_signed = false` |

### `placement_determinations` — 14 rows

**No backfill needed, and no `signature_method` column.** These already carry `determined_by` (14/14
populated), `determined_at`, and `basis_snapshot.signed_by`, and are already append-only at the RLS
layer. This table is the existing good precedent — the design copies it rather than changing it.

**The migration is safe to write but must not be applied blind**: it is additive, but the backfill
reads `data` jsonb and its correctness depends on the key list above being complete. Re-run the
census immediately before applying.

---

## 6. Surfaces to wire, in order

Sequenced so each step is independently shippable and witnessable.

1. **Capture + storage + `signatures` table.** The `SignaturePad` already exists and emits PNG; it
   needs an edge function to receive the blob, write to the private bucket, and stamp server-side
   time/IP/UA/consent. *Nothing user-visible changes yet.*
2. **Backfill `signature_method` everywhere + honest rendering.** Every existing record renders
   correctly labelled *before* any new capture surface goes live. This ordering is deliberate: if
   new capture ships first, historical records briefly render as unsigned.
3. **Client consent forms** (`consent-treatment`, `hipaa-ack`, `authorization-release`,
   `telehealth-consent`, `satop-checklist`, `emergency-contact` — the six that gate the completion
   certificate). Highest value: these are what the cert gate claims are "signed".
4. **Clinical note signing** — replaces the boolean button. Needs re-auth + `signed_by` + immutability.
5. **PDF compositing.** `jsPDF.addImage` is currently unused; the certificate, CIMOR packet, and
   record packet all learn to embed the signature. This is what finally lets the completion
   certificate drop its unconditional SAMPLE banner.
6. **Styled fallback lane**, explicitly labelled, client surfaces only.
7. **Means-test certification** — depends on all of the above (see `docs/design/means-test-native-direction.html`).

Steps 1–3 are the meaningful demo. Steps 4–5 are what make the certificate real.

---

## 7. Honest size estimate

| Phase | Scope | Estimate |
|---|---|---|
| 1 — capture + storage + schema | migration, private bucket + RLS, capture edge function, wire `SignaturePad` to one surface | **2–3 days** |
| 2 — backfill + honest rendering | backfill migration, render `signature_method` in ~6 read surfaces | **1 day** |
| 3 — six consent forms | `BaseFormTemplate` signature field type, reuse-across-forms UX | **1–2 days** |
| 4 — clinical notes | re-auth, `signed_by`, immutability policy, replace the boolean | **1–2 days** |
| 5 — PDF compositing | `addImage` in 3 generators, re-baseline `check:forms` | **1–2 days** |
| 6 — styled fallback | port AIVA's picker, relabel honestly | **0.5–1 day** |

**Total ≈ 7–11 working days** for all six, with steps 1–3 (**4–6 days**) as the first shippable
increment.

**What makes it 11 rather than 7:** the immutability policy needs a real decision on correction
workflow (supersede vs amend); `check:forms` guards `PrintPreview` byte-for-byte so touching the
print path forces a deliberate re-baseline; and every one of the six consent forms has its own
signature field naming (`clientSignature` vs `client_signature` vs `signature`) that has to be
normalised without breaking the 23 existing typed rows.

**Explicitly not in this estimate:** retiring the unconditional SAMPLE banner (a judgment call once
signatures are real, not a coding task), and the means-test build.

---

## 8. Decisions I need from you before anything is built

1. **Re-auth for staff attestations** — password re-entry, or is an active session enough? I
   recommend re-entry; it is the difference between a boolean and an attestation.
2. **Correction workflow** — supersede-only (my recommendation, matches `placement_determinations`),
   or an amend-with-history model?
3. **Styled lane for staff** — I recommend excluding it entirely. Confirm.
4. **Consent wording** — `consent_text` stores it verbatim, so the exact sentence needs to be
   approved once, by someone who can speak to ESIGN/UETA. That is the AMBIGUOUS item A1 from the
   sweep and it is still open.
