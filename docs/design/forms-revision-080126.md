# Forms Revision — David Yoder change guide, gap analysis & build plan (2026-08-01)

Recon-only deliverable. Source package: `Documents/Historical/SATOP/new-forms-080126/`
(Forms.docx + 6 annotated PDFs, received from David Yoder / ACS). Repo witnessed at
`main` @ `19e1398` (clean working tree). **No code was changed in this session.**

---

## 1. David's change list (verbatim from Forms.docx)

The docx is a flat bulleted list (form name, then its changes). Reproduced verbatim:

> **FORMS**
> - Authorization for Release of Information –
>   - DELETE email field
> - HIPAA Notice -
>   - See mark up for wording change
> - Support Group Meeting Report
>   - DELETE Chairman Signature field
> - Client Orientation Checklist
>   - See markup for word changes
>   - Add field with wording on markup about finances
> - Chart Review – Not needed and similar to another form
>   - Change name to "Client Status Report"
> - Consent for Treatment
>   - Need to include full narratives
>   - See submitted paper form for wording
> - Continuing Recovery Plan
>   - See markup for adjustments
>   - "Plan to remain sober" needs to be yes OR no
>   - Most fields need minimum of 3 responses and up to 4 rather than open box that could accept 1 response.  Maybe add numbered lines?
>   - **Following the paper form more literally may be easiest way to adjust** *(bold in original)*
> - SATOP Client Intake – let's talk about whether to delete or modify this
> - ADD - SATOP Registration Form
>   - Digitize the submitted example
>   - All fields mandatory
>   - FYI this is the first and base form for new SATOP clients
> - ADD – Registration Form
>   - Digitize the submitted example
>   - Add the following
>     - Is this a legal requirement   yes/no
>     - If yes, what is/are the related charge(s)
>   - FYI this is the first and base form for new OP(outpatient) clients
> - Session Attendance – not needed, delete

Grouping note: the docx is visually flat (each bullet is its own Word list), so the
"Change name to Client Status Report" line sits directly under Chart Review, which David
also calls "not needed" — delete-vs-rename as written is contradictory. **Resolved by
decision D1 (§11): Chart Review is soft-retired and no "Client Status Report" form is
created.** The line is recorded above for provenance only; it is not actioned.

## 2. The six PDF markups — legibility report

All six scans were read page-by-page. Handwriting was legible except where flagged.

