/**
 * Category-on-capture picker (P2). Shows the existing document_type options grouped
 * under Admin / Clinical headers (config/recordCategory.ts). Controlled: the host
 * pre-selects the AI's inferred document_type; the user confirms or overrides. When
 * the inference is unmapped (not one of the offered options), nothing is pre-selected
 * and a hint asks the user to choose — the type is surfaced, never silently bucketed.
 *
 * Maroon = selected; neutral = unselected. No off-palette colors.
 */
import React from 'react';
import { CATEGORY_OPTIONS, RECORD_CATEGORY_ORDER } from '../../config/recordCategory';

interface CategoryPickerProps {
  value: string;
  onChange: (documentType: string) => void;
  /** True when the current value came from AI inference (vs a user click). */
  inferred?: boolean;
  className?: string;
}

const CategoryPicker: React.FC<CategoryPickerProps> = ({ value, onChange, inferred, className = '' }) => {
  const known = RECORD_CATEGORY_ORDER.some(cat => CATEGORY_OPTIONS[cat].some(o => o.value === value));
  return (
    <div className={`space-y-4 ${className}`} role="radiogroup" aria-label="Document category">
      {!known && (
        <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
          Pick a category so this document files correctly.
        </p>
      )}
      {inferred && known && (
        <p className="text-[11px] text-slate-500">Suggested from the document — change it if it's wrong.</p>
      )}
      {RECORD_CATEGORY_ORDER.map(cat => (
        <div key={cat}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{cat}</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS[cat].map(opt => {
              const selected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange(opt.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                    selected
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-primary/40'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CategoryPicker;
