
import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import { checkSupabaseConnection } from '../services/api';
import { TRIAL_HIDE_SETTINGS_MANUAL_CONFIG } from '../config/trialMode';
import {
    beginGoogleOAuth,
    isGoogleOAuthConfigured,
    isGoogleCalendarLinked,
    clearGoogleCalendarLink,
    getConnectedGoogleAccountEmail,
} from '../services/googleCalendar';
import {
    beginZoomOAuth,
    isZoomOAuthConfigured,
    isZoomLinked,
    clearZoomLink,
    getConnectedZoomAccountEmail,
} from '../services/zoom';
import { Loader2, Check, Wifi, WifiOff, Terminal, Video } from 'lucide-react';

// NOTE (pre-provisioning honesty pass, 2026-06-11): a dead `IntegrationCard`
// component used to live here — a setTimeout-driven fake OAuth ("Verifying
// Credentials… → Connection Successful!") that earned nothing. It was never
// rendered anywhere; deleted rather than flag-hidden. The two cards below are
// the real integrations: PKCE OAuth + edge-function token exchange, and their
// "Active" chips are set only after a successful exchange.
const GoogleCalendarCard: React.FC = () => {
    const configured = isGoogleOAuthConfigured();
    const [linked, setLinked] = useState<boolean>(isGoogleCalendarLinked());
    const [email, setEmail] = useState<string | null>(getConnectedGoogleAccountEmail());
    const [isConnecting, setIsConnecting] = useState(false);

    const handleConnect = async () => {
        try {
            setIsConnecting(true);
            await beginGoogleOAuth(); // redirects — no code after this runs
        } catch (e: any) {
            setIsConnecting(false);
            alert(e?.message || 'Could not start Google connection.');
        }
    };

    const handleDisconnect = () => {
        if (!window.confirm('Disconnect Google Calendar? New sessions will no longer be pushed to your calendar. (Existing events are not removed.)')) return;
        clearGoogleCalendarLink();
        setLinked(false);
        setEmail(null);
    };

    return (
        <div className="flex items-center justify-between p-4 bg-surface dark:bg-slate-800/50 rounded-lg border border-border dark:border-slate-700 transition-all hover:border-primary/50">
            <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    Google Calendar
                    {linked && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full flex items-center gap-1"><Check size={10}/> Active</span>}
                    {!configured && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Not configured</span>}
                </h3>
                <p className="text-sm text-on-surface-secondary">
                    {linked && email
                        ? `Sessions will be pushed to ${email}.`
                        : 'Push new sessions to your Google Calendar automatically.'}
                </p>
                {!configured && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                        Set <code>VITE_GOOGLE_CLIENT_ID</code> and deploy the
                        <code> google-oauth-exchange</code> edge function to enable.
                    </p>
                )}
            </div>
            <div className="flex items-center gap-4">
                <button
                    onClick={linked ? handleDisconnect : handleConnect}
                    disabled={!configured || isConnecting}
                    className={`px-4 py-2 rounded-md text-sm font-semibold text-white transition-all min-w-[120px] flex justify-center items-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${linked ? 'bg-white text-red-600 border border-red-200 hover:bg-red-50' : 'bg-primary hover:bg-primary-focus'}`}
                >
                    {isConnecting ? <Loader2 size={16} className="animate-spin"/> : linked ? 'Disconnect' : 'Connect'}
                </button>
            </div>
        </div>
    );
};

const ZoomCard: React.FC = () => {
    const configured = isZoomOAuthConfigured();
    const [linked, setLinked] = useState<boolean>(isZoomLinked());
    const [email, setEmail] = useState<string | null>(getConnectedZoomAccountEmail());
    const [isConnecting, setIsConnecting] = useState(false);

    const handleConnect = async () => {
        try {
            setIsConnecting(true);
            await beginZoomOAuth(); // redirects — no code after this runs
        } catch (e: any) {
            setIsConnecting(false);
            alert(e?.message || 'Could not start Zoom connection.');
        }
    };

    const handleDisconnect = () => {
        if (!window.confirm('Disconnect Zoom? New telehealth sessions will fall back to a manual link.')) return;
        clearZoomLink();
        setLinked(false);
        setEmail(null);
    };

    return (
        <div className="flex items-center justify-between p-4 bg-surface dark:bg-slate-800/50 rounded-lg border border-border dark:border-slate-700 transition-all hover:border-primary/50">
            <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    Zoom Meetings
                    {linked && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full flex items-center gap-1"><Check size={10}/> Active</span>}
                    {!configured && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Not configured</span>}
                </h3>
                <p className="text-sm text-on-surface-secondary">
                    {linked && email
                        ? `Telehealth sessions auto-create Zoom meetings on ${email}.`
                        : 'Auto-create a secure Zoom meeting for every telehealth session.'}
                </p>
                {!configured && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                        Set <code>VITE_ZOOM_CLIENT_ID</code> and deploy the
                        <code> zoom-oauth-exchange</code> edge function to enable.
                    </p>
                )}
            </div>
            <div className="flex items-center gap-4">
                <button
                    onClick={linked ? handleDisconnect : handleConnect}
                    disabled={!configured || isConnecting}
                    className={`px-4 py-2 rounded-md text-sm font-semibold text-white transition-all min-w-[120px] flex justify-center items-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${linked ? 'bg-white text-red-600 border border-red-200 hover:bg-red-50' : 'bg-primary hover:bg-primary-focus'}`}
                >
                    {isConnecting ? <Loader2 size={16} className="animate-spin"/> : linked ? 'Disconnect' : 'Connect'}
                </button>
            </div>
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
    const [zoomPMI, setZoomPMI] = useState(localStorage.getItem('zoom_pmi') || '');

    const saveSettings = () => {
        localStorage.setItem('zoom_pmi', zoomPMI);
        alert("Configuration saved!");
    };

    return (
        <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <Card title="External Integrations" subtitle="Connect your workflow tools.">
                        <div className="space-y-4">
                            <GoogleCalendarCard />
                            <ZoomCard />
                        </div>

                        {/* Manual Configuration (Zoom PMI) — TRIAL-HIDDEN: `zoom_pmi`
                            has zero readers in the app, so "Save Configurations" stored
                            a value nothing consumes. Restorable via
                            TRIAL_HIDE_SETTINGS_MANUAL_CONFIG once a real consumer exists. */}
                        {!TRIAL_HIDE_SETTINGS_MANUAL_CONFIG && (
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

                                <button onClick={saveSettings} className="w-full py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-sm hover:bg-primary-focus transition">
                                    Save Configurations
                                </button>
                            </div>
                        </div>
                        )}
                    </Card>
                </div>
                 <div className="space-y-6">
                    <DatabaseHealthCard />
                    {/* "System Administration / Reset Application Data" card REMOVED
                        (pre-provisioning honesty pass, 2026-06-11): the button only
                        re-cloned the legacy in-memory mock arrays (services/api.ts
                        resetDemoData → data/database.ts initializeDatabase) — it never
                        touched Supabase, and the reload it triggered rebuilt that state
                        anyway. A destructive-looking placebo must not sit in front of a
                        real Director. resetDemoData stays exported for internal use. */}
                </div>
            </div>
        </div>
    );
};

export default Settings;