| PDF | Pages | What it is | Annotations extracted |
|---|---|---|---|
| HIPAA.pdf | 1 | App printout of HIPAA Notice Acknowledgement (page 1 of a 2-page printout — **page 2 not scanned**) | Caret after "received" with circled "**or been advised of**"; slash marks strike the "with an effective date of January 2025" clause. **Resolved by Dan 2026-08-01** — final text in §5. |
| Orientation Checklist.pdf | 1 | App printout of Orientation Checklist (page 1 of a 3-page printout — **pages 2–3 not scanned**) | Item rewordings (see §5, satop-checklist row) + circled add: "**Add: I have been advised of all fees associated with my care.**" |
| Registration Form.pdf | 1 | Paper "DEMOGRAPHICS" form — the OP base form to digitize | Title "DEMOGRAPHICS" struck, handwritten "**Registration Form**" ✓. Per-field **R**/**O** marks (R = required, O = optional) — detail in §7. Circled "**ADD HERE**" at the "I have received the Notice of HIPAA Privacy Practices" line — likely the insertion point for the two new legal-requirement questions, and that line may itself be struck (Q4). |
| SATOP Registration Form.pdf | 1 | Paper SATOP intake sheet (footer 08/20) — the SATOP base form to digitize | Header: handwritten title "**SATOP Registration Form**". "Date of Appointment" struck with "**Delete**". "If yes, which branch" (Veteran) struck, replaced "**active or inactive**". Entire bottom block (Probation/Parole Officer, Phone, Name of Attorney, Phone #, Fax/Email, "You must provide us with your attorney's contact information") X'd out with "**Delete**". |
| Consent for Treatment.pdf | 1 | Paper "SATOP/SROP/Chemical Dependency Program — Consent for Treatment and Responsibility Agreement" with 8 numbered narrative paragraphs | This IS the "full narratives" wording source. Margin marks in ¶5 near "client will be discharged and recommended". **Resolved by Dan 2026-08-01** — final text in §5. Everything else is clean printed text. |
| Continuing Recovery Plan.pdf | 2 | Paper CRP form | Fully legible R/O marking system: on every numbered-line question, lines 1–3 marked **R**, line 4 marked **O**. Header Name = R. "Do you plan on remaining alcohol and drug free? Yes/No" = R. "What will you do if you want to use?" = R. Relapse-steps list (unmarked). Sober-support-meetings count = R. Sponsor date = R. Medications Y/N = R, dosing Y/N = R. Daily clean-and-sober list = R×3 + O. Referrals block (2× Organization/Contact Number/Contact Person) = all **O**. Client/Counselor/Date signature lines = all **R**. |

**Gaps I could not witness** (Dan has the markup details and will fill in):
1. HIPAA printout page 2 and Orientation Checklist printout pages 2–3 were not in the scans — any annotations there are unknown.
2. The two partially-legible spots flagged above (HIPAA effective-date clause; Consent ¶5 margin marks).

## 3. Current state of the forms system (witnessed)

- **Branch:** `main`, clean, up to date with `origin/main`. Did not switch branches.
- **Pattern: config-driven, one registry + per-form definition modules.**
  - [config/formRegistry.ts](../../config/formRegistry.ts) — `FORM_REGISTRY`, the single catalog (id, title, category, audience, requiredForCompletion). Drives the assign picker, portal list (`CLIENT_REGISTRY_FORMS`), and the cert gate (`REQUIRED_FORMS_BY_LEVEL`).
  - [config/formDefinitions.ts](../../config/formDefinitions.ts) — `FORM_DEFINITION_BY_ID`, maps form_id → `FormDefinition` (imported from `components/forms/*Form.tsx`). Used to render committed submissions; falls back to key-based rendering when no definition matches.
  - Each `components/forms/<X>Form.tsx` exports a `FormDefinition` whose **`fieldDefinitions` array is what actually renders** — [BaseFormTemplate.tsx](../../components/BaseFormTemplate.tsx) iterates `fieldDefinitions` (single page); the `Step1..N` React components inside several form files are **not referenced** by their definitions (dead code; `FormDefinition.steps` is optional and unused by BaseFormTemplate).
  - Field type vocabulary ([types.ts:130-151](../../types.ts)): `text | number | textarea | tel | date | rating | boolean | object | email | password | select | checkbox-group`, plus `min`/`max`, `options`, `required`, and **`visibleWhen` one-level conditional visibility** (single sibling, strict equality). Emission/validation integrity gate: [config/fieldInput.ts](../../config/fieldInput.ts), [scripts/formIntegrityCheck.tsx](../../scripts/formIntegrityCheck.tsx).
- **Assignment = a `form_submissions` row.** `assignForm` ([services/api.ts:2011](../../services/api.ts)) bulk-inserts rows with `status='Not Started'`; there is no separate assignments table. `form_id` is free text and assignForm does **not** hard-reject unknown ids.
- **Duplicate-file note:** `components/forms/RecoveryPlanFormDef.tsx` and `components/forms/ConsentTreatmentFormDef.tsx` also export `RECOVERY_PLAN_DEFINITION` / consent definitions, but `formDefinitions.ts` imports from `ContinuingRecoveryPlanForm.tsx` / `ConsentForTreatmentForm.tsx` — the `*FormDef.tsx` pair appears to be unwired older copies. Cleanup candidate during the CRP/Consent rebuilds.

### Full current form catalog (FORM_REGISTRY)

| id | Registry title | Audience | Cert-gate required |
|---|---|---|---|
| consent-treatment | Consent for Treatment | client | ✅ |
| hipaa-ack | HIPAA Notice Acknowledgement | client | ✅ |
| authorization-release | Authorization for Release of Information | client | ✅ |
| telehealth-consent | Telehealth Informed Consent | client | ✅ |
| satop-checklist | Orientation Checklist | client | ✅ |
| emergency-contact | Emergency Contact | client | ✅ |
| satop-intake | SATOP Client Intake | client | — |
| recovery-plan | Continuing Recovery Plan | client | — |
| telehealth-feedback | Telehealth Session Feedback | client | — |
| late-cancellation | Late Cancellation Policy | client | — |
| meeting-report | AA/NA Group Meeting Report *(component title: "Support Group Meeting Report" — mismatch)* | client | — |
| treatment-plan | Individual Comprehensive Treatment Plan | staff | — |
| discharge-summary | Clinical Discharge Summary | staff | — |
| chart-checklist | Chart Review | staff | — |
| session-attendance | Session Attendance | staff | — |

## 4. Live data check (delete safety)

Queried the live Supabase project (`ldzzlndsspkyohvzfiiu`), `form_submissions`:
**7 rows total, all `Not Started`** (one each: authorization-release, consent-treatment,
emergency-contact, hipaa-ack, late-cancellation, satop-checklist, telehealth-consent).
**Zero rows** reference `meeting-report`, `session-attendance`, or `chart-checklist`.

**Recommended deletion approach — soft retire anyway:**
add `retired?: boolean` to `FormRegistryEntry`; filter retired ids out of
`CLIENT_REGISTRY_FORMS`, the assign picker, and FormLibrary, but **keep** the entries in
`FORM_DEFINITION_BY_ID` so any submission row ever created still renders. Rationale:
`form_id` is free text with no FK, `assignForm` doesn't reject unknown ids, and hard
deletion of the definition would drop historical rendering to the key-based fallback.
Cost over hard delete is one flag + three filter sites. None of the delete candidates is
in the cert-gate set, so `REQUIRED_FORMS_BY_LEVEL` is untouched.

## 5. Mapping table — David's name → our form → change

| David's form | Our id (exists?) | Type | Specific changes | Effort |
|---|---|---|---|---|
| Authorization for Release of Information | `authorization-release` ✅ | MODIFY | Delete `clientEmail` field (currently `required: true` — also remove from validation/initialState). | **S** |
| HIPAA Notice | `hipaa-ack` ✅ | MODIFY | `acknowledgesNotice` label becomes exactly: **"I acknowledge that I have received or been advised of ACS's HIPAA Notice of Privacy Practices."** The "with an effective date of January 2025" clause is struck. *(Final text, Dan 2026-08-01.)* | **S** |
| Support Group Meeting Report | `meeting-report` ✅ | MODIFY | Delete `chairpersonSignature` field (+ its validateStep rule). Also reconcile the registry-vs-component title mismatch ("AA/NA Group Meeting Report" vs "Support Group Meeting Report" — David uses the latter). | **S** |
| Client Orientation Checklist | `satop-checklist` ✅ | MODIFY | Reword 5 items (label-only, ids unchanged): "Client Bill of Rights received and reviewed" → "**Client Rights Explained**"; "Grievance procedure reviewed" → "Grievance procedure **explained**"; "Confidentiality and HIPAA policies reviewed" → "Confidentiality **explained**"; "Crisis response and emergency contacts reviewed" → "**Emergency contacts reviewed**"; "Program rules reviewed" → "Program rules **and expectations explained**". Add new boolean acknowledgement: "**I have been advised of all fees associated with my care.**" | **S** |
| Chart Review | `chart-checklist` ✅ | DELETE (soft-retire) | **Decided (Dan 2026-08-01): soft-retire only. Do NOT create a "Client Status Report" form** — the rename in David's note is not actioned. Zero live submissions. | **S** |
| Consent for Treatment | `consent-treatment` ✅ | MODIFY (rebuild) | Replace the current paraphrased checkbox list with the paper form's **8 full narrative paragraphs** verbatim (attendance/refund policy, fees-paid-in-full, $40 cancellation fee, abstinence + testing ≤$30 + marijuana clause, prescribed/controlled-substance disclosure, medical/psychological clearance, participation + self-help group requirement, emergency phone number), plus group-session schedule fill-ins, client + staff signatures and dates. Needs a way to render static narrative text (see §8b). **¶5 final wording (Dan 2026-08-01): "…client will be discharged and/or may be recommended to the next higher treatment level."** | **M** |
| Continuing Recovery Plan | `recovery-plan` ✅ | MODIFY (rebuild to paper form) | Follow the paper form literally (David's bolded advice): remain-sober **yes/no** (already `boolean` — keep); 5 list questions (problems to address / how to address / people-places-things to avoid / changes noticed / daily clean-and-sober list) each as **numbered lines 1–4, lines 1–3 required, line 4 optional**; "What will you do if you want to use?" required text; relapse-steps list (lines 1–4, marks absent — mirror the R×3+O pattern, confirm with Dan); meetings-per-week count (required), sponsor date (required), meds yes/no + dosing yes/no (required, dosing conditional on meds — `visibleWhen` fits); Referrals ×2 (Organization/Contact Number/Contact Person — all optional); Client + Counselor signatures + dates (required). Current definition's off-paper fields (primaryGoals, triggers, copingSkills, supportGroups, emergencyContacts…) drop. Zero live submissions → no rendering-compat migration needed. | **M–L** |
| SATOP Client Intake | `satop-intake` ✅ | **OUT OF SCOPE — leave untouched** | **Decided (Dan 2026-08-01): entirely out of scope for this revision.** Not modified, not retired, no PDF twin. David's "delete or modify" note is not actioned here. | — |
| **ADD:** SATOP Registration Form | — (new; propose `satop-registration`) | ADD | Digitize the 08/20 paper sheet minus the deletions: Client Name, Date, Address, City/State/Zip, Primary Phone, Email, DOB, Age, Sex, Marital Status, Race, SSN, Driver's License #, Referred by, BAC, Veteran Y/N + **active or inactive** (conditional — `visibleWhen` fits), last school + last grade, Employed Y/N, approx annual income, Occupation, Number in household, other-alcohol-offense arrest, # traffic tickets, # drug-related arrests, County of arrest for DWI, Court handling DWI. **Deleted per markup:** Date of Appointment; the whole Probation-Officer/Attorney contact block. **All fields mandatory** (David). Base form for new **SATOP** clients (§8a). | **M** |
| **ADD:** Registration Form | — (new; propose `registration`) | ADD | Digitize the "DEMOGRAPHICS" sheet under the new title "Registration Form", with the markup's R/O map (§7) and two new fields: "**Is this a legal requirement** — yes/no" and conditional "**If yes, what is/are the related charge(s)**" (`visibleWhen` fits). Base form for new **OP** clients (§8a). | **M** |
| Session Attendance | `session-attendance` ✅ | DELETE (soft-retire) | "Not needed, delete." Zero live submissions. | **S** |

**Our forms David did not mention** (no action; keep as-is):
`telehealth-consent`, `emergency-contact`, `telehealth-feedback`, `late-cancellation`,
`treatment-plan` (staff), `discharge-summary` (staff). Note `telehealth-consent` and
`emergency-contact` are cert-gate forms — untouched by this revision.

**David's forms with no match in our system:** only the two intentional ADDs. No orphans.

## 6. Build plan, sequenced by dependency

**Phase 0 — schema/plumbing (before any form work):**
1. **Soft-retire flag** on `FormRegistryEntry` + filters (assign picker, portal list, FormLibrary). Unblocks the two deletes. *(S)*
2. **Base-form-per-program plumbing** (§8a) — decide behavior with Dan first (Q2), then implement (likely a `baseFormForClientTypes?: string[]` registry field consumed at client creation and/or portal ordering). Unblocks the two ADDs being "first and base". *(M)*
3. **Static-narrative rendering decision** for Consent (§8b): either a new display-only `'static'` field type in BaseFormTemplate (small, clean) or long-label booleans (no schema change, uglier). *(S if long-labels, M if new type)*
4. *(No new field type needed for numbered lines — see §8c.)*

**Phase 1 — small modifies (independent, any order):**
5. `authorization-release`: drop email. 6. `hipaa-ack`: wording. 7. `meeting-report`: drop chairperson signature + title reconciliation. 8. `satop-checklist`: rewordings + fees acknowledgement.

**Phase 2 — retires:** 9. `session-attendance`. 10. `chart-checklist` — only after Q1 resolves.

**Phase 3 — rebuilds and adds (after Phase 0):**
11. `consent-treatment` narratives. 12. `recovery-plan` paper-literal rebuild. 13. New `satop-registration`. 14. New `registration`. 15. Wire both ADDs as base forms.

**Phase 4 — PDF twins (per form, each PDF ships *with* its form's revision — never before).**
See §9 for the full design. Plumbing (registry field + two UI surfaces + the existence gate)
**shipped 2026-08-01** as Phase 0; it is inert until the first `pdfSlug` is set. The
remaining work is `PrintPreview` blank-template mode — a **prerequisite for every PDF**
(§9e), not a per-form task — and then one PDF per form as that form's revision merges.

Run `check:forms` (formIntegrityCheck) after each phase; it models emission vs validation and will catch id/type drift.

## 7. Registration Form (OP) — R/O map from the markup

Required (R): Initial Contact Date, Service Needed, Legal Name (First/MI/Last), Address,
City, State, Zip, Phone, Email, SS#, Referred by, Date of Birth, Age, Gender, Marital
Status, Employer, Occupation, HIPAA-received signature + date *(but see Q4)*.
Optional (O): Race *(mark is small — confirm, Q6)*, Probation/Parole Officer block,
Caseworker/Agency block, Attorney/Law Firm block, all insurance fields + insurance
authorization signature.

## 8. Feasibility findings (the three specific questions)

**a. "First/base form per program type" — new plumbing. Behavior DECIDED (Dan 2026-08-01).**
Nothing in the codebase models form ordering or a per-program first form. The nearest hooks:
`REQUIRED_FORMS_BY_LEVEL` is keyed by **SATOP level** (from the signed placement
determination), not program; and `clients.client_type` already carries both `'SATOP'` and
`'OP'` tokens (migration `20260708_sched11_client_type_extend.sql`).

**Decision: the base form auto-assigns on client creation, keyed off `clients.client_type`**
— `SATOP` → SATOP Registration Form, `OP` → Registration Form. Implementation shape: a
registry field naming the client_type(s) a form is the base form for, read at the
client-creation path, which then calls the existing `assignForm` to insert the
`form_submissions` row. Two things to settle during that build, neither blocking now:
- `client_type` is **nullable** and 15 tokens wide — a client created with a null or
  non-SATOP/OP type gets no base form. That should be the explicit, silent default rather
  than an error, but it means client_type must be set at creation for the auto-assign to fire.
- `assignForm` requires a `dueDate`; a base form assigned at creation has no natural due
  date. Decide a convention (creation date, or a nullable due date) at build time.

**b. Consent narratives.** `fieldDefinitions` has no static-text/display type; BaseFormTemplate
renders only input fields. Options: (i) new `'static'` display-only field type (renders label
as narrative prose, emits nothing; ~small addition to BaseFormTemplate + fieldInput + integrity
check), or (ii) put each paragraph verbatim as the label of a required boolean. Recommend (i) —
paper form's paragraphs are not individually acknowledged; there's one signature block.

**c. CRP numbered lines — expressible today, no new field type required.** Model each
"minimum 3 / up to 4" question as four discrete `text` fields ("1.", "2.", "3." required,
"4." optional). Required-ness is per-field, exactly matching David's R/R/R/O markup, and the
integrity gate already understands `text`+`required`. A dedicated `numbered-list` type with
`min`/`max` would be tidier long-term but is strictly optional; recommend discrete fields to
keep the schema untouched. (~20 line fields across 6 list questions — verbose but mechanical.)

## 9. PDF twins — static shareable copy of every active form

**Requirement.** Every active form gets a static, shareable PDF twin: a blank template,
no PHI. Therapist-facing — a stable public URL staff can copy and text/email to a client.
Client-facing — a "Download PDF" fallback on each assigned form in the portal, for clients
who struggle with the e-form.

### 9a. Hosting — works with the existing config; no rewrite change needed

Verified: `public/` exists (`brand/`, `branding/`, `images/`, `index.css`, `sw.js`), Vite
uses it as the default `publicDir` (no override in [vite.config.ts](../../vite.config.ts)),
and `dist/` currently mirrors those exact entries — so `public/forms/*.pdf` ships to
`dist/forms/*.pdf` verbatim. [firebase.json](../../firebase.json) serves `"public": "dist"`.

The `"source": "**" → /index.html` rewrite **will not swallow the PDFs.** Firebase Hosting
resolves in a fixed order — reserved `/__/*`, then redirects, then **exact-match static
content**, then rewrites. A file that exists in `dist/` is served before any rewrite is
consulted; the catch-all only fires when nothing matched. **No hosting config change is
required.**

Two real traps that follow from that same ordering, both worth building against:
- **A missing or misspelled PDF returns HTTP 200 with `index.html`, not a 404.** The
  catch-all absorbs it, so a broken link renders the SPA shell and looks like a weird app
  bug rather than a missing file. Mitigation: a build-time check that every `pdfSlug` in
  the registry has a matching file in `public/forms/` (natural home:
  [scripts/formIntegrityCheck.tsx](../../scripts/formIntegrityCheck.tsx), which already
  gates form config), so the gate goes RED instead of shipping a silent 200.
- **Cache headers.** The `"source": "**"` header block applies `no-cache, must-revalidate`
  to everything, PDFs included. That is arguably *correct* here — a revised form should not
  serve stale from a client's cache — so no change is proposed. If PDF traffic ever
  justifies caching, add a `/forms/**` header block with a short max-age; do not widen the
  `/assets/**` immutable rule to cover them (the filenames are not content-hashed).

No service-worker risk: [public/sw.js](../../public/sw.js) is a deliberate kill-switch that
unregisters itself and deletes all caches — it does not intercept fetches. Its header
comment explicitly warns against reintroducing a caching worker without a versioned update
strategy; doing so later would need to exclude or version `/forms/*.pdf`.

### 9b. Registry as source of truth — two corrections to the proposed design

**Correction 1 — the type name.** `FormDefinition` is not in `config/formRegistry.ts`; it
lives in [types.ts:155](../../types.ts) and is the *render* contract (initialState,
validateStep, fieldDefinitions). The type in
[config/formRegistry.ts:17](../../config/formRegistry.ts) is **`FormRegistryEntry`** — the
catalog contract (id, title, category, audience, requiredForCompletion). The PDF pointer
belongs on **`FormRegistryEntry`**: it is catalog metadata, not render behavior, and the
registry is what §6 Phase 0 already extends with the `retired` flag.

**Correction 2 — a registry-only field does not reach the staff surface.** The two surfaces
read *different catalogs*:

| Surface | Reads | Count |
|---|---|---|
| Staff form library | `FORM_DEFINITION_BY_ID` ([components/FormLibrary.tsx:23-27](../../components/FormLibrary.tsx)) | 14 |
| Client portal | `CLIENT_REGISTRY_FORMS` ([pages/portal/PortalDocuments.tsx:14,22-28](../../pages/portal/PortalDocuments.tsx)) | 15-derived |

This is the known catalog divergence logged as **DEFERRED #36**, which warned about exactly
this failure mode for the admin/clinical split: *"That field alone would render nothing,
since FormLibrary.tsx … doesn't read FORM_REGISTRY at all."* The same warning applies
verbatim to `pdfSlug`.

*(Note: DEFERRED #36 is now partly stale on the mechanism — it describes FormLibrary's
`allForms` as a hardcoded 14-entry array, but as of the 2026-07-28 pass it derives from the
shared `FORM_DEFINITION_BY_ID` index. The conclusion still holds: it reads the definitions
index, not `FORM_REGISTRY`.)*

**Resolution — no catalog consolidation required.** Keep the registry as the single source
of truth and have the staff card resolve through it by id:

```ts
// config/formRegistry.ts — on FormRegistryEntry
/** Filename stem of the blank PDF twin in public/forms/. Presence = a PDF exists;
 *  unset = no PDF (retired forms, and any form whose revision hasn't shipped yet). */
