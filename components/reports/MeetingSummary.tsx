import React, { useEffect } from 'react';

interface MeetingSummaryProps {
    onDone: () => void;
}

const MeetingSummary: React.FC<MeetingSummaryProps> = ({ onDone }) => {

    useEffect(() => {
        const originalTitle = document.title;
        document.title = 'ACS-TherapyHub-Meeting-Summary';
        
        // Hide scrollbars and other UI elements for printing
        document.body.style.overflow = 'hidden';
        const root = document.getElementById('root');
        if (root) root.style.display = 'none';

        setTimeout(() => {
            window.print();
            
            // Cleanup after printing
            document.title = originalTitle;
            if (root) root.style.display = 'block';
            document.body.style.overflow = 'auto';
            onDone();
        }, 500); // Small delay to ensure styles are applied

    }, [onDone]);

    return (
        <div id="print-content" className="fixed inset-0 bg-white z-[100] p-8 font-sans text-gray-800 overflow-y-auto">
            <style>{`
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .no-print { display: none; }
                }
            `}</style>
            <div className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center pb-4 border-b">
                     <img src="https://storage.googleapis.com/westerns1978-digital-assets/Websites/acs-therapy/ACS-Logo1.svg" alt="ACS Logo" className="h-12" />
                    <div>
                        <h1 className="text-2xl font-bold">ACS TherapyHub Platform Overview</h1>
                        <p className="text-right text-gray-600">Generated: {new Date().toLocaleDateString()}</p>
                    </div>
                </header>

                <section className="my-8">
                    <h2 className="text-xl font-semibold border-b-2 border-primary pb-2 mb-4">Key Features Overview</h2>
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-bold">1. AI-Powered Clinical Insights</h3>
                            <p className="text-base text-gray-700">TherapyHub leverages the Google Gemini API to provide real-time assistance. This includes one-click SOAP note generation from session transcripts and AI-powered analysis of client compliance scores, turning raw data into actionable clinical insights and saving valuable administrative time.</p>
                            <img src="https://storage.googleapis.com/my-first-project-content/ACS%20Therapy%20Hub/screenshot-ai-analysis.png" alt="AI Analysis Screenshot" className="mt-2 rounded-lg shadow-md border w-full"/>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">2. Comprehensive Compliance Tracking</h3>
                            <p className="text-base text-gray-700">Monitor client progress against court-mandated requirements like the 75-hour SROP program. The system includes visual progress trackers, gamification badges, and an automated timeline of compliance events (e.g., court reports, reassessments) to ensure nothing falls through the cracks.</p>
                             <img src="https://storage.googleapis.com/my-first-project-content/ACS%20Therapy%20Hub/screenshot-compliance-tracking.png" alt="Compliance Tracking Screenshot" className="mt-2 rounded-lg shadow-md border w-full"/>
                        </div>
                         <div>
                            <h3 className="text-lg font-bold">3. Document Intelligence Hub</h3>
                            <p className="text-base text-gray-700">Digitize your document workflow. Scan court orders, medical records, or other documents using hardware scanners or a camera. The AI processes the documents, extracts key data points and deadlines, and allows you to create trackable compliance tasks with a single click.</p>
                             <img src="https://storage.googleapis.com/my-first-project-content/ACS%20Therapy%20Hub/screenshot-doc-intel.png" alt="Document Intelligence Screenshot" className="mt-2 rounded-lg shadow-md border w-full"/>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">4. Empowering Client Portal</h3>
                            <p className="text-base text-gray-700">Clients are given a secure portal to track their own progress, view upcoming appointments, manage documents requiring e-signature, and see their billing history. This increases client accountability and reduces administrative workload for staff.</p>
                        </div>
                    </div>
                </section>
                
                <footer className="text-center text-xs text-gray-500 pt-4 border-t">
                    Confidential & Proprietary | ACS TherapyHub
                </footer>
            </div>
        </div>
    );
};

export default MeetingSummary;