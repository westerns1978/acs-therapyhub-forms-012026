/**
 * ACS TherapyHub — Risk Modeling types.
 *
 * The hardcoded "John Doe" mock profile, fixed cohort counts, and static report
 * string that used to live here have been REMOVED — they had no callers and
 * risked being mistaken for real output. The real, live risk prediction is
 * `generateRelapseRiskPrediction` in services/api.ts (Gemini `gemini-2.5-flash`),
 * already used by ClientWorkspace's RelapseRiskCard.
 *
 * These type contracts are retained only because RiskDashboard.tsx imports them.
 * NOTE: RiskDashboard is not currently mounted anywhere, and its
 * ClientRiskProfile / CohortRiskSummary shape (tiers, warrant probabilities,
 * factor/recommendation lists, cohort counts) is much richer than the live
 * engine's { score, reasoning }. Wiring it to real output would need an expanded
 * model output schema plus a cohort data source — a product decision, not a
 * drop-in replacement. See the sprint report.
 */

export type RiskTier = "CRITICAL" | "RED" | "ORANGE" | "YELLOW" | "GREEN";

export interface ClientRiskProfile {
  clientId: string;
  clientName: string;
  riskScore: number;
  riskTier: RiskTier;
  warrantProbability7Day: number;
  warrantProbability30Day: number;
  primaryRiskFactors: string[];
  protectiveFactors: string[];
  recommendations: string[];
  trend: "UP" | "DOWN" | "STABLE";
}

export interface CohortRiskSummary {
  criticalCount: number;
  redCount: number;
  orangeCount: number;
  yellowCount: number;
  greenCount: number;
  totalClients: number;
}
