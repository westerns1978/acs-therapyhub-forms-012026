
import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';

const ThemeToggle: React.FC<{ isCollapsed?: boolean; className?: string }> = ({ isCollapsed, className = '' }) => {
  const { theme, setTheme } = useTheme();

  // If collapsed, we show a cycle button. If not, we show the segmented control.
  if (isCollapsed) {
     const toggleCycle = () => {
        if (theme === 'light') setTheme('dark');
        else if (theme === 'dark') setTheme('system');
        else setTheme('light');
     }
     
     const Icon = theme === 'light' ? Sun : (theme === 'dark' ? Moon : Monitor);
     
     return (
        <button
            onClick={toggleCycle}
            className={`flex items-center justify-center p-2 rounded-full transition-all duration-200 text-slate-500 hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-800 ${className}`}
            title="Cycle theme"
            aria-label={`Theme: ${theme}. Click to cycle light, dark, system.`}
        >
            <Icon size={20} />
        </button>
     )
  }

  return (
    <div className={`bg-gray-100 dark:bg-slate-800/50 p-1 rounded-xl flex items-center justify-between ${className}`}>
      {(['light', 'system', 'dark'] as const).map((mode) => {
          const Icon = mode === 'light' ? Sun : (mode === 'dark' ? Moon : Monitor);
          const isActive = theme === mode;
          return (
            <button
                key={mode}
                onClick={() => setTheme(mode)}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${
                    isActive 
                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm transform scale-105' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
                aria-label={`Set theme to ${mode}`}
            >
                <Icon size={14} className="mr-1.5" />
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          )
      })}
    </div>
  );
};

export default ThemeToggle;
