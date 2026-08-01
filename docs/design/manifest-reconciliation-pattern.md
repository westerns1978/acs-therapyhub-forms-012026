# The manifest pattern: generate first, reconcile on return

**Status:** design note, cross-product
**Origin:** SoftMed (acquired by 3M) medical records reconciliation, healthcare
**Captured:** 2026-08-01
**Applies to:** ACS TherapyHub, FlowVault, FlowView, FieldFlow/Katie, FlowHub

---

## The pattern in one paragraph

If you generate the documents up front, you know what is supposed to come back.
The returning stack stops being an unknown pile to classify and becomes a known
list to reconcile. Indexing collapses to matching. Page counts become
assertions. And — the part that matters most — **you gain the ability to detect
absence**, which no classifier can do.

## Prior art

SoftMed built this for hospital medical records. Patient forms were generated at
admission, so by the time the chart hit medical records post-discharge the system
already knew which forms belonged to it and how many pages each should be.
Indexing effort dropped sharply because the chart was *expecting* a specific
document set of a specific length. Deviation from the manifest was the signal.

## Why it beats classification

Classification is an open-set problem: given an arbitrary page, what is it?
Reconciliation is a closed-set problem: given a page and a list of ten expected
documents, which one is it? The second is dramatically easier, degrades
gracefully, and is auditable.

But the decisive difference is structural, not accuracy:

| | Classifier | Manifest |
|---|---|---|
| Document arrives | Identifies it | Matches it to an expectation |
| Document arrives partial | Usually silent | Page count mismatch → flagged |
| Document arrives wrong version | Usually silent | Version mismatch → flagged |
| **Document never arrives** | **Structurally invisible** | **Flagged** |

A classifier can only tell you about documents that showed up. It cannot tell
you the consent form never came back. For any compliance regime, absence is the
exposure — a missing consent is not a filing problem, it is a finding.

## The three fields

The whole pattern hangs off a small amount of metadata, declared at generation
time and carried on the artifact:

1. **Identity** — which document, which version, which record it belongs to.
   Carried on the page itself (QR/barcode) so it survives the paper round trip.
   Payload is identity and routing only, ~60 bytes. Never the content.
2. **Expected page count** — per document version. Turns a partial return into a
   detectable event.
3. **Expected document set** — per record, per record type. The manifest proper.
   Turns a missing document into a detectable event.

Signing note: identity/routing on paper is safe. The moment a code encodes a
*command*, the page becomes an auth token and anyone with a photocopier can
invoke it. Sign the payload, whitelist the verb, single-use nonce with expiry.

## Per-product application

### ACS TherapyHub — nearest term, already half-built

The manifest already exists: it is the form assignment table. Assigning the base
registration form on client creation (SATOP → SATOP Registration, OP →
Registration) is the declaration of what that chart should contain.

- Add `expectedPages` to `FormRegistryEntry`, alongside `pdfSlug`. One more
  optional field on a type already being modified.
- Generated PDFs carry a QR: `{form_id, version, assignment_id, nonce, sig}`.
- Scanned return routes to the exact assignment with no keying, and asserts page
  count.
- Chart completeness becomes a diff against assignments, not a review task.

Positioning value: every competitor pitching David is solving document *arrival*.
None are solving *absence*. For a Missouri DMH / 42 CFR Part 2 audit, absence is
the whole risk surface.

### FlowVault — death-care document taxonomy

The 15-label FTC-grounded taxonomy is a classifier. The manifest is the
complement: a case type declares its required document set (contract,
authorization, disposition permit, death certificate, etc.). A case is not
"processed," it is *complete* or it is short by name.

- Case type → required document set.
- Generated forms carry case identity, so returns self-file.
- Dashboard shifts from "documents received" to "documents outstanding."

### FieldFlow / Katie — the manifest is the equipment, not a form

