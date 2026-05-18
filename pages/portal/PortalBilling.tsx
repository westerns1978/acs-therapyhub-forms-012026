import React, { useState, useEffect } from 'react';
import PortalLayout from '../../layouts/PortalLayout';
import Header from '../../components/ui/Header';
import Card from '../../components/ui/Card';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../services/supabase';
import { usePortalClient } from '../../hooks/usePortalClient';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { CreditCard, Download, ArrowUpRight, Loader2, AlertTriangle } from 'lucide-react';

const PortalBilling: React.FC = () => {
    const portalClient = usePortalClient();
    const [billingData, setBillingData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaying, setIsPaying] = useState(false);
    const [payError, setPayError] = useState<string | null>(null);

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

    const handlePayNow = async () => {
        if (isPaying) return;
        const balance = Math.max(0, Number(billingData?.balance) || 0);
        const amountCents = Math.round(balance * 100) || 4900;
        setPayError(null);
        setIsPaying(true);
        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/acs-create-checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    amount_cents: amountCents,
                    description: balance > 0 ? 'ACS Session Balance' : 'ACS Intake Fee',
                    return_url: window.location.href,
                    client_id: portalClient?.id,
                    client_email: (portalClient as any)?.email,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.checkout_url) {
                throw new Error(data?.detail || data?.error || 'Could not start checkout.');
            }
            window.location.href = data.checkout_url;
        } catch (err: any) {
            setPayError(err?.message || 'Payment could not start. Please try again.');
            setIsPaying(false);
        }
    };

    if (isLoading || !portalClient) return <PortalLayout><div className="flex justify-center items-center h-64"><LoadingSpinner /></div></PortalLayout>;

    const paymentStatus = new URLSearchParams(window.location.search).get('payment');

    return (
        <PortalLayout>
            <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
                <Header title="Billing & Payments" subtitle="Manage your balance, payment methods, and view history." />

                {paymentStatus === 'success' && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-green-800">
                        <p className="font-black text-sm">Payment received (test mode)</p>
                        <p className="text-xs mt-1">Your transaction is being processed. Real-time balance updates after the webhook lands.</p>
                    </div>
                )}
                {paymentStatus === 'cancelled' && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800">
                        <p className="font-black text-sm">Payment cancelled</p>
                        <p className="text-xs mt-1">No charge was made. You can retry whenever you're ready.</p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-primary text-white border-none shadow-xl shadow-primary/20">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Current Balance</p>
                            <span className="text-[9px] font-black uppercase tracking-widest bg-white/15 border border-white/30 rounded-full px-2 py-0.5">TEST MODE</span>
                        </div>
                        <h3 className="text-4xl font-black mt-2">${billingData.balance.toFixed(2)}</h3>
                        <button
                            onClick={handlePayNow}
                            disabled={isPaying}
                            className="mt-6 w-full py-3 bg-white text-primary rounded-xl font-black text-sm shadow-lg hover:scale-105 transition-all disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2"
                        >
                            {isPaying ? (<><Loader2 size={16} className="animate-spin" /> STARTING CHECKOUT</>) : (billingData.balance > 0 ? 'PAY BALANCE' : 'PAY INTAKE FEE')}
                        </button>
                        {payError && (
                            <div className="mt-3 flex items-start gap-2 text-[11px] bg-white/15 border border-white/30 rounded-xl p-2">
                                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                <span className="leading-snug">{payError}</span>
                            </div>
                        )}
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
                                            <p className="text-sm font-black text-slate-800 dark:text-slate-100">{tx.description || tx.payment_type || 'Service Fee'}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">
                                                {tx.payment_method ? `${tx.payment_method} · ` : ''}Ref: {tx.external_payment_id || tx.id.substring(0, 8)}
                                            </p>
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
