/**
 * OutreachModal — one-click actions for a flagged client.
 *
 * Surfaces four actions on a single alert:
 *   • Log outreach (phone / SMS / email / letter)
 *   • Create follow-up task
 *   • Schedule urgent session (navigates to calendar)
 *   • Notify probation officer (templated message)
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Phone, MessageSquare, Mail, FileText, CalendarPlus, Shield, CheckSquare, Loader2 } from 'lucide-react';
import { logOutreach, createTask, type ClientAlert } from '../services/alertsService';

interface Props {
  alert: ClientAlert | null;
  onClose: () => void;
  onActionComplete?: () => void;
}

type ActionTab = 'outreach' | 'task' | 'schedule' | 'probation';

const OUTREACH_TEMPLATES: Record<ClientAlert['reason'], string> = {
  WARRANT_RISK: 'Hi {name}, this is ACS reaching out because of an urgent compliance matter. Please call the office at 314-849-2800 today to discuss your program status.',
  DEADLINE_IMMINENT: 'Hi {name}, your court deadline is approaching and you still have hours to complete. Please call 314-849-2800 today so we can get you scheduled immediately.',
  MISSED_SESSIONS: 'Hi {name}, we noticed you have missed your last few sessions. Missing sessions can affect your court compliance. Please call 314-849-2800 today so we can get you back on track.',
  NON_COMPLIANT_STATUS: 'Hi {name}, I wanted to reach out regarding your current program status. Please call the office at 314-849-2800 at your earliest convenience.',
  LICENSE_SUSPENDED: 'Hi {name}, checking in on your SATOP progress so we can keep your reinstatement paperwork on track. Please call 314-849-2800 with any questions.',
  MISSING_DOCUMENTS: 'Hi {name}, we are missing some documents required for your program placement. Please call 314-849-2800 today to complete them.',
  LAGGING_COMPLETION: 'Hi {name}, just checking in on your program progress. Let\'s talk about pacing — please call 314-849-2800.',
};

const OutreachModal: React.FC<Props> = ({ alert, onClose, onActionComplete }) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<ActionTab>('outreach');
  const [method, setMethod] = useState<'Phone' | 'SMS' | 'Email' | 'Letter' | 'In-Person'>('Phone');
  const [message, setMessage] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('high');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (alert) {
      const template = OUTREACH_TEMPLATES[alert.reason] || '';
      setMessage(template.replace('{name}', alert.clientName.split(' ')[0]));
      setTaskDesc(`Follow up on: ${alert.headline}`);
      setDone(null);
      setError(null);
      setTab('outreach');
    }
  }, [alert]);

  if (!alert) return null;

  const handleOutreach = async () => {
    setSaving(true);
    setError(null);
    const res = await logOutreach(alert.clientId, method, message, alert.id);
    setSaving(false);
    if (res.ok) {
      setDone(`Outreach logged (${method}).`);
      onActionComplete?.();
    } else {
      setError(res.error || 'Failed to log outreach');
    }
  };

  const handleCreateTask = async () => {
    setSaving(true);
    setError(null);
    const res = await createTask(alert.clientId, taskDesc, taskDue || undefined, taskPriority);
    setSaving(false);
    if (res.ok) {
      setDone('Task created.');
      onActionComplete?.();
    } else {
      setError(res.error || 'Failed to create task');
    }
  };

  const handleScheduleUrgent = () => {
    // Log it first so we have a record that the action was taken, then navigate.
    createTask(
      alert.clientId,
      `URGENT: Schedule session — ${alert.headline}`,
      undefined,
      'urgent'
    );
    navigate('/session-management');
    onClose();
  };

  const handleNotifyProbation = async () => {
    setSaving(true);
    setError(null);
    const notes = `Notified probation officer regarding: ${alert.headline}. Detail: ${alert.detail}`;
    const res = await logOutreach(alert.clientId, 'Email', notes, alert.id);
    await createTask(
      alert.clientId,
      `Confirm probation officer received notification re: ${alert.headline}`,
      undefined,
      'high'
    );
    setSaving(false);
    if (res.ok) {
      setDone('Probation notification logged + follow-up task created.');
      onActionComplete?.();
    } else {
      setError(res.error || 'Failed to log notification');
    }
  };

  const tierColor = {
    CRITICAL: 'text-red-600 bg-red-50 border-red-200',
    HIGH: 'text-orange-600 bg-orange-50 border-orange-200',
    ELEVATED: 'text-amber-600 bg-amber-50 border-amber-200',
    MODERATE: 'text-blue-600 bg-blue-50 border-blue-200',
  }[alert.tier];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <header className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between">
          <div className="flex-1">
            <div className={`inline-block text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${tierColor}`}>
              {alert.tier}
            </div>
            <h2 className="text-xl font-black tracking-tight mt-2 dark:text-white">{alert.clientName}</h2>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">{alert.headline}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{alert.detail}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full shrink-0">
            <X size={18} />
          </button>
        </header>

        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          {([
            ['outreach', 'Outreach', MessageSquare],
            ['task', 'Task', CheckSquare],
            ['schedule', 'Schedule', CalendarPlus],
            ['probation', 'Probation', Shield],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setDone(null); setError(null); }}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-black uppercase tracking-widest transition ${tab === key ? 'text-primary border-b-2 border-primary bg-white dark:bg-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {done && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm font-bold text-emerald-700 dark:text-emerald-300">
              ✓ {done}
            </div>
          )}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm font-bold text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {tab === 'outreach' && (
            <>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Method</label>
                <div className="flex gap-2 mt-2">
                  {(['Phone', 'SMS', 'Email', 'Letter', 'In-Person'] as const).map(m => {
                    const Icon = m === 'Phone' ? Phone : m === 'SMS' ? MessageSquare : m === 'Email' ? Mail : FileText;
                    return (
                      <button
                        key={m}
                        onClick={() => setMethod(m)}
                        className={`flex-1 p-2 rounded-xl border text-[10px] font-bold uppercase flex flex-col items-center gap-1 transition ${method === m ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                      >
                        <Icon size={14} />
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Message / notes</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={6}
                  className="w-full mt-2 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <button
                onClick={handleOutreach}
                disabled={saving || !message.trim()}
                className="w-full py-3 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : null}
                Log {method} outreach
              </button>
            </>
          )}

          {tab === 'task' && (
            <>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Task description</label>
                <textarea
                  value={taskDesc}
                  onChange={e => setTaskDesc(e.target.value)}
                  rows={3}
                  className="w-full mt-2 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Due date</label>
                  <input
                    type="date"
                    value={taskDue}
                    onChange={e => setTaskDue(e.target.value)}
                    className="w-full mt-2 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={e => setTaskPriority(e.target.value as any)}
                    className="w-full mt-2 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleCreateTask}
                disabled={saving || !taskDesc.trim()}
                className="w-full py-3 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : null}
                Create task
              </button>
            </>
          )}

          {tab === 'schedule' && (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Opens the calendar to book an urgent session with {alert.clientName}. A follow-up task will be logged automatically so you can track it.
              </p>
              <button
                onClick={handleScheduleUrgent}
                className="w-full py-3 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <CalendarPlus size={16} />
                Open calendar
              </button>
            </>
          )}

          {tab === 'probation' && (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Logs a notification to probation officer <strong>{/* TODO: populate from client record */}on file</strong> regarding this alert and creates a follow-up task to confirm receipt.
              </p>
              <button
                onClick={handleNotifyProbation}
                disabled={saving}
                className="w-full py-3 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Shield size={16} />}
                Notify probation officer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OutreachModal;
