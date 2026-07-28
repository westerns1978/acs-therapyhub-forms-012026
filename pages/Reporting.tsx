import React from 'react';
import Card from '../components/ui/Card';
import { BarChart3 } from 'lucide-react';

/**
 * Reporting — HONEST PLACEHOLDER (2026-07-28).
 *
 * The previous version charted getRevenueData/getComplianceTrendData — hardcoded
 * literals in services/api.ts ($12,500 SATOP revenue, an 88→98% compliance trend)
 * presented to the Director as if real. Those functions are deleted (guard comment
 * at their old site in services/api.ts). This page renders a not-wired notice and
 * remains TRIAL_MODE-hidden (config/trialMode.ts) until it is rebuilt on the real
 * acs_report_* RPCs — the same ledger pages/Financials.tsx already reads.
 * Do NOT re-add charts here fed by anything other than those RPCs.
 */
const Reporting: React.FC = () => (
    <div className="max-w-3xl mx-auto py-16">
        <Card title="Analytics" subtitle="Not yet wired to live data.">
            <div className="flex flex-col items-center gap-3 py-10 text-center">
                <BarChart3 size={40} className="text-slate-300" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    Practice analytics are not connected to the live ledger yet.
                </p>
                <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                    Nothing is shown here because no real figures are available on this page yet.
                    Financial reporting on real ledger data is available under Financials.
                </p>
            </div>
        </Card>
    </div>
);

export default Reporting;
