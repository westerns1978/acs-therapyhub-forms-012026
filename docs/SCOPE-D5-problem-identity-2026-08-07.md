# D5 — Treatment-plan problem identity: migration scope

**2026-08-07. Report only — no code, no migration, no deploy.**
Witnessed against live Supabase `ldzzlndsspkyohvzfiiu` (read-only SQL) and local `main` @ `d7689a4`.

---

## The one fact that changes the whole cost

**`public.treatment_plans` is EMPTY in production. 0 rows. 0 clients. 0 versions.**

```
total_plans  with_content  with_problems  total_problem_rows  versioned  clients
     0            0              0              (null)            0         0
```

And the other candidate home for plan problems is empty too — `form_submissions` has 21 rows
across 9 form ids, and **zero** of them carry a `data.problems` array (the `ClientOverviewTab`
"Treatment Plan" summary card at `ClientOverviewTab.tsx:203` renders nothing today, for anyone).

So the "would existing plans migrate cleanly or need hand-repair?" question has no teeth:
**there is nothing to migrate.** This is a greenfield schema change, not a data migration. That
is the single largest cost driver on David's list and it currently rounds to zero — but it is a
*perishable* fact. The moment David's staff author their first plan, this becomes a real
backfill with real clinical content in it.

> **Recommendation: this is the cheapest it will ever be. Do it before the plan tab gets used.**

Disambiguation, so nobody re-derives it: `RecoveryPlanData.problems1..4` (`types.ts:219`) is the
*Continuing Recovery Plan* form — client-authored paper questions, not treatment-plan problems.
Out of scope entirely.

---

## What a "problem" is today

`treatment_plans.content` is one JSONB blob:

```jsonc
{ "problems": [ { "title": "...", "goals": ["..."], "interventions": [ {"description": "...", "frequency": "..."} ] } ] }
```

A problem has **no database identity** — no id, nothing a foreign key could point at. The editor
mutates the array positionally (`CustomizeTreatmentPlanModal.tsx:142,148` — patch by index,
remove by `filter((_, i) => i !== idx)`), so not even array position survives an edit.

**The live defect this causes, concretely.** `TreatmentPlanTab.tsx:290-293` renders each problem
as `#{idx + 1} · {problem.title}`. That displayed number *is* the array index. The note field
David asked for — "Problem number(s) or a full sentence" (`SmartNoteImporter.tsx:311`) — is a
bare `<input type="text">` where the clinician retypes that number from memory. Delete problem
#2 from the plan and every prior note that says "addressed #3" now silently points at a
different problem. Nothing in the app detects it. That is the actual clinical risk in D5, and
it's worth putting to David in exactly those terms — it's more persuasive than "no FK exists."

Also: `SmartNoteImporter.tsx` **never reads the client's treatment plan at all**. There is no
picker to build on; the clinician gets no list. And the group-note path
(`submitGroupSession`, `api.ts:929-948`) writes no `problems_addressed` at all — 41 of the 53
live notes are group notes and **0** of them carry problems. 8 of 53 notes total have any value
in `problems_addressed`.

---

## Option A — normalize into a child table

```sql
create table treatment_plan_problems (
  id uuid primary key default gen_random_uuid(),
  treatment_plan_id uuid not null references treatment_plans(id) on delete cascade,
  lineage_id uuid not null,          -- stable ACROSS versions (see the versioning trap below)
  position int not null,
  title text not null,
  goals jsonb not null default '[]',
  interventions jsonb not null default '[]'
);
```

**Cost.** One migration + a backfill that is currently a no-op. Rewrites 4 call sites:
`api.ts` (mapper `:2705`, `saveTreatmentPlan`, `applyTreatmentPlanUpdate`),
`CustomizeTreatmentPlanModal.tsx`, `TreatmentPlanTab.tsx`, and `ClientOverviewTab.tsx`'s
separate card. The plan write stops being one atomic `insert` and becomes a parent+children
write — which today has **no transaction wrapper**, so it needs an RPC or accepts a partial-write
failure mode. That is the real hidden cost of Option A, and it's the same class of problem
`submitGroupSession` already has.

**What breaks.** Nothing reads `content.problems` outside those 4 files. `complianceEngine.ts`
touches `treatment_plans` only for `created_at` + the two signature columns
(`fetchClientPlan:383`, `fetchAllPlans:397`) — the 90/180-day plan-review clock is untouched.
`greenRoom.ts:100` only asks "does a row exist." `TreatmentPlanLibrary.tsx` reads the static
TypeScript templates, not the DB. So the blast radius is genuinely small.

**Buys you.** Real FKs, a join table for the multi-problem case David's "problem number(s)"
plural implies, per-problem queries ("show every note that addressed this problem"), and
per-problem status/progress later without another migration.

## Option B — stamp a UUID into each JSON object

Add `id` to each element of `content.problems[]` at write time; backfill existing rows with
`jsonb_set` (currently: zero rows).

**Cost.** Materially smaller — no new table, no transaction problem, the write path stays one
atomic `insert`, `TreatmentPlanContent` gains one field, the editor generates an id on "add
problem" and preserves it on edit. Maybe a third of Option A.

