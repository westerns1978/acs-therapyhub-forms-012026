import React, { useState, useMemo, useEffect } from 'react';
import Card from '../components/ui/Card';
import ComplianceTimeline from '../components/compliance/ComplianceTimeline';
import AuditTrailTable from '../components/compliance/AuditTrailTable';
import ReportPreviewModal from '../components/ui/ReportPreviewModal';
import { getComplianceEvents, getAuditLogs, getClients, getSROPData, getSessionRecords } from '../services/api';
import { ComplianceEvent, AuditLog, StaffCertification, Client, SROPProgress, SessionRecord } from '../types';
import { dbStaffCertifications } from '../data/database';
import CourtReportPreview from '../components/compliance/CourtReportPreview';
import LoadingSpinner from '../components/ui/LoadingSpinner';


const ShieldCheckIcon = (props: React.ComponentProps<'svg'>) => <svg viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>;
const AlertTriangleIcon = (props: React.ComponentProps<'svg'>) => <svg viewBox="0 0 24 24" fill="currentColor" {...props}><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>;
const CalendarClockIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><path d="M17.5 17.5 16 16.25V14"/><path d="M22 16a6 6 0 1 1-12 0 6 6 0 0 1 12 0z"/></svg>;
const FileTextIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>;
const DownloadIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>;

const StatCard: React.FC<{ icon: React.ElementType; title: string; value: string | number; gradient: string; }> = ({ icon: Icon, title, value, gradient }) => (
    <div className={`relative p-0.5 rounded-2xl bg-gradient-to-r ${gradient} shadow-lg`}>
        <div className="bg-background/80 dark:bg-dark-surface/80 backdrop-blur-lg rounded-[15px] p-5 h-full transition-transform duration-300 hover:scale-[1.03]">
            <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <h3 className="font-semibold text-surface-secondary-content dark:text-dark-surface-secondary-content">{title}</h3>
                    <p className="text-3xl font-bold text-surface-content dark:text-dark-surface-content mt-1">{value}</p>
                </div>
                <Icon className="w-8 h-8 text-white/80" />
            </div>
        </div>
    </div>
);