pdfSlug?: string;
```

`FORM_REGISTRY_BY_ID[id]?.pdfSlug` is already exported
([formRegistry.ts:51](../../config/formRegistry.ts)), so the staff card needs a one-line
lookup — not a refactor of which catalog it iterates. Both surfaces then read one field in
one file, satisfying the source-of-truth requirement for real. Consolidating the catalogs
remains the right long-term fix (DEFERRED #36) but is **not** a prerequisite here.

`pdfSlug` over `pdfUrl`: the URL is derivable (`/forms/${pdfSlug}.pdf`), so a slug cannot
carry a wrong origin, a stale absolute link, or an off-site URL into either surface. Store
the stem, derive the href in one helper.

### 9c. The two UI surfaces — exact insertion points

**Staff — "Copy PDF link"**: [components/FormLibrary.tsx:104-118](../../components/FormLibrary.tsx),
the `FormCard` footer button row that currently holds **Start** and **Assign**. Add a third
action rendered only when `FORM_REGISTRY_BY_ID[form.id]?.pdfSlug` is set; it copies the
absolute URL (`window.location.origin + '/forms/' + pdfSlug + '.pdf'`) to the clipboard so
staff can paste it into a text or email. Secondary optional home:
[components/FormDetailModal.tsx](../../components/FormDetailModal.tsx), the Info-button
preview modal.

**Client — "Download PDF"**: [pages/portal/PortalDocuments.tsx](../../pages/portal/PortalDocuments.tsx),
the per-form action clusters at **lines 266-280** (required pending) and **305-319**
(optional pending) — each already pairs an icon-button (Upload paper copy) with the primary
**Start** button, so a download icon-button sits naturally beside it. This is the assigned-form
list, which is the surface a struggling client actually lands on.

⚠️ **Required plumbing detail:** `CLIENT_FORMS` at
[PortalDocuments.tsx:22-28](../../pages/portal/PortalDocuments.tsx) re-maps registry entries
down to `{id, name, category, description, required}` — it drops every other field. `pdfSlug`
must be added to that projection or the button will never render, with no error to explain why.

The download pairs well with the existing "Upload Paper Copy" flow already on those rows
(`submitPaperForm`): a client can download the blank PDF, fill it by hand, and upload the
result through the button immediately next to it — a complete paper round-trip.

### 9d. Proposed slugs — every ACTIVE form post-revision

Convention: **slug = registry id**, so the mapping is inspectable and cannot drift. (The
`-form.pdf` variant from the brief is honored where the id already ends in a noun that reads
oddly bare — noted below.) Retired forms are excluded by definition.

**Every PDF is generated from our own form definition via blank-template mode** — one
source, no exceptions (Dan 2026-08-01). See §9e.

| # | Registry id | Public URL |
|---|---|---|
| 1 | `consent-treatment` | `/forms/consent-treatment.pdf` |
| 2 | `hipaa-ack` | `/forms/hipaa-ack.pdf` |
| 3 | `authorization-release` | `/forms/authorization-release.pdf` |
| 4 | `telehealth-consent` | `/forms/telehealth-consent.pdf` |
| 5 | `satop-checklist` | `/forms/satop-checklist.pdf` |
| 6 | `emergency-contact` | `/forms/emergency-contact.pdf` |
| 7 | `recovery-plan` | `/forms/recovery-plan.pdf` |
| 8 | `meeting-report` | `/forms/meeting-report.pdf` |
| 9 | `telehealth-feedback` | `/forms/telehealth-feedback.pdf` |
| 10 | `late-cancellation` | `/forms/late-cancellation.pdf` |
| 11 | `satop-registration` *(new)* | `/forms/satop-registration-form.pdf` |
| 12 | `registration` *(new)* | `/forms/registration-form.pdf` |
| 13 | `treatment-plan` *(staff)* | `/forms/treatment-plan.pdf` — see note |
| 14 | `discharge-summary` *(staff)* | `/forms/discharge-summary.pdf` |

`satop-intake` is **excluded** — it is out of scope for this revision (§5), so it gets no
`pdfSlug` and no PDF.

Rows 11-12 use the `-form.pdf` suffix per the brief's example (`satop-registration-form.pdf`);
their registry ids stay `satop-registration` / `registration`. This is the one place slug ≠ id,
which is precisely why `pdfSlug` is an explicit field rather than derived from the id.

**`treatment-plan` note:** it exists in `FORM_REGISTRY` but has no `View` token, no route,
and no card — a staff member cannot reach it through any live UI (DEFERRED #36). A PDF twin
would be its only reachable artifact. Not a blocker; flagging that shipping one does not make
the e-form reachable.

### 9e. Sequencing rule and PDF sources

**Rule: the PDF ships in the same change as its form's revision, never before.** David's six
PDFs are *markups* — handwriting, strike-throughs, circled inserts — not masters. Publishing
any of them as the shareable twin would put an annotated draft in a client's hands. A form
whose revision has not landed simply has no `pdfSlug`, so neither button renders.

**Single source, decided (Dan 2026-08-01): every PDF is generated from our own form
definition via blank-template mode. There is no bucket (a) — we are not sourcing masters
from the client, for any form.** The revised e-form is the master; its blank print is the
PDF twin. This keeps the PDF and the e-form structurally identical by construction: they
are the same `fieldDefinitions`, so they cannot drift into saying different things, and a
later form revision regenerates its own PDF rather than needing a fresh document from ACS.

⚠️ **This makes blank-template mode load-bearing for all 14 PDFs, not a nice-to-have.**
[components/PrintPreview.tsx](../../components/PrintPreview.tsx) is the generator, but today
it renders a **filled** record and prints `'N/A'` for every empty value — a blank run would
produce a page of "N/A", not a fillable template. A blank mode (emit a rule/box for the
answer space instead of the value; keep `'static'` narrative fields as prose) is now a
**prerequisite for Phase 4 as a whole**, and must be built before the first PDF is
generated. Note gate 3 of `npm run check:forms` compares PrintPreview output byte-for-byte
against a checked-in baseline, so this change must be additive (a new mode, not an
alteration of the filled-record path) or that baseline needs an intentional, gated
regeneration.

Two consequences worth stating plainly:
- The PDFs will look like our app's print output, not like ACS's familiar paper forms. For
  `recovery-plan` and the two registration forms — where David's guidance was to follow the
  paper literally — fidelity now depends on how faithfully the *e-form* reproduces the paper
  layout, which is exactly what the Phase 3 rebuilds are for.
- Nothing is blocked on David. No document request is needed for the PDF work.

### 9f. Retired forms

`chart-checklist` and `session-attendance` get **no `pdfSlug`** — the field stays unset.
Nothing further is needed: both buttons are already gated on its presence, and both surfaces
filter retired entries out anyway (§6 Phase 0), so the gating is belt-and-braces. Confirmed:
no PDF file, no registry value, no special case. `satop-intake` is treated the same way for
a different reason — out of scope, not retired.

## 10. Gate 3 fixture coverage — largely closed, with named gaps remaining

**Logged 2026-08-01 (`72663c4`); mostly addressed the same day by `fd86135`. NOT closed
— see "still uncovered" below.**

`check:forms` gate 3 protects how a **committed clinical record** prints — the artifact
that reaches courts, probation officers, and DMH. It renders `PrintPreview` under a
frozen clock and pinned timezone, comparing byte-for-byte against checked-in baselines.

### Covered as of `fd86135` — 6 renders

| Fixture | Branches it pins |
|---|---|
| `printpreview-47431370` *(authorization-release)* | flat-dotted legacy keys + nested empties (the must-never-re-blank path); `text` / `tel` / `boolean` |
| `discharge-summary-conditional-visible` | `select` option→label, `checkbox-group` option→label join, `visibleWhen` **visible** branch |
| `discharge-summary-legacy-hidden-value` | `shouldPrintField`'s legacy rule — a stored value under a **hidden** conditional must still print |
| `telehealth-feedback-rating` | `rating` → `n/5`, spanning 1–5 |
| `consent-treatment-objectmap-staffsig` | `object` boolean-map → join-truthy; the **staff** signature block |
| `emergency-contact-witnesssig` | the **witness** signature block (distinct heading) |

Also fixed in that pass: the gate now pins `TZ=America/Chicago`, because the signature
block renders a *time* and therefore read the ambient zone — the first machine to
generate a baseline would otherwise have baked its own timezone into a committed file.
Verified green under ambient `TZ=UTC` and `TZ=Asia/Tokyo`.

**Correction to this item as originally written:** it listed "multi-section layouts
(`recovery-plan`, `satop-intake`)" as an uncovered branch. That was wrong.
`PrintPreview` has no section concept — it renders a flat `.map` over
`fieldDefinitions` plus a fixed header and signature block, and never reads
`FormDefinition.steps`. The gap was inferred from the form components without checking
the print path. There is nothing there to cover.

**Deliberately not fixtured:** `meeting-report` (its `meetingType` map goes through the
identical branch as consent's `groupDays`) and `satop-checklist` (its dotted ids are the
same branch as authorization-release's). A fixture exercising no new path is maintenance
cost with no coverage gain.

### Still uncovered — the item stays open

1. **Per-form output is not pinned for the nine unfixtured forms.** Branch coverage is
   now good; *form* coverage is not. A regression that drops or reorders a field in
   `recovery-plan`, `satop-intake`, `hipaa-ack`, `telehealth-consent`, `satop-checklist`,
   `late-cancellation`, `meeting-report`, `chart-checklist`, or `session-attendance`
   still ships green, because no baseline contains those documents' text. Closing this
   means one fixture per remaining form — cheap (the gate runs in ~1.5s) but nine more
   files to regenerate on every intentional render change. Worth doing before
   blank-template mode if that work touches shared layout rather than only adding a mode.

2. ~~**The frozen clock masks the two-timestamp defect below.**~~ **RESOLVED
   (`87a4e08`).** The defect is fixed and guarded by a `committedAt` fixture whose
   record date differs from the harness clock — the only construct that can tell a
   correct render from the buggy one. See §10a, now closed. Gate 3 covers **7** renders.

3. **The `object` non-boolean-map path** (a stored object whose values are not booleans)
   has no fixture. It appears unreachable from current definitions — no form declares an
   `object` field holding a non-boolean map — so this is noted for completeness rather
   than as a live risk.

### 10a. CLOSED — one render could print two different dates

**Reported 2026-08-01 during the fixture work (`3df6b4f`); FIXED the same day
(`87a4e08`). Closed, with a regression guard. Blast radius: zero documents.**

**Fix:** the signature block now derives from `recordDate` instead of calling
`new Date()`. The single resolution point already existed at line 46 — the bug was
a call site bypassing it — so the resolve-once approach *was* the minimal fix; no
refactor was required. `recordDate` now carries a comment stating it is the only
clock read in the component. This also removes the midnight-straddle variant.

**Recon result:** the whole print/record/export surface was swept on the assumption
there might be a third site. There isn't. `MeetingSummary.tsx:43` and
`pdfDocuments.ts:332,430` print `Generated: <now>` on documents that genuinely are
generated now; `cimorPacket.ts:86` formats a passed-in date and already says "no
`new Date()` of 'now'"; `pdfDocuments.ts:176` explicitly refuses a now-fallback so an
unrecorded completion date prints blank. The distinction is not *reads the clock* but
*presents the clock as a property of the record* — only the signature block did that.

**Regression guard:** `printpreview-consent-treatment-reprint-committedat`, a fixture
whose `committedAt` (2026-05-11) differs from the harness's frozen clock (2026-07-16),
asserting both stamps read 5/11/2026. This was necessary because **the frozen clock
masks the bug**: with no `committedAt`, the buggy and correct renders are byte-identical
— which is why the two existing signature-block baselines did *not* change when the fix
landed, contrary to what §10 predicted. Verified by reverting the fix: that fixture, and
only that fixture, goes red.

**Blast radius — no document is affected.** Reprints are **not audited**: `audit_logs`
contains no print, view, or export action, so a reprint count is *not knowable* from the
database. The exposure is instead bounded structurally: `form_submissions` holds 7 rows,
**all** with `status = 'Not Started'` and `submitted_at IS NULL`. No record has ever been
committed, and `SubmissionViewer` only reprints committed records — so there has never
been anything to reprint. No document carrying a false verification date exists, in a
client's hands or a court's.

Two caveats on that conclusion, stated rather than buried: it rests on the current
contents of the shared Supabase project (`ldzzlndsspkyohvzfiiu`) — a record committed and
reprinted *and then deleted* would leave no trace, and a document printed from a local
session that never persisted would likewise be invisible. Both are unlikely given zero
committed rows have ever existed, but neither is disprovable from the data.

**The audit gap this exposed is addressed in code (`11b8b73`)** — `form.printed` writes
at the `printRecord()` chokepoint, fire-and-forget, carrying `client_id`, `form_id`,
`form_name`, `committed_at` and `reprint: true`. What it still cannot tell you is
recorded as §10b. **⚠️ But it is NOT yet confirmed working in production — see §10c: a
live test on 2026-08-01 produced zero audit rows from two prints.** Do not treat reprint
provenance as answerable until §10c is resolved.

**Live confirmation of the §10a fix itself is PENDING, and the 2026-08-01 attempt did not
exercise it at all.** Two separate reasons, both now understood:

1. **The signature block never rendered.** The witness signature was left blank on the
   test submission, and that block is gated on `staffSignature || witnessSignature` being
   truthy — so `SYSTEM TIMESTAMPED`, the line the fix changes, **was not printed**. The
   test could not have confirmed or refuted anything.
2. **Same-day reprint cannot distinguish fixed from buggy** even when the block does
   render: `committedAt` and `new Date()` are both today, so both versions emit identical
   dates — the same masking that made the `committedAt` fixture necessary.

The record (Bela Lugosi, `emergency-contact`,
`725cc235-afa5-455c-ac47-61f6b2dcaebb`) was committed 2026-08-01 23:15 UTC. Backdating
`submitted_at` was explicitly declined — the record is not to be mutated.

**The live check therefore requires BOTH conditions: a reprint on 2026-08-02 or later,
AND a witness or staff signature filled in** so the block renders. Either alone proves
nothing.

**Until then the `committedAt` fixture is the authoritative proof.**
`printpreview-consent-treatment-reprint-committedat` pins a record date (2026-05-11)
distinct from the harness clock (2026-07-16) and asserts both stamps read the record
date; reverting the fix turns that fixture, and only that fixture, red. That is a
stronger guarantee than a single manual reprint would give, and it runs on every
`check:forms`. The pending live check adds production confirmation, not correctness
evidence.

---

<details>
<summary>Original report, retained for the record</summary>

**Reported 2026-08-01 during the fixture work. Not fixed; no code changed.**

[PrintPreview.tsx](../../components/PrintPreview.tsx) reads the clock **twice**, and the
two reads do not agree:

- Line 46 — `const recordDate = committedAt ? new Date(committedAt) : new Date();`
  The header (line 60, `COMMITTED RECORD:`) honours `committedAt`.
- Line 99 — `SYSTEM TIMESTAMPED: {new Date().toLocaleString()}`
  The signature block **ignores `committedAt` entirely** and always stamps *now*.

`committedAt` is supplied on the reprint path by
[SubmissionViewer.tsx:142](../../components/forms/SubmissionViewer.tsx). So reprinting a
record committed 2026-06-14, on 2026-08-01, produces one document reading:

```
COMMITTED RECORD: 6/14/2026          ← correct, the actual commit date
SYSTEM TIMESTAMPED: 8/1/2026, …      ← today, printed beside the staff signature
```

**Failure mode.** The restamped date sits directly under the "Staff Verification" /
"Witness Acknowledgment" heading, where it reads as *when the signature was witnessed*.
A reprint therefore asserts that a staff member verified the record on a date they did
not — on a document that goes to a court or a probation officer. The internally
inconsistent pair is also exactly what an auditor would flag.

This is the same defect `83f4826` fixed for the header; its own comment says *"a reprint
must not restamp today as the commit date."* The fix was applied to `recordDate` and line
99 was left reading the clock directly — the fix is half-applied, not absent.

A lesser variant exists on the live-commit path (no `committedAt`): lines 46 and 99 are
two separate reads, so a render straddling midnight prints two different dates. Rare, but
the same class.

**Shape of the fix (not done here):** have line 99 derive from `recordDate` rather than
call `new Date()`. Note this changes rendered output, so it will turn gate 3 red by
design — the two signature-block baselines must be regenerated in the same commit, with
the justification recorded. **Adding a fixture that passes `committedAt`** would make the
defect visible in a baseline today; that was deliberately not done, since it would pin
the wrong behaviour into a checked-in file.

*(Correction on that last paragraph, recorded after the fix: the prediction that the two
signature-block baselines would go red was **wrong**. Without `committedAt` the frozen
clock makes the buggy and correct renders byte-identical, so they did not change at all.
The `committedAt` fixture was not merely a nice-to-have — it is the only construct that
can distinguish the two, and therefore the only possible regression guard.)*

</details>

### 10b. DEFERRED — three things `form.printed` cannot record

**Logged 2026-08-01 alongside the `form.printed` build (`11b8b73`). Not defects in that
work — limits of it.** Written down now so that "is the print log complete?" has an
honest answer on file rather than an optimistic one produced under pressure.

**1. It cannot record WHICH VERSION of a form was printed.** There is no version concept
anywhere in the system — not on `FormDefinition` (types.ts), not on `FormRegistryEntry`
(config/formRegistry.ts), not in the database. So a print of the Consent for Treatment
logs *that* form, not the revision of it that was on the paper. Once the Phase 1–3 form
revisions land, two prints months apart can show materially different documents under an
identical audit row.

This is the **same gap** `docs/design/manifest-reconciliation-pattern.md` flags as version
pinning: *"a form printed six months ago is v3, not v7. Reconciliation must accept the
historical version and record which one was signed."* It should be resolved **as part of
versioning**, not bolted onto the audit payload — a `form_version` field invented to
satisfy a log column would be a number with no authority behind it, which is worse than
its absence. When versioning exists, `form.printed` gains the field for free.

**2. Browser-native Ctrl+P is unloggable.** It never reaches `printRecord()`. It does not
currently produce the record layout — the `print-record-only` body class is only applied
by `printRecord()`, so Ctrl+P prints the surrounding page — but it is a real path that
puts a rendering on paper without an audit row.

**3. The in-session pre-commit print is unloggable.** `BaseFormTemplate` renders
`PrintPreview` inside a `hidden print:block` div with no button and no chokepoint. There
is no submission id at that point — the record has not been committed — so there is
nothing to attribute an event to. It is a draft, not a record, which is why this is a
limit rather than a defect.

**No client-side instrumentation can close (2) or (3).** Both are browser-initiated or
pre-persistence. Closing them would need either a server-rendered print path (the print
request becomes an auditable server event) or accepting that the ledger covers
*application-initiated prints of committed records* and saying exactly that when asked.
The second is the honest, cheap position and is what the system claims today.


### 10c. RESOLVED — `form.printed` wrote nothing in production (stale bundle)

**Found 2026-08-01, resolved 2026-08-02. Root cause: a stale loaded SPA bundle — not a
code defect.** Hypothesis 1 confirmed: after a hard reload (Ctrl+Shift+R), a print from
the Client Forms tab wrote the expected row immediately:

```
id          8c45c261-32f7-41a6-b542-e1f550d3cb3f
user_id     cbb1da1e-9043-43bd-ab31-31132b898d20      populated, staff actor
entity_id   725cc235-afa5-455c-ac47-61f6b2dcaebb      correct submission
details     { form_id: "emergency-contact", client_id: "43f6a849-…",
              form_name: "Emergency Contact", reprint: true,
              committed_at: "Sat Aug 01 2026 18:15:02 GMT-0500 (Central Daylight Time)" }
