import React from 'react';

interface RadioGroupStringProps {
  id: string;
  label: React.ReactNode;
  value: string | null;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  error?: string;
  required?: boolean;
}

export const RadioGroupString: React.FC<RadioGroupStringProps> = ({ id, label, value, onChange, options, error, required = true }) => {
  return (
    <div id={id} className="mb-6">
      <label className="flex items-center text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="mt-2 flex flex-wrap gap-3">
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`px-6 py-2.5 rounded-xl transition-all duration-300 font-black text-xs uppercase tracking-widest border-2 ${
              value === option.value 
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
