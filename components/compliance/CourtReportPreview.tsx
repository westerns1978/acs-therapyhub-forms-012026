import React from 'react';
import { Client, SROPProgress, SessionRecord } from '../../types';

interface CourtReportPreviewProps {
    client: Client;
    sropData: SROPProgress | null;
    sessionRecords: SessionRecord[];
}

const CourtReportPreview: React.FC<CourtReportPreviewProps> = ({ client, sropData, sessionRecords }) => {
    const totalBilled = sessionRecords.reduce((acc, s) => acc + s.rate, 0);
    const outstanding = sessionRecords.filter(s => s.status === 'Unpaid').reduce((acc, s) => acc + s.rate, 0);

    return (
        <div className="bg-white text-gray-800 p-8 font-sans text-base">
            <header className="flex justify-between items-start mb-8">
                <div>
                    <img src="https://storage.googleapis.com/westerns1978-digital-assets/Websites/acs-therapy/ACS-Logo1.svg" alt="ACS Logo" className="h-12 object-contain" />
                    <p className="mt-2 text-xs text-gray-600">11648 Gravois, Suite 245, St. Louis, MO 63126</p>
                </div>
                <div className="text-right">
                    <h1 className="text-2xl font-bold uppercase text-gray-700">Court Compliance Report</h1>
                    <p className="text-sm text-gray-500">Report Date: {new Date().toLocaleDateString()}</p>
                </div>
            </header>
            
            <section className="grid grid-cols-2 gap-8 mb-6 border-y py-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-600 mb-2">CLIENT INFORMATION</h2>
                    <p><strong>Name:</strong> {client.name}</p>
                    <p><strong>Case Number:</strong> {client.caseNumber}</p>
                    <p><strong>Probation Officer:</strong> {client.probationOfficer}</p>
                </div>
                 <div className="text-right">
                    <h2 className="text-lg font-bold text-gray-600 mb-2">COMPLIANCE STATUS</h2>
                    <p className={`text-xl font-bold ${client.status === 'Compliant' ? 'text-green-600' : 'text-red-600'}`}>
                        {client.status.toUpperCase()}
                    </p>
                </div>
            </section>
            
            <section className="mb-6">
                <h2 className="text-lg font-bold text-gray-600 mb-2 border-b pb-1">PROGRAM PROGRESS (SROP)</h2>
                {sropData ? (
                    <>
                        {/* Fix: Use completionPercentage instead of non-existent progress property */}
                        <p><strong>Overall Progress:</strong> {client.completionPercentage}% Complete</p>
                        <p><strong>Phase I Hours:</strong> {sropData.phase1.completedHours} / {sropData.phase1.requiredHours}</p>
                        <p><strong>Phase II Hours:</strong> {sropData.phase2.completedHours} / {sropData.phase2.requiredHours}</p>
                    </>
                ) : <p>N/A</p>}
            </section>
            
            <section className="mb-6">
                 <h2 className="text-lg font-bold text-gray-600 mb-2 border-b pb-1">ATTENDANCE &amp; FINANCIALS</h2>
                 <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b">
                            <th className="py-2">Date</th><th className="py-2">Service</th><th className="py-2">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessionRecords.map(session => (
                             <tr key={session.id} className="border-b border-gray-100">
                                <td className="py-1">{new Date(session.date).toLocaleDateString()}</td>
                                <td className="py-1">{session.type}</td>
                                <td className="py-1">{session.status}</td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
                 <div className="text-right mt-2 font-semibold">
                    <p>Total Billed: ${totalBilled.toFixed(2)}</p>
                    <p>Outstanding Balance: <span className="text-red-600">${outstanding.toFixed(2)}</span></p>
                 </div>
            </section>

            <section>
                 <h2 className="text-lg font-bold text-gray-600 mb-2 border-b pb-1">DRUG SCREEN RESULTS</h2>
                 {sropData?.drugScreens.length ? (
                      <table className="w-full text-left text-sm">
                        <thead><tr className="border-b"><th className="py-2">Date</th><th className="py-2">Test Type</th><th className="py-2">Result</th></tr></thead>
                        <tbody>
                            {sropData.drugScreens.map(screen => (
                                <tr key={screen.chainOfCustodyId} className="border-b border-gray-100">
                                    <td className="py-1">{screen.date}</td>
                                    <td className="py-1">{screen.testType}</td>
                                    <td className={`py-1 font-bold ${screen.result === 'Positive' ? 'text-red-600' : 'text-green-600'}`}>{screen.result}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 ) : <p>No screens on record.</p>}
            </section>

            <footer className="mt-12 text-center text-xs text-gray-500 border-t pt-4">
                This report was electronically generated by ACS TherapyHub.
                <br/>
                Assessment & Counseling Solutions | 314-849-2800
            </footer>
        </div>
    );
};

export default CourtReportPreview;