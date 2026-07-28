# ACS TherapyHub — New Client Walk-Through

**Test script · 28 July 2026 · for David Yoder and staff**

This walks one imaginary new client — **Derek** — from first contact all the way to his own
portal login. Every step below is a real screen in the live system.

**Before you start:** you'll need two browser windows, or one normal and one private/incognito.
One is Derek (the client), the other is you (staff). That keeps the two logins from fighting
each other.

Fill in the last column as you go. If something doesn't match, write down exactly what you saw —
"looked wrong" is harder to chase than "the phone number came out blank."

Site: **https://acs-therapyhub.web.app**

---

## Part 1 — Derek gets in touch (Derek's window)

| # | Do this | You should see | What actually happened |
|---|---|---|---|
| 1 | Go to **/intake** | A page headed **"Start your intake"** | |
| 2 | Enter full name **Derek Salinas** | Name accepted | |
| 3 | Enter a phone number you can recognise later, e.g. **(314) 555-0177** | Phone accepted | |
| 4 | Enter an email you control (or make one up, e.g. `derek.test@example.com`) | Email accepted | |
| 5 | Under **"What brings you here?"** type: *Court-referred for SATOP* | Text accepted | |
| 6 | Submit the form | A confirmation that his request is in | |

> Note: name and phone are required; email is optional. Try submitting with the name blank to
> confirm it stops you — that's worth knowing.

---

## Part 2 — Derek shows up in your queue (your window)

| # | Do this | You should see | What actually happened |
|---|---|---|---|
| 7 | Log in as yourself and land on the **Dashboard** | The dashboard loads | |
| 8 | Find the **Intake Queue** panel | Derek Salinas listed as a new intake | |
| 9 | Check the count on the panel title | It includes Derek | |
| 10 | Click Derek's name | His client workspace opens | |
| 11 | Check the details carried across | Name, phone, and what he wrote all match Part 1 | |

---

## Part 3 — You place Derek into a program (your window)

| # | Do this | You should see | What actually happened |
|---|---|---|---|
| 12 | In Derek's workspace, open the **Assessment** tab | The assessment/placement screen | |
| 13 | Work through the placement and record the determination | A determination you can sign | |
| 14 | Sign the determination as the clinician | It's recorded with your name and the date | |
| 15 | Use **Place & Activate** to convert him from an enquiry to an active client | Derek becomes an active client | |
| 16 | Go to **Clients** and search for Derek | He now appears in the active client list | |

> This is the step that turns an enquiry into a real client record. If anything is going to
> snag, it will most likely snag here — note carefully what you clicked.

---

## Part 4 — You send Derek his forms (your window)

| # | Do this | You should see | What actually happened |
|---|---|---|---|
| 17 | In Derek's workspace, open the **Forms** tab | His forms list (empty to start) | |
| 18 | Assign **Consent for Treatment** | It appears as assigned / not started | |
| 19 | Assign **HIPAA Notice Acknowledgement** | Same | |
| 20 | Assign **Emergency Contact** | Same | |

> **Important:** the system does **not** email or text Derek. Nothing is sent automatically.
> You would ring him or hand him the link yourself. This is expected, not a fault — worth
> feeling how that lands in practice, because it's on the list to fix.

---

## Part 5 — Derek fills his forms in (Derek's window)

| # | Do this | You should see | What actually happened |
|---|---|---|---|
| 21 | Log in to the client portal at **/portal/login** as Derek | His portal dashboard | |
| 22 | Open **Document Vault** (**/portal/documents**) | The three forms you assigned, all pending | |
| 23 | Open **Consent for Treatment** and complete it | Fields accept input | |
| 24 | Where it asks for a signature, **type his full name** | It accepts typed text | |
| 25 | Submit | A confirmation, and the form shows as complete | |
| 26 | Complete **Emergency Contact** the same way | Marked complete | |
| 27 | Check the "X of Y complete" counter | It goes up | |
| 28 | Leave **HIPAA** unfinished on purpose | It stays pending | |

> On signatures: today the system accepts a **typed name**, not a drawn one. Drawn, handwritten
> signatures are the next piece of work — this is exactly the gap you flagged on the 21st.

---

## Part 6 — You see his progress (your window)

| # | Do this | You should see | What actually happened |
|---|---|---|---|
| 29 | Reopen Derek's **Forms** tab | Two complete, HIPAA still outstanding | |
| 30 | Open the **Overview** tab | His status reflects the two completed forms | |
| 31 | Book Derek an appointment from **Schedule** | The appointment appears on the calendar | |
| 32 | Reopen his workspace | The appointment shows on his record | |

---

## Part 7 — Worth trying if you have time

| # | Do this | You should see | What actually happened |
|---|---|---|---|
| 33 | From Derek's record, request a document from him | A link you can copy and send by hand | |
| 34 | Open that link in Derek's window and upload any file | It uploads | |
| 35 | Back in your window, check it arrived on his record | The file is listed | |
| 36 | Look at **Compliance Readiness** in the main menu | Honest status, including anything not yet verifiable | |

---

## When you're done

Three questions are more useful to me than a bug list:

1. **Where did you hesitate?** Any point where you weren't sure what to click.
2. **What did you expect to happen that didn't?** Especially anything you assumed was automatic.
3. **What would you have done differently on paper?** Where the software is making you work in an
   order that isn't how the practice actually runs.

Anything that looked plainly broken, note the step number and what you saw on screen.
