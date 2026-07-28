# RECON — AIVA signature system — 2026-07-27

Read-only survey of **AIVA** (`C:\Users\dlwes\Documents\WestFlow\Aiva\aiva-dev`, branch `main`,
remote `Aiva-040226-v1`) for the purpose of porting its architecture into ACS TherapyHub.
**Nothing in AIVA was modified. No build, no deploy.** Line citations are AIVA's, not ACS's.

Note: `Aiva\aiva-dev\.claude\worktrees\` contains stale copies of these files. Everything below is
from the main tree; where a worktree copy differs it is called out.

**One-line summary:** AIVA has no hand-drawn capture at all — it renders a *typed name in a script
font* to a PNG on an offscreen canvas. That artifact is stored once (as base64 in a jsonb column,
mirrored to `localStorage`) and reused across documents, composited server-side into PDFs by
pdf-lib. **The architecture is worth taking. The capture method, the storage posture, and the audit
posture are not.**

---

## B1 · CAPTURE — a style picker, not a signature pad

**Five styles** (the brief said ~6), defined as a plain array —
`utils/SignatureStylePickerUtils.ts:1-10`:

```ts
export const SIGNATURE_STYLES = [
  { id: 'dancing',   label: 'Classic', font: 'Dancing Script', weight: 700, size: 42, initialsSize: 52 },
  { id: 'great',     label: 'Elegant', font: 'Great Vibes',    weight: 400, size: 38, initialsSize: 48 },
  { id: 'pinyon',    label: 'Formal',  font: 'Pinyon Script',  weight: 400, size: 36, initialsSize: 46 },
  { id: 'allura',    label: 'Flowing', font: 'Allura',         weight: 400, size: 40, initialsSize: 50 },
  { id: 'parisienne',label: 'Ornate',  font: 'Parisienne',     weight: 400, size: 34, initialsSize: 44 },
];
```

Fonts are Google Fonts, injected as a `<link>` at runtime (`SignatureStylePicker.tsx:35-46`) —
**an external network dependency at signing time.**

**Name → artifact.** `utils/SignatureStylePickerUtils.ts:29-60` is the whole producer:

```ts
  const fontStr = `${weight} ${fontSize}px '${font}'`;
  ctx.font = fontStr;
  …
  ctx.fillText(text, 10, 10);
  return canvas.toDataURL();
