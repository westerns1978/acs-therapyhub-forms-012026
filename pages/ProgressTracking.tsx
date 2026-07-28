import React from 'react';
import Card from '../components/ui/Card';
import { BarChart3 } from 'lucide-react';

/**
 * Program Compliance (/program-compliance/:clientId) — HONEST PLACEHOLDER (2026-07-28).
 *
 * The previous version rendered an "SROP 75-Hour Progress Tracker" plus phase bars
 * and a drug-screen chain-of-custody table entirely from the hardcoded `dbSropData`
 * mock (data/database.ts): one row, one demo client, 42/75 hours across two phases,
 * and invented COC ids.
 *
 * Those numbers CONTRADICTED the authoritative accrual for the same client
 * (client_accrued_hours → services/displayProgress; the real figure was 16/75). Two
 * different hour counts for one client, one of them fabricated, on a page named
 * "Program Compliance" — with the fabricated one being the more flattering.
 *
 * getSROPData() is now retired at the API layer (returns null, do-not-reintroduce
 * guard in services/api.ts), so this page had no data source left. The honest
 * per-client progress surfaces are the client record's Overview/Assessment tabs,
 * which read the accrual + the signed determination.
 *
 * This route stays TRIAL_MODE-hidden (config/trialMode.ts) and is deep-link only —
 * no nav points at it. Rebuild on the accrual view before un-hiding.
 */
const ProgramCompliance: React.FC = () => (
    <div className="max-w-3xl mx-auto py-16">
        <Card title="Program Compliance" subtitle="Not yet rebuilt on real data.">
            <div className="flex flex-col items-center gap-3 py-10 text-center">
                <BarChart3 size={40} className="text-slate-300" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    This page is not available.
                </p>
                <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                    Nothing is shown here because this surface has no verified data behind it yet.
                    A client’s authoritative hours and placement level are on their client record.
                </p>
            </div>
        </Card>
    </div>
);

export default ProgramCompliance;
