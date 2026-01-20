import React from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ title, subtitle, children }) => {
  return (
    <header className="mb-8 relative rounded-2xl p-6 overflow-hidden bg-background dark:bg-dark-surface">
       <div 
        className="absolute inset-0 -z-10 animate-aurora" 
        style={{
          backgroundImage: 'linear-gradient(120deg, rgba(59, 130, 246, 0.1), rgba(168, 85, 247, 0.1) 50%, rgba(236, 72, 153, 0.1))',
          backgroundSize: '200% 200%'
        }}
      ></div>
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4 relative z-10">
        <div>
          <h1 className="text-h1 font-bold text-surface-content dark:text-dark-surface-content">{title}</h1>
          {subtitle && <p className="text-surface-secondary-content dark:text-dark-surface-secondary-content mt-2 text-lg">{subtitle}</p>}
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {children && <div className="flex items-center gap-2">{children}</div>}
        </div>
      </div>
    </header>
  );
};

export default Header;
