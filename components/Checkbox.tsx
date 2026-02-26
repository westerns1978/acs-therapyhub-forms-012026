
import React from 'react';
import { Check } from 'lucide-react';

interface CheckboxProps {
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  id?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, checked, onChange, error, id }) => {
  return (
    <div className="mb-4">
      <label className="flex items-start gap-3 cursor-pointer group" htmlFor={id}>
        <div className="relative mt-0.5">
          <input
            id={id}
            type="checkbox"
            className="sr-only"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />
          <div className={`w-6 h-6 border-2 rounded-lg transition-all duration-200 flex items-center justify-center ${
            checked 
              ? 'bg-primary border-primary shadow-lg shadow-primary/20' 
              : 'bg-white/5 border-black/10 dark:border-white/10 group-hover:border-primary/50'
          }`}>
            {checked && <Check size={14} className="text-white" />}
          </div>
        </div>
        <span className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-snug group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
          {label}
        </span>
      </label>
      {error && <p className="mt-2 text-[10px] font-black text-red-500 uppercase tracking-tighter ml-9">{error}</p>}
    </div>
  );
};
