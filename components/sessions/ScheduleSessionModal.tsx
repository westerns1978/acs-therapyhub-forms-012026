import React, { useState, useEffect } from 'react';
import { Client, Appointment, AppointmentType } from '../../types';
import { addAppointment, updateAppointment, analyzeTravelRisk, getGroupsWithCounselor, getTherapistAppointments, createRecurringSeries } from '../../services/api';
import { isGoogleCalendarLinked, createGoogleCalendarEvent } from '../../services/googleCalendar';
import { isZoomLinked, createZoomMeeting } from '../../services/zoom';
import { generateWeeklyOccurrences, detectOverlaps } from '../../services/recurrence';
import { formatTime12, parseTimeToMinutes } from '../../config/time';
import { useAuth } from '../../contexts/AuthContext';
import { MapPin, AlertTriangle, CheckCircle, Loader2, Repeat } from 'lucide-react';

interface ScheduleSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newAppointment: Appointment) => void;
    clients: Client[];
    preselectedClient?: Client;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ScheduleSessionModal: React.FC<ScheduleSessionModalProps> = ({ isOpen, onClose, onSave, clients, preselectedClient }) => {
    const { user } = useAuth();
    const [sessionType, setSessionType] = useState<AppointmentType>('SATOP Group');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState('18:00');
    const [endTime, setEndTime] = useState('20:00');
    const [capacity, setCapacity] = useState(15);
    const [selectedClientId, setSelectedClientId] = useState<string | undefined>(clients[0]?.id);

    // Booking-dropdown TYPE funnel (status → type). The clients passed in are already
    // status-scoped (active/completed) by getClients; this narrows by operational client_type.
    // No-op until client_type is populated — the control only renders when types exist.
    const [clientTypeFilter, setClientTypeFilter] = useState('All');
    const presentClientTypes = Array.from(
        new Set(clients.map(c => c.clientType).filter((t): t is string => !!t)),
    ).sort();
    const visibleClients = clientTypeFilter === 'All'
        ? clients
        : clients.filter(c => c.clientType === clientTypeFilter);

    // Recurring 1:1 series (1:1 only — group recurrence is out of scope this round).
    const MAX_OCCURRENCES = 52;
    const [isRecurring, setIsRecurring] = useState(false);
    const [occurrenceCount, setOccurrenceCount] = useState(6);
    const [isSaving, setIsSaving] = useState(false);

    // Smart Scheduling State
    const [travelRisk, setTravelRisk] = useState<'Low' | 'Medium' | 'High' | null>(null);
    const [riskReason, setRiskReason] = useState<string>('');
    const [isAnalyzingRisk, setIsAnalyzingRisk] = useState(false);

    // Deterministic therapist double-booking check (replaces the advisory Google free/busy).
    // A conflict is a real overlap against this therapist's existing appointments; policy is
    // warn-and-allow — staff may override with an explicit acknowledgement.
    interface ConflictHit { date: Date; startTime: string; endTime: string; withTitle: string; }
    const [conflicts, setConflicts] = useState<ConflictHit[]>([]);
    const [checkingConflicts, setCheckingConflicts] = useState(false);
    const [overrideConflicts, setOverrideConflicts] = useState(false);

    // WS6: optional standing group. When selected, the appointment inherits the counselor's
    // permanent Zoom room + the group's service_type and skips minting a throwaway meeting.
    const [groups, setGroups] = useState<any[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(undefined);
    useEffect(() => { if (isOpen) getGroupsWithCounselor().then(setGroups).catch(() => setGroups([])); }, [isOpen]);

    useEffect(() => {
        if (preselectedClient) {
            setSessionType('Individual Counseling');
            setSelectedClientId(preselectedClient.id);
        } else {
            setSessionType('SATOP Group');
            setSelectedClientId(clients[0]?.id);
        }
    }, [preselectedClient, clients]);
    
    // Trigger AI Risk Analysis when date/time/client changes
    useEffect(() => {
        const analyze = async () => {
            if (selectedClientId && date && startTime && !sessionType.includes('Group')) {
                setIsAnalyzingRisk(true);
                setTravelRisk(null);
                try {
                    const analysis = await analyzeTravelRisk(selectedClientId, date, startTime);
                    setTravelRisk(analysis.risk);
                    setRiskReason(analysis.reason);
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsAnalyzingRisk(false);
                }
            } else {
                setTravelRisk(null);
            }
        };
        const debounce = setTimeout(analyze, 800);
        return () => clearTimeout(debounce);
    }, [date, startTime, selectedClientId, sessionType]);

    const isGroup = sessionType.toLowerCase().includes('group');
    const selectedGroupObj = selectedGroupId ? groups.find(g => g.id === selectedGroupId) : undefined;
    // Therapist = the selected standing group's counselor (David/Karen/...), else the acting
    // counselor (the logged-in user). Replaces the old hardcoded 'Bill Sunderman'.
    const therapistName = selectedGroupObj?.counselor_name || user?.name || 'Unassigned';

    // Recurrence is a 1:1 AD-HOC affordance this round: not for group session types, and not
    // when a standing group is attached (a series doesn't carry group_id — out of scope). Either
    // selection hides the control and forces a single booking.
    const recurring = isRecurring && !isGroup && !selectedGroupId;

    // True when the time window is invalid (unparseable or end <= start) — nothing to check yet.
    const invalidWindow = (() => {
        const s = parseTimeToMinutes(startTime), e = parseTimeToMinutes(endTime);
        return Number.isNaN(s) || Number.isNaN(e) || e <= s;
    })();

    // Build the candidate occurrence windows for the current form state: N weekly dates when
    // recurring, else the single picked date. Pure derivation — feeds both the conflict check
    // and the submit path so they can never disagree about what's being booked.
    const firstDate = new Date(date + 'T00:00:00');
    const candidateDates = recurring
        ? generateWeeklyOccurrences(firstDate, Math.min(Math.max(occurrenceCount, 1), MAX_OCCURRENCES))
        : [firstDate];

    // Debounced DETERMINISTIC therapist double-booking check. Queries this therapist's existing
    // appointments across the candidate span, then intersects intervals (pure detectOverlaps).
    // Warn-and-allow: a hit blocks submit only until staff tick the override box. Resets the
    // override whenever the booking shape changes so a stale ack can't slip a new conflict by.
    useEffect(() => {
        setConflicts([]);
        setOverrideConflicts(false);
        if (!therapistName || therapistName === 'Unassigned') return;
        if (invalidWindow) return; // invalid window → nothing to check yet
        const run = async () => {
            setCheckingConflicts(true);
            try {
                const sorted = [...candidateDates].sort((a, b) => a.getTime() - b.getTime());
                const from = new Date(sorted[0]); from.setHours(0, 0, 0, 0);
                const to = new Date(sorted[sorted.length - 1]); to.setHours(23, 59, 59, 999);
                const existing = await getTherapistAppointments(therapistName, from.toISOString(), to.toISOString());
                const candidates = candidateDates.map(d => ({ date: d, startTime, endTime }));
                const existingWindows = existing.map(a => ({ date: new Date(a.date), startTime: a.startTime, endTime: a.endTime, _t: a.clientName || a.title }));
                const hits = detectOverlaps(candidates, existingWindows);
                setConflicts(hits.map(h => ({
                    date: h.candidate.date,
                    startTime: h.candidate.startTime,
                    endTime: h.candidate.endTime,
                    withTitle: (h.conflictsWith as any)._t || 'another appointment',
                })));
            } catch {
                // Visible-empty on failure: getTherapistAppointments already returns [] on error,
                // so we never silently assert "no conflicts" off a thrown query.
            } finally {
                setCheckingConflicts(false);
            }
        };
        const t = setTimeout(run, 600);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date, startTime, endTime, therapistName, isRecurring, occurrenceCount, isGroup]);

    const hasConflicts = conflicts.length > 0;
    const blockedByConflicts = hasConflicts && !overrideConflicts;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Warn-and-allow: a real overlap blocks submit until staff explicitly override.
        if (blockedByConflicts) return;
        setIsSaving(true);
        try {
        const client = clients.find(p => p.id === selectedClientId);
        const selectedGroup = selectedGroupId ? groups.find(g => g.id === selectedGroupId) : undefined;

        let zoomLink: string | undefined;
        let zoomMeetingId: string | undefined;
        let serviceType: Appointment['serviceType'];
        let groupId: string | undefined;

        if (selectedGroup) {
            // WS6 standing group: reuse the counselor's PERMANENT Zoom room + inherit the WS3
            // reg category. Do NOT mint a throwaway per-session meeting.
            zoomLink = selectedGroup.counselor_zoom_link || undefined;
            zoomMeetingId = selectedGroup.counselor_zoom_meeting_id || undefined;
            serviceType = (selectedGroup.service_type as Appointment['serviceType']) || undefined;
            groupId = selectedGroup.id;
        } else if (user?.id && isZoomLinked()) {
            // Ad-hoc (no group): auto-create a per-session Zoom meeting — unchanged path.
            // Failure is non-fatal; appointment still saves without a zoom link.
            try {
                const startIso = new Date(`${date}T${startTime}:00`).toISOString();
                const endIso = new Date(`${date}T${endTime}:00`).toISOString();
                const durationMin = Math.max(
                    15,
                    Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000),
                );
                const topic = isGroup ? sessionType : `Individual Counseling - ${client?.name ?? ''}`.trim();
                const zm = await createZoomMeeting(String(user.id), {
                    topic,
                    startIso,
                    durationMinutes: durationMin,
                    timezone: 'America/Chicago',
                });
                zoomLink = zm.joinUrl;
                zoomMeetingId = zm.meetingId;
            } catch (err) {
                console.warn('[ScheduleSessionModal] Zoom create failed:', err);
            }
        }

        // ── Recurring 1:1 series ────────────────────────────────────────────────────────
        // Writes the parent rule + N dated occurrences in one go, each carrying a REAL uuid
        // client_id (clients[].id) so the appointment pop-up can fetch phone/email. One minted
        // Zoom link (above) is reused across the series. Google Calendar push is deferred for
        // series (would spam N events) — single sessions keep their write-through below.
        if (recurring) {
            if (!selectedClientId || !client) {
                alert('Choose a client before booking a recurring series.');
                return;
            }
            const { occurrences } = await createRecurringSeries({
                clientId: selectedClientId,
                clientName: client.name,
                therapistName,
                appointmentType: sessionType,
                modality: 'Virtual (Zoom)',
                title: `Individual Counseling - ${client.name}`,
                firstDate,
                startTime,
                endTime,
                count: Math.min(Math.max(occurrenceCount, 1), MAX_OCCURRENCES),
                serviceType,
                zoomLink,
                zoomMeetingId,
            });
            // Surface every created occurrence to the parent grid.
            occurrences.forEach(o => onSave({ ...o, date: new Date(o.date) }));
            onClose();
            return;
        }

        const newAppointmentData: Omit<Appointment, 'id'> = {
            title: isGroup ? sessionType : `Individual Counseling - ${client?.name}`,
            type: sessionType,
            date: new Date(date + 'T00:00:00'),
            // Canonical 24-hour "HH:MM" (matches the <input type="time"> value and the
            // read-path format). NO 12-hour conversion here — that produced "06:00 PM",
            // which combineDateAndTime then mis-stored as 6 AM. See config/time.ts.
            startTime,
            endTime,
            modality: 'Virtual (Zoom)',
            therapist: selectedGroup?.counselor_name || user?.name || 'Unassigned',
            zoomLink,
            status: 'Scheduled',
            serviceType,
            groupId,
            ...(isGroup
                ? { capacity, attendees: [] }
                : { clientId: selectedClientId, clientName: client?.name }
            )
        };

        const savedAppointment = await addAppointment({ ...newAppointmentData, zoomMeetingId });

        // Best-effort Google Calendar write-through. Appointment is already
        // in Supabase; calendar failure must not block the user flow. If the
        // push succeeds, we attach the returned event id/link so the UI can
        // render a Synced indicator and later delete/update can target it.
        let googleEventId: string | undefined;
        let googleEventLink: string | undefined;
        if (user?.id && isGoogleCalendarLinked()) {
            try {
                const startIso = new Date(`${date}T${startTime}:00`).toISOString();
                const endIso = new Date(`${date}T${endTime}:00`).toISOString();
                const attendees: string[] = [];
                if (!isGroup && client?.email) attendees.push(client.email);
                const result = await createGoogleCalendarEvent(String(user.id), {
                    summary: newAppointmentData.title,
                    description: newAppointmentData.zoomLink
                        ? `Zoom: ${newAppointmentData.zoomLink}`
                        : undefined,
                    startIso,
                    endIso,
                    timezone: 'America/Chicago',
                    attendees: attendees.length ? attendees : undefined,
                });
                googleEventId = result.eventId;
                googleEventLink = result.htmlLink;
            } catch (err) {
                console.warn('[ScheduleSessionModal] Google Calendar push failed:', err);
            }
        }

        // If the Google push succeeded, persist the event id/link on the row so
        // refresh preserves the Synced badge and future update/delete can target it.
        if (googleEventId) {
            try {
                await updateAppointment(savedAppointment.id, { googleEventId, googleEventLink });
            } catch (err) {
                console.warn('[ScheduleSessionModal] failed to persist google event id:', err);
            }
        }

        onSave({
            ...savedAppointment,
            date: new Date(savedAppointment.date),
            googleEventId,
            googleEventLink,
        });
        onClose();
        } catch (err) {
            console.error('[ScheduleSessionModal] save failed:', err);
            alert('Could not create the session: ' + (err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-lg">
                <form onSubmit={handleSubmit}>
                    <header className="flex justify-between items-center p-4 border-b border-black/10 dark:border-white/10">
                        <h2 className="text-lg font-semibold">{preselectedClient ? `Schedule Makeup for ${preselectedClient.name}` : 'Schedule New Session'}</h2>
                        <button type="button" onClick={onClose} className="text-2xl font-light" aria-label="Close modal">&times;</button>
                    </header>
                    
                    <main className="p-6 space-y-4">
                        <div>
                            <label htmlFor="sessionType" className="block text-sm font-medium mb-1">Session Type</label>
                            <select id="sessionType" value={sessionType} onChange={e => setSessionType(e.target.value as AppointmentType)} className="w-full p-2 border border-border dark:border-slate-600 bg-transparent rounded-md">
                                <option>SATOP Group</option>
                                <option>REACT Group</option>
                                <option>Anger Management Group</option>
                                <option>Gambling Group</option>
                                <option>Individual Counseling</option>
                                <option>DOT Assessment</option>
                                <option>Intake Assessment</option>
                            </select>
                        </div>

                        {/* WS6: optional standing group — inherits the counselor's permanent
                            Zoom room + auto-categorizes hours. "Ad-hoc" keeps the unchanged path. */}
                        <div>
                            <label htmlFor="group" className="block text-sm font-medium mb-1">Standing group <span className="text-slate-400 font-normal">(optional)</span></label>
                            <select id="group" value={selectedGroupId ?? ''} onChange={e => setSelectedGroupId(e.target.value || undefined)} className="w-full p-2 border border-border dark:border-slate-600 bg-transparent rounded-md">
                                <option value="">— Ad-hoc session (no group) —</option>
                                {groups.map(g => (
                                    <option key={g.id} value={g.id}>
                                        {g.program} · {g.counselor_name ?? 'TBD'} · {WEEKDAYS[g.weekday] ?? 'by appt'}{g.start_local ? ' ' + String(g.start_local).slice(0, 5) : ''} · {g.session_kind}
                                    </option>
                                ))}
                            </select>
                            {selectedGroupObj && (
                                <p className="mt-1 text-xs text-slate-500">
                                    Inherits <b>{selectedGroupObj.counselor_name ?? 'counselor'}</b>'s permanent Zoom room · category <b>{selectedGroupObj.service_type}</b>{selectedGroupObj.counselor_zoom_link ? '' : ' · (no link on counselor)'}
                                </p>
                            )}
                        </div>

                        {!isGroup && (
                             <div className="space-y-2">
                                {!preselectedClient && presentClientTypes.length > 0 && (
                                    <div>
                                        <label htmlFor="clientType" className="block text-sm font-medium mb-1">Type <span className="text-slate-400 font-normal">(funnel)</span></label>
                                        <select id="clientType" value={clientTypeFilter} onChange={e => setClientTypeFilter(e.target.value)} className="w-full p-2 border border-border dark:border-slate-600 bg-transparent rounded-md">
                                            <option value="All">All types</option>
                                            {presentClientTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="client" className="block text-sm font-medium mb-1">Client</label>
                                    <select id="client" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="w-full p-2 border border-border dark:border-slate-600 bg-transparent rounded-md" disabled={!!preselectedClient}>
                                        {visibleClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="date" className="block text-sm font-medium mb-1">Date</label>
                                <input type="date" id="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border border-border dark:border-slate-600 bg-transparent rounded-md" />
                            </div>
                            {isGroup && (
                                <div>
                                    <label htmlFor="capacity" className="block text-sm font-medium mb-1">Capacity</label>
                                    <input type="number" id="capacity" value={capacity} onChange={e => setCapacity(parseInt(e.target.value, 10))} className="w-full p-2 border border-border dark:border-slate-600 bg-transparent rounded-md" />
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="startTime" className="block text-sm font-medium mb-1">Start Time</label>
                                <input type="time" id="startTime" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 border border-border dark:border-slate-600 bg-transparent rounded-md" />
                            </div>
                             <div>
                                <label htmlFor="endTime" className="block text-sm font-medium mb-1">End Time</label>
                                <input type="time" id="endTime" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 border border-border dark:border-slate-600 bg-transparent rounded-md" />
                            </div>
                        </div>

                        {/* Recurring 1:1 series — 1:1 ad-hoc only (group recurrence out of scope). Weekly,
                            for N occurrences starting on the picked date (its weekday repeats). */}
                        {!isGroup && !selectedGroupId && (
                            <div className="rounded-lg border border-border dark:border-slate-600 p-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="rounded" />
                                    <Repeat size={15} className="text-slate-500" />
                                    <span className="text-sm font-medium">Repeat weekly</span>
                                </label>
                                {isRecurring && (
                                    <div className="mt-3 flex items-center gap-2">
                                        <label htmlFor="occCount" className="text-sm text-slate-600 dark:text-slate-300">for</label>
                                        <input
                                            type="number" id="occCount" min={1} max={MAX_OCCURRENCES}
                                            value={occurrenceCount}
                                            onChange={e => setOccurrenceCount(Math.min(Math.max(parseInt(e.target.value, 10) || 1, 1), MAX_OCCURRENCES))}
                                            className="w-20 p-2 border border-border dark:border-slate-600 bg-transparent rounded-md text-center"
                                        />
                                        <span className="text-sm text-slate-600 dark:text-slate-300">weekly sessions</span>
                                        {candidateDates.length > 1 && (
                                            <span className="ml-auto text-xs text-slate-500">
                                                {candidateDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → {candidateDates[candidateDates.length - 1].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Smart Scheduling Indicator */}
                        {!isGroup && selectedClientId && (
                            <div className={`mt-2 p-3 rounded-lg border flex items-start gap-3 transition-colors ${
                                isAnalyzingRisk ? 'bg-gray-100 border-gray-200' :
                                travelRisk === 'High' ? 'bg-red-50 border-red-200' :
                                travelRisk === 'Medium' ? 'bg-yellow-50 border-yellow-200' :
                                'bg-green-50 border-green-200'
                            }`}>
                                <div className="mt-0.5">
                                    {isAnalyzingRisk ? <Loader2 size={16} className="animate-spin text-gray-500" /> :
                                     travelRisk === 'High' ? <AlertTriangle size={16} className="text-red-500" /> :
                                     travelRisk === 'Medium' ? <AlertTriangle size={16} className="text-yellow-600" /> :
                                     <CheckCircle size={16} className="text-green-600" />}
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider mb-0.5 text-gray-500">Commute & Care Intelligence</p>
                                    <p className={`text-sm font-semibold ${
                                        isAnalyzingRisk ? 'text-gray-600' :
                                        travelRisk === 'High' ? 'text-red-800' :
                                        travelRisk === 'Medium' ? 'text-yellow-800' :
                                        'text-green-800'
                                    }`}>
                                        {isAnalyzingRisk ? "Analyzing travel conditions..." : riskReason || "Schedule looks good."}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Deterministic therapist double-booking warning. Lists each colliding
                            occurrence; warn-and-allow via the override checkbox. No AI, no Google. */}
                        {checkingConflicts && (
                            <p className="mt-1 text-xs text-slate-400 flex items-center gap-1.5">
                                <Loader2 size={12} className="animate-spin" /> Checking {therapistName}'s schedule…
                            </p>
                        )}
                        {hasConflicts && (
                            <div className="mt-2 p-3 rounded-lg border bg-red-50 border-red-200">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold uppercase tracking-wider mb-1 text-red-700">
                                            Double-booking — {therapistName} {conflicts.length === 1 ? 'is' : 'is'} already booked
                                        </p>
                                        <ul className="text-sm text-red-800 space-y-0.5">
                                            {conflicts.map((c, i) => (
                                                <li key={i}>
                                                    {c.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {formatTime12(c.startTime)}–{formatTime12(c.endTime)} — overlaps <b>{c.withTitle}</b>
                                                </li>
                                            ))}
                                        </ul>
                                        <label className="mt-2 flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={overrideConflicts} onChange={e => setOverrideConflicts(e.target.checked)} className="rounded" />
                                            <span className="text-sm font-semibold text-red-800">Book anyway (override {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'})</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                         <div>
                            <label className="block text-sm font-medium mb-1">Therapist</label>
                            <input type="text" readOnly value={therapistName} className="w-full p-2 border border-border dark:border-slate-600 bg-gray-100 dark:bg-slate-800 rounded-md" />
                        </div>
                    </main>

                    <footer className="p-4 border-t border-black/10 dark:border-white/10 flex justify-end">
                        <button
                            type="submit"
                            disabled={isSaving || blockedByConflicts || invalidWindow}
                            className="bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-primary-focus transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSaving && <Loader2 size={16} className="animate-spin" />}
                            {recurring
                                ? `Create ${Math.min(Math.max(occurrenceCount, 1), MAX_OCCURRENCES)} Sessions`
                                : 'Create Session'}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default ScheduleSessionModal;