
# ACS TherapyHub

**ACS TherapyHub** is a custom-built operations dashboard for Assessment & Counseling Solutions (ACS), a St. Louis-based provider of SATOP, CSTAR, and SROP services. This web application is designed to streamline operations, help clinicians work toward compliance with Missouri Department of Mental Health (DMH) regulations, and enhance both therapist efficiency and client engagement.

Built with AI Studio, this platform integrates AI for clinical insights to support court-mandated treatment programs.

---

> ## ⚠️ Security & Compliance Status (as of 2026-06-02)
>
> **This is a trial/demo build running on mock data. It is NOT HIPAA / 42 CFR Part 2 compliant and must not be used with real client PHI.** The items below are **planned / not yet implemented**:
>
> - **Data encryption** — no application-level encryption; uploaded documents are stored at **public** Supabase Storage URLs.
> - **Secure, server-enforced access control** — role checks are client-side only; the Supabase anon key ships in the browser bundle; Row-Level Security is permissive or disabled on the clinical tables. Authentication is currently a client-side `sessionStorage` stub (no real Supabase Auth session).
> - **Audit logging** — the `audit_logs` table exists but is never written to.
> - **iVALT biometric MFA** — the edge-function handshake works, but a successful check does **not** establish a server-side authenticated session.
>
> See `GAP_ANALYSIS.md` for the full, evidence-backed assessment.

---

## Features

- **DMH-Aligned Staff Dashboard**: Manage client caseloads, schedules, and compliance documentation in an intuitive interface.
- **AI-Powered Assessments**: Utilize AI to summarize ASAM multidimensional assessments and predict client relapse risk.
- **Document Management**: AI-driven document analysis with *simulated* `AuthentiCapture` signatures and `ScanBot` OCR. ⚠️ Secure, access-controlled document storage is **planned / not yet implemented** — uploaded files are currently written to public Storage URLs (see Security & Compliance Status above).
- **Visual Progress Tracking**: Clients and therapists can easily monitor progress through programs like the 75-hour SROP with a clean, visual progress bar and gamification elements.
- **DMV & Interlock Coordination**: Keep track of license reinstatement requirements and ignition interlock device compliance.
- **Automated Reporting & Handoffs**: Generate mock DMH compliance reports and export client data to CSV for seamless workflows.
- **Integrated Communications**: Simulated integration with Slack for real-time notifications and Zoom for telehealth sessions.
- **Smart Note Studio**: A multimodal tool for therapists to create clinical notes via Dictation, File Upload (handwritten note scanning), or Manual Entry, powered by Gemini AI for SOAP formatting.
- **Clara (Clinical Agent)**: A voice-enabled AI assistant capable of navigating the app and performing tasks (scheduling, creating notes) hands-free.

## Tech Stack

- **Frontend**: React 18+, TypeScript, Tailwind CSS
- **Routing**: React Router
- **State Management**: React Context API
- **AI Integration**: Google Gemini API — `gemini-2.5-flash` and `gemini-2.5-flash-lite` for clinical and document analysis (note: `gemini-3-pro` is **not** used anywhere in the code), plus the Gemini Live API (`gemini-2.5-flash-native-audio-preview-12-2025`) for the Clara voice assistant.
- **Backend**: Supabase (PostgreSQL) for data persistence and Storage.
- **Security**: ⚠️ Trial/demo posture only — see **Security & Compliance Status** above. P3ID is mocked; iVALT biometric MFA performs a real edge-function handshake but does **not** yet establish an authenticated server-side session (login state is held client-side).

---

## Demo Guide & Logins

### Login Credentials

Use the "Quick Login" buttons on the login page for convenience, or enter credentials manually.

-   **Admin Role (Practice Owner):**
    -   **Email:** `david.yoder@therapyhub.com`
-   **Clinical Role (Therapist):**
    -   **Email:** `dr.anya@therapyhub.com`
