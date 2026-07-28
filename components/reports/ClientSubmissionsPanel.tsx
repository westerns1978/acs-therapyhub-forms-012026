
import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import { supabase } from '../../services/supabase';
import LoadingSpinner from '../ui/LoadingSpinner';
import Modal from '../ui/Modal';
import { normalizeSubmissionStatus, SUBMISSION_STATUS_LABELS, NormalizedSubmissionStatus } from '../../config/formSubmissionStatus';
import { approveFormSubmission } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, CheckCircle2, Clock, AlertTriangle, Search, RefreshCw, User, FileText, Calendar, Printer } from 'lucide-react';
import { maybeForceFail } from '../../config/failureHarness';
import { SubmissionViewer, RecordPrintRoot, printRecord } from '../forms/SubmissionViewer';
import { showDemoRows } from '../../config/demoData';

interface Submission {
  id: string;
  client_id: string;
  form_id?: string | null;
  form_type: string;
  form_name: string;
  status: string;
  data: any;
  submitted_at: string | null;
  created_at: string;
  client_name?: string;
}

/**
 * Stat card, restructured pattern (2026-07-28).
 *
 * Neutral surface + 1px hairline always. Colour is a 3px LEFT RULE, never a fill
 * and never a heavy border — and it appears only when `accent` is true, i.e. on
 * the single metric in the group that the user must act on. Everything else is a
 * count of work that is blocked elsewhere or already done, and reads quietly.
 */
