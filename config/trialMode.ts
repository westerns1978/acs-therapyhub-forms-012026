export const TRIAL_MODE = true;

// TODO(Q2): /document-intelligence is hidden whole-tab provisionally — we don't
// know yet whether the page itself black-screens or only the Scan Handwritten
// Form flow does. If only the scan flow is broken, remove '/document-intelligence'
// from this list and instead disable the Scan button entry in
// pages/DocumentIntelligence.tsx.
export const TRIAL_HIDDEN_ROUTES: readonly string[] = [
  // '/financials' un-hidden for the day-30 review — Director Reports rebuilt on the
  // real charges/payments ledger; route + nav gated to Director/Admin (isFinancialRole).
  '/reporting',
  '/document-intelligence',
  // '/video-sessions' (+ its green-room) is a MOCK page — getVideoSessions returns a
  // hardcoded array; addVideoSession / updateVideoSessionStatus are no-ops. The real
  // session spine is `appointments` + the Zoom edge fns. Hidden for the team test
  // (it's orphaned — no nav link); rebuild on `appointments` before un-hiding.
  '/video-sessions',
  // '/communication-center' (Messages) — the Send persists to client_communications but
  // reaches NO client (this app has no portal inbox; delivery is a future scope decision),
  // under fabricated "ONLINE" + ✓✓-read cues. Hidden for the team test to avoid a
  // message-into-the-void trap. CommunicationCenter.tsx + the API fns stay intact (restorable).
  '/communication-center',
  // '/program-compliance/:id' (ProgressTracking) is MOCK: getSROPData returns hardcoded
  // phase1/phase2 hours (e.g. 42/75) that CONTRADICT the authoritative accrual (16/75).
  // Deep-link only (no nav). Hidden for the team test; rebuild on the accrual view before un-hiding.
  '/program-compliance',
  // '/portal/recovery-plan' (Continuing Recovery Plan WIZARD) — a PHANTOM twin: hardcoded
  // "Alice Johnson" PII (never reads usePortalClient), AI-Suggest buttons backed by a stub
  // that returns the literal string "Suggestion" (services/api.ts), and a submit hardcoded
  // to clientId '1' that cannot pass the WS5 client-write RLS. The HONEST registry form at
  // /portal/forms/recovery-plan (real prefill, real scoped write) stays live and is NOT
  // affected. Hidden = dashboard ActionCard gated + route redirected. Whether clients
  // should author a recovery plan at all is a parked scope decision (SECURITY_BACKLOG #17).
  '/portal/recovery-plan',
  // '/compliance' (staff Compliance page) — every number on it is fabricated.
  // The "Compliance Score" tile computes complete/(total-upcoming) over the
  // hardcoded one-row mock `dbComplianceEvents`, i.e. 0/(1-1) = NaN, and an
  // isNaN guard renders a permanent green "100%" — the most reassuring value the
  // widget can show, on the compliance page of a compliance product, to the
  // Director. The CSR alert timeline reads the same one mock row. And "Bulk
  // Export (CSV)" pulls getSessionRecords('') — which matches nothing — so it
  // downloads REAL client names and case numbers paired with 0 sessions and
  // 0.00 balance. Hidden for the team test. The honest replacement already
  // exists: /compliance-readiness (deterministic engine, explicit "Not Yet
  // Verifiable" card). Rebuild this page on complianceEngine before un-hiding.
  '/compliance',
  // '/session/:clientId' (ActiveSession → SessionWrapUpModal) — the wrap-up
  // wizard ends on "Session Finalized! All post-session tasks are complete."
  // while three of its four steps do nothing. "Submit Charge" shows CPT 90834 /
  // $150.00 and calls addSessionRecord, an EMPTY function body (api.ts) — the
  // real ledger is the `charges` table, untouched. "Assign Client Task" says
  // "This will appear in the client's portal" and calls addClientAssignment,
  // also an empty body. "Schedule Next" renders five time-slot buttons with no
  // onClick, then books a REAL appointment hardcoded to next week 10:00-11:00
  // AM with no conflict check — the one thing that persists is the thing nobody
  // chose. Its "Click to Apply Digital Signature" button also flips a bare React
  // boolean into clinical_notes.is_signed. Hidden for the team test; the real
  // note path is SmartNoteImporter (confirm-gated + audit-logged) and the real
  // completion path is SessionManagement → AppointmentStatusModal.
  '/session',
];

export const isTrialHidden = (path: string): boolean =>
  TRIAL_MODE && TRIAL_HIDDEN_ROUTES.includes(path);

// Per-component tab hides. Tied to TRIAL_MODE so flipping the master flag off
// re-enables everything in one place. The scheduling tab on ClientWorkspace
// fronts a DispatcherChat → schedulingService.createDispatcher stub that
// doesn't actually reschedule anything — hide for the trial.
export const TRIAL_HIDE_CLIENT_SCHEDULING_TAB = TRIAL_MODE;

// Settings "Manual Configuration (MVP)" block: it saves `zoom_pmi` to
// localStorage, but nothing in the app reads that key — the Save button is a
// no-op ritual and its helper text ("Used for Start Session buttons") is false.
// Hidden for the trial; flip back once a real consumer of the PMI exists.
export const TRIAL_HIDE_SETTINGS_MANUAL_CONFIG = TRIAL_MODE;
