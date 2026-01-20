# GeMyndFlow (ACS TherapyHub) Technical Specification V2.0

## 1. Architectural Overview
GeMyndFlow is a **Multimodal Clinical Orchestration Platform** built on a "Driverless Infrastructure" philosophy. It leverages agentic workflows to minimize administrative latency in court-mandated treatment programs (SATOP, SROP, CSTAR).

### Core Philosophy: The Infrastructure of Trust
- **Zero-Footprint Paradox**: Clinical data must be immutable and "perfect from the source" to avoid catastrophic legal failure.
- **Neural Sync**: Real-time synchronization between clinical observations (Live API) and the permanent record (Postgres/Vault).

---

## 2. Tech Stack
| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | React 19 (ESM) | High-concurrency UI components and hook-based state. |
| **Styling** | Tailwind CSS 3.4 | Atomic design tokens with ACS Brand alignment (#8B1E24). |
| **Intelligence** | Gemini 3 Pro/Flash | Deep reasoning for ASAM analysis and Document DNA extraction. |
| **Real-time** | Gemini Live API | Low-latency voice/vision clinical auditing and session capturing. |
| **Backend** | Supabase (Postgres) | Relational clinical metadata and Auth. |
| **Storage** | PDS-Vault (GCS/S3) | Secure binary storage for PHI documents. |
| **Identity** | iVALT Biometric | Multi-factor biometric uplink for Level III authorization. |

---

## 3. System Architecture & Data Flow

### A. Document Ingestion Pipeline (The "Vault")
1. **Binary Surge**: User drops a PDF/Image into `ClientDocumentsGrid`.
2. **Concurrent DNA Extraction**: 
   - `storageService.extractDocumentDNA` sends the binary to Gemini 3 Flash.
   - AI extracts `Document DNA`: Title, Summary, Clinical Tags, and Suggested Category.
3. **Commit Phase**: File is stored in Supabase Storage; metadata + AI summary are committed to the `uploaded_files` table.

### B. Live Session Orchestration
1. **Handshake**: Therapist initiates `ActiveSession.tsx`.
2. **Telemetry Pulse**: Web Speech API / Gemini Live API captures real-time transcript.
3. **Neural Wrap-Up**: On session end, `generateSoapNoteFromTranscript` formats raw data into a structured SOAP note.
4. **Logic Dispatch**: The note is linked to billing (Cpt-90834) and tasks (AA meetings) in a single atomic transaction.

---

## 4. API Endpoints & Expectations

### Internal Services (`/services/api.ts`)
- `generateAsamAnalysis(notes: string)`: 
  - **Expectation**: Uses Gemini 3 Pro with a **32k token thinking budget**.
  - **Returns**: JSON object with clinical justification and recommended ASAM levels.
- `callMcpOrchestrator(tool, params)`:
  - **Expectation**: Outbound request to Supabase Edge Functions acting as an MCP (Model Context Protocol) host.
  - **Use Case**: Cross-referencing patient records with billing data without exposing full database access to the LLM.

### Authentication Gateway (`/services/iValtService.ts`)
- `startAuthentication(mobile)`: Triggers a biometric push to the user's mobile device.
- `pollStatus(requestId)`: Long-polling mechanism with exponential backoff to detect biometric approval.

---

## 5. Backend Schema Requirements (Supabase)
To support the current V2 features, the following tables must exist:
- **`clients`**: Full patient PII, compliance scores, and program metadata.
- **`uploaded_files`**: Document metadata with an `extracted_dna` JSONB column.
- **`form_submissions`**: Raw JSON data from clinical protocols.
- **`session_records`**: Billing ledger and clinical note associations.
- **`audit_logs`**: System-wide event tracking (HIPAA requirement).

---

## 6. Enhancement Suggestions (Roadmap V3)

### Phase 1: High-Fidelity OCR (Vision Pro)
- **Problem**: Handwritten intake forms are currently treated as generic images.
- **Enhancement**: Integrate Gemini 3 Vision to map handwritten text directly into `form_submissions` JSON, removing the need for manual transcription.

### Phase 2: Predictive Risk Modeling
- **Problem**: Relapse risk is currently based on static compliance scores.
- **Enhancement**: Implement `generateRelapseRiskPrediction` using a "Time-to-Event" model. Gemini 3 should analyze attendance patterns to predict potential warrants 7 days before they occur.

### Phase 3: Driverless Scheduling (The Dispatcher)
- **Problem**: Rescheduling sessions takes 3-4 clicks.
- **Enhancement**: Allow "Clara" to handle 100% of rescheduling via natural language. If a client says "I can't make it" via the portal, Clara checks the therapist's Google Calendar and offers 3 slots automatically.

### Phase 4: Geo-Fencing for IValt
- **Problem**: Biometric trust is high, but location is not verified.
- **Enhancement**: Use iVALT's Geo-Fence Evaluation to ensure a therapist is only authorized to sign notes while physically at the Sunset Hills or Gravois locations.

---

## 7. Security & Compliance (HIPAA)
- **Encryption**: AES-256 for all binary storage.
- **Session Latency**: 8-minute maximum uplink for biometric sessions.
- **Audit Integrity**: Every AI-generated summary must include the `Grounded in PDS records` watermark to differentiate from human clinical observations.

---
*End of Specification*