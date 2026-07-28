import React from 'react';
import { useNavigate } from 'react-router-dom';
import PortalLayout from '../../layouts/PortalLayout';
import Card from '../../components/ui/Card';
import { ClipboardList, ArrowLeft } from 'lucide-react';

/**
 * Continuing Recovery Plan WIZARD — HONEST PLACEHOLDER (2026-07-28).
 *
 * This was a PHANTOM TWIN of a form that already works, and every part of it was
 * fake:
 *  - It seeded another person's PII as the client's own — a hardcoded name, date of
 *    birth, case number and email — because it never read usePortalClient. A real
 *    client opening it saw someone else's identifying details in their own portal.
 *  - Its "AI Suggest" buttons called generateFormSuggestions, a stub returning the
 *    literal string "Suggestion".
 *  - Its submit was hardcoded to clientId '1', which cannot pass the WS5
 *    client-write RLS — so nothing it collected could ever be saved.
 *  - It also carried the unscoped-draft bug (ROADMAP release-gate note).
 *
 * The HONEST version is live and unaffected: /portal/forms/recovery-plan
 * (RECOVERY_PLAN_DEFINITION via PortalFormPage — real prefill, real scoped write).
 *
 * Route kept so App.tsx's TRIAL_MODE redirect remains the single containment point;
 * the dashboard ActionCard that pointed here is already gated by isTrialHidden.
 * Do NOT restore the wizard — send clients to the registry form.
 */
const RecoveryPlanForm: React.FC = () => {
    const navigate = useNavigate();
    return (
        <PortalLayout>
            <div className="max-w-2xl mx-auto py-12">
                <Card title="Continuing Recovery Plan">
                    <div className="flex flex-col items-center gap-3 py-10 text-center">
                        <ClipboardList size={40} className="text-slate-300" />
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                            This form has moved.
                        </p>
                        <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                            Your Continuing Recovery Plan is available with the rest of your forms,
                            already filled in with your own information.
                        </p>
                        <button
                            onClick={() => navigate('/portal/documents')}
                            className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary-focus transition"
                        >
                            <ArrowLeft size={14} /> Go to my forms
                        </button>
                    </div>
                </Card>
            </div>
        </PortalLayout>
    );
};

export default RecoveryPlanForm;
