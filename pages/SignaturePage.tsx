

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DocumentType, SignedDocument, Client } from '../types';
import { getClient, addSignedDocument } from '../services/api';
import Card from '../components/ui/Card';
import SignaturePad from '../components/ui/SignaturePad';

const ShieldCheckIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>;

const ConsentText = () => (
  <div className="prose max-w-none text-gray-700 max-h-96 overflow-y-auto p-2 border rounded-md bg-white">
    <p>Welcome to Assessment & Counseling Solutions. This document outlines the terms of your court-ordered program. Please read it carefully.</p>
    <h2 className="text-xl font-semibold mt-4 leading-tight">Confidentiality & Reporting</h2>
    <p>All information disclosed within sessions is confidential with exceptions required by law and your court order. This includes, but is not limited to, suspected child abuse, potential harm to yourself or others, and mandatory reporting of your attendance, compliance, and drug screen results to the court and your probation officer.</p>
    <h2 className="text-xl font-semibold mt-4 leading-tight">Program Rules & Expectations</h2>
    <p>Your active participation and compliance are mandatory. Failure to attend sessions, pay required fees, or adhere to program rules will be reported and may result in legal consequences, including program extension or revocation of probation.</p>
    <h2 className="text-xl font-semibold mt-4 leading-tight">Financial Responsibility</h2>
    <p>You are responsible for paying all program fees as they are due. Failure to pay may result in a non-compliance report to the court. All fees are non-negotiable.</p>
    <h2 className="text-xl font-semibold mt-4 leading-tight">Acknowledgement</h2>
    <p>By signing below, you acknowledge that you have read and understood the terms of this consent document and agree to participate in this program under these conditions.</p>
  </div>
);

const TreatmentPlanText = () => (
    <div className="prose max-w-none text-gray-700 max-h-96 overflow-y-auto p-2 border rounded-md bg-white">
      <p>This document summarizes the key goals of your program plan. Your signature indicates your agreement and commitment to working towards these court-mandated objectives.</p>
      <h2 className="text-xl font-semibold mt-4 leading-tight">Primary Goals</h2>
      <ul>
        <li>Maintain abstinence from all non-prescribed substances, verified by random screens.</li>
        <li>Successfully complete all phases of the 75-hour SROP program.</li>
        <li>Identify high-risk situations and implement approved relapse prevention strategies.</li>
        <li>Satisfy all financial and reporting obligations to the court and this agency.</li>
      </ul>
      <h2 className="text-xl font-semibold mt-4 leading-tight">Acknowledgement</h2>
      <p>By signing below, you acknowledge that you have reviewed this program plan with your counselor, understand the goals, and agree to work towards them as required by your court order.</p>
    </div>
);


const SignaturePage: React.FC = () => {
    const { documentType, clientId } = useParams<{ documentType: DocumentType, clientId: string }>();
    const navigate = useNavigate();
    const [signatureData, setSignatureData] = useState<string | null>(null);
    const [signedTimestamp, setSignedTimestamp] = useState<Date | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (clientId) {
            const fetchClient = async () => {
                setIsLoading(true);
                const clientData = await getClient(clientId);
                setClient(clientData || null);
                setIsLoading(false);
            };
            fetchClient();
        }
    }, [clientId]);

    const documentDetails = {
        'consent': { title: 'Informed Consent for Program Participation', component: <ConsentText /> },
        'treatment-plan': { title: 'Program Plan Approval', component: <TreatmentPlanText /> },
    };
    
    const currentDocument = documentDetails[documentType || 'consent'];

    const handleSaveSignature = async (dataUrl: string) => {
        const timestamp = new Date();
        if (!client || !documentType) return;
        
        await addSignedDocument({
            clientId: client.id,
            documentType: documentType,
            signatureDataUrl: dataUrl,
            signedAt: timestamp,
        });
        
        setSignatureData(dataUrl);
        setSignedTimestamp(timestamp);
    };

    if (isLoading) {
        return <div className="text-center p-8">Loading client information...</div>;
    }

    if (!client) {
        return <div className="text-center p-8">Client not found.</div>;
    }

    if (signatureData) {
        return (
            <div className="max-w-3xl mx-auto">
                <Card>
                    <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
                        <ShieldCheckIcon className="w-12 h-12 text-green-500 mx-auto mb-2" />
                        <h1 className="text-xl font-bold text-on-surface">Document Signed Successfully</h1>
                        <p className="text-sm text-on-surface-secondary">A copy has been saved to the client's record.</p>
                    </div>

                    <div id="signed-document-preview" className="p-4 sm:p-6 border rounded-md shadow-inner bg-surface">
                        <h2 className="text-2xl font-bold text-center mb-2">{currentDocument.title}</h2>
                        <p className="text-center text-gray-500 mb-6">Client: {client.name}</p>
                        
                        {currentDocument.component}

                        <div className="mt-8 pt-4 border-t">
                            <h3 className="font-semibold text-on-surface">Signature:</h3>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mt-2 gap-4">
                                <img src={signatureData} alt="Client's signature" className="h-16 w-auto bg-white p-1 rounded-md border" />
                                <div className="text-left sm:text-right text-xs text-gray-500">
                                    <p>Signed Electronically</p>
                                    <p>Timestamp: {signedTimestamp?.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <button
                        onClick={() => navigate('/clients')}
                        className="mt-6 bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-focus transition w-full font-semibold"
                    >
                        Return to Client Workspace
                    </button>
                </Card>
            </div>
        );
    }
    
    return (
        <div className="max-w-3xl mx-auto p-6 sm:p-8 rounded-2xl bg-background/80 dark:bg-dark-surface/80 backdrop-blur-xl border border-border dark:border-dark-border shadow-lg">
            <h1 className="text-h1 font-bold text-center mb-2">{currentDocument.title}</h1>
            <p className="text-center text-gray-500 mb-6">Client: {client.name}</p>

            {currentDocument.component}

            <div className="mt-8">
                <label className="block text-sm font-medium text-on-surface-secondary mb-2">Please sign in the box below:</label>
                <SignaturePad onSave={handleSaveSignature} />
            </div>
        </div>
    );
};

export default SignaturePage;