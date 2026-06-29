import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, Appointment, CLIENT_STATUS_LABELS } from '../../types';
import type { SatopLevel } from '../../config/satopFees';
import { formatTime12 } from '../../config/time';
import { normalizeProgram } from '../../config/programVocab';
import type { ClientProgress } from '../../services/displayProgress';
import type { ProgramCardState } from '../../services/complianceEngine';
import { useAuth } from '../../contexts/AuthContext';
import ClientAvatar from './ClientAvatar';
import { CalendarPlus, FilePlus, BrainCircuit, Zap, Pencil, Play, UserCheck, Loader2, AlertTriangle, CalendarClock } from 'lucide-react';
import { placeAndActivate } from '../../services/api';
import { CLARA_AVATAR_URL } from '../../services/claraPrompts';

interface ClientProfileHeaderProps {
  client: Client;
  /** WS4: current signed determination level (same source as the completion gate). null → none signed. */
  determinedLevel?: SatopLevel | null;
  /** WS-DisplayTruth: authoritative progress composed in ClientWorkspace (accrual + signed
   *  determination) — the header % reads this, NOT the neutralized client.completionPercentage. */
  progress?: ClientProgress | null;
  /** Program-aware: non-SATOP timeline compliance state (null for SATOP). When present, the
   *  small "Progress" box shows the review state instead of a meaningless hours %. */
  timelineState?: ProgramCardState | null;
  /** Contextual Clara: opens Clara seeded with a real-data summary of THIS client. Composed
   *  by the caller (ClientWorkspace) from facts already on the page. Undefined → hidden. */
  onAskClara?: () => void;
  /** Booking glance: most-recent PAST appointment (null = none on file). Undefined → the whole
   *  glance line is hidden (e.g. DocumentManagement renders the header without it). */
  lastBooked?: Appointment | null;
  /** Booking glance: next UPCOMING appointment (null = none scheduled). See lastBooked. */
  nextBooked?: Appointment | null;
}

