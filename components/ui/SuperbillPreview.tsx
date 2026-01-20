import React from 'react';
import { Client, SessionRecord } from '../../types';

interface SuperbillPreviewProps {
    client: Client;
    sessions: SessionRecord[];
}

const SuperbillPreview: React.FC<SuperbillPreviewProps> = ({ client, sessions }) => {
    const providerInfo = {
        name: 'Bill Sunderman, MEd, LPC',
        npi: '1234567890',
        license: 'LPC-202400123',
        address: '11648 Gravois, Suite 245, St. Louis, MO 63126',
        phone: '314-849-2800'
    };
    
    const totalAmount = sessions.reduce((acc, session) => acc + session.rate, 0);

    return (
        <div className="bg-white text-gray-800 p-8 font-sans text-sm">
            <header className="flex justify-between items-start mb-8">
                <div>
                    <img src="https://storage.googleapis.com/westerns1978-digital-assets/Websites/acs-therapy/ACS-Logo1.svg" alt="ACS Logo" className="h-12 object-contain" />
                    <div className="mt-2 text-xs text-gray-600">
                        <p>{providerInfo.address}</p>
                        <p>{providerInfo.phone}</p>
                    </div>
                </div>
                <div className="text-right">
                    <h1 className="text-2xl font-bold uppercase text-gray-700">Superbill</h1>
                    <p className="text-xs text-gray-500">Statement Date: {new Date().toLocaleDateString()}</p>
                </div>
            </header>
            
            <section className="grid grid-cols-2 gap-8 mb-8">
                <div className="border p-4 rounded-md">
                    <h2 className="font-bold text-gray-600 mb-2">PROVIDER</h2>
                    <p>{providerInfo.name}</p>
                    <p>NPI: {providerInfo.npi}</p>
                    <p>License: {providerInfo.license}</p>
                </div>
                 <div className="border p-4 rounded-md">
                    <h2 className="font-bold text-gray-600 mb-2">CLIENT</h2>
                    <p>{client.name}</p>
                    <p>Client ID: {client.id}</p>
                    {/* Add more client details like DOB, address as needed */}
                </div>
            </section>
            
            <section>
                 <h2 className="font-bold text-gray-600 mb-2 border-b pb-1">SERVICES RENDERED</h2>
                 <table className="w-full text-left">
                    <thead>
                        <tr className="border-b">
                            <th className="py-2">Date of Service</th>
                            <th className="py-2">Service (CPT Code)</th>
                            <th className="py-2">Diagnosis (ICD-10)</th>
                            <th className="py-2 text-right">Fee</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.map(session => (
                             <tr key={session.id} className="border-b border-gray-100">
                                <td className="py-2">{session.date.toLocaleDateString()}</td>
                                <td className="py-2">{session.type} (90834)</td>
                                <td className="py-2">F41.1 (GAD)</td>
                                <td className="py-2 text-right">${session.rate.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
            </section>
            
            <footer className="mt-8 text-right">
                <div className="text-lg font-bold">
                    <span>Total Amount Due:</span>
                    <span className="ml-4">${totalAmount.toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                    Please submit this form to your insurance provider for reimbursement.
                </p>
            </footer>

        </div>
    );
};

export default SuperbillPreview;