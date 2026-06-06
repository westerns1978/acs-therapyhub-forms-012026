import React, { useState, useEffect } from 'react';
import PortalLayout from '../../layouts/PortalLayout';
import Header from '../../components/ui/Header';
import Card from '../../components/ui/Card';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../services/supabase';
import { usePortalClient } from '../../hooks/usePortalClient';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import BillingLedger from '../../components/billing/BillingLedger';
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
                // Hero balance + Stripe "pay unpaid charges" still need the client's own
                // charges here; the itemized charges/payments tables are rendered by the
                // shared <BillingLedger> below (read-only in the portal). Same real ledger.
                const { data: clientData } = await supabase
                    .from('clients')
                    .select('balance')
                    .eq('id', portalClient.id)
                    .single();

                const { data: charges } = await supabase
                    .from('charges')
                    .select('*')
                    .eq('client_id', portalClient.id)
                    .order('created_at', { ascending: false });

                const { data: payments } = await supabase
                    .from('payments')
                    .select('*')
                    .eq('client_id', portalClient.id)
                    .order('payment_date', { ascending: false });

                setBillingData({
                    balance: Number(clientData?.balance ?? 0),
                    paymentMethod: payments && payments.length ? (payments[0].payment_method || 'None') : 'None',
                    charges: charges || [],
                    transactions: payments || []
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
        setPayError(null);
        setIsPaying(true);
        try {
            // Prefer paying the actual unpaid charges (so the webhook can mark them paid);
            // fall back to the raw balance amount only when there are no itemized charges.
            const unpaidChargeIds = (billingData?.charges || [])
                .filter((c: any) => c.status === 'pending')
                .map((c: any) => c.id);
            const balance = Math.max(0, Number(billingData?.balance) || 0);
            const amountCents = Math.round(balance * 100) || 4900;
            const res = await fetch(`${SUPABASE_URL}/functions/v1/acs-create-checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    client_id: portalClient?.id,
                    client_email: (portalClient as any)?.email,
                    return_url: window.location.href,
                    ...(unpaidChargeIds.length
                        ? { charge_ids: unpaidChargeIds }
                        : { amount_cents: amountCents, description: balance > 0 ? 'ACS Session Balance' : 'ACS Intake Fee' }),
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

                {/* Itemized ledger (charges + payment history) — shared component, read-only here. */}
                <BillingLedger clientId={portalClient.id} showSummary={false} />
            </div>
        </PortalLayout>
    );
};

export default PortalBilling;
