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
];

export const isTrialHidden = (path: string): boolean =>
  TRIAL_MODE && TRIAL_HIDDEN_ROUTES.includes(path);

// Per-component tab hides. Tied to TRIAL_MODE so flipping the master flag off
// re-enables everything in one place. The scheduling tab on ClientWorkspace
// fronts a DispatcherChat → schedulingService.createDispatcher stub that
// doesn't actually reschedule anything — hide for the trial.
export const TRIAL_HIDE_CLIENT_SCHEDULING_TAB = TRIAL_MODE;