created_at  2026-08-02 00:16:43.644+00
```

`user_id`, `entity_id`, and four of five `details` keys are exactly as intended. Two
notes below.

**⚠️ THIS WILL RECUR ON EVERY DEPLOY, and nothing currently prevents it.** A tab opened
before a deploy keeps running the old JS forever: `index.html` is `no-cache` but a
*loaded* SPA never re-fetches it, asset filenames are content-hashed so the old chunks
stay valid, and `public/sw.js` is a deliberate kill-switch (it unregisters and clears
caches — it does not check for new versions). There is **no** version check, no update
banner, no forced reload. The practical consequence is not limited to audit: any user
with a tab open across a deploy is running old code with no signal, and the first
symptom here was a *silently missing compliance record*. Worth a version-check + "a new
version is available, reload" prompt before ACS is doing real work in long-lived tabs.

**`details.ip_address` is null on every row, and cannot be filled client-side.**
`logAudit` never sets it, and there is no way for browser JavaScript to learn its own
public IP — the only client-side route is calling a third-party echo service, which would
leak the fact of a Part 2 record access to an outside party to populate an audit field.
That is not a trade worth making. Postgres `inet_client_addr()` is no help either: it
returns PostgREST's address, not the end user's. **The one viable path is server-side** —
a column default or trigger reading
`current_setting('request.headers', true)::json->>'x-forwarded-for'`, which PostgREST
populates. Not built. Recorded as a **known limitation** so the null column is explained
rather than looking like an oversight when an auditor asks.

**⚠️ `details.committed_at` was stored in the wrong format — FIXED in `62a5709`.**
Cause: `ClientFormsTab` passed `String(submission.submittedAt)` where `submittedAt` is a
`Date`, yielding the locale/timezone-bearing human string; `ClientSubmissionsPanel`
passed Supabase's raw ISO string. Two formats in one append-only column, neither sortable
against the other.

Normalisation now happens **at the `printRecord` chokepoint, not at the call sites**, so a
third caller cannot reintroduce the split; unparseable input stores `null` rather than a
garbage string.

**⚠️ THE ONE ROW ALREADY WRITTEN CANNOT BE CORRECTED** — `audit_logs` has no UPDATE
policy and no UPDATE grant, by design. Stated explicitly so a future reader is not
confused: audit row `8c45c261-32f7-41a6-b542-e1f550d3cb3f` holds
`committed_at = "Sat Aug 01 2026 18:15:02 GMT-0500 (Central Daylight Time)"`. That is the
**only** row in this format; every row written after `62a5709` is ISO 8601. It is not a
second live format and nothing should be built to parse it.

**Still unverified live: the `ClientSubmissionsPanel` call site.** It has never produced
a row — the only successful print came from `ClientFormsTab`. Its instrumentation is
identical in shape, but "identical in shape" is what was believed about both sites
before the first test returned zero.

<details>
<summary>Original report, retained for the record</summary>

**Found 2026-08-01 by live test. Not diagnosed to root cause; NOT fixed in this pass.**

**What happened.** Emergency Contact was committed on Bela Lugosi
(`725cc235-afa5-455c-ac47-61f6b2dcaebb`) and then printed **twice** — once from the
Client Forms tab (`ClientFormsTab`) and once from the Client Submissions panel
(`ClientSubmissionsPanel`). Expected two `form.printed` rows. **`audit_logs` contains
zero.** No rows at all in the surrounding six hours.

**What is ruled out.**

| Hypothesis | Status |
|---|---|
| The commit failed | ❌ ruled out — row is `status='Completed'`, `submitted_at=2026-08-01 23:15:02Z` |
| The fix wasn't deployed | ❌ ruled out — `form.printed` is present in the **live** bundle `assets/SubmissionViewer-CopFI558.js`, fetched and grepped from production |
| One call site is uninstrumented | ❌ ruled out as the explanation — *both* produced nothing, so the cause is common to both, not per-site |

**Remaining candidates, none yet confirmed.** All three fail silently, which is the
design (`logAudit` swallows every error), and none leaves a trace to query:

1. **Stale loaded bundle — most likely.** The app is a SPA. A tab opened *before* the
   deploy keeps running the old chunk and never re-fetches `index.html`, so the old
   uninstrumented `printRecord` would execute. This fits the evidence exactly: both
   sites silent, code verifiably live. **Discriminating test: hard-reload
   (Ctrl+Shift+R), print again, re-query.** Cheapest first move.
2. **`currentActorId()` returned null** → the `if (!actor) return` guard skips the write
   entirely. Happens when `supabase.auth.getUser()` has no resolvable session.
3. **RLS rejected the insert.** The policy is
   `audit_logs_insert_staff: private.is_staff() AND user_id = auth.uid()`. A signed-in
   user without the staff role in app_metadata is rejected, and `logAudit` console.errors
   it without surfacing anything.

**The deeper problem this exposes, independent of which cause it turns out to be.**
Fire-and-forget was chosen so an audit outage could never withhold a record from a
clinician — that reasoning still holds. But it means **a permanently broken audit path
is indistinguishable from an audit path that is simply never exercised**: both produce an
empty table. The compliance value of `form.printed` depends entirely on it actually
writing, and nothing currently reports that it isn't. Fixing the immediate cause is not
sufficient; this needs a way to know the path works — a startup self-check, a visible
console warning on failure, or a periodic "prints logged vs prints expected"
reconciliation. Worth deciding when 10c is fixed, not later.

**Consequence:** §10a's audit-gap closure is provisional. Print provenance is NOT yet
answerable in production.

</details>

### 10d. OPEN — no guard covers print CSS, fonts, or pagination

**Logged 2026-08-02 after garbled output was found on a live printed PDF (§10e).**

Gate 3's fixtures compare `renderToStaticMarkup` output — an **HTML string**. That is a
genuinely strong guard for *what content is emitted*, and it caught a real 290-char
regression. But it is structurally blind to everything that happens after HTML:

| Not covered | Why the fixtures cannot see it |
|---|---|
| `@media print` rules (`public/index.css`) | No CSS is ever applied; the fixture is unstyled markup |
| Font loading, embedding, substitution | No font engine, no rasterization |
| Pagination / page breaks / `@page` margins | No layout engine; the fixture has no pages |
| Print isolation (`print-record-only` toggling `#root` vs `#record-print-root`) | Depends on a runtime class toggle and CSS, neither of which exists in a string render |
| Anything in the browser's print pipeline | Out of process entirely |
| **The bytes of any referenced asset** | The baselines pin `src="/branding/acs-logomark.svg"` — the *path*. Restyle, recolour, or replace that SVG and every fixture stays byte-identical while the printed record changes |

