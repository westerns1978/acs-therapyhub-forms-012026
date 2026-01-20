import React from 'react';

interface CheckboxProps {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ id, label, checked, onChange, error }) => {
  return (
    <div className="mb-6">
      <div className="flex items-start">
        <div className="flex items-center h-6">
          <input
            id={id}
            name={id}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            className="w-5 h-5 text-primary bg-white/10 border-2 border-slate-300 dark:border-slate-600 rounded focus:ring-primary/50 focus:ring-2 transition-colors cursor-pointer checked:bg-primary checked:border-primary"
          />
        </div>
        <div className="ml-3 text-sm">
          <label htmlFor={id} className="font-medium text-slate-700 dark:text-slate-200 cursor-pointer leading-relaxed">
            {label}
          </label>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-500 dark:text-red-400 font-medium">{error}</p>}
    </div>
  );
};
