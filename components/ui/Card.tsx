
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
      bg-white dark:bg-slate-800
      border border-border dark:border-slate-700
      rounded-2xl 
      shadow-card dark:shadow-card-dark
      transition-all duration-300
      ${onClick ? 'cursor-pointer hover:shadow-card-hover dark:hover:shadow-card-hover-dark hover:-translate-y-0.5' : ''}
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