That last row is the same blindness class as the pink glyph, arrived at from the other
direction: §10e-2 showed a graphic appearing where the HTML said none should be; this
says a graphic could *change* while the HTML swears nothing did. It is not theoretical —
the 2026-08-02 brand snap (`beb8e86`) altered the app's entire red on the reasoning that
the logomark was already correct. Had that pass concluded the opposite and restyled the
asset instead, the printed record's letterhead would have changed colour with all seven
fixtures green and no gate raising a hand.

**So a defect that makes a court-bound document unreadable can ship with every gate
green** — which is exactly what happened in §10e. This is not a gap in the fixtures'
execution; it is the boundary of the technique.

**§10e-2 is the live example, and it is worth being precise about why.** A stray graphic
reached a printed court-bound record while `tsc`, all four `check:forms` gates, and seven
byte-exact print fixtures were green — and every one of them was *correct*. The HTML the
fixtures pin is genuinely unchanged; the defect lives entirely in what happens to that
HTML afterwards. No amount of strengthening the existing gates would have caught it,
which is the argument for the different instrument described above rather than more
fixtures.

Closing it needs a different instrument: a headless-Chrome print-to-PDF of a known
record, compared against a reference (text extraction for content, or a rasterized
image diff for layout). That is a real piece of infrastructure — a browser in CI — and
should be scoped deliberately rather than bolted on. Until it exists, **print output is
verified by a human looking at a PDF, and that fact should be stated rather than
assumed.**

