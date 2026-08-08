# Questions for David — Tuesday 2026-08-11

Open questions that need David's answer before work can proceed. Started 2026-08-07 (no
consolidated list existed before this; earlier one-off questions are still inline in
`docs/DAVID-AUG5-MAP.md` and `ACS-TherapyHub-MAP.md`).

All three below come from the D5 treatment-plan scope
([SCOPE-D5-problem-identity-2026-08-07.md](SCOPE-D5-problem-identity-2026-08-07.md)).
Answers gate the largest remaining item on his Aug-5 list.

---

## D5-Q1 — Group notes and treatment-plan problems

**Ask:** When you write one group note, should each client in the group get their own
"problems addressed" selection, or do group notes stay without problems (as they are today)?

**Why it matters:** A group note fans out to N clients, and each of those clients has a
*different* treatment plan with different problems. Per-seat selection means the group note
modal has to show a separate problem picker for every attendee.

**What it costs us:** This is the single question that moves the estimate. Group notes stay
problem-less → **M**. Per-seat selection → **L**.

**Ground truth, if he asks:** `GroupNoteModal` has no problems field at all today, and
`submitGroupSession` writes no `problems_addressed` on any seat. Live: 41 of 53 clinical notes
are group notes; **0** of them carry a problem. Only 8 notes total have anything in that field.

---

## D5-Q2 — Which problems appear in the picker

**Ask:** When a clinician picks the problem they worked on, should the list show only the
problems on the client's *current* plan, or every problem the plan has ever had — including
ones dropped in a later update?

**Why it matters:** Plan updates are versioned; a problem can be retired. If the picker shows
only current problems, a note written about a problem the plan has since dropped can't be
recorded against it. If it shows all of them, the list grows over time with retired items.

---

## D5-Q3 — Confirm the free-text field stays

**Ask:** Confirming: when we add the pick-from-your-plan list, we keep the existing typed field
alongside it — right? Your markup said "problem number(s) **or a full sentence**."

**Why it matters:** We don't want to remove something you asked for on an inference. It's also
the only thing that works for a client with no treatment plan on file — which today is every
client (`treatment_plans` is empty in production).
