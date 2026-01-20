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
  datalistId?: string;
  datalistOptions?: string[];
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
  datalistId,
  datalistOptions,
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
    className: `w-full p-3 bg-white/5 dark:bg-slate-800/50 text-slate-800 dark:text-white border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-300 placeholder:text-slate-400 ${
      error ? 'border-red-500/50' : 'border-black/10 dark:border-white/10'
    }`,
  };

  const remainingChars = maxLength && typeof value === 'string' ? maxLength - value.length : null;

  return (
    <div className="mb-6">
      <div className="flex justify-between items-baseline mb-2">
        <label htmlFor={id} className="flex items-center text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {type === 'textarea' && maxLength && remainingChars !== null && (
          <span className={`text-[10px] font-mono font-bold ${remainingChars < 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {remainingChars}
          </span>
        )}
      </div>
      {type === 'textarea' ? (
        <textarea {...commonProps} rows={4}></textarea>
      ) : (
        <input {...commonProps} type={type} list={datalistId} />
      )}
      {datalistId && datalistOptions && (
        <datalist id={datalistId}>
          {datalistOptions.map((option, index) => (
            <option key={index} value={option} />
          ))}
        </datalist>
      )}
      {error && <p className="mt-2 text-xs text-red-500 font-bold uppercase tracking-tighter">{error}</p>}
    </div>
  );
};
