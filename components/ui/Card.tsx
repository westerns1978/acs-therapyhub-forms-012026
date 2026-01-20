
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  noPadding?: boolean;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className = '', title, subtitle, actions, noPadding = false, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`
      bg-white/70 dark:bg-slate-800/60
      backdrop-blur-xl
      border border-white/40 dark:border-slate-700
      rounded-2xl 
      shadow-xl 
      transition-all duration-300
      hover:shadow-2xl hover:border-white/60 dark:hover:border-slate-600
      hover:scale-[1.01]
      ${onClick ? 'cursor-pointer' : ''}
      ${className}`
    }>
      {(title || actions) && (
        <div className={`px-6 py-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center gap-4`}>
          <div>
            {title && <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight tracking-tight">{title}</h3>}
            {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>{children}</div>
    </div>
  );
};

export default Card;