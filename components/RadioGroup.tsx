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
    <div id={id} className="mb-6">
      <label className="flex items-center text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="mt-2 flex items-center space-x-4">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-8 py-3 rounded-xl transition-all duration-300 font-black text-xs uppercase tracking-widest border-2 ${
            value === true 
              ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
              : 'bg-white/5 border-black/10 dark:border-white/10 text-slate-500 hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-8 py-3 rounded-xl transition-all duration-300 font-black text-xs uppercase tracking-widest border-2 ${
            value === false 
              ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
              : 'bg-white/5 border-black/10 dark:border-white/10 text-slate-500 hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          No
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-500 font-bold uppercase tracking-tighter">{error}</p>}
    </div>
  );
};
