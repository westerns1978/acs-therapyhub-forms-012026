import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FormDefinition } from '../types';
import { Clock, BarChart, Info, X, Shield, Zap } from 'lucide-react';

interface FormDetailModalProps {
  form: FormDefinition<any>;
  onClose: () => void;
}

const InfoPill: React.FC<{ label: string; value: string; colorClass: string; icon: React.ElementType }> = ({ label, value, colorClass, icon: Icon }) => (
  <div className="flex-1 text-center group">
    <div className={`flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all duration-300 group-hover:scale-105 ${colorClass}`}>
      <Icon size={20} className="mb-2" />
      <span className="font-black text-xs uppercase tracking-widest">{value}</span>
    </div>
    <span className="text-[9px] font-black uppercase text-slate-400 mt-2 block tracking-widest">{label}</span>
  </div>
);

export const FormDetailModal: React.FC<FormDetailModalProps> = ({ form, onClose }) => {
  const difficultyColors = {
    Simple: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
    Moderate: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
    Complex: 'bg-primary/10 text-primary border-primary/20',
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden border border-white/20 dark:border-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="p-8 bg-gradient-to-br from-primary/5 to-transparent border-b border-black/5 dark:border-white/5 flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase text-primary tracking-[0.3em]">{form.category}</span>
              <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white mt-2">{form.title}</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">
              <X size={24} className="text-slate-400" />
            </button>
          </header>

          <div className="p-8">
            <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{form.description}</p>

            <div className="mt-10 flex gap-4">
              <InfoPill icon={BarChart} label="Complexity" value={form.difficulty || 'Simple'} colorClass={difficultyColors[form.difficulty || 'Simple']} />
              <InfoPill icon={Clock} label="Latency" value={form.estimatedTime || '5 min'} colorClass="bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400" />
              <InfoPill icon={Shield} label="Phases" value={`${form.steps.length}`} colorClass="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700" />
            </div>

            <div className="mt-10 p-6 bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-3">
                    <Zap size={16} className="text-primary fill-primary" />
                    <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest">Protocol Eligibility</h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                    This protocol is typically dispatched during the <strong>{form.category.toLowerCase()}</strong> phase of the client's clinical journey. Requires verified staff credentials for commitment.
                </p>
            </div>
          </div>
          
          <footer className="p-8 border-t border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/50">
             <button onClick={onClose} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl hover:scale-[1.02] transition-all">Acknowledge</button>
          </footer>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