-   **Client Portal Login**:
    -   **Email**: Any email
    -   **Password**: Any password
    -   *Note: The client portal is a prototype and will always display data for the mock client, Alice Johnson.*

### Demo Script: Admin Role (David Yoder)

**Goal:** Showcase high-level oversight, financial health, and operational control.

1.  **Login as Admin.**
2.  **Navigate to Reporting:** Explain the revenue and compliance trend charts as tools for strategic oversight.
3.  **Navigate to Compliance:** Walk through staff certification tracking and the one-click "Bulk Export" feature as time-savers. *(Note: the audit-trail view displays demo data only — audit logging is **not yet implemented**.)*
4.  **Navigate to Forms Management:** Show how the practice can manage and standardize its clinical document templates.
5.  **Navigate to Settings:** Explain the concept of integrating with external tools like Google Calendar to centralize operations.

### Demo Script: Clinical Role (Dr. Anya Sharma)

**Goal:** Showcase workflow efficiency, AI assistance, and enhanced client care.

1.  **Login as Clinical.**
2.  **AI Daily Briefing:** When the modal appears, explain how the AI summarizes the day and flags at-risk clients. Click on a client name (e.g., Bob Williams) to navigate directly to their file.
3.  **Agentic Interaction:** Open **Clara** (bottom right). Use voice to say "Open Smart Note Studio".
4.  **Smart Note Studio:**
    -   Show the **Dictate** tab. Speak a few sentences about a session.
    -   Click **Generate Note**. Show how Gemini formats it into a perfect SOAP note.
    -   Click **Save**. Explain how this writes directly to the backend.
5.  **Live Session Simulation:** Navigate to the **Active Session** page for a client. Describe the simulated real-time transcript with AI-tagged insights.
6.  **Automated Wrap-Up:** Click **End Session & Finalize** and walk through the guided modal (signature, billing, scheduling, tasks), highlighting the streamlined workflow.

### Demo Script: The Client Experience

**Goal:** Showcase clarity, empowerment, and simplified program management for the client.

1.  **Login via the Client Portal** (`/portal/login`).
2.  **Portal Dashboard:** Start on the main dashboard. Point out the clear, welcoming interface and the high-level progress summary card. Explain that this is the client's central hub.
3.  **My Compliance:** Navigate to the "My Compliance" page.
    -   Highlight the **visual SROP progress bar**, explaining how it gives clients a clear, tangible sense of accomplishment.
    -   Show the **Gamification & Achievements** card, pointing out the earned points and badges which help with motivation.
4.  **Appointments:** Navigate to the "Appointments" page. Show the clean list of upcoming sessions and the easy-to-find "Join Session" button.

---

## DMH Alignment Notes (9 CSR 30-3)

This application is designed with key Missouri DMH regulations in mind:

-   **ASAM Criteria**: The "Assessments" module is built around the ASAM multidimensional assessment framework, with AI assistance for summarizing risks across the 6 dimensions.
-   **Treatment Planning**: The "Program Plan" feature allows for the creation and tracking of client goals, objectives, and interventions as required.
-   **Staff Qualifications**: The "Compliance" dashboard includes a module for tracking staff certifications (e.g., QMHP, QAP), ensuring alignment with `9 CSR 30-3.155`.
-   **Reassessments**: The system includes logic to flag clients for required annual reassessments, with the ability to trigger them sooner based on clinical need.
-   **HIPAA / 42 CFR Part 2 — NOT compliant in this build:** This trial build runs on mock data and is **not** suitable for real client PHI. There is **no application-level data encryption** (uploaded documents are stored at public Storage URLs), access control is **client-side only** (Row-Level Security is permissive or disabled on the clinical tables and the Supabase anon key ships in the browser), and **audit logging is not implemented** (the `audit_logs` table is never written to). Real encryption, server-enforced role-based access, and audit logging are **planned / not yet implemented** — see Security & Compliance Status above.
