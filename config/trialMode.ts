export const TRIAL_MODE = true;

// TODO(Q2): /document-intelligence is hidden whole-tab provisionally — we don't
// know yet whether the page itself black-screens or only the Scan Handwritten
// Form flow does. If only the scan flow is broken, remove '/document-intelligence'
// from this list and instead disable the Scan button entry in
// pages/DocumentIntelligence.tsx.
export const TRIAL_HIDDEN_ROUTES: readonly string[] = [
  '/financials',
  '/reporting',
  '/document-intelligence',
];

export const isTrialHidden = (path: string): boolean =>
  TRIAL_MODE && TRIAL_HIDDEN_ROUTES.includes(path);
