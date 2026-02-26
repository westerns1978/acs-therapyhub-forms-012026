
import React from 'react';

interface ProgressBarProps {
  progress: number;
  step: number;
  totalSteps: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, step, totalSteps }) => {
  return (
    <div className="print:hidden mb-12">
      <div className="flex justify-between items-end mb-4">
        <div>
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Form Progress</p>
           <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">Step {step} of {totalSteps}</h3>
        </div>
        <div className="text-right">
          <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{Math.round(progress)}%</span>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Completed</p>
        </div>
      </div>
      <div className="w-full bg-slate-100 dark:bg-slate-800/50 rounded-full h-3 overflow-hidden shadow-inner border border-black/5 dark:border-white/5 p-0.5">
        <div
          className="bg-gradient-to-r from-primary via-primary to-accent h-full rounded-full transition-all duration-1000 ease-out shadow-lg"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};
