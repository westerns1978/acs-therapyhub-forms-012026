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

## 10. DEFERRED — gate 3's fixture covers one form out of fourteen

**Not built. Logged 2026-08-01 while fixing the stale baseline (`72663c4`).**

`check:forms` gate 3 is the guard that protects how a **committed clinical record**
prints — the artifact that reaches courts, probation officers, and DMH. It works by
rendering `PrintPreview` under a frozen clock and comparing byte-for-byte against
`scripts/fixtures/printpreview-47431370.baseline.html`.

**What it covers today:** exactly one render — `authorization-release`, row
`47431370`. That fixture was chosen well: it is a mixed-shape legacy row (flat dotted
keys carrying data alongside nested empties), so it exercises the path-resolution
behaviour that must never re-blank. It genuinely caught the 7/28 drift.

**What it does not cover:** the other thirteen forms, and every field type absent from
that one row. `authorization-release` is `text` / `tel` / `boolean` only. Nothing in
the gate exercises:

| Uncovered | Where it lives | Why it matters |
|---|---|---|
| `object` boolean-maps | `meeting-report.meetingType` | `PrintField` has a dedicated branch (joins truthy keys); a regression prints nothing or `[object Object]` |
| `checkbox-group` + `select` option-label mapping | consent, discharge-summary | Prints human labels, not machine tokens — the 2026-07-16 fix |
| `rating` (`n/5`) | `telehealth-feedback` | Its own `PrintField` branch |
| `visibleWhen` / `shouldPrintField` | `discharge-summary` | The legacy-value print rule — the one place paper is allowed to disagree with a new record |
| Multi-section layouts | `recovery-plan`, `satop-intake` | Section grouping, not just field rows |

A regression in any of those ships green. That is a real hole, and it widens as soon as
blank-template mode lands, because that work adds a **second** render path through the
same component — the exact change this gate exists to police, aimed mostly at forms it
cannot see.

**Two shapes of fix:**

1. **More fixtures — one row per archetype.** Add ~4 baselines chosen by field-type
   coverage rather than by form: an `object` map (`meeting-report`), an options-mapped
   form (`consent-treatment` or `discharge-summary`), a `rating` form
   (`telehealth-feedback`), and a conditional-visibility form (`discharge-summary`
   again, for `shouldPrintField`). Same mechanism, no new machinery — the regeneration
   path added in `72663c4` already generalises.
2. **Broad render sweep.** Render all 14 definitions against synthetic data and assert
   invariants (no `[object Object]`, no `undefined`, every required field label present)
   rather than byte-equality.

**Recommendation: (1), and not (2).** Byte-equality is what makes this gate honest —
it caught a 290-char delta that no invariant assertion would have flagged, since the
output stayed perfectly well-formed. A sweep trades that precision for breadth and
would have been green through the entire 7/28 drift. Option 1 keeps byte-equality and
buys coverage by picking rows for what they exercise, and it costs four fixtures plus
a loop, not a new test framework. Option 2 is worth revisiting only if fixture
maintenance becomes the bottleneck.

**Sequencing:** do this *before* blank-template mode, not after. Adding a second render
path while the guard sees one-fourteenth of the surface is the wrong order — the
fixtures are cheap now and become regression triage later.

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

### Still open — for David

1. SATOP Registration "all fields mandatory": does that include SSN and Driver's License # (sensitive; everything else on the sheet is plainly mandatory)?
2. Display name check: we currently show the meeting report as "AA/NA Group Meeting Report" in some surfaces and "Support Group Meeting Report" in others — which name should stand?

*No document request goes to David — per D6, every PDF is generated from our own form
definitions.*
