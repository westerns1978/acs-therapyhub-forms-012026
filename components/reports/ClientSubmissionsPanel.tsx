
import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import { supabase } from '../../services/supabase';
import LoadingSpinner from '../ui/LoadingSpinner';
import Modal from '../ui/Modal';
import { normalizeSubmissionStatus, SUBMISSION_STATUS_LABELS, NormalizedSubmissionStatus } from '../../config/formSubmissionStatus';
import { approveFormSubmission } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, CheckCircle2, Clock, AlertTriangle, Search, RefreshCw, User, FileText, Calendar } from 'lucide-react';

interface Submission {
  id: string;
  client_id: string;
  form_type: string;
  form_name: string;
  status: string;
  data: any;
  submitted_at: string | null;
  created_at: string;
  client_name?: string;
}

const ClientSubmissionsPanel: React.FC = () => {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'reviewed'>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      // Get all form submissions
      const { data: subs } = await supabase
        .from('form_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      // Get client names for mapping
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name');

      const clientMap = new Map((clients || []).map(c => [c.id, c.name]));

      const enriched = (subs || []).map(s => ({
        ...s,
        client_name: clientMap.get(s.client_id) || 'Unknown Client'
      }));

      setSubmissions(enriched);
    } catch (err) {
      console.warn('Failed to fetch submissions:', err);
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

  const getStatusBadge = (status: string) => {
    switch (normalizeSubmissionStatus(status)) {
      case 'not_started':
      case 'in_progress': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'completed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'reviewed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (normalizeSubmissionStatus(status)) {
      case 'not_started':
      case 'in_progress': return <Clock size={12} />;
      case 'completed': return <AlertTriangle size={12} />;
      case 'reviewed': return <CheckCircle2 size={12} />;
      default: return null;
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl">
          <div className="flex items-center gap-3">
            <Clock className="text-amber-600" size={20} />
            <div>
              <p className="text-2xl font-black text-amber-800 dark:text-amber-200">{pendingCount}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Awaiting Client</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-2xl">
          <div className="flex items-center gap-3">
            <FileText className="text-blue-600" size={20} />
            <div>
              <p className="text-2xl font-black text-blue-800 dark:text-blue-200">{completedCount}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Needs Review</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-2xl">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-green-600" size={20} />
            <div>
              <p className="text-2xl font-black text-green-800 dark:text-green-200">{submissions.filter(s => normalizeSubmissionStatus(s.status) === 'reviewed').length}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-green-600">Reviewed</p>
            </div>
          </div>
        </div>
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
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg ${getStatusBadge(sub.status)}`}>
                      {getStatusIcon(sub.status)}
                      {SUBMISSION_STATUS_LABELS[status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {status === 'completed' && (
                      <button
                        onClick={() => setSelectedSubmission(sub)}
                        className="inline-flex items-center gap-2 text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-bold hover:bg-primary/20 transition-colors"
                      >
                        <Eye size={14} /> Review
                      </button>
                    )}
                    {status === 'reviewed' && (
                      <button
                        onClick={() => setSelectedSubmission(sub)}
                        className="inline-flex items-center gap-2 text-sm bg-slate-100 dark:bg-slate-800 text-slate-500 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-200 transition-colors"
                      >
                        <Eye size={14} /> View
                      </button>
                    )}
                    {isAwaitingClient(status) && (
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Awaiting Client</span>
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
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg ${getStatusBadge(selectedSubmission.status)}`}>
                {SUBMISSION_STATUS_LABELS[normalizeSubmissionStatus(selectedSubmission.status)]}
              </span>
            </div>

            {/* Form Data Display */}
            {selectedSubmission.data && typeof selectedSubmission.data === 'object' ? (
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Form Responses</h4>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-3">
                  {Object.entries(selectedSubmission.data).map(([key, value]) => (
                    <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[140px]">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm text-slate-800 dark:text-slate-200 font-medium">
                        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || '—')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-slate-500 italic text-center py-8">No form data available yet.</p>
            )}

            {reviewError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400">
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
              {normalizeSubmissionStatus(selectedSubmission.status) === 'completed' && (
                <button
                  onClick={() => handleMarkReviewed(selectedSubmission)}
                  className="px-6 py-2 bg-green-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all flex items-center gap-2"
                >
                  <CheckCircle2 size={16} /> Mark as Reviewed
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ClientSubmissionsPanel;
