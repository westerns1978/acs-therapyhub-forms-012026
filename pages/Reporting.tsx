import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import { getRevenueData, getComplianceTrendData } from '../services/api';
import { RevenueDataPoint, ComplianceDataPoint } from '../types';
import RevenueChart from '../components/charts/RevenueChart';
import ComplianceTrendChart from '../components/charts/ComplianceTrendChart';
import MeetingSummary from '../components/reports/MeetingSummary';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const DownloadIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>;

const Reporting: React.FC = () => {
    const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
    const [complianceData, setComplianceData] = useState<ComplianceDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPrinting, setIsPrinting] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const [revData, compData] = await Promise.all([
                getRevenueData(),
                getComplianceTrendData()
            ]);
            setRevenueData(revData);
            setComplianceData(compData);
            setIsLoading(false);
        }
        fetchData();
    }, []);
    
    const handlePrint = () => {
        setIsPrinting(true);
    };

    if (isLoading) {
        return <LoadingSpinner />;
    }

    return (
        <div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3">
                    <Card title="Monthly Revenue by Program">
                        <div style={{ height: '400px' }}>
                           <RevenueChart data={revenueData} />
                        </div>
                    </Card>
                </div>
                <div className="lg:col-span-2">
                    <Card title="Overall Compliance Trend">
                        <div style={{ height: '400px' }}>
                           <ComplianceTrendChart data={complianceData} />
                        </div>
                    </Card>
                </div>
            </div>
            
            {isPrinting && <MeetingSummary onDone={() => setIsPrinting(false)} />}
        </div>
    );
};

export default Reporting;