const Compliance: React.FC = () => {
    const [isReportModalOpen, setReportModalOpen] = useState(false);
    const [reportContent, setReportContent] = useState({ title: '', content: <></> });
    const [complianceEvents, setComplianceEvents] = useState<ComplianceEvent[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [staffCerts, setStaffCerts] = useState<StaffCertification[]>(dbStaffCertifications);
    const [allSessionRecords, setAllSessionRecords] = useState<SessionRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const [events, logs, clientsData, sessionRecordsData] = await Promise.all([
                getComplianceEvents(),
                getAuditLogs(),
                getClients(),
                getSessionRecords('')
            ]);
            setComplianceEvents(events.map(e => ({...e, dueDate: new Date(e.dueDate)})));
            setAuditLogs(logs.map(l => ({...l, timestamp: new Date(l.timestamp)})));
            setClients(clientsData);
            setAllSessionRecords(sessionRecordsData.map(s => ({...s, date: new Date(s.date)})));
            setIsLoading(false);
        };
        fetchData();
    }, []);
    
    const complianceStats = useMemo(() => {
        const total = complianceEvents.length;
        const complete = complianceEvents.filter(e => e.status === 'complete').length;
        const overdue = complianceEvents.filter(e => e.status === 'overdue').length;
        const upcoming = complianceEvents.filter(e => e.status === 'upcoming').length;
        const score = total > 0 ? Math.round((complete / (total - upcoming)) * 100) : 100;
        return { score: isNaN(score) ? 100 : score, overdue, upcoming };
    }, [complianceEvents]);

    const handleGenerateCourtReport = async () => {
        const client = clients.find(c => c.id === '2'); // Using Bob Williams as the example non-compliant client
        if (!client) return;

        const [sropData, sessionRecords] = await Promise.all([
            getSROPData(client.id),
            getSessionRecords(client.id)
        ]);

        setReportContent({
            title: `Court Compliance Report: ${client.name}`,
            content: <CourtReportPreview client={client} sropData={sropData} sessionRecords={sessionRecords.map(s => ({...s, date: new Date(s.date)}))} />
        });
        setReportModalOpen(true);
    };
    
    const handleBulkExport = () => {
        const headers = ["Client Name", "Case Number", "Program", "Status", "Compliance Score", "Total Sessions", "Unpaid Balance"];
        const rows = clients.map(client => {
            const clientRecords = allSessionRecords.filter(r => r.clientId === client.id);
            const unpaid = clientRecords.filter(r => r.status === 'Unpaid').reduce((sum, r) => sum + r.rate, 0);
            return [
                client.name,
                client.caseNumber,
                client.program,
                client.status,
                client.complianceScore.toString(),
                clientRecords.length.toString(),
                unpaid.toFixed(2)
            ].join(',');
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `compliance_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    if (isLoading) {
        return <LoadingSpinner />
    }

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <StatCard 
                    icon={ShieldCheckIcon} 
                    title="Compliance Score" 
                    value={`${complianceStats.score}%`} 
                    gradient="from-secondary to-green-400" 
                />
                <StatCard 
                    icon={AlertTriangleIcon} 
                    title="Overdue Items" 
                    value={complianceStats.overdue} 
                    gradient="from-red-500 to-pink-500" 
                />
                <StatCard 
                    icon={CalendarClockIcon} 
                    title="Upcoming Deadlines" 
                    value={complianceStats.upcoming} 
                    gradient="from-yellow-500 to-orange-500" 
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <ComplianceTimeline events={complianceEvents} />
                    <Card title="Report Generation">
                        <div className="space-y-3">
                             <button onClick={handleGenerateCourtReport} className="w-full flex items-center gap-3 p-3 bg-surface dark:bg-dark-surface-secondary rounded-lg hover:bg-surface-secondary dark:hover:bg-dark-surface-secondary/50 transition font-semibold text-primary dark:text-dark-primary">
                                <FileTextIcon className="h-5 w-5" />
                                <span>Generate Court Report</span>
                            </button>
                             <button onClick={handleBulkExport} className="w-full flex items-center gap-3 p-3 bg-surface dark:bg-dark-surface-secondary rounded-lg hover:bg-surface-secondary dark:hover:bg-dark-surface-secondary/50 transition font-semibold text-surface-secondary-content dark:text-dark-surface-secondary-content">
                                <DownloadIcon className="h-5 w-5" />
                                <span>Bulk Export (CSV)</span>
                            </button>
                        </div>
                    </Card>
                    <Card title="Staff Certifications">
                        <ul className="space-y-3 text-sm">
                            {staffCerts.map(cert => {
                                const renewalDate = new Date(cert.renewalDate);
                                const isExpired = renewalDate < new Date();
                                return (
                                    <li key={cert.id} className="flex justify-between items-center p-2 bg-surface rounded-md">
                                        <div>
                                            <p className="font-semibold">{cert.staffName} <span className="text-xs font-mono text-surface-secondary-content">{cert.credential}</span></p>
                                            <p className={`text-xs ${isExpired ? 'text-red-600 font-bold' : 'text-surface-secondary-content'}`}>
                                                {isExpired ? 'EXPIRED:' : 'Renews:'} {renewalDate.toLocaleDateString()}
                                            </p>
                                        </div>
                                        <button className="text-xs font-semibold text-primary dark:text-dark-primary hover:underline">
                                            {isExpired ? 'Update' : 'View'}
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    </Card>
                </div>
                <div className="lg:col-span-2">
                    <AuditTrailTable logs={auditLogs} />
                </div>
            </div>

            <ReportPreviewModal
                isOpen={isReportModalOpen}
                onClose={() => setReportModalOpen(false)}
                reportTitle={reportContent.title}
            >
                {reportContent.content}
            </ReportPreviewModal>
        </div>
    );
};

export default Compliance;