// Compact "Mon DD, YYYY, h:mm AM" for the glance line. Date via the standard Intl formatter
// (same as the calendar header); time via config/time.ts (the canonical 24h-aware formatter).
const formatBooking = (apt: Appointment): string => {
    const d = apt.date instanceof Date ? apt.date : new Date(apt.date);
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${datePart}, ${formatTime12(apt.startTime)}`;
};

// Lifecycle badge (status normalization, 2026-06-11). The old version painted
// a green "Compliant" on every active client purely because STATUS_MAP renamed
// 'active' → 'Compliant' — a fabricated standing signal. Standing is the
// engine's (the program-aware timeline state beside this badge); this badge
// only says where the client is in the lifecycle.
const getStatusColor = (status: Client['status']) => {
    switch (status) {
        case 'active': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'archived': return 'bg-slate-100 text-slate-600 border-slate-200';
        default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
};

const getProgramBadge = (client: Client, determinedLevel?: SatopLevel | null) => {
    const norm = normalizeProgram(client.program);
    if (norm.program === 'SATOP') {
        // WS4: the level badge reads the SIGNED determination (same source as the
        // completion gate) — never the program name's implied level. With no signed
        // determination, show the ENROLLED program identity (e.g. "SROP"/"SATOP"),
        // which is an enrollment fact, not a clinical level claim.
        const label = determinedLevel ? `SATOP Level ${determinedLevel}` : norm.canonical;
        return { label, color: 'bg-blue-100 text-blue-800 border-blue-200' };
    }
    switch (norm.canonical) {
        case 'ANGER_MANAGEMENT':
            return { label: 'Anger Management', color: 'bg-orange-100 text-orange-800 border-orange-200' };
        case 'GAMBLING_RECOVERY':
            return { label: 'Gambling Recovery', color: 'bg-teal-100 text-teal-800 border-teal-200' };
        case 'OPIOID_RECOVERY':
            return { label: 'Opioid Recovery', color: 'bg-violet-100 text-violet-800 border-violet-200' };
        case 'INDIVIDUAL_COUNSELING':
            return { label: 'Individual Counseling', color: 'bg-slate-100 text-slate-800 border-slate-200' };
        default:
            return { label: norm.canonical, color: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
};

const ClientProfileHeader: React.FC<ClientProfileHeaderProps> = ({ client, determinedLevel, progress, timelineState, onAskClara, lastBooked, nextBooked }) => {
  // Only render the glance line when a caller opts in (passes the props). DocumentManagement
  // renders the header without them → both undefined → line hidden (no misleading empty states).
  const showBookingGlance = lastBooked !== undefined || nextBooked !== undefined;
  const navigate = useNavigate();
  const { user } = useAuth();
  // A live session writes a CLINICAL note — Director/Therapist only (not Admin/Jessica).
  const canStartSession = !!user && (user.role === 'Director' || user.role === 'Therapist');

  // Front-door conversion: a prospect (pre-placement) gets a "Place & Activate"
  // action instead of the normal clinical buttons. The gate (a SIGNED placement
  // determination must exist) is enforced in api.placeAndActivate, not here.
  const isProspect = client.status === 'prospect';
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const handlePlaceActivate = async () => {
    setPlaceError(null);
    setPlacing(true);
    try {
      await placeAndActivate(client.id);
      window.location.reload();   // re-render the now-active client with its program + gates
    } catch (e: any) {
      setPlaceError(e?.message || 'Could not place this prospect.');
      setPlacing(false);
    }
  };

  // Program-aware: for a non-SATOP timeline program, the small "Progress" box shows the engine's
  // review STATE instead of a meaningless hours %. SATOP (timelineState null) keeps the % path.
  const timelineBox = timelineState ? (() => {
    const tone = timelineState.status === 'violation' ? 'text-rose-600 dark:text-rose-400'
      : timelineState.status === 'warning' ? 'text-amber-600 dark:text-amber-400'
      : timelineState.status === 'met' ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-slate-500 dark:text-slate-300';
    if (timelineState.kind === 'no_gate') return { head: 'Compliance', value: 'No gate', sub: 'Court-determined', tone };
    if (timelineState.status === 'violation') return { head: 'Plan Review', value: 'Overdue', sub: null, tone };
    if (timelineState.status === 'warning') return { head: 'Plan Review', value: 'Due soon', sub: null, tone };
    if (timelineState.status === 'met') {
      const m = timelineState.label.match(/in (\d+) days/);
      return { head: 'Plan Review', value: m ? `${m[1]}d` : 'On track', sub: m ? 'until review' : null, tone };
    }
    return { head: 'Plan Review', value: 'No plan', sub: null, tone };
  })() : null;

  return (
    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/20 dark:border-slate-800 rounded-[2.5rem] shadow-2xl p-8 transition-all duration-500 overflow-hidden relative">
      {/* Background HUD decorations */}
      <div className="absolute top-0 right-0 p-4 opacity-5">
         <BrainCircuit size={120} />
      </div>

      <div className="flex flex-col lg:flex-row items-center lg:items-start gap-10 relative z-10">
        <div className="relative group">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl group-hover:blur-3xl transition-all"></div>
            <ClientAvatar client={client} className="w-32 h-32 text-5xl relative border-4 border-white dark:border-slate-800 shadow-2xl" />
            <div className="absolute -bottom-2 -right-2 bg-green-500 w-8 h-8 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center">
               <Zap size={14} className="text-white fill-white" />
            </div>
        </div>

        <div className="flex-1 text-center lg:text-left">
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-3">
              <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white">{client.name}</h1>
              <span className={`px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border ${getProgramBadge(client, determinedLevel).color}`}>
                {getProgramBadge(client, determinedLevel).label}
              </span>
              <span className={`px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border ${getStatusColor(client.status)}`}>
                {CLIENT_STATUS_LABELS[client.status] ?? client.status}
              </span>
          </div>
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm font-bold text-slate-500 uppercase tracking-widest">
              <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> ID: {client.caseNumber}</span>
          </div>

          {/* Booking glance — most-recent past + next upcoming appointment. Both resolve via
              appointments.client_id matched to this client's uuid (same as the contact popup). */}
          {showBookingGlance && (
            <div className="mt-3 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-1.5 text-sm">
                <span className="flex items-center gap-2">
                    <CalendarClock size={15} className="text-slate-400 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Last booked:</span>
                    {lastBooked
                        ? <span className="font-bold text-slate-700 dark:text-slate-200">{formatBooking(lastBooked)}</span>
                        : <span className="font-medium italic text-slate-400">No prior appointments</span>}
                </span>
                <span className="hidden sm:inline text-slate-300 dark:text-slate-600">·</span>
                <span className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Next booked:</span>
                    {nextBooked
                        ? <span className="font-bold text-slate-700 dark:text-slate-200">{formatBooking(nextBooked)}</span>
                        : <span className="font-medium italic text-slate-400">Nothing scheduled</span>}
                </span>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                {isProspect ? (
                  <>
                    {/* Prospect (front-door intake): the clinical actions are premature.
                        Place & Activate converts to an active client — gated on a SIGNED
                        placement determination (enforced in api.placeAndActivate). */}
                    <button
                        onClick={handlePlaceActivate}
                        disabled={placing}
                        className="flex items-center gap-3 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 hover:scale-105 transition-all shadow-xl shadow-emerald-600/20 active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
                    >
                        {placing ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
                        {placing ? 'Placing…' : 'Place & Activate'}
                    </button>
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('open-edit-client-modal', { detail: { client } }))}
                        aria-label="Edit client"
                        className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all active:scale-95"
                    >
                        <Pencil size={14} /> Edit
                    </button>
                  </>
                ) : (
                  <>
                {/* Contextual Clara — the one obvious, high-value action: one tap → Clara
                    summarizes THIS client from real on-page facts. Clara-branded (her avatar)
                    so the value is unmistakably hers. Seed/composition live in ClientWorkspace. */}
                {onAskClara && (
                    <button
                        onClick={onAskClara}
                        className="flex items-center gap-2.5 bg-primary text-white pl-2 pr-5 py-2 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-primary-focus hover:scale-105 transition-all shadow-xl shadow-primary/20 active:scale-95"
                    >
                        <img src={CLARA_AVATAR_URL} alt="" className="w-7 h-7 rounded-full object-cover ring-2 ring-white/40" />
                        Summarize with Clara
                    </button>
                )}
                {canStartSession && (
                    <button
                        onClick={() => navigate(`/session/${client.id}`)}
                        className="flex items-center gap-3 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 hover:scale-105 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
                    >
                        <Play size={16} /> Start Session
                    </button>
                )}
                {/* Opens Smart Note Studio (owned by MainLayout) pre-scoped to THIS
                    client via the existing open-note-modal event (e.detail.clientId). */}
                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('open-note-modal', { detail: { clientId: client.id } }))}
                    className="flex items-center gap-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                >
                    <FilePlus size={16} /> Session Note
                </button>
                {/* Opens the existing ScheduleSessionModal pre-scoped to this client
                    (its preselectedClient prop → "Schedule Makeup for {name}"). */}
                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('open-schedule-modal', { detail: { client } }))}
                    className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all active:scale-95"
                >
                    <CalendarPlus size={16} /> Schedule
                </button>
                {/* Opens EditClientModal owned by MainLayout. Available to all
                    roles; the modal itself locks clinical fields for Admin. */}
                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('open-edit-client-modal', { detail: { client } }))}
                    aria-label="Edit client"
                    title="Edit client"
                    className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all active:scale-95"
                >
                    <Pencil size={14} /> Edit
                </button>
                  </>
                )}
          </div>
          {placeError && (
            <div className="mt-3 flex items-start gap-2 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-3 py-2 max-w-xl mx-auto lg:mx-0">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <p className="text-xs font-medium leading-relaxed">{placeError}</p>
            </div>
          )}
        </div>

        <div className="lg:w-64 grid grid-cols-1 gap-3">
             <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-center" title={timelineState?.detail || undefined}>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{timelineBox ? timelineBox.head : 'Progress'}</p>
                {timelineBox ? (
                    <>
                        <p className={`text-2xl font-black ${timelineBox.tone}`}>{timelineBox.value}</p>
                        {timelineBox.sub && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{timelineBox.sub}</p>}
                    </>
                ) : (
                    <p className="text-2xl font-black text-slate-700 dark:text-white">{progress?.established && progress.progressPct != null ? `${progress.progressPct}%` : '—'}</p>
                )}
             </div>
        </div>
      </div>

    </div>
  );
};

export default ClientProfileHeader;