const SummaryCard: React.FC<{ icon: React.ElementType; label: string; value: number; accent?: boolean }> = ({
  icon: Icon, label, value, accent = false,
}) => (
  <div className={`relative overflow-hidden p-4 rounded-2xl bg-white dark:bg-slate-900 border border-hairline dark:border-slate-700/60 ${accent ? 'pl-5' : ''}`}>
    {accent && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-warning-600 dark:bg-warning-400" />}
    <div className="flex items-center gap-3">
      <Icon className={accent ? 'text-warning-700 dark:text-warning-400' : 'text-neutral-400'} size={18} />
      <div>
        <p className={`text-2xl font-black tabular-nums ${accent ? 'text-slate-900 dark:text-white' : 'text-neutral-600 dark:text-neutral-300'}`}>{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mt-0.5">{label}</p>
      </div>
    </div>
  </div>
);

const ClientSubmissionsPanel: React.FC = () => {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'reviewed'>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchSubmissions = async () => {
    setIsLoading(true);
    setLoadError(null);
    // Fail-visibly (2026-07-28): supabase-js does NOT throw on query errors — check
    // `error` explicitly. The old unchecked destructure rendered 0 Awaiting / 0 Needs
    // Review over an empty table on RLS denial: a clean-looking queue that wasn't read.
    try {
      maybeForceFail('form submissions queue');
      const { data: subs, error: subsError } = await supabase
        .from('form_submissions')
        .select('*')
        .order('created_at', { ascending: false });
      if (subsError) throw new Error(`Submissions query failed: ${subsError.message}`);

      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, is_demo');
      if (clientsError) throw new Error(`Client names query failed: ${clientsError.message}`);

      const clientMap = new Map((clients || []).map(c => [c.id, c.name]));
      // ONE shared demo policy (config/demoData): submissions belonging to a
      // flagged demo client leave the queue with them unless ?demo=1.
      const demoIds = new Set((clients || []).filter(c => (c as any).is_demo).map(c => c.id));

      const enriched = (subs || [])
        .filter(s => showDemoRows() || !demoIds.has(s.client_id))
        .map(s => ({
          ...s,
          client_name: clientMap.get(s.client_id) || 'Unknown Client'
        }));

      setSubmissions(enriched);
    } catch (err: any) {
      console.warn('Failed to fetch submissions:', err);
      setSubmissions([]);
      setLoadError(err?.message || 'Unknown error');
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchSubmissions(); }, []);

  // Converged onto approveFormSubmission (the single approve path): it stamps
  // reviewed_at + reviewed_by (acting user's auth uuid) and merges — never
  // replaces — the data JSONB. The previous inline writer here wrote lowercase
  // 'reviewed', status only, recording no reviewer at all. On failure the modal
  // stays OPEN with the error shown — never assert success the DB doesn't hold.
  const handleMarkReviewed = async (sub: Submission) => {
    setReviewError(null);
    try {
      await approveFormSubmission(sub.id, user?.id ?? null);
      await fetchSubmissions();
      setSelectedSubmission(null);
    } catch (err: any) {
      console.error('Failed to mark reviewed:', err);
      setReviewError(err?.message || 'Review failed — the record was NOT updated. Please try again.');
    }
  };

  // Status comparisons go through normalizeSubmissionStatus — the DB carries both
  // 'completed' and 'Completed' (mixed writers), so raw literals miss half the rows.
  // The 'pending' filter bucket = assigned-but-unsubmitted: the assignment writer
  // (assignForm) emits 'Not Started', which normalizes to 'not_started'; a draft
  // in flight is 'in_progress'. Both belong to "Awaiting Client".
  const isAwaitingClient = (s: NormalizedSubmissionStatus) =>
    s === 'not_started' || s === 'in_progress';

  const filtered = submissions.filter(s => {
    const matchesSearch = searchTerm === '' ||
      (s.client_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.form_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const status = normalizeSubmissionStatus(s.status);
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'pending' ? isAwaitingClient(status) : status === filterStatus);
    return matchesSearch && matchesStatus;
  });

  const pendingCount = submissions.filter(s => isAwaitingClient(normalizeSubmissionStatus(s.status))).length;
  const completedCount = submissions.filter(s => normalizeSubmissionStatus(s.status) === 'completed').length;
  const reviewedCount = submissions.filter(s => normalizeSubmissionStatus(s.status) === 'reviewed').length;

  // Badges: outline + ink, no fill (2026-07-28). A filled chip reads as a button
  // and, at this density, turned the table into a colour field. 1px border in the
  // status ink + the same ink for text carries the same meaning at a fraction of
  // the visual weight. Only the ACTIONABLE state ('completed' = waiting on staff)
  // gets brand maroon; everything else is passive and stays warm neutral.
  const getStatusBadge = (status: string) => {
    switch (normalizeSubmissionStatus(status)) {
      case 'not_started':
      case 'in_progress': return 'border border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300';
      // J4b role separation: BRAND never renders as a status badge. Needs-review
      // is a pending-on-staff STATE, so it takes warning ochre; the brand stays
      // on the Review BUTTON (buttons are brand's job).
      case 'completed': return 'border border-warning-600 text-warning-700 dark:border-warning-400 dark:text-warning-400';
      case 'reviewed': return 'border border-success-300 text-success-700 dark:border-success-800 dark:text-success-400';
      default: return 'border border-neutral-300 text-neutral-600';
    }
  };

  // Icon semantics audited 2026-07-28: 'completed' rendered an AlertTriangle —
  // a hazard glyph on a row whose label said "Completed". It means "the client
  // finished it, you must review it", so it now carries an inbox/eye affordance
  // and the label reads "Needs review" (config/formSubmissionStatus.ts).
  const getStatusIcon = (status: string) => {
    switch (normalizeSubmissionStatus(status)) {
      case 'not_started': return <Clock size={12} />;
      case 'in_progress': return <Clock size={12} />;
      case 'completed': return <Eye size={12} />;
      case 'reviewed': return <CheckCircle2 size={12} />;
      default: return null;
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;

  // A failed load renders as a failed load — never as an empty (clean-looking) queue.
  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl text-center">
        <AlertTriangle size={22} className="text-rose-600" />
        <p className="text-sm font-bold text-rose-700 dark:text-rose-300">The submissions queue could not be loaded.</p>
        <p className="text-xs text-rose-600/80 dark:text-rose-400/80 max-w-md">Submissions may be awaiting review that aren’t shown. ({loadError})</p>
        <button
          onClick={fetchSubmissions}
          className="mt-1 inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-black uppercase tracking-widest text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards. Restructured 2026-07-28: three tinted, 1px-bordered colour
          blocks competed at equal weight, so nothing led. Now a neutral surface with
          a hairline, and colour enters ONLY as a 3px left rule.

          ONE card carries the accent — the actionable one. Of these three, only
          "Needs review" is work the staff member must do: "Awaiting client" is
          blocked on someone else, "Reviewed" is already finished. Both stay neutral.
          A ZERO count drops the accent entirely (no colour celebrating nothing). */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard icon={Clock} label="Awaiting client" value={pendingCount} />
        <SummaryCard icon={Eye} label="Needs review" value={completedCount} accent={completedCount > 0} />
        <SummaryCard icon={CheckCircle2} label="Reviewed" value={reviewedCount} />
      </div>

      {/* Filters */}
      <Card noPadding>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by client or form..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            {(['all', 'pending', 'completed', 'reviewed'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                  filterStatus === status
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
            <button onClick={fetchSubmissions} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Refresh">
              <RefreshCw size={16} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</th>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Form</th>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {filtered.map(sub => {
                const status = normalizeSubmissionStatus(sub.status);
                return (
                <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <User size={14} className="text-slate-400" />
                      </div>
                      <span className="font-bold text-sm">{sub.client_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">{sub.form_name}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {sub.submitted_at 
                      ? new Date(sub.submitted_at).toLocaleDateString() 
                      : <span className="italic text-slate-400">Not yet</span>
                    }
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md ${getStatusBadge(sub.status)}`}>
                      {getStatusIcon(sub.status)}
                      {SUBMISSION_STATUS_LABELS[status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {/* Proper secondary button (2026-07-28): the old pale-pink
                        bg-primary/10 fill read as a weak primary — a washed-out version
                        of the real CTA rather than a deliberate second tier. Transparent
                        with a maroon border and maroon text is unambiguous at both tiers. */}
                    {status === 'completed' && (
                      <button
                        onClick={() => setSelectedSubmission(sub)}
                        className="inline-flex items-center gap-2 text-sm bg-transparent border border-primary text-primary dark:border-dark-primary dark:text-dark-primary px-3 py-1.5 rounded-lg font-semibold hover:bg-primary/5 dark:hover:bg-dark-primary/10 transition-colors"
                      >
                        <Eye size={14} /> Review
                      </button>
                    )}
                    {status === 'reviewed' && (
                      <button
                        onClick={() => setSelectedSubmission(sub)}
                        className="inline-flex items-center gap-2 text-sm bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 px-3 py-1.5 rounded-lg font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <Eye size={14} /> View
                      </button>
                    )}
                    {isAwaitingClient(status) && (
                      <span className="text-[11px] text-neutral-500">Awaiting client</span>
                    )}
                  </td>
                </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 italic">
                    No submissions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Review Modal */}
      {selectedSubmission && (
        <Modal isOpen={true} onClose={() => { setSelectedSubmission(null); setReviewError(null); }} title={`${selectedSubmission.form_name} — ${selectedSubmission.client_name}`}>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-slate-400" />
                <span className="text-sm text-slate-500">
                  {selectedSubmission.submitted_at 
                    ? `Submitted ${new Date(selectedSubmission.submitted_at).toLocaleString()}`
                    : 'Pending submission'
                  }
                </span>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md ${getStatusBadge(selectedSubmission.status)}`}>
                {SUBMISSION_STATUS_LABELS[normalizeSubmissionStatus(selectedSubmission.status)]}
              </span>
            </div>

            {/* Answers through the shared SubmissionViewer (2026-07-28): real field
                labels from the form's own definition instead of raw payload keys
                ('clientSignature', dotted legacy ids), and unanswered fields say
                "Not answered" rather than rendering as bare headings. */}
            {selectedSubmission.data && typeof selectedSubmission.data === 'object' ? (
              <SubmissionViewer
                formId={selectedSubmission.form_id}
                formName={selectedSubmission.form_name}
                data={selectedSubmission.data}
              />
            ) : (
              <p className="text-slate-500 italic text-center py-8">No form data available yet.</p>
            )}

            {reviewError && (
              <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-2xl flex items-center gap-3 text-danger-600 dark:text-danger-400">
                <AlertTriangle size={18} className="shrink-0" />
                <span className="text-xs font-bold leading-relaxed">{reviewError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => { setSelectedSubmission(null); setReviewError(null); }}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Close
              </button>
              <button
                onClick={printRecord}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-sm font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <Printer size={15} /> Print / Save as PDF
              </button>
              {normalizeSubmissionStatus(selectedSubmission.status) === 'completed' && (
                <button
                  onClick={() => handleMarkReviewed(selectedSubmission)}
                  className="px-6 py-2 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-focus transition-all flex items-center gap-2"
                >
                  <CheckCircle2 size={16} /> Mark reviewed
                </button>
              )}
            </div>
          </div>
          <RecordPrintRoot
            formId={selectedSubmission.form_id}
            formName={selectedSubmission.form_name}
            data={selectedSubmission.data}
            committedAt={selectedSubmission.submitted_at}
          />
        </Modal>
      )}
    </div>
  );
};

export default ClientSubmissionsPanel;
