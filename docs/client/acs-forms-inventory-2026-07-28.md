# ACS TherapyHub — Forms Inventory

**Prepared 28 July 2026 · for David Yoder**

This is every form the system knows about today, what it does, and whether anyone has actually
used it. Counts are pulled from the live system, not estimated.

A note on how to read the "Used so far" column: the current records are demo and test clients, so
the numbers tell you which forms have been *exercised*, not how busy the practice is.

---

## The forms that are built and working

All fourteen of these are real, digitized forms — a person fills in actual fields on screen and
the answers are saved to the client's record.

A ★ marks the six forms the system currently requires before it will produce a completion
certificate. Those six are the ones worth deciding about most carefully.

| Form | Required for certificate | Who fills it in | Used so far |
|---|---|---|---|
| **Consent for Treatment** | ★ | Client (staff can fill on their behalf) | 13 — the most-used form in the system |
| **Authorization for Release of Information** | ★ | Client | 9 (5 finished, 4 sent but not yet started) |
| **Emergency Contact** | ★ | Client | 7 |
| **SATOP Client Intake** | | Client | 5 |
| **Telehealth Informed Consent** | ★ | Client | 5 |
| **HIPAA Notice Acknowledgement** | ★ | Client | 4 |
| **Continuing Recovery Plan** | | Client | 3 (1 finished, 2 part-way) |
| **Orientation Checklist** | ★ | Client | 2 |
| **Late Cancellation Policy** | | Client | 2 |
| **Chart Review** | | Staff only | 1 |
| **Clinical Discharge Summary** | | Staff only | **Never used** |
| **Session Attendance** | | Staff only | **Never used** |
| **Support Group Meeting Report** | | Client | **Never used** |
| **Telehealth Experience Feedback** | | Client | **Never used** |

### About those six

Until all six are complete for a client, the system will not issue their completion certificate.
If a different set is the right one, changing it is small — but worth deciding deliberately,
because this is the list the certificate actually depends on.

---

## Things I want to flag before you sort these

### 1. One form on the menu was never actually built

**"Individual Comprehensive Treatment Plan"** appears in the system's list of assignable forms —
staff can pick it and send it to a client — but **the form itself does not exist**. There is no
screen behind it. If a client or staff member clicks "Fill Out", nothing happens; they land back
on the forms list with no error message.

There is also **one record in the system marked "Completed"** for this form, for a test client. It
is left exactly as-is so you can see it rather than take my word for it. Nobody filled that form
in, because there is nothing to fill in — it came from the original demo data.

This matters more than it sounds: the record currently shows on that client's own portal as a
completed treatment plan.

**Decision needed:** build this form, or remove it from the menu.

### 2. Two records exist for forms that aren't in the system at all

There are two completed records — **"Gambling Recovery Intake"** and **"Opioid Recovery
Intake"** — that don't correspond to any form the software has. They're leftovers from early demo
data. They look like real completed intake forms on those clients' records.

**Decision needed:** are these two forms you actually want built? If yes, they go on the build
list. If no, the two stray records should be cleared out.

### 3. Four built forms have never been used once

Clinical Discharge Summary, Session Attendance, Support Group Meeting Report, and Telehealth
Experience Feedback are all fully built and working — they have simply never been opened. That is
either because they're not needed, or because nobody knows they're there.

**Decision needed:** keep, retire, or start using.

### 4. Two forms are named one thing in the menu and another when you open them

- The menu says *"AA/NA Group Meeting Report"*; the form itself is titled **"Support Group Meeting Report"**.
- The menu says *"Telehealth Session Feedback"*; the form itself is titled **"Telehealth Experience Feedback"**.

Harmless, but it will cause confusion when you're matching this list against what your staff see
on screen. Tell me which name is right for each and I'll make them agree.

---

## What I'd suggest as your three buckets

You mentioned sorting these. Based on what's actually here:

- **Keep as-is** — the nine client-facing forms that are in regular use, plus Chart Review.
- **Decide** — the four never-used forms, the two naming mismatches, and the two orphan records.
- **Build** — the treatment plan, and any of the paper forms not yet represented here.

---

*Counts verified against the live system on 28 July 2026. Fourteen forms built and working; one
listed but not built; two records belonging to no form.*
