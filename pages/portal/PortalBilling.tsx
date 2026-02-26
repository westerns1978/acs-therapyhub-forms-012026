import React, { useState, useEffect } from 'react';
import PortalLayout from '../../layouts/PortalLayout';
import Header from '../../components/ui/Header';
import Card from '../../components/ui/Card';
import { supabase } from '../../services/supabase';
import { usePortalClient } from '../../hooks/usePortalClient';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { DollarSign, CreditCard, History, Download, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

const PortalBilling: React.FC = () => {
    const portalClient = usePortalClient();
    const [billingData, setBillingData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!portalClient) return;
        const fetchBilling = async () => {
            setIsLoading(true);
            try {
                // Get client balance and payment info
                const { data: clientData } = await supabase
                    .from('clients')
                    .select('balance, payment_method')
                    .eq('id', portalClient.id)
                    .single();

                // Get transaction history
                const { data: transactions } = await supabase
                    .from('payments')
                    .select('*')
                    .eq('client_id', portalClient.id)
                    .order('payment_date', { ascending: false });

                setBillingData({
                    balance: clientData?.balance || 0,
                    paymentMethod: clientData?.payment_method || 'None',
                    transactions: transactions || []
                });
            } catch (err) {
                console.warn('Failed to fetch billing:', err);
            }
            setIsLoading(false);
        };
        fetchBilling();
    }, [portalClient]);

    if (isLoading || !portalClient) return <PortalLayout><div className="flex justify-center items-center h-64"><LoadingSpinner /></div></PortalLayout>;

    return (
        <PortalLayout>
            <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
                <Header title="Billing & Payments" subtitle="Manage your balance, payment methods, and view history." />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-primary text-white border-none shadow-xl shadow-primary/20">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Current Balance</p>
                        <h3 className="text-4xl font-black mt-2">${billingData.balance.toFixed(2)}</h3>
                        <button className="mt-6 w-full py-3 bg-white text-primary rounded-xl font-black text-sm shadow-lg hover:scale-105 transition-all">
                            PAY NOW
                        </button>
                    </Card>

                    <Card title="Payment Method">
                        <div className="flex items-center gap-4 mt-2">
                            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                                <CreditCard className="text-primary" />
                            </div>
                            <div>
                                <p className="font-black text-slate-800 dark:text-slate-100">{billingData.paymentMethod}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Method</p>
                            </div>
                        </div>
                        <button className="mt-6 text-primary font-bold text-sm hover:underline">Update Method</button>
                    </Card>

                    <Card title="Quick Actions">
                        <div className="space-y-3 mt-2">
                            <button className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 transition-colors">
                                <span className="text-sm font-bold">Download Tax Statement</span>
                                <Download size={16} className="text-slate-400" />
                            </button>
                            <button className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 transition-colors">
                                <span className="text-sm font-bold">Insurance Claims</span>
                                <ArrowUpRight size={16} className="text-slate-400" />
                            </button>
                        </div>
                    </Card>
                </div>

                <Card title="Transaction History">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                {billingData.transactions.map((tx: any) => (
                                    <tr key={tx.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="py-4 text-sm font-bold text-slate-500">
                                            {new Date(tx.payment_date).toLocaleDateString()}
                                        </td>
                                        <td className="py-4">
                                            <p className="text-sm font-black text-slate-800 dark:text-slate-100">{tx.payment_type || 'Service Fee'}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">Ref: {tx.id.substring(0, 8)}</p>
                                        </td>
                                        <td className="py-4">
                                            <span className={`text-sm font-black ${tx.amount < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                {tx.amount < 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="py-4 text-right">
                                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-green-100 text-green-700 rounded-md">
                                                {tx.status || 'Success'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {billingData.transactions.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-12 text-center text-slate-500 font-medium italic">
                                            No recent transactions found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </PortalLayout>
    );
};

export default PortalBilling;
