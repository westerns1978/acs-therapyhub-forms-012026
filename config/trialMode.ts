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
