
# ACS TherapyHub

**ACS TherapyHub** is a custom-built operations dashboard for Assessment & Counseling Solutions (ACS), a St. Louis-based provider of SATOP, CSTAR, and SROP services. This web application is designed to streamline operations, ensure compliance with Missouri Department of Mental Health (DMH) regulations, and enhance both therapist efficiency and client engagement.

Built with AI Studio, this platform integrates modern technologies like P3ID for secure document handling and AI for clinical insights, providing a comprehensive solution for court-mandated treatment programs.

## Features

- **DMH-Aligned Staff Dashboard**: Manage client caseloads, schedules, and compliance documentation in a secure, intuitive interface.
- **AI-Powered Assessments**: Utilize AI to summarize ASAM multidimensional assessments and predict client relapse risk.
- **P3ID Document Management**: Securely handle sensitive documents with simulated `AuthentiCapture` for signatures and `ScanBot` for OCR, plus AI-driven document analysis.
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
- **AI Integration**: Google Gemini API (`gemini-2.5-flash` for speed, `gemini-3-pro` for reasoning) and Gemini Live API for voice interaction.
- **Backend**: Supabase (PostgreSQL) for data persistence and Storage.
- **Security**: Mock implementation of P3ID technologies, iValt biometric MFA integration.

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
3.  **Navigate to Compliance:** Highlight the system-wide audit trail, staff certification tracking, and the one-click "Bulk Export" feature as major time-savers.
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
-   **HIPAA Compliance**: The application architecture emphasizes security, with data encryption in mind (`9 CSR 10-5.220`) and secure, role-based access. Audit trails are logged to ensure accountability.
