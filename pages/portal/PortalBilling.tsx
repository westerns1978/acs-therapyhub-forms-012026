

import React, { useState, useEffect } from 'react';
import PortalLayout from '../../layouts/PortalLayout';
import Header from '../../components/ui/Header';
import Card from '../../components/ui/Card';
// Fix: Correctly import getBillingSummary from the services API.
import { getBillingSummary, getClient } from '../../services/api';
import { BillingSummary, Client, Transaction } from '../../types';

const DollarSignIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const CreditCardIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>;

const PortalBilling: React.FC = () => {
    const [client, setClient] = useState<Client | null>(null);
    const [summary, setSummary] = useState<BillingSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            // Using a fixed client ID for demo purposes
            const [clientData, summaryData] = await Promise.all([
                getClient('1'),
                getBillingSummary('1')
            ]);
            setClient(clientData || null);
            setSummary(summaryData);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    if (isLoading || !client || !summary) {
        return <PortalLayout><div className="text-center">Loading billing information...</div></PortalLayout>;
    }

    return (
        <PortalLayout>
            <div className="max-w-4xl mx-auto">
                <Header title="Billing & Payments" subtitle={`Account details for ${client.name}`} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <Card>
                        <p className="text-sm text-on-surface-secondary">Current Balance</p>
                        <p className={`text-3xl font-bold ${summary.currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ${summary.currentBalance.toFixed(2)}
                        </p>
                    </Card>
                    <Card>
                        <p className="text-sm text-on-surface-secondary">Payment Method</p>
                        <div className="flex items-center gap-2 mt-2">
                            <CreditCardIcon className="w-6 h-6 text-primary" />
                            <p className="text-lg font-semibold">{summary.paymentMethod}</p>
                        </div>
                    </Card>
                     <Card className="flex items-center justify-center">
                        <button className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-primary-focus transition">
                            Make a Payment
                        </button>
                    </Card>
                </div>

                <Card title="Transaction History" noPadding>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border">
                            <thead className="bg-surface">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase">Description</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-on-surface-secondary uppercase">Charge</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-on-surface-secondary uppercase">Payment</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-on-surface-secondary uppercase">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="bg-background divide-y divide-border">
                                {summary.transactions.map(tx => (
                                    <tr key={tx.id}>
                                        <td className="px-6 py-4">{tx.date}</td>
                                        <td className="px-6 py-4">{tx.description}</td>
                                        <td className="px-6 py-4 text-right text-red-600">{tx.charge ? `$${tx.charge.toFixed(2)}` : '-'}</td>
                                        <td className="px-6 py-4 text-right text-green-600">{tx.payment ? `$${tx.payment.toFixed(2)}` : '-'}</td>
                                        <td className="px-6 py-4 text-right font-semibold">${tx.balance.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </PortalLayout>
    );
};

export default PortalBilling;