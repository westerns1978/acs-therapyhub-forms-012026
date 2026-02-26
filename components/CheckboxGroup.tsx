
import React from 'react';

interface CheckboxGroupProps {
  id: string;
  label: React.ReactNode;
  options: { id: string; label: string }[];
  values: { [key: string]: boolean };
  onChange: (id: string) => void;
  error?: string;
  required?: boolean;
}

export const CheckboxGroup: React.FC<CheckboxGroupProps> = ({ id, label, options, values, onChange, error, required = true }) => {
  return (
    <div id={id} className="mb-8">
      {label && (
        <label className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-4 px-1">
          {label}
          {required && <span className="text-red-500 ml-1.5 opacity-50">*</span>}
        </label>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {options.map(option => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`px-4 py-4 text-center rounded-2xl transition-all duration-300 font-black text-[9px] uppercase tracking-widest border-2 shadow-sm ${
              values[option.id]
                ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20 scale-[1.02]'
                : 'bg-white/5 border-black/5 dark:border-white/5 text-slate-500 hover:bg-black/5 dark:hover:bg-white/5 hover:border-primary/30'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-[10px] font-black text-red-500 uppercase tracking-widest ml-1">{error}</p>}
    </div>
  );
};
