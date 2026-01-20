

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PortalLayout from '../../layouts/PortalLayout';
import Card from '../../components/ui/Card';
import SignaturePad from '../../components/ui/SignaturePad';
// Fix: Correctly import getDocumentForSigning and saveClientSignature from the services API.
import { getDocumentForSigning, saveClientSignature } from '../../services/api';
import { ClientDocument } from '../../types';

const ShieldCheckIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>;

const ConsentText = () => (
  <div className="prose prose-sm max-w-none text-gray-700 dark:text-slate-300 max-h-80 overflow-y-auto p-4 border rounded-md bg-surface dark:bg-slate-800/50">
    <p>Welcome to Assessment & Counseling Solutions. This document outlines the terms of your court-ordered program. Please read it carefully.</p>
    <h2 className="text-xl font-semibold mt-4 leading-tight">Confidentiality & Reporting</h2>
    <p>All information disclosed within sessions is confidential with exceptions required by law and your court order. This includes, but is not limited to, suspected child abuse, potential harm to yourself or others, and mandatory reporting of your attendance, compliance, and drug screen results to the court and your probation officer.</p>
    <h2 className="text-xl font-semibold mt-4 leading-tight">Financial Responsibility</h2>
    <p>You are responsible for paying all program fees as they are due. Failure to pay may result in a non-compliance report to the court. All fees are non-negotiable.</p>
    <h2 className="text-xl font-semibold mt-4 leading-tight">Acknowledgement</h2>
    <p>By signing below, you acknowledge that you have read and understood the terms of this consent document and agree to participate in this program under these conditions.</p>
  </div>
);

const PortalSignDocument: React.FC = () => {
    const { docId } = useParams<{ docId: string }>();
    const navigate = useNavigate();
    const [document, setDocument] = useState<ClientDocument | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSigned, setIsSigned] = useState(false);

    useEffect(() => {
        if (docId) {
            const fetchData = async () => {
                setIsLoading(true);
                const data = await getDocumentForSigning(docId);
                setDocument(data);
                setIsLoading(false);
            };
            fetchData();
        }
    }, [docId]);

    const handleSaveSignature = async (signatureDataUrl: string) => {
        if (docId) {
            await saveClientSignature(docId, signatureDataUrl);
            setIsSigned(true);
        }
    };

    if (isLoading) {
        return <PortalLayout><div className="text-center">Loading document...</div></PortalLayout>;
    }
    
    if (!document) {
        return <PortalLayout><div className="text-center">Document not found.</div></PortalLayout>;
    }

    if (isSigned) {
         return (
            <PortalLayout>
                <div className="max-w-2xl mx-auto">
                    <Card>
                        <div className="text-center p-4">
                            <ShieldCheckIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
                            <h1 className="text-2xl font-bold">Document Signed Successfully</h1>
                            <p className="text-on-surface-secondary mt-2">Thank you. A confirmation has been sent to your records.</p>
                            <button
                                onClick={() => navigate('/portal/documents')}
                                className="mt-6 bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-focus transition w-full font-semibold"
                            >
                                Return to My Documents
                            </button>
                        </div>
                    </Card>
                </div>
            </PortalLayout>
        );
    }
    
    return (
        <PortalLayout>
            <div className="max-w-2xl mx-auto">
                 <Card>
                    <h1 className="text-h1 font-bold text-center mb-2 leading-tight">{document.title}</h1>
                    <p className="text-center text-on-surface-secondary mb-6">Please read the document below and provide your e-signature.</p>
                    
                    <ConsentText />

                    <div className="mt-8">
                        <label className="block text-sm font-medium text-on-surface-secondary mb-2">Please sign in the box below:</label>
                        <SignaturePad onSave={handleSaveSignature} />
                    </div>
                 </Card>
            </div>
        </PortalLayout>
    );
};

export default PortalSignDocument;