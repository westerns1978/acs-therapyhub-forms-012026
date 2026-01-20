
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';
import { getSyncedAppointments, resetDemoData, checkSupabaseConnection } from '../services/api';
import { Integration, SyncedAppointment } from '../types';
import { isGoogleCalendarConnected, connectGoogleCalendar, disconnectGoogleCalendar, isZoomConnected, connectZoom, disconnectZoom } from '../services/integrationService';
import { CheckCircleIcon, XCircleIcon, AlertTriangleIcon, HardDriveIcon, Loader2, RefreshCw, X, Check, Database, Wifi, WifiOff, Code, Terminal, Video, Calendar } from 'lucide-react';
import Modal from '../components/ui/Modal';

const IntegrationCard: React.FC<{ integration: Integration, onToggle: () => void }> = ({ integration, onToggle }) => {
    const [isConnecting, setIsConnecting] = useState(false);
    const [showAuthWindow, setShowAuthWindow] = useState(false);
    const [authStep, setAuthStep] = useState(0);
    
    const handleConnectClick = () => {
        if (integration.status === 'Connected') {
            onToggle(); // Disconnect immediately
        } else {
            setShowAuthWindow(true);
            setAuthStep(0);
            // Start simulation
            setTimeout(() => setAuthStep(1), 1000); // Authenticating...
            setTimeout(() => setAuthStep(2), 2500); // Requesting Permissions...
            setTimeout(() => {
                setShowAuthWindow(false);
                onToggle();
            }, 3500);
        }
    };

    return (
        <div className="flex items-center justify-between p-4 bg-surface dark:bg-slate-800/50 rounded-lg border border-border dark:border-slate-700 transition-all hover:border-primary/50">
            <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    {integration.name}
                    {integration.status === 'Connected' && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full flex items-center gap-1"><Check size={10}/> Active</span>}
                </h3>
                <p className="text-sm text-on-surface-secondary">{integration.description}</p>
            </div>
            <div className="flex items-center gap-4">
                <button 
                    onClick={handleConnectClick}
                    className={`px-4 py-2 rounded-md text-sm font-semibold text-white transition-all min-w-[120px] flex justify-center items-center shadow-sm ${integration.status === 'Connected' ? 'bg-white text-red-600 border border-red-200 hover:bg-red-50' : 'bg-primary hover:bg-primary-focus'}`}
                >
                    {integration.status === 'Connected' ? 'Disconnect' : 'Connect'}
                </button>
            </div>

            {showAuthWindow && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md text-center animate-fade-in-up border border-gray-200">
                        <div className="mb-6 flex justify-center">
                            {authStep < 2 ? (
                                <div className="relative">
                                    <div className="w-16 h-16 border-4 border-gray-200 border-t-primary rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center animate-bounce">
                                    <Check size={32} />
                                </div>
                            )}
                        </div>
                        <h4 className="text-xl font-bold mb-2 text-gray-900">
                            {authStep === 0 && `Connecting to ${integration.name}...`}
                            {authStep === 1 && "Verifying Credentials..."}
                            {authStep === 2 && "Connection Successful!"}
                        </h4>
                    </div>
                </div>
            )}
        </div>
    );
};