**What breaks.** Nothing structural. Every existing reader keeps working; the id is additive.

**What it doesn't buy.** No FK — `clinical_notes.treatment_plan_problem_id` would be an
unenforced uuid pointing into a JSON blob. No "notes for this problem" query without a
`jsonb_array_elements` scan. Referential integrity becomes a convention the app has to keep,
which is exactly the posture that produced `appointments.client_id` being TEXT with no FK
(SECURITY_BACKLOG #7) — a wart this repo is still paying for.

**My read:** Option A. Not because B is wrong, but because the argument *for* B is "it's
cheaper," and the thing that makes A expensive — the backfill — costs nothing today and will
cost real money in three months. Take A while it's free.

---

## The note → objective link, once problems have ids

David's ask is the TherapyNotes pattern: pick the problem you worked on, don't retype a number.
Shape:

1. **Reference table**, not a column — his "problem number(**s**)" is plural:
   `clinical_note_problems(clinical_note_id, problem_lineage_id)`. A column would force a
   rewrite the first time a clinician addresses two problems in one session.
2. **Keep `problems_addressed` (text) alongside.** David's own spec says "or a full sentence,"
   and 8 live notes already use it. The structured link is *additive*; the free-text field stays
   for the no-plan-on-file case and for prose. Never migrate one into the other.
3. **`SmartNoteImporter` must learn to read the plan** — it currently has zero references to the
   treatment-plan API. This is the largest single UI piece of the whole item: fetch the client's
   active plan, render its problems as checkboxes, fall back to the free-text input when the
   client has no plan (which today is *every* client).
4. **The group-note path needs a decision from David.** `GroupNoteModal` has no problems field,
   and a group note fans out to N clients with N *different* treatment plans. Either group notes
   stay problem-less (status quo, honest), or each seat needs its own problem selection — which
   is a materially bigger UI. **This is a question for David, not a thing to guess.**

---

## Does this also give us versioning? No — and there's a trap

**Versioning is already shipped** (`20260728_l5_treatment_plan_updates.sql`, map item #25). All
six of David's requirements are met: clinician name, immutable prior version, update date,
progress comments, add/remove problem-goal-intervention, both signatures. The two items are
**independent** — problem identity buys no versioning, and versioning is not waiting on it.

**But they collide, and this is the part worth reading twice.**

Today an "update" is a new `treatment_plans` row that deep-copies the whole `content` blob
(`applyTreatmentPlanUpdate`, `api.ts:2788-2812`); the prior row is byte-for-byte untouched. That
copy is what makes history immutable, and it's clean *precisely because* problems have no
identity.

Give problems ids and you get a fork in the road:

- **Per-version ids** — each version's problems get fresh ids. History stays immutable, but a
  note linked to v1's "Problem A" does **not** link to v2's "Problem A", so "every note that
  addressed this problem" breaks at every plan update. Useless for David's actual question.
- **Lineage id** — a `lineage_id` that is copied forward across versions, alongside a
  per-version row id. Notes link to the **lineage**, not the version. History stays immutable,
  the query works across updates.

**Lineage is the right answer, and it is nearly free if you do it in the same migration and
nearly impossible to retrofit afterward** — retrofitting means inventing lineage across plan
versions that were already written and signed. Whichever of A or B is chosen, the id must be a
lineage id from day one. This is the single most important design call in D5.

Corollary: `applyTreatmentPlanUpdate` must copy problem rows forward preserving `lineage_id`,
and the editor must not regenerate ids on an unchanged problem.

---

## Effort

Scale from the Aug-5 map (XS <2h · S ≈ half-day · M 1–3 days · L ≥ a week).

| Piece | Option A | Option B |
|---|---|---|
| Schema + migration (+ no-op backfill) | S | XS |
| Plan write path (incl. transaction/RPC for A) | M | XS |
| Editor + tab + overview card rewrite | S | XS |
| `clinical_note_problems` join table | XS | XS |
| `SmartNoteImporter` reads the plan, picker UI | **M** | **M** |
| Lineage-preserving version copy | S | XS |
| **Total** | **M–L** (~4–6 days) | **M** (~2–3 days) |

The `SmartNoteImporter` picker is `M` either way — it is the same UI regardless of where the id
lives, and it's the piece David will actually *see*. Most of the A-vs-B delta is plumbing he
won't.

---

## Open questions for David

1. **Group notes and problems** — problem-less (status quo) or per-seat problem selection?
   Drives whether the UI piece is `M` or `L`.
2. **Does the picker show only the active plan's problems, or the whole lineage** (including
   problems dropped in a later version)? Affects a note written about a problem the plan has
   since retired.
3. Confirm the free-text `problems_addressed` field **stays** alongside the picker — his own
   markup said "number(s) **or a full sentence**," and I'd rather not remove something he asked
   for on an inference.

## Corrections to prior recon

- `docs/IA-RECON.md:214` says `treatment_plans` RLS is "wide-open (`USING (true)`)". **Stale.**
  Live policies are `staff_all_treatment_plans` (`private.is_clinician()`) and
  `client_self_read_treatment_plans` (`client_id IN private.my_client_ids()`).
- The same section's cost framing assumed existing plans to migrate. There are none.
