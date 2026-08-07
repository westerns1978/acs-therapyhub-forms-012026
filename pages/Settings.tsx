
import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import { checkSupabaseConnection } from '../services/api';
import { TRIAL_HIDE_SETTINGS_MANUAL_CONFIG } from '../config/trialMode';
// googleCalendar / zoom imports removed 2026-08-07 with the connect cards. Both
// service modules are kept on disk for a service-account rebuild (DEFERRED #45);
// this page simply no longer offers a button that stores an unreadable token.
import { Loader2, Wifi, WifiOff, Terminal, Video, FlaskConical } from 'lucide-react';
import { useDemoVisibility } from '../hooks/useDemoVisibility';

/* INTEGRATION CONNECT CARDS REMOVED (2026-08-07).
 *
 * A dead `IntegrationCard` (a setTimeout-driven fake OAuth) was deleted here in
 * the 2026-06-11 honesty pass. GoogleCalendarCard and ZoomCard replaced it and
 * were real PKCE OAuth — but they have now gone the same way, for the same
 * reason: they were buttons that appeared to work and did nothing.
 *
 * Both wrote a token to public.user_integrations keyed on the id the caller
 * passed, and BOTH read paths were broken in the same way. That table's
 * `user_id` is `text`, and its two rows were keyed on legacy app-level ids
 * ('staff-david-yoder', 'u1') from the pre-Supabase-auth AuthContext, while
 * every caller now sends a Supabase auth UUID. The lookup could never match, and
 * both call sites swallow failure by design (a calendar or Zoom error must not
 * block a booking), so it failed silently for months.
 *
 * Measured before removal: 0 of 100 appointments carried a google_event_id, and
 * all 8 carrying a zoom_meeting_id got it from the WS6 standing-group branch
 * (counselors.zoom_meeting_id, which never touches this integration) — zero were
 * created through the Zoom API. Both user_integrations rows are deleted; the
 * Google write-through is gone from ScheduleSessionModal.
 *
 * Connecting today would store a credential nothing can read. For Google that
 * credential was a personal account token carrying 36 scopes including Gmail and
 * Drive. Offering the button again without fixing the id mismatch would invite
 * exactly that.
 *
 * services/googleCalendar.ts, services/zoom.ts and all the edge functions are
 * LEFT IN PLACE for a service-account rebuild. See DEFERRED #45 for the three
 * options and the non-negotiables.
 *
 * STILL LIVE, deliberately untouched: the ad-hoc Zoom mint branch at
 * ScheduleSessionModal:269. It is gated on isZoomLinked() (a localStorage flag)
 * which nothing can set now that this card is gone, so it is unreachable rather
 * than removed — that call site is the thing a rebuild would re-point, and
 * deleting it would throw away the shape. Recorded in DEFERRED #45.
 */

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

/**
 * "Show demo data" — the ONE control for demo-row visibility (replaced the
 * `?demo=1` URL parameter, 2026-07-28). Per-user, persisted, default OFF.
 * Turning it on lights the header's "Demo data" badge on every screen.
 */
const DemoDataCard: React.FC = () => {
    const { showDemo, setShowDemo } = useDemoVisibility();
    return (
        <Card title="Demo data" subtitle="Sample clients for training and demonstration — not real records.">
            <label className="flex items-start justify-between gap-4 cursor-pointer">
                <span className="min-w-0">
                    <span className="block font-bold text-sm text-slate-800 dark:text-slate-100">Show demo data</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Adds sample clients, sessions, and notes to every list so the app can be shown
                        or practised on. They are clearly marked and are never real client records.
                        While this is on, a <span className="font-bold">Demo data</span> badge stays in
                        the header. Off by default; the setting is yours alone.
                    </span>
                </span>
                <button
                    type="button"
                    role="switch"
                    aria-checked={showDemo}
                    aria-label="Show demo data"
                    onClick={() => setShowDemo(!showDemo)}
                    className={`relative shrink-0 mt-0.5 h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                        showDemo ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${showDemo ? 'left-[1.375rem]' : 'left-0.5'}`} />
                </button>
            </label>
            {showDemo && (
                <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
                    <FlaskConical size={14} className="shrink-0 mt-px" />
                    Demo data is visible. Lists include sample clients alongside real ones.
                </p>
            )}
        </Card>
    );
};

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
                    <Card title="External Integrations" subtitle="No calendar or meeting sync is connected.">
                        {/* The Google Calendar and Zoom connect buttons lived here until
                            2026-08-07. Both stored a credential nothing could read — see
                            the block comment at the top of this file. Rather than leave a
                            control that lies, the section states the actual position. */}
                        <p className="text-sm text-on-surface-secondary">
                            Sessions are not pushed to an external calendar. Group sessions
                            reuse each counselor&rsquo;s permanent Zoom room, which is set on
                            the counselor record — not through an integration here.
                        </p>

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
                                    <p className="text-[10px] text-gray-500 mt-1">Used for "Start transcribed session" buttons when OAuth is unavailable.</p>
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
                    <DemoDataCard />
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