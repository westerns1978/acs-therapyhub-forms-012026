/**
 * form_submissions.status — single choke-point for READING the mixed-casing
 * status vocabulary (GATE 0 recon, 2026-07-16).
 *
 * The live table carries BOTH casings ('completed' 22 rows / 'Completed' 23 rows
 * at recon time): BaseFormTemplate writes lowercase, the services/api.ts writers
 * emit the capitalized vocabulary that types.ts (FormSubmission['status'])
 * declares canonical, and ClientSubmissionsPanel's mark-reviewed writes lowercase
 * 'reviewed'. Until the writers are unified — and forever after, for the legacy
 * rows — every status COMPARISON must route through normalizeSubmissionStatus().
 * Never compare a raw form_submissions.status literal (same rule as
 * config/programVocab.ts for program tokens).
 *
 * complianceEngine.ts (the cert gate) already lowercases before comparing and is
 * intentionally left on its own inline normalization — it predates this file and
 * is witnessed correct; consolidating it is optional, not required.
 */

export type NormalizedSubmissionStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'reviewed';

export const normalizeSubmissionStatus = (
  raw: string | null | undefined,
): NormalizedSubmissionStatus => {
  switch (String(raw ?? '').trim().toLowerCase()) {
    case 'completed':
      return 'completed';
    case 'reviewed':
      return 'reviewed';
    case 'in progress':
    case 'in_progress':
      return 'in_progress';
    case 'not started':
    case 'not_started':
    // 'pending' is a historical assigned-but-unsubmitted value (PortalDashboard
    // still queries for it); no rows carry it today, but it folds here if one
    // ever reappears.
    case 'pending':
      return 'not_started';
    default:
      // Null/empty/unrecognized → 'not_started'. Matches getFormSubmissions'
      // existing default (services/api.ts: `row.status || 'Not Started'`) and
      // fails CLOSED for completion/review affordances — a submission never
      // renders as completed or reviewed unless its status affirmatively says so.
      return 'not_started';
  }
};

/** Display labels — presentation only; identity is the normalized token. */
export const SUBMISSION_STATUS_LABELS: Record<NormalizedSubmissionStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  reviewed: 'Reviewed',
};
