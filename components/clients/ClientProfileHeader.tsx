import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, Appointment, CLIENT_STATUS_LABELS, needsStatusReview } from '../../types';
import type { SatopLevel } from '../../config/satopFees';
import { formatTime12 } from '../../config/time';
import { normalizeProgram, programLabel } from '../../config/programVocab';
import { isTrialHidden } from '../../config/trialMode';
import type { ClientProgress } from '../../services/displayProgress';
import type { ProgramCardState } from '../../services/complianceEngine';
import { useAuth } from '../../contexts/AuthContext';
import ClientAvatar from './ClientAvatar';
import ClientTypeBadge from './ClientTypeBadge';
import GroupAssignmentModal from './GroupAssignmentModal';
import { CalendarPlus, FilePlus, Pencil, Play, UserCheck, Loader2, AlertTriangle, CalendarClock, Phone, Mail, UsersRound } from 'lucide-react';
import { placeAndActivate, getCounselors } from '../../services/api';
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
// Outline badges, no fill (2026-07-28). 'completed'/'successful_dx' lost its blue —
// blue left the status system; a finished program is a resolved good outcome, so it
// takes sage. Lifecycle states that need no action (archived) read warm neutral.
const getStatusColor = (status: Client['status']) => {
    switch (status) {
        case 'active': return 'border-success-400 text-success-700 dark:text-success-400';
        case 'completed': case 'successful_dx': return 'border-success-500 text-success-800 dark:text-success-300';
        case 'archived': return 'border-neutral-300 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400';
        case 'prospect': return 'border-warning-400 text-warning-700 dark:text-warning-400';
        case 'paused': return 'border-orange-400 text-orange-700 dark:text-orange-400';
        case 'unsuccessful_dx': return 'border-danger-400 text-danger-700 dark:text-danger-400';
        default: return 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300';
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
    // Labels from config/programVocab (single source, 2026-07-28) — the old default
    // branch leaked the raw canonical token. Per-program badge colors stay local.
    const label = programLabel(norm.canonical);
    switch (norm.canonical) {
        case 'ANGER_MANAGEMENT':
            return { label, color: 'bg-orange-100 text-orange-800 border-orange-200' };
        case 'GAMBLING_RECOVERY':
            return { label, color: 'bg-teal-100 text-teal-800 border-teal-200' };
        case 'OPIOID_RECOVERY':
            return { label, color: 'bg-violet-100 text-violet-800 border-violet-200' };
        default:
            return { label, color: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
};

const ClientProfileHeader: React.FC<ClientProfileHeaderProps> = ({ client, determinedLevel, progress, timelineState, onAskClara, lastBooked, nextBooked }) => {
  // Only render the glance line when a caller opts in (passes the props). DocumentManagement
  // renders the header without them → both undefined → line hidden (no misleading empty states).
  const showBookingGlance = lastBooked !== undefined || nextBooked !== undefined;
  const navigate = useNavigate();
  const { user } = useAuth();

  // L4 (David 7/15): Primary Counselor in the header. Resolved from the tiny
  // counselors roster; best-effort — no name renders while unset/unloadable
  // (never a fabricated one).
  const [primaryCounselorName, setPrimaryCounselorName] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (!client.primaryCounselorId) { setPrimaryCounselorName(null); return; }
    getCounselors()
      .then(list => { if (live) setPrimaryCounselorName(list.find(c => c.id === client.primaryCounselorId)?.name ?? null); })
      .catch(() => { if (live) setPrimaryCounselorName(null); });
    return () => { live = false; };
  }, [client.primaryCounselorId]);
  // A live session writes a CLINICAL note — Director/Therapist only (not Admin/Jessica).
  // …and not while /session is trial-hidden, or "Start transcribed session"
  // would just bounce to the dashboard (see config/trialMode.ts).
  const canStartSession = !!user && (user.role === 'Director' || user.role === 'Therapist') && !isTrialHidden('/session');

  // Front-door conversion: a prospect (pre-placement) gets a "Place & Activate"
  // action instead of the normal clinical buttons. The gate (a SIGNED placement
  // determination must exist) is enforced in api.placeAndActivate, not here.
  const isProspect = client.status === 'prospect';
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  // L2: standing group assignment modal (Modal portals to body — no transform trap).
  const [groupsModalOpen, setGroupsModalOpen] = useState(false);
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

  // J5 (2026-07-28): the hero sits ON the elevation scale now — surface-1 card,
  // hairline border, card shadow — instead of a glassmorphic tinted slab unlike
  // every other surface. Removed with it: the decorative HUD brain, the avatar
  // glow, and the green lightning "presence" badge (a fabricated online
  // indicator — nothing measures presence; same class as the fake read receipts).
  return (
    <div className="bg-white dark:bg-slate-900 border border-hairline dark:border-slate-700/60 rounded-2xl shadow-card p-8 relative">
      <div className="flex flex-col lg:flex-row items-center lg:items-start gap-10">
        {/* Sized down (2026-08-07) — this was the single largest element on the page,
            competing with the client's own name for attention. w-20 keeps it clearly
            legible and still the header's visual anchor, just not its dominant one. */}
        <ClientAvatar client={client} className="w-20 h-20 text-2xl border-4 border-white dark:border-slate-800 shadow-card" />

        <div className="flex-1 text-center lg:text-left">
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-3">
              {/* Truncate + title (2026-07-28): at text-4xl a 40-character name wrapped the
                  header and pushed the action row down the page. min-w-0 lets the flex
                  parent actually allow the shrink. */}
              <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white truncate min-w-0" title={client.name}>{client.name}</h1>
              <span className={`px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border ${getProgramBadge(client, determinedLevel).color}`}>
                {getProgramBadge(client, determinedLevel).label}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border ${getStatusColor(client.status)}`}
                title={needsStatusReview(client.status) ? 'Needs review — confirm this discharge outcome' : undefined}
              >
                {needsStatusReview(client.status) && <AlertTriangle size={11} className="shrink-0" />}
                {CLIENT_STATUS_LABELS[client.status] ?? client.status}
              </span>
          </div>
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm font-bold text-slate-500 uppercase tracking-widest">
              {/* client.caseNumber has no data source for every client — mapClientToApp
                  defaults it to '' when clients.case_number is null (services/api.ts),
                  which is common (e.g. Bela Lugosi carries no case number). This used to
                  render unconditionally, so an unset case number printed a bare "ID:"
                  label with nothing after it. Same pattern as phone/email below: no
                  value, no row — an orphaned label is not an honest empty state. */}
              {client.caseNumber && (
                <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> ID: {client.caseNumber}</span>
              )}
              {client.phone && (
                <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 normal-case tracking-normal font-medium text-slate-500 hover:text-primary transition-colors">
                  <Phone size={13} className="shrink-0" /> {client.phone}
                </a>
              )}
              {client.email && (
                <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 normal-case tracking-normal font-medium text-slate-500 hover:text-primary transition-colors">
                  <Mail size={13} className="shrink-0" /> {client.email}
                </a>
              )}
              {primaryCounselorName && (
                <span className="flex items-center gap-1.5 normal-case tracking-normal font-medium text-slate-500" title="Primary Counselor">
                  <UserCheck size={13} className="shrink-0" /> {primaryCounselorName}
                </span>
              )}
          </div>

          {/* Operational client-type chip — read-only, styled unlike the clinical program pill
              above so the two axes don't read as duplicates. Sits with the booking glance.
              Always rendered (sched step 11) — the badge itself surfaces a "needs review"
              state for untagged/ambiguous-legacy client_type rather than staying invisible. */}
          <div className="mt-3 flex justify-center lg:justify-start">
            <ClientTypeBadge type={client.clientType} />
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
                        className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary-focus transition-colors shadow-card disabled:opacity-60"
                    >
                        {placing ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
                        {placing ? 'Placing…' : 'Place & Activate'}
                    </button>
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('open-edit-client-modal', { detail: { client } }))}
                        aria-label="Edit client"
                        className="flex items-center gap-2 bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        <Pencil size={14} /> Edit
                    </button>
                  </>
                ) : (
                  <>
                {/* Contextual Clara — the one obvious, high-value action: one tap → Clara
                    summarizes THIS client from real on-page facts. Clara-branded (her avatar)
                    so the value is unmistakably hers. Seed/composition live in ClientWorkspace. */}
                {/* J5 hierarchy: ONE primary per row - the daily clinical action,
                    starting a note. Everything else demotes to bordered secondary.
                    Sentence case throughout (uppercase tracking read as shouting). */}
                {/* One-solid-red-per-surface rule (2026-08-07): "Start typed or dictated
                    note" below is the header's one primary action — the thing a
                    counselor is there to do. This button used to carry a red border +
                    red text, a second brand mark competing with it. Neutral outline now,
                    same as Schedule/Groups/Edit; Clara's own avatar image is still the
                    thing that makes this unmistakably hers. */}
                {onAskClara && (
                    <button
                        onClick={onAskClara}
                        className="flex items-center gap-2.5 bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 pl-2 pr-5 py-2 rounded-xl font-semibold text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        <img src={CLARA_AVATAR_URL} alt="" className="w-7 h-7 rounded-full object-cover" />
                        Summarize with Clara
                    </button>
                )}
                {canStartSession && (
                    <button
                        onClick={() => navigate(`/session/${client.id}`)}
                        className="flex items-center gap-2 bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        <Play size={15} /> Start transcribed session
                    </button>
                )}
                {/* Opens Smart Note Studio (owned by MainLayout) pre-scoped to THIS
                    client via the existing open-note-modal event (e.detail.clientId). */}
                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('open-note-modal', { detail: { clientId: client.id } }))}
                    className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary-focus transition-colors shadow-card"
                >
                    <FilePlus size={15} /> Start typed or dictated note
                </button>
                {/* Opens the existing ScheduleSessionModal pre-scoped to this client
                    (its preselectedClient prop → "Schedule Makeup for {name}"). */}
                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('open-schedule-modal', { detail: { client } }))}
                    className="flex items-center gap-2 bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                    <CalendarPlus size={15} /> Schedule
                </button>
                {/* L2: standing group assignment — multi-select, start date, no end date. */}
                <button
                    onClick={() => setGroupsModalOpen(true)}
                    className="flex items-center gap-2 bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                    <UsersRound size={15} /> Groups
                </button>
                {/* Opens EditClientModal owned by MainLayout. Available to all
                    roles; the modal itself locks clinical fields for Admin. */}
                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('open-edit-client-modal', { detail: { client } }))}
                    aria-label="Edit client"
                    title="Edit client"
                    className="flex items-center gap-2 bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
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

      {/* L2: standing group assignment — open groups, start date, no end date. */}
      <GroupAssignmentModal isOpen={groupsModalOpen} onClose={() => setGroupsModalOpen(false)} client={client} />
    </div>
  );
};

export default ClientProfileHeader;