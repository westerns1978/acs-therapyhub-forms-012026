
import React from 'react';

interface FormFieldProps {
  id: string;
  label: React.ReactNode;
  type?: 'text' | 'email' | 'date' | 'textarea' | 'time' | 'tel';
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  error,
  required = true,
  maxLength,
  placeholder,
}) => {
  const commonProps = {
    id,
    name: id,
    value,
    onChange,
    required,
    maxLength,
    placeholder,
    className: `w-full p-4 bg-white/5 dark:bg-slate-800/50 text-slate-900 dark:text-white border-2 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-300 placeholder:text-slate-400 font-bold tracking-tight shadow-inner ${
      error ? 'border-red-500/50 bg-red-50/50' : 'border-black/5 dark:border-white/5'
    }`,
  };

  const remainingChars = maxLength && typeof value === 'string' ? maxLength - value.length : null;

  return (
    <div className="mb-8 group">
      <div className="flex justify-between items-baseline mb-2 px-1">
        <label htmlFor={id} className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 group-focus-within:text-primary transition-colors">
          {label}
          {required && <span className="text-red-500 ml-1.5 opacity-50">*</span>}
        </label>
        {maxLength && remainingChars !== null && (
          <span className={`text-[9px] font-black tracking-widest ${remainingChars < 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {remainingChars} BYTES REMAINING
          </span>
        )}
      </div>
      {type === 'textarea' ? (
        <textarea {...commonProps} rows={4}></textarea>
      ) : (
        <input {...commonProps} type={type} />
      )}
      {error && <p className="mt-2 text-[10px] font-black text-red-500 uppercase tracking-widest animate-fade-in-up ml-1">{error}</p>}
    </div>
  );
};
