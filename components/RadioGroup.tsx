
import React from 'react';

interface RadioGroupProps {
  id: string;
  label: React.ReactNode;
  value: boolean | null;
  onChange: (value: boolean) => void;
  error?: string;
  required?: boolean;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({ id, label, value, onChange, error, required = true }) => {
  return (
    <div id={id} className="mb-8">
      <label className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-4 px-1">
        {label}
        {required && <span className="text-red-500 ml-1.5 opacity-50">*</span>}
      </label>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 py-4 rounded-2xl transition-all duration-300 font-black text-xs uppercase tracking-widest border-2 shadow-sm ${
            value === true 
              ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20 scale-[1.02]' 
              : 'bg-white/5 border-black/5 dark:border-white/5 text-slate-500 hover:bg-black/5 dark:hover:bg-white/5 hover:border-primary/30'
          }`}
        >
          Affirmative (Yes)
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 py-4 rounded-2xl transition-all duration-300 font-black text-xs uppercase tracking-widest border-2 shadow-sm ${
            value === false 
              ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20 scale-[1.02]' 
              : 'bg-white/5 border-black/5 dark:border-white/5 text-slate-500 hover:bg-black/5 dark:hover:bg-white/5 hover:border-primary/30'
          }`}
        >
          Negative (No)
        </button>
      </div>
      {error && <p className="mt-2 text-[10px] font-black text-red-500 uppercase tracking-widest ml-1">{error}</p>}
    </div>
  );
};
