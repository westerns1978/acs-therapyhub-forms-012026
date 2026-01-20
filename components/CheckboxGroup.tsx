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
    <div id={id} className="mb-6">
      <label className="flex items-center text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {options.map(option => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`px-4 py-3 text-center rounded-xl transition-all duration-300 font-black text-[10px] uppercase tracking-widest border-2 ${
              values[option.id]
                ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                : 'bg-white/5 border-black/10 dark:border-white/10 text-slate-500 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-500 font-bold uppercase tracking-tighter">{error}</p>}
    </div>
  );
};
