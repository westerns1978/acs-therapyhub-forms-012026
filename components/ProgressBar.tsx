import React from 'react';

interface ProgressBarProps {
  progress: number;
  step: number;
  totalSteps: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, step, totalSteps }) => {
  return (
    <div className="print:hidden mb-8">
      <div className="flex justify-between items-end mb-3">
        <div>
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Synchronizing Progress</p>
           <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300">Phase {step} of {totalSteps}</h3>
        </div>
        <span className="text-2xl font-black text-slate-900 dark:text-white">{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden shadow-inner">
        <div
          className="bg-gradient-to-r from-primary to-accent h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};