```

**Artifact = two base64 PNG data URLs** (signature + initials) plus a `styleId` string.
`canvas.toDataURL()` with no argument is `image/png`; consumers confirm it by calling
`pdfDoc.embedPng(...)` and by stripping `data:image/png;base64,`.

**There is no drawn/canvas option anywhere.** Verified: repo-wide search for `SignaturePad`,
`isDrawing`, or pointer-drawn canvas returns **zero** hits. The component header says so outright
(`components/SignatureCapture.tsx:6-15`): *"Drop-in replacement for the old drawn-only
SignatureCapture. Uses SignatureStylePicker (Google Fonts) — no draw canvas."* The result type
hardcodes it (`SignatureCapture.tsx:30-37`): `method: 'styled';` — a literal, not a union.

Legacy branches on `'drawn'` / `'digital_drawn'` survive in `PolicyPacketFlow.tsx:207` and
`mcp-orchestrator/index.ts:1017`, but nothing in the current tree can produce those values.

**Initials are derived, not captured** — first letter of each whitespace-separated word
(`SignatureStylePickerUtils.ts:12-19`), rendered from the same style at `initialsSize`.

---

## B2 · PERSISTENCE — stored once, reused, with a deterministic re-render fallback

**This is the part ACS should take.**

Primary store is a **jsonb column**, `onboarding_telemetry.metadata` — *not* object storage.
Written at `OnboardingJourney.tsx:3422-3438`:

```tsx
saveFormDataToMetadata({
    signature_method:   sig.method || 'styled',
    signature_style_id: sig.styleId || null,
    offer_signed_at:    sig.timestamp,
    offer_signed_by:    signerName,
    signature_captured: true,
    signature_data_url: sig.signatureDataUrl,
    initials_data_url:  …,
});
```

Every value is **dual-written to `localStorage`** as an availability hedge:

| Concern | jsonb key | localStorage key |
|---|---|---|
| Signature PNG | `signature_data_url` | `aiva-signature-data-url` |
| Initials PNG | `initials_data_url` | `aiva-initials-data-url` |
| Chosen style | `signature_style_id` | `aiva-signature-style-id` |

Countersignature (manager) uses a parallel namespace: `countersign_signature_data_url`, etc.

**The reuse model, precisely** (`OnboardingJourney.tsx:2973-2981` and `:3103-3134`):

1. **Path A — reuse.** `getSavedStep1Signature()` reads the stored data URLs (metadata first,
   localStorage fallback). If both exist, the *exact original PNG bytes* are re-sent for the next
   document. Pixel-identical, no re-render, **no re-signing by the user.**
2. **Path B — re-render.** If either is missing, the artifact is regenerated client-side from
   `(signerName, styleId)`. `styleId` is the durable minimum needed to reproduce.
3. On success the stamp handler **re-writes** the data URLs back to metadata, so Path B
   self-heals into Path A.

**Caveat worth carrying into the port:** Path B's signer name is
`identifiedName || currentHire?.staff_name || 'Employee'` (`:3093`), which can differ from the name
originally typed into the picker — so the regenerated artifact is **not guaranteed identical** to
the one the user actually approved. A signature that silently changes shape between documents is a
defect in a compliance context.

**The rendered PNG is never uploaded to storage as a standalone object.** It lives only as a base64
string in a jsonb column and in `localStorage`. What reaches storage is the *composited PDF*.

---

## B3 · APPLICATION — composited server-side into the PDF by pdf-lib

Not a DOM/CSS overlay. The signature is rasterized into the document.

Chain: `SignatureCapture.onComplete` → `handleStep7ContractStamp` → `signDocument()` →
POST to the `mcp-orchestrator` edge function, tool `stamp_contract` → pdf-lib in Deno → upload →
`uploaded_files` row → telemetry patch.

The rationale for server-side is documented at `utils/pdfStamper.ts:1-16` — a browser service
worker was intercepting the PDF fetch and returning a 1-page stub.

Embed (`mcp-orchestrator/index.ts:1407-1423`):

```ts
const base64 = dataUrl.split(',')[1] || dataUrl;
…
try { return await pdfDoc.embedPng(bytes); }
catch { return await pdfDoc.embedJpg(bytes); }
```

**What travels onto the page with the image** (`:1623-1640`, `:1789-1817`): the signature image, an
underline, then the **signer name** and a **localized `en-ZA` datetime** drawn as literal 7pt text
beneath it, plus the signer's national ID number at its own field. Initials are stamped on every
page carrying an `employee_initials` field. Placement is data-driven from `template_blocks` rows —
a coordinate map per template, not hardcoded positions.

**Document integrity hash** over the final bytes (`:1856-1860`):

```ts
const finalBytes = (await pdfDoc.save()).slice();
const hashBuf = await crypto.subtle.digest('SHA-256', finalBytes);
```

Two secondary paths still exist: browser-side pdf-lib in `MediaViewerModal.tsx:259-287`, and a
jsPDF *signature certificate* (a standalone artifact rather than an overlay) in
`PolicyPacketFlow.tsx:124-136`.

---

## B4 · IDENTITY + AUDIT — the weakest area; do not port as-is

**Consent: two required checkboxes, never persisted.** `SignatureCapture.tsx:269-284` presents
*"I consent to secure digital processing per POPIA"* and *"I confirm this is my legal signature and
I accept the terms of this document"*, gating submit at `:102`:

```tsx
const canConfirm = !!(signatureDataUrl && initialsDataUrl && ackPopia && ackAccuracy);
```

But `SignatureResult` (`:30-37`) carries **no consent field**, and nothing writes one. Verified
directly: `ackPopia`/`ackAccuracy` appear only as local `useState` and in the JSX. The proof of
consent is purely implicit in the existence of a signature.

Worse, consent is **auto-ticked without user action** for returning signers (`:93-100`), and on the
Step-7 auto-sign path `SignatureCapture` is **never mounted at all** — the document is signed from
the saved artifact behind a single button (`OnboardingJourney.tsx:3373-3381`). No checkbox is
presented on that path.

**Timestamp: client-side `new Date()`, and the server trusts it.** Generated in the browser at
`SignatureCapture.tsx:112`, with two more fabrication sites (`OnboardingJourney.tsx:3012`, `:3111`).
The server only substitutes its own when the client omits the value entirely
(`mcp-orchestrator/index.ts:1805`, `:1906`). **A device with a wrong or manipulated clock produces
a wrong signing date on the legal document.**

**IP / user agent: not captured on the live path.** They are read only in two legacy orchestrator
tools writing to `employment_contracts` — a table AIVA's own migration comments confirm is **empty**
(`supabase/migrations/aiva_hire_state.sql:8-10`, `:21-24`). The live `stamp_contract` tool reads no
request headers.

| Item | Captured? | Where |
|---|---|---|
| Signer name | Yes | metadata + painted on PDF |
| National ID | Yes | painted on PDF only |
| Timestamp | Yes — **client-generated** | metadata + painted on PDF |
| Style used | Yes | `signature_style_id` |
| Method | Yes — always the literal `'styled'` | `signature_method` |
| SHA-256 of final PDF | Yes | `document_hash` |
| IP address | **No** (live path) | legacy table, empty |
| User agent | **No** (live path) | legacy table, empty |
| Consent state | **No — never persisted** | — |

---

## B5 · The `hire_id` argument-order bug — **NOT present at the signature callsites**

The signature is `storageService.uploadFile(file, name, folder, metadata, options)` — arg 4 is a
jsonb blob, **arg 5 `options.hireId` is what reaches the `uploaded_files.hire_id` column** and also
prefixes the storage path (`services/storageService.ts:42-54`, `:84-89`).

**It was already found and fixed, with the reasoning left in place.**
`components/PolicyPacketFlow.tsx:188-202`:

```tsx
// hireId MUST go in the 5th arg (options), not the 4th (metadata) — only
// options.hireId reaches the uploaded_files.hire_id COLUMN. Passing it as
// metadata buried it in the jsonb blob, left the column NULL, and made every
// signed policy doc invisible to delete-hire (which matches on the column).
```

All five signature-related callsites pass arg 5 correctly (`PolicyPacketFlow.tsx:196-202`,
`MediaViewerModal.tsx:329-344`, `:350-356`, `:550-557`, `OnboardingJourney.tsx:2665-2672`). Several
*also* repeat `hire_id` inside arg 4 — a harmless duplicate, not a misplacement.

The **pre-fix form still exists in the stale worktree copy**
(`.claude/worktrees/blissful-goldstine-62b54c/components/PolicyPacketFlow.tsx:140-143`) — useful as
a before/after reference, but not live code.

Two genuine misses remain in AIVA **outside** the signature path — `context/AppContext.tsx:239-242`
(no 5th arg at all) and `components/seasonal_onboarding/SeasonalWorkerOnboarding.tsx:135-144`
(`worker_id` in metadata, no options) — both leaving `hire_id` NULL. **Reported, not fixed; AIVA's
call.**

**Port note:** the main signing path (`services/signingService.ts`) bypasses `uploadFile` entirely
and posts `hire_id` as a *named* key. Porting that path makes this whole class of bug impossible.

---

## B6 · STORAGE POSTURE — public bucket, no signed URLs. **Do not copy.**

Bucket `project-aiva-afridroids`, hardcoded server-side
(`mcp-orchestrator/index.ts:1862-1868`). It is **public**, proven by the URL form used everywhere
(`:1883`):

```ts
const pdfUrl = `${SUPABASE_URL_ENV}/storage/v1/object/public/${BUCKET}/${storagePath}`;
```

The `/object/public/` route only resolves for a public bucket. That URL is then persisted as
`signed_pdf_url` in metadata and as `uploaded_files.public_url`.

**Zero signed-URL usage.** Verified directly: repo-wide search for `createSignedUrl` /
`createSignedUploadUrl` returns **no hits**. Client uploads use `getPublicUrl` (`storageService.ts:65`).

**Consequence:** the fully-executed employment contract — signature image, printed name, national
ID, signing datetime — is retrievable by anyone holding the URL, with no expiry. Path entropy is
`contracts/<hire_uuid>/contract_signed_<Date.now()>.pdf`; the UUID is unguessable but is exposed
client-side, and the millisecond suffix is low entropy.

**No storage policies are version-controlled.** No migration creates the bucket, sets its public
flag, or defines any policy on `storage.objects`. The bucket ACL was configured out-of-band in the
dashboard — the live policy set is **UNKNOWN** from the repo.

**And the signature artifact itself isn't in storage at all** — it is base64 in
`onboarding_telemetry.metadata`, whose RLS is likewise **not defined in any migration here**
(UNKNOWN). Every client-side read/write of that table uses the **anon key as a bearer token from the
browser**. If that table lacks restrictive RLS, the anon key is sufficient to read any hire's
signature image. Tenant separation is app-layer only, which the repo states plainly
(`constants.ts:28-31`, *"Phase 1, app-layer isolation"*).

The `localStorage` mirror is unencrypted, persists after the journey completes, and nothing clears it.

---

## What to take, and what to leave

**Take:** capture-once → persist → reuse-across-documents (with `styleId` as the durable
regeneration seed); server-side pdf-lib compositing; the SHA-256 document hash; the data-driven
`template_blocks` coordinate map; named-key transport instead of positional args.

**Leave:** styled-font-only capture (it is a typed signature in a costume — see the ACS design);
base64-in-a-jsonb-column as the system of record; the `localStorage` mirror; the public bucket;
client-generated signing timestamps; unpersisted, auto-ticked consent; and the Path-B re-render
that can silently produce a different artifact than the one the signer approved.

**Three things AIVA left implicit that the ACS port must decide explicitly:** whether the signing
timestamp is server-authoritative (AIVA's is not), whether consent state is persisted (AIVA's is
not), and whether signed documents are publicly readable (AIVA's are).