const DatabaseHealthCard = () => {
    const [status, setStatus] = useState<{connected: boolean, latency: number, message?: string} | null>(null);
    const [isChecking, setIsChecking] = useState(false);

    const check = async () => {
        setIsChecking(true);
        // FIX: The API returns { status: 'healthy' | 'offline', message: string }. 
        // We need to map this to our expected state: { connected: boolean, latency: number, message?: string }.
        const start = Date.now();
        const result = await checkSupabaseConnection();
        const latency = Date.now() - start;
        setStatus({
            connected: result.status === 'healthy',
            latency: latency,
            message: result.message
        });
        setIsChecking(false);
    };

    useEffect(() => {
        check();
    }, []);

    return (
        <Card title="Database Connection Health">
            <div className="flex flex-col gap-4">
                <div className={`p-4 rounded-lg border ${status?.connected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-3">
                        {status?.connected ? <Wifi className="text-green-600 w-6 h-6"/> : <WifiOff className="text-red-600 w-6 h-6"/>}
                        <div>
                            <h4 className={`font-bold ${status?.connected ? 'text-green-800' : 'text-red-800'}`}>
                                {status?.connected ? 'Supabase Connected' : 'Connection Failed'}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">
                                {status?.connected 
                                    ? `Latency: ${status.latency}ms. Operations are syncing normally.` 
                                    : `Error: ${status?.message || "Unknown network error"}. Using local fallback data.`}
                            </p>
                        </div>
                    </div>
                </div>
                <button onClick={check} disabled={isChecking} className="self-end text-sm font-semibold text-primary hover:underline flex items-center gap-1">
                    {isChecking && <Loader2 size={14} className="animate-spin"/>} Test Connection
                </button>
            </div>
        </Card>
    );
}

const Settings: React.FC = () => {
    const [googleConnected, setGoogleConnected] = useState(isGoogleCalendarConnected());
    const [zoomConnected, setZoomConnected] = useState(isZoomConnected());
    const [zoomPMI, setZoomPMI] = useState(localStorage.getItem('zoom_pmi') || '');
    const [calendarId, setCalendarId] = useState(localStorage.getItem('google_calendar_id') || '');
    const [isResetting, setIsResetting] = useState(false);

    const toggleGoogle = () => {
        if (googleConnected) disconnectGoogleCalendar(); else connectGoogleCalendar();
        setGoogleConnected(!googleConnected);
    };

    const toggleZoom = () => {
        if (zoomConnected) disconnectZoom(); else connectZoom();
        setZoomConnected(!zoomConnected);
    };

    const saveSettings = () => {
        localStorage.setItem('zoom_pmi', zoomPMI);
        localStorage.setItem('google_calendar_id', calendarId);
        alert("Configuration saved!");
    };

    const integrations: Integration[] = [
        { id: 'google_calendar', name: 'Google Calendar', status: googleConnected ? 'Connected' : 'Disconnected', description: 'Two-way sync for appointments and availability.' },
        { id: 'zoom', name: 'Zoom Meetings', status: zoomConnected ? 'Connected' : 'Disconnected', description: 'Generate secure meeting links automatically.' },
    ];

    const handleResetData = async () => {
        if (window.confirm("Are you sure? This will revert the app to its initial state.")) {
            setIsResetting(true);
            await resetDemoData();
            setIsResetting(false);
            window.location.reload();
        }
    };

    return (
        <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <Card title="External Integrations" subtitle="Connect your workflow tools.">
                        <div className="space-y-4">
                            {integrations.map(integration => (
                                <IntegrationCard 
                                    key={integration.id} 
                                    integration={integration} 
                                    onToggle={() => integration.id === 'google_calendar' ? toggleGoogle() : toggleZoom()} 
                                />
                            ))}
                        </div>
                        
                        {/* MVP: Manual Configuration */}
                        <div className="mt-6 p-6 border rounded-xl bg-gray-50 dark:bg-slate-800/50">
                            <h4 className="font-bold text-sm mb-4 flex items-center gap-2 uppercase tracking-wide text-gray-500">
                                <Terminal size={14}/> Manual Configuration (MVP)
                            </h4>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                                        <Video size={14} className="text-blue-500"/> Zoom Personal Meeting ID (PMI) Link
                                    </label>
                                    <input 
                                        type="text" 
                                        placeholder="https://zoom.us/j/your-pmi" 
                                        value={zoomPMI}
                                        onChange={(e) => setZoomPMI(e.target.value)}
                                        className="w-full p-2 border rounded-md text-sm bg-white dark:bg-slate-700"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">Used for "Start Session" buttons when OAuth is unavailable.</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                                        <Calendar size={14} className="text-orange-500"/> Google Calendar ID
                                    </label>
                                    <input 
                                        type="text" 
                                        placeholder="your.email@gmail.com" 
                                        value={calendarId}
                                        onChange={(e) => setCalendarId(e.target.value)}
                                        className="w-full p-2 border rounded-md text-sm bg-white dark:bg-slate-700"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">Primary calendar for availability checks.</p>
                                </div>

                                <button onClick={saveSettings} className="w-full py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-sm hover:bg-primary-focus transition">
                                    Save Configurations
                                </button>
                            </div>
                        </div>
                    </Card>
                </div>
                 <div className="space-y-6">
                    <DatabaseHealthCard />
                    <Card title="System Administration">
                         <button 
                            onClick={handleResetData}
                            disabled={isResetting}
                            className="w-full bg-red-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
                        >
                            {isResetting ? <Loader2 className="animate-spin"/> : null}
                            {isResetting ? 'Restoring...' : 'Reset Application Data'}
                        </button>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Settings;