
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
    <div id={id} className="mb-8">
      <label className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-4 px-1">
        {label}
        {required && <span className="text-red-500 ml-1.5 opacity-50">*</span>}
      </label>
      <div className="flex flex-wrap gap-3">
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`px-6 py-3.5 rounded-2xl transition-all duration-300 font-black text-[10px] uppercase tracking-widest border-2 shadow-sm ${
              value === option.value 
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
