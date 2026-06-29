import React from 'react';
import { Tag } from 'lucide-react';
import { clientTypeLabel } from '../../config/clientType';

/**
 * Read-only chip for a client's OPERATIONAL client_type (the scheduling-funnel axis).
 * Deliberately styled UNLIKE the clinical program label/badge — a filled indigo pill with a
 * tag glyph, mixed-case — so the type and the program never read as duplicates. Renders
 * nothing when the client carries no type (untagged = null). No filtering, no interaction.
 */
const ClientTypeBadge: React.FC<{ type?: string | null; className?: string }> = ({ type, className = '' }) => {
  if (!type) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-400/20 px-2 py-0.5 text-xs font-semibold ${className}`}
      title={`Client type: ${clientTypeLabel(type)}`}
    >
      <Tag size={12} className="shrink-0 opacity-80" />
      {clientTypeLabel(type)}
    </span>
  );
};

export default ClientTypeBadge;
