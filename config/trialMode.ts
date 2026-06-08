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
];

export const isTrialHidden = (path: string): boolean =>
  TRIAL_MODE && TRIAL_HIDDEN_ROUTES.includes(path);

// Per-component tab hides. Tied to TRIAL_MODE so flipping the master flag off
// re-enables everything in one place. The scheduling tab on ClientWorkspace
// fronts a DispatcherChat → schedulingService.createDispatcher stub that
// doesn't actually reschedule anything — hide for the trial.
export const TRIAL_HIDE_CLIENT_SCHEDULING_TAB = TRIAL_MODE;
