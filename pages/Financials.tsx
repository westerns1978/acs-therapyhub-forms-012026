
import React, { useMemo, useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import { getPayments, getSessionRecords } from '../services/api';
import { Payment, SessionRecord } from '../types';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const DollarSignIcon = (props: React.ComponentProps<'svg'>) => <svg viewBox="0 0 24 24" fill="currentColor" {...props}><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const AlertCircleIcon = (props: React.ComponentProps<'svg'>) => <svg viewBox="0 0 24 24" fill="currentColor" {...props}><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>;
const TrendingUpIcon = (props: React.ComponentProps<'svg'>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;

const StatCard: React.FC<{ icon: React.ElementType; title: string; value: string; gradient: string; }> = ({ icon: Icon, title, value, gradient }) => (
    <div className={`relative p-0.5 rounded-2xl bg-gradient-to-r ${gradient} shadow-lg`}>
        <div className="bg-background/80 dark:bg-dark-surface/80 backdrop-blur-lg rounded-[15px] p-5 h-full transition-transform duration-300 hover:scale-[1.03]">
            <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <h3 className="text-base font-semibold text-surface-secondary-content dark:text-dark-surface-secondary-content">{title}</h3>
                    <p className="text-3xl font-bold text-surface-content dark:text-dark-surface-content mt-1">{value}</p>
                </div>
                <Icon className="w-8 h-8 text-white/80" />
            </div>
        </div>
    </div>
);

const getStatusColor = (status: Payment['status']) => {
    switch (status) {
        case 'Completed': return 'bg-green-100 text-green-800';
        case 'Pending': return 'bg-yellow-100 text-yellow-800';
        case 'Failed': return 'bg-red-100 text-red-800';
    }
};


const Financials: React.FC = () => {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const [paymentsData, recordsData] = await Promise.all([
                getPayments(),
                getSessionRecords('') // In real app, might fetch all or based on a date range
            ]);
            // FIX: Explicitly cast method and status to ensure they match the Payment union types.
            setPayments(paymentsData.map(p => ({
                ...p, 
                date: new Date(p.date),
                method: p.method as Payment['method'],
                status: p.status as Payment['status']
            })));
            setSessionRecords(recordsData);
            setIsLoading(false);
        };
        fetchData();
    }, []);
    
    const financialStats = useMemo(() => {
        const totalRevenue = payments.reduce((acc, p) => acc + p.amount, 0);
        const outstandingAR = sessionRecords.filter(s => s.status === 'Unpaid').reduce((acc, s) => acc + s.rate, 0);
        const thirtyDayRevenue = payments
            .filter(p => (new Date().getTime() - p.date.getTime()) / (1000 * 3600 * 24) <= 30)
            .reduce((acc, p) => acc + p.amount, 0);
        return { totalRevenue, outstandingAR, thirtyDayRevenue };
    }, [payments, sessionRecords]);
    
    const recentTransactions = [...payments].sort((a, b) => b.date.getTime() - a.date.getTime());

    if (isLoading) {
        return <LoadingSpinner />
    }

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <StatCard 
                    icon={DollarSignIcon} 
                    title="Total Revenue (Last 30 Days)" 
                    value={`$${financialStats.thirtyDayRevenue.toFixed(2)}`}
                    gradient="from-secondary to-green-400" 
                />
                <StatCard 
                    icon={AlertCircleIcon} 
                    title="Outstanding A/R" 
                    value={`$${financialStats.outstandingAR.toFixed(2)}`}
                    gradient="from-red-500 to-pink-500" 
                />
                <StatCard 
                    icon={TrendingUpIcon} 
                    title="YTD Revenue" 
                    value={`$${financialStats.totalRevenue.toFixed(2)}`}
                    gradient="from-primary to-accent" 
                />
            </div>
            
            <Card title="Recent Transactions" noPadding>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border dark:divide-dark-border">
                        <thead className="bg-surface dark:bg-dark-surface-secondary">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-surface-secondary-content dark:text-dark-surface-secondary-content uppercase tracking-wider">Date</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-surface-secondary-content dark:text-dark-surface-secondary-content uppercase tracking-wider">Client</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-surface-secondary-content dark:text-dark-surface-secondary-content uppercase tracking-wider">Method</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-surface-secondary-content dark:text-dark-surface-secondary-content uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-surface-secondary-content dark:text-dark-surface-secondary-content uppercase tracking-wider">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border dark:divide-dark-border">
                            {recentTransactions.slice(0, 10).map(tx => (
                                <tr key={tx.id} className="hover:bg-surface-secondary dark:hover:bg-dark-surface-secondary transition">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-surface-content dark:text-dark-surface-content">{tx.date.toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-content dark:text-dark-surface-secondary-content">{tx.clientName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-secondary-content dark:text-dark-surface-secondary-content">{tx.method}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(tx.status)}`}>
                                            {tx.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-surface-content dark:text-dark-surface-content">${tx.amount.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default Financials;