### 10d-i. The gap class: "form lacks the field AND lacks a value"

**Logged 2026-08-02 after a defect reached a printed clinical record with every gate
green.** Worth naming precisely, because neither condition alone was visible — it was
the *combination*.

`PrintPreview` draws Client Name and Client Email in a **fixed header outside the
fieldDefinitions loop**. Nine of the fourteen forms never declared a `clientEmail`
field, so every one of their committed records printed **"CLIENT EMAIL / N/A"** — on
documents that reach courts and probation officers. Removing the field from
authorization-release (`5535f0c`, at David's instruction) did not and could not fix
it, because the header never read the definition in the first place.

**Why no gate saw it.** Every existing fixture masked the condition, each for a
different reason:

| Fixture | Why it couldn't show the defect |
|---|---|
| consent-treatment, satop-checklist, telehealth-feedback | their forms *declare* clientEmail — value present, row correct |
| authorization-release (`47431370`) | form no longer declares it, but the legacy row *has* a stored email — row correct |
| discharge-summary ×2, emergency-contact | forms don't declare it, but the fixture data I authored *supplied* one anyway — row correct |

So the defect needed a fixture whose form lacked the field **and** whose data lacked a
value. That combination existed in exactly one place, and only from `b9ae218` —
`recovery-plan`, built for entirely unrelated reasons (David's numbered lines). **The
defect was caught by accident.** Had that fixture not been built last commit, the
`N/A` row would have shipped.

**The generalisable point:** fixture data authored by the same person who authored the
form tends to be *complete* — every field populated, because that is the natural way to
write an example. Complete data cannot exercise absent-value paths. A fixture set can
have good breadth across forms and still be systematically blind to what a *sparse*
record prints. Worth deliberately including under-filled rows, not just representative
ones.

Fixed in `bb08a4c` (render the email row only when a value is present; Client Name
stays unconditional by deliberate asymmetry — see §11 and the comment at the render
site). Coverage raised from 8 fixtures to 11 in `68f6898`.

### 10d-ii. Sparse-vs-complete is a coverage dimension, independent of form count

**Established 2026-08-02 by building one deliberately sparse fixture (`196bd81`).**

Fixture coverage was being counted in one dimension — *how many forms are pinned*. That
number can rise indefinitely without buying any coverage of what an **incompletely
filled** record prints, because fixture data authored alongside a form is naturally
**complete**: populating every field is the natural way to write an example. Twelve
fully-populated fixtures across ten forms had **zero** coverage of absent-value paths.

The two dimensions are independent:

| | Complete data | Sparse data |
|---|---|---|
| **Pins** | every row populated; labels, values, ordering | N/A rows, omitted rows, absent blocks, hidden-and-empty conditionals |
| **Blind to** | anything that only appears when a value is missing | nothing about how a full record reads |

**Adding more fully-populated fixtures does not move the second column.** That is not a
theory — it is what happened twice:

1. The `CLIENT EMAIL / N/A` header defect (§10d-i) shipped to printed clinical records
   with every gate green. Eight fixtures existed. None was sparse in the one place that
   mattered, and it was caught by accident.
2. Building the first deliberately sparse fixture immediately exposed **two more**
   defects that twelve complete fixtures had not: each CRP question printing four times
   (`02a2993` — a fixture built one phase earlier had pinned that output without anyone
   noticing, including the author) and counselor signatures rendering as plain text
   rows (`950d357`).

**The practical rule: a form's coverage is not "has a fixture" but "has a fixture at
each end of its fill spectrum"** — at minimum for forms with many optional fields.
`recovery-plan` (13 of 44 optional) now has both; every other form has only the
complete end.

**Order matters when a sparse fixture finds something.** Both defects above were fixed
*before* the sparse baseline was committed. A fixture that pins bad output is worse than
no fixture: it converts a defect into an expectation, and the next person to see the
output assumes it was intended. Establish the render is *correct*, then pin it.

### 10e. Printed-output findings — one operational, one still open

**Reported 2026-08-02 from a live print; PDF analysed by Dan. The two symptoms turned
out to have different causes, and only one is ours.**

#### 10e-1. RESOLVED (not a code defect) — the "mojibake" is a print-driver artifact

Both pages **rasterise visually clean at 200 DPI**. Nothing is garbled on the page. The
garbling appears only under *text extraction*, because the PDF was produced through the
**Adobe PDF printer driver**, not Chrome's built-in Save-as-PDF:

```
pdffonts : T1, T2 — Type 3, Custom encoding, emb=yes, uni=NO
Creator  : PScript5.dll Version 5.2.2
Producer : Acrobat Distiller 26.0 (Windows)
```

PScript5 re-encodes fonts as Type 3 with **no ToUnicode CMap**, so there is no
extractable text layer. The app's print CSS is fine and no code change is warranted.

**But it is a real operational limitation, not a non-issue.** A PDF produced this way is
**not searchable, not copyable, and invisible to assistive technology**. For an archive
of court-bound records that matters: a document that cannot be searched or read by a
screen reader is materially worse as a record, even though it looks correct on paper.

**Staff guidance: print via Chrome's built-in "Save as PDF" destination, not "Adobe
PDF".** ⚠️ **We cannot enforce this from the application.** The print destination is
chosen in the browser's own dialog, entirely outside the page's control — there is no
API to require, detect, or even observe which driver was used. This is documentation and
training, not something a future change can close. Worth stating plainly to ACS rather
than leaving as tribal knowledge.

#### 10e-2. CLOSED — the stray pink glyph was leaked app chrome

**Identified 2026-08-02. Fixed by `62a5709`, which had already shipped for other
reasons. What changed was the EVIDENCE, not the code.**

**Page 2 was never part of the record.** The image count settles it. The printed PDF
carries **one** image on page 1 and **three** on page 2. `PrintPreview` references
exactly one image (the logomark) — consistent with page 1 being the record. The
application shell carries exactly **three** persistent images:

1. `/branding/acs-logo.svg` — sidebar (`AcsTherapyHubLogo`)
2. `/branding/clara.png` — header (`CLARA_AVATAR_URL`)
3. the `ui-avatars.com` PNG — header user avatar

Three for three. The Emergency Contact record fit on **one** page; page 2 was the app
UI, and the pink glyph is one lucide icon inside it.

**Mechanism:** page 1 rasterised while `print-record-only` was applied, then
`printRecord`'s `finally` removed the class mid-capture, `#root` became visible, and
the remaining page rasterised as app chrome. That is precisely the race `62a5709`
fixed by holding the class until `afterprint`.

**The fix was correctly NOT credited when it shipped**, and that distinction is worth
preserving. At the time, the honest position was "this is a real race worth fixing on
its own merits, but it is NOT confirmed as the cause of the glyph" — and the leading
hypothesis was actively argued against, on the reasoning that a reappearing `#root`
should have produced far more than a single icon. That reasoning was sound and the
conclusion was still wrong: the record was one page, so the leak had only one page of
chrome to show. **The code did not change between "unconfirmed" and "closed"; only the
evidence did.** Claiming the fix at the time would have been right by luck, and would
have taught the next reader that a plausible mechanism is proof.

**Two corrections of record.** The glyph was first identified as the ACS logomark on
the reasoning that `#C62828` was the document's only colour source — wrong; it is
`#FEB3B3`. The driver explanation was then over-weighted after `10e-1` proved PScript5
was mangling fonts — also wrong; that was a real artifact, but a different one.

**Not claimed:** the specific icon is unnamed. The page was identified, not the glyph.
Naming it needs the PDF's image extraction and does not change the remedy — removing
page 2 removes the glyph. **Verification: reprint on the live build; page 2 should be
absent entirely.**

<details>
<summary>Original report, retained for the record</summary>

#### 10e-2 (original). OPEN — the stray pink glyph

Confirmed at high resolution: a small pink/red icon glyph in the **left margin beside the
DATE label on page 2**. No icon belongs in the record layout.

**What it almost certainly IS — identified.** The ACS logomark. It is the *only* source
of colour in the entire printed document:

- `PrintPreview` references exactly one image, `/branding/acs-logomark.svg`
  ([PrintPreview.tsx:69](../../components/PrintPreview.tsx)).
- That asset contains `fill="#C62828"` — a strong red that reads as pink at small size —
  alongside `fill="#2B2B2B"`.
- The print stylesheet forces `color: #000 !important` on `body *`
  ([index.css:77-83](../../public/index.css)) — but **`color` does not override an SVG's
  `fill` attribute**. So the logomark's red is the one colour that survives into print,
  which is exactly why the stray element is pink while every glyph on the page is black.

**Why a copy lands beside DATE on page 2 is NOT established.** Two mechanisms remain, and
the evidence does not separate them:

1. **Print-isolation race (fixed in `62a5709`, but unconfirmed as the cause).**
   `printRecord()` released `print-record-only` in a `finally` immediately after
   `window.print()`, which can return before rasterisation completes on the
   Save-as-PDF path. `#root` would become visible mid-capture and app chrome — which
   uses this same logomark — could land on the page. **Argument against:** if `#root`
   had reappeared we would expect substantially more app content than a single icon.
2. **The same Adobe PScript5 pipeline implicated in 10e-1.** It demonstrably mangles
   font encoding; image placement is handled by the same driver, and an SVG
   rasterised/positioned incorrectly by it would produce precisely this — one stray
   graphic, correct content everywhere else.

**The race was fixed regardless**, because it is a genuine defect on its own merits
(details in `62a5709`, including the `afterprint` failsafe and the bounded risk if
`afterprint` never fires). **That fix is NOT claimed to close 10e-2.**

**Discriminating test, not yet run:** reprint the same record through **Chrome's Save as
PDF** rather than the Adobe driver. If the glyph disappears, cause (2) — a driver
artifact, closable only by the same staff guidance as 10e-1. If it persists on the fixed
build, cause (1) is refuted too and the layout needs direct inspection under print
emulation.

</details>

### 10f. A value gate and a reachability gate are different things

**Logged 2026-08-02 after the same failure shape landed twice.**

Both incidents share a structure worth naming, because on this host **a missing static
asset does not fail loudly — it fails by looking fine.** `firebase.json` rewrites `**`
to `/index.html` and Firebase consults rewrites only when no static file matched, so a
file that was never deployed answers **HTTP 200 with the SPA shell**, not a 404.

| Incident | The value was correct | …but |
|---|---|---|
| PDF twins (§9a, gate 4) | `pdfSlug` named the right file | a typo'd or missing PDF served the app instead — anticipated in advance, which is why gate 4 exists |
| `manifest.json` (`832da5c`) | `theme_color` was `#C62828`, asserted green by `check:brand` | the file sat at the repo root, was never copied into `dist/`, and had **never been served at all** |

The second one is the sharper lesson: **a gate was diligently verifying a literal inside
a file no browser ever fetched.** Value correctness and reachability are independent
properties, and asserting the first says nothing about the second. `check:brand` now has
two modes — values + source placement before the build, real `dist/` presence after it.

**The generalisable rule: for anything served as a static asset, assert that it SHIPS,
not merely that its contents are right.** The corollary is that this cannot be checked
before the build, so any such gate needs a post-build step — which is why the deploy
chain is now six stages rather than five.

Worth applying next to: the `/branding/*` assets (referenced by `PrintPreview`,
`PortalLayout`, `MobileDrawer` and others — a missing logomark would print a broken
image and no gate would see it) and `public/sw.js`.

## 11. Decisions taken, and what's still open

### Decided — Dan, 2026-08-01 (not open; do not re-raise)

| # | Decision |
|---|---|
| D1 | **Chart Review: soft-retire.** No "Client Status Report" form is created. |
| D2 | **SATOP Client Intake: out of scope entirely** — untouched, not retired, no PDF. |
| D3 | **HIPAA final text:** "I acknowledge that I have received or been advised of ACS's HIPAA Notice of Privacy Practices." (date clause struck). |
| D4 | **Consent ¶5 final text:** "…client will be discharged and/or may be recommended to the next higher treatment level." |
| D5 | **Base forms auto-assign on client creation**, keyed off `clients.client_type` — SATOP → SATOP Registration Form, OP → Registration Form. |
| D6 | **All PDFs are generated from our own form definitions via blank-template mode.** No bucket (a); no masters sourced from the client. |

### Still open — for Dan

1. *(Q4)* Registration Form "ADD HERE" circle: confirm the two legal-requirement questions insert at the HIPAA-received line, and whether that line itself is struck (redundant with the standalone HIPAA form?).
2. *(Q6)* Registration Form: Race optional (mark reads as O) — confirm.
3. CRP relapse-steps list carried no R/O marks — mirror the R×3+O pattern of the other lists?
4. HIPAA printout p.2 and Orientation Checklist pp.2–3 weren't scanned — any annotations there?
5. Approve the `'static'` display-only field type for the Consent narratives (§8b). *(Soft-retire is settled by D1.)*
6. ~~**Deploy gating for `check:forms`.**~~ **RESOLVED 2026-08-01.** The gate-3 drift was
   diagnosed as a stale baseline and fixed (`72663c4`), then `check:forms` was wired into
   `scripts/deploy.mjs` (`d849be3`). The chain is now lint → check:forms → build → deploy,
   negative-tested against the real command: a bogus `pdfSlug` aborts the deploy before the
   build runs and before firebase is invoked. **Newly open in its place: the fixture
   coverage gap, §10.**

### Questions raised BY the Phase 1 build (2026-08-02) — send to David together

Every one of these is a place the build made a choice a human should confirm. None
blocked delivery; all are cheap to reverse.

**D-a. Consent ¶5 — two typos transcribed verbatim.** ACS's paper reads "for a long
as I remain in treatment" (for *as* long) and "These is a fee for the screen" (*There*
is). Both were transcribed exactly rather than corrected: this is the operative
wording of an agreement clients sign, so fixing it is ACS's call. Say the word and
they are two string edits.

**D-b. CRP relapse-steps R/O — a decision, not a reading.** Its four lines carry NO
marks on the scan while its question is marked R; the six preceding lists are all
R·R·R·O. Dan chose to mirror R·R·R·O (pattern established). David should see that this
was chosen, not read off the paper. One `required` flag per line to reverse.

**D-c. Orientation Checklist — placement of the fee acknowledgement.** His circled
"Add:" sits in the margin beside "Program rules"/"All my questions were answered" and
is not tied to a line. Placed after "Program rules and expectations explained". The
order of an acknowledgement list is a signing sequence, so it should be confirmed
rather than inferred from where the pen landed.

**D-d. Orientation Checklist — pages 2–3 were never scanned.** The package contains
page 1 of a 3-page printout. Any markup on the other two pages is unseen.

**D-e. HIPAA — the validation message was left alone.** The acknowledgement now reads
"…received or been advised of…", but the on-failure message still says "You must
acknowledge receipt of the Notice." That text is operator-facing and never part of the
signed record, so it was not changed unasked. Harmonise?

**D-f. Consent ¶1 — group day/time fields are optional.** The paper shows them as
blanks to fill. They remain `required: false` because making them mandatory was not
part of the instruction. Should a client be able to sign the agreement without
recording their group schedule?

**D-g. ~~PrintPreview's fixed header prints "CLIENT EMAIL / N/A"~~ — RESOLVED
2026-08-02 (`bb08a4c`), no input needed.** David said delete the field and it still
printed; that is a defect, not a question. The email row now renders only when a value
is present. Client Name deliberately stays unconditional. Gap class recorded as §10d-i.

**D-i. Every signature prints TWICE on the committed record.** Once as an ordinary
field row from `fieldDefinitions`, and again in the attestation block — verified on
telehealth-consent ("Staff signature: Fixture QMHP" *and* "Staff Verification") and on
hipaa-ack for the client side. Pre-existing, systemic, and affects both the client and
counter signatures on essentially every form. Fixing it means skipping signature fields
in the print loop, which moves ~12 baselines and is a print-layout decision rather than
a defect fix — so it was reported, not changed, during 1c.

**D-j. Four field names mean "counter-signature".** `staffSignature`,
`counselorSignature`, `therapistSignature`, `witnessSignature` across seven forms. The
rendering asymmetry this caused is fixed (`950d357`), but consolidating the ids is a
data-shape change touching every definition, its type, and every committed row. Worth
doing deliberately rather than at the next place it bites.

**D-h. Meeting type prints raw storage keys on the committed record.** The Support
Group Meeting Report shows `aa, discussion, bigBook, open` where it should read
`AA, Discussion, Big Book, Open`. Cause: `meetingType` uses the legacy `object` field
type, and PrintPreview's option→label mapping covers only `select` and
`checkbox-group`. Pre-existing and unrelated to David's revisions, so not changed
during Phase 1 — but it is machine tokens on a document going to courts and POs, and
worth his call on whether to fix now or with the wider label work.

### Still open — for David

1. SATOP Registration "all fields mandatory": does that include SSN and Driver's License # (sensitive; everything else on the sheet is plainly mandatory)?
2. Display name check: we currently show the meeting report as "AA/NA Group Meeting Report" in some surfaces and "Support Group Meeting Report" in others — which name should stand?

*No document request goes to David — per D6, every PDF is generated from our own form
definitions.*
