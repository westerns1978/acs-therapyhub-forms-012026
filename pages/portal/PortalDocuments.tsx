

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PortalLayout from '../../layouts/PortalLayout';
import Header from '../../components/ui/Header';
import Card from '../../components/ui/Card';
import { supabase } from '../../services/supabase';
import { usePortalClient } from '../../hooks/usePortalClient';

// Form definitions for the client-facing forms
const CLIENT_FORMS = [
  { id: 'consent-treatment', name: 'Consent for Treatment', 
    category: 'Legal', description: 'Authorization for program participation' },
  { id: 'emergency-contact', name: 'Emergency Contact Form', 
    category: 'Intake', description: 'Emergency contact information' },
  { id: 'recovery-plan', name: 'Continuing Recovery Plan', 
    category: 'Treatment', description: 'Your personal recovery plan' },
  { id: 'telehealth-feedback', name: 'Telehealth Session Feedback', 
    category: 'Clinical', description: 'Rate your telehealth experience' },
];

const PortalDocuments: React.FC = () => {
    const portalClient = usePortalClient();
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!portalClient) return;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const { data } = await supabase
                    .from('form_submissions')
                    .select('*')
                    .eq('client_id', portalClient.id)
                    .order('created_at', { ascending: false });
                setSubmissions(data || []);
            } catch (err) {
                console.warn('Failed to load documents:', err);
            }
            setIsLoading(false);
        };
        fetchData();
    }, [portalClient]);

    if (isLoading || !portalClient) {
        return <PortalLayout><div className="text-center p-12">Loading documents...</div></PortalLayout>;
    }

    return (
        <PortalLayout>
            <div className="max-w-4xl mx-auto space-y-8">
                <Header title="My Documents" subtitle="Please review and sign any pending documents." />
                
                {/* Pending / Available Forms */}
                <Card title="Forms to Complete">
                    <div className="space-y-3">
                        {CLIENT_FORMS.filter(form => 
                            !submissions.some(s => 
                                s.form_name === form.name && s.status === 'completed'
                            )
                        ).map(form => (
                            <div key={form.id} 
                                className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">
                                <div>
                                    <h4 className="font-bold text-amber-900 dark:text-amber-100">{form.name}</h4>
                                    <p className="text-xs text-amber-700 dark:text-amber-300">
                                        {form.description}
                                    </p>
                                </div>
                                <button
                                    onClick={() => navigate(`/portal/forms/${form.id}`)}
                                    className="px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary-focus transition"
                                >
                                    Start Form
                                </button>
                            </div>
                        ))}
                        {CLIENT_FORMS.filter(form => 
                            !submissions.some(s => 
                                s.form_name === form.name && s.status === 'completed'
                            )
                        ).length === 0 && (
                            <p className="text-sm text-slate-500 text-center py-4">No pending forms to complete.</p>
                        )}
                    </div>
                </Card>

                {/* Completed Submissions */}
                <Card title="Completed Forms">
                    <div className="space-y-3">
                        {submissions.filter(s => s.status === 'completed')
                            .map(sub => (
                            <div key={sub.id} 
                                className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl">
                                <div>
                                    <h4 className="font-bold text-green-900 dark:text-green-100">{sub.form_name}</h4>
                                    <p className="text-xs text-green-700 dark:text-green-300">
                                        Submitted {new Date(sub.submitted_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <span className="text-green-600 dark:text-green-400 text-sm font-bold flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    Completed
                                </span>
                            </div>
                        ))}
                        {submissions.filter(s => s.status === 'completed').length === 0 && (
                            <p className="text-sm text-slate-500 text-center py-4">No completed forms yet.</p>
                        )}
                    </div>
                </Card>
            </div>
        </PortalLayout>
    );
};

export default PortalDocuments;
