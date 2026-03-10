/**
 * ACS TherapyHub — Clinical Risk Dashboard Component
 */

import React, { useState } from "react";
import type { ClientRiskProfile, CohortRiskSummary, RiskTier } from "../services/riskModelingService";

interface RiskDashboardProps {
  profiles: ClientRiskProfile[];
  summary: CohortRiskSummary;
  onSelectClient: (clientId: string) => void;
  onTriggerOutreach: (clientId: string, message: string) => void;
  isLoading?: boolean;
}

const TIER_CONFIG: Record<RiskTier, { label: string; bg: string; text: string; border: string; pulse: boolean }> = {
  CRITICAL: { label: "CRITICAL", bg: "bg-red-950",    text: "text-red-300",    border: "border-red-500",   pulse: true  },
  RED:      { label: "HIGH",     bg: "bg-red-900",    text: "text-red-400",    border: "border-red-600",   pulse: true  },
  ORANGE:   { label: "ELEVATED", bg: "bg-orange-900", text: "text-orange-300", border: "border-orange-500",pulse: false },
  YELLOW:   { label: "MODERATE", bg: "bg-yellow-900", text: "text-yellow-300", border: "border-yellow-600",pulse: false },
  GREEN:    { label: "LOW",      bg: "bg-green-950",  text: "text-green-400",  border: "border-green-700", pulse: false },
};

export default function RiskDashboard({
  profiles,
  summary,
  onSelectClient,
  onTriggerOutreach,
  isLoading = false,
}: RiskDashboardProps) {
  const [selectedTier, setSelectedTier] = useState<RiskTier | "ALL">("ALL");

  const filtered = profiles
    .filter(p => selectedTier === "ALL" || p.riskTier === selectedTier)
    .sort((a, b) => b.riskScore - a.riskScore);

  return (
    <div className="min-h-screen bg-gray-950 text-white font-mono p-6">
      <h1 className="text-2xl font-bold text-white tracking-tight mb-8">Predictive Risk Monitor</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {(["CRITICAL", "RED", "ORANGE", "YELLOW", "GREEN"] as RiskTier[]).map(tier => {
          const cfg = TIER_CONFIG[tier];
          const count = summary[`${tier.toLowerCase()}Count` as keyof CohortRiskSummary] as number;
          return (
            <button
              key={tier}
              onClick={() => setSelectedTier(selectedTier === tier ? "ALL" : tier)}
              className={`p-4 rounded-lg border ${cfg.bg} ${cfg.border} ${selectedTier === tier ? "ring-2 ring-white" : ""}`}
            >
              <div className={`text-2xl font-bold ${cfg.text}`}>{count}</div>
              <div className="text-xs text-gray-400 mt-1">{cfg.label}</div>
            </button>
          );
        })}
      </div>

      {isLoading ? <div>Loading...</div> : (
        <div className="space-y-3">
          {filtered.map(profile => (
            <div key={profile.clientId} className="p-4 rounded-lg border border-gray-800 bg-gray-900 flex justify-between items-center">
              <div>
                <div className="font-semibold">{profile.clientName}</div>
                <div className="text-xs text-gray-400">Risk Score: {profile.riskScore}</div>
              </div>
              <button onClick={() => onSelectClient(profile.clientId)} className="px-3 py-1 bg-white text-black rounded text-xs">View</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
