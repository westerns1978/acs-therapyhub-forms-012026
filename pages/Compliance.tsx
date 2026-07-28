import React from 'react';
import Card from '../components/ui/Card';
import { ShieldCheck } from 'lucide-react';

/**
 * Compliance — HONEST PLACEHOLDER (2026-07-28).
 *
 * The previous version was fabricated end to end and is deleted:
 *
 *  - "Compliance Score" tile computed complete/(total-upcoming) over the hardcoded
 *    one-row `dbComplianceEvents` mock, i.e. 0/(1-1) = NaN, and an isNaN guard
 *    rendered a permanent green "100%" — the most reassuring number the widget
 *    could show, on the compliance page of a compliance product, to the Director.
 *  - The CSR alert timeline read that same single mock row.
 *  - "Bulk Export (CSV)" called getSessionRecords('') — which matches nothing — so
 *    it downloaded REAL client names and case numbers paired with 0 sessions and a
 *    $0.00 balance.
 *  - The Court Report preview was hardcoded to a demo client id and to mock
 *    getSROPData hours that contradict the authoritative accrual.
 *  - Staff certifications rendered from the hardcoded dbStaffCertifications array.
 *
 * Its data sources are now retired at the API layer: getComplianceEvents() returns []
 * and getSROPData() returns null, both with do-not-reintroduce guards in
 * services/api.ts. The honest replacement already exists and is deterministic:
 * /compliance-readiness (services/complianceEngine, real client data, explicit
 * "Not Yet Verifiable" card).
 *
 * This route stays TRIAL_MODE-hidden (config/trialMode.ts). Rebuild on
 * complianceEngine before un-hiding. Do NOT restore mock-backed widgets here.
 */
const Compliance: React.FC = () => (
    <div className="max-w-3xl mx-auto py-16">
        <Card title="Compliance" subtitle="Not yet rebuilt on real data.">
            <div className="flex flex-col items-center gap-3 py-10 text-center">
                <ShieldCheck size={40} className="text-slate-300" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    This page is not available.
                </p>
                <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                    Nothing is shown here because this surface has no verified data behind it yet.
                    Deterministic, real-data compliance verdicts are on Compliance Readiness.
                </p>
            </div>
        </Card>
    </div>
);

export default Compliance;