Same reconciliation logic, different noun. A QR/asset tag on a machine encoding
model + serial means a tech never keys a model number, and Katie retrieves the
correct manual chunks and error-code set for *that* device without disambiguation.

- Service call declares expected artifacts (work order, parts used, meter reads).
- Incomplete call is detectable at close, not at invoicing.

### Story Scribe — the manifest is a life, not a form

The least obvious application and possibly the most valuable, because the failure
mode Story Scribe cannot currently see is exactly the one the manifest catches.

A tribute is assembled from whatever the family happens to upload. The system
knows what it received. It does not know what it is missing — and in a memoir,
the gap is the thing that matters. A life story with no photographs between 1960
and 1980 has a twenty-year hole in it, and nobody notices until the family
watches the finished piece.

The obituary is the manifest. It already names the eras, the relationships, the
service, the workplaces, the places lived. Parse it into an expected-source set
and Story Scribe can reconcile against it:

- Decades named in the obituary with no photo or document covering them.
- People named (spouse, children, siblings) who appear in no uploaded image.
- Military service, marriage, or immigration mentioned with no corresponding
  record — each of which is a specific, findable FamilySearch lookup.
- Interview topics raised but never returned to.

This turns Connie from a collector into an active gap-filler. Instead of
"upload anything else you'd like to include," she can ask for the specific
missing thing: *"You mentioned he served in Korea — do you have anything from
those years?"* That is a materially better prompt, and it comes directly from
diffing the obituary manifest against what has actually arrived.

It also gives the family a completeness view that is honest rather than
flattering: not "12 items uploaded" but "the 1970s are thin."

Same three fields, different nouns: identity (which tribute, which era, which
person), expected count (how many sources per decade is enough), expected set
(what the obituary declared exists).

Note the ordering difference from the other products: ACS and FlowVault declare
the manifest at generation time. Story Scribe *derives* it from an inbound
document. That is an extraction problem rather than a declaration problem, and
it will be imperfect — so the derived manifest should be editable by the curator,
never treated as authoritative on its own.

### FlowView — the reporting surface

If the other products declare manifests, FlowView is where "what is outstanding"
gets rendered. Nothing to build until the upstream manifests exist, but the
reporting model should assume expectation-vs-actual, not just actual.

### FlowHub / scanning infrastructure

This is where the pattern gets teeth at capture time:

- Patch/separator sheets are the ancient version of the same idea; every capture
  platform supports them.
- The scanner is the right place to catch a page-count shortfall — while the
  paper is still in the operator's hand, not after it is filed.
- TWAIN/eSCL path already exists; the addition is a decode step and a manifest
  lookup between capture and commit.

## Density note (why payload never goes on the page)

Kept for reference, so nobody re-litigates it:

- QR version 40, ECC L: 2,953 bytes per code.
- ~6–12 scannable codes on a letter page at 300 DPI → roughly 20–35 KB.
- 600 DPI pushes into low hundreds of KB. Purpose-built formats (Twibright Optar)
  claim ~200 KB per A4. Xerox PARC DataGlyphs hid kilobytes inside halftone.
- Prior art for paper that *executes*: Cauzin Softstrip (1985), Nintendo
  e-Reader Dot Code, PDF417 on licenses and boarding passes.

None of this matters if the code only carries identity. Sixty bytes fits in a
code small enough to print in a form header at any DPI. Density is a problem you
avoid rather than solve.

## Open design questions

- Where does `expectedDocumentSet` live per product — registry config, DB table,
  or derived from assignment rows?
- Does page-count assertion happen at scan time (FlowHub bridge) or at commit
  time (server)? Scan time gives the better operator experience; commit time is
  the enforceable one. Probably both.
- Version pinning: a form printed six months ago is v3, not v7. Reconciliation
  must accept the historical version and record which one was signed.
- What is the failure UX when reconciliation flags a shortfall? Blocking vs
  advisory almost certainly differs by product (blocking for ACS compliance,
  advisory for FieldFlow).
