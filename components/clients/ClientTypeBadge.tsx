import React from 'react';
import { Tag, AlertTriangle } from 'lucide-react';
import { clientTypeLabel, needsClientTypeReview } from '../../config/clientType';

/**
 * Read-only chip for a client's OPERATIONAL client_type (the scheduling-funnel axis).
 * Deliberately styled UNLIKE the clinical program label/badge — a filled indigo pill with a
 * tag glyph, mixed-case — so the type and the program never read as duplicates. No filtering,
 * no interaction.
 *
 * Sched step 11: untagged (null) and the two ambiguous legacy tokens (ANGER_MANAGEMENT,
 * GAMBLING_RECOVERY) render an amber "needs review" treatment instead of nothing/plain
 * indigo — surfacing so David/staff re-tag deliberately in-app. The current stored value
 * (if any) is still shown; nothing is hidden or guessed away.
 */
const ClientTypeBadge: React.FC<{ type?: string | null; className?: string }> = ({ type, className = '' }) => {
  const flagged = needsClientTypeReview(type);
  if (!type) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-400/20 px-2 py-0.5 text-xs font-semibold ${className}`}
        title="Client type not tagged — needs review"
      >
        <AlertTriangle size={12} className="shrink-0 opacity-80" />
        Needs review
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${
        flagged
          ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200/70 dark:border-amber-400/20'
          : 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200/70 dark:border-indigo-400/20'
      } ${className}`}
      title={flagged ? `Client type: ${clientTypeLabel(type)} — needs review (pre-David straw-man token)` : `Client type: ${clientTypeLabel(type)}`}
    >
      {flagged ? <AlertTriangle size={12} className="shrink-0 opacity-80" /> : <Tag size={12} className="shrink-0 opacity-80" />}
      {clientTypeLabel(type)}
    </span>
  );
};

export default ClientTypeBadge;
