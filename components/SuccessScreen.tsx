import React from 'react';
import { motion } from 'framer-motion';
import { FormDefinition } from '../types';
import { CheckCircle, ArrowLeft, Star, ExternalLink, ShieldCheck } from 'lucide-react';

interface SuccessScreenProps {
  formData: any;
  formDefinition: FormDefinition<any>;
  onReturnToLibrary: () => void;
  submissionId: string | null;
}

export const SuccessScreen: React.FC<SuccessScreenProps> = ({ formData, formDefinition, onReturnToLibrary, submissionId }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-3xl border border-white/20 dark:border-slate-800 rounded-[3.5rem] shadow-2xl p-12 sm:p-20 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 to-primary"></div>
      
      <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner border border-emerald-200 dark:border-emerald-800">
         <ShieldCheck className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
      </div>

      <h2 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white">Neural Handshake Complete</h2>
      <p className="mt-4 text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
        Your protocol <strong>{formDefinition.title}</strong> has been successfully transmitted and encrypted in the ACS Therapy Vault.
      </p>

      <div className="mt-10 p-6 bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-100 dark:border-slate-800 text-left space-y-4 max-w-lg mx-auto">
        <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Protocol ID</span>
            <code className="bg-white dark:bg-slate-800 px-3 py-1 rounded-lg font-mono text-xs text-primary font-bold">{submissionId}</code>
        </div>
        <div className="flex items-center gap-3 p-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl"><ExternalLink size={16}/></div>
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400">A high-fidelity copy has been attached to your patient file.</p>
        </div>
      </div>

      {formDefinition.successScreen?.googleReview && (
        <div className="mt-10 p-8 bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 rounded-[2.5rem]">
          <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-white flex items-center justify-center gap-2">
            <Star className="text-amber-500 fill-amber-500" size={20} /> Share Your Experience
          </h3>
          <p className="text-sm text-slate-500 mt-2 font-medium">Your digital testimony helps others navigate their recovery path.</p>
          <a
            href="https://g.page/r/CY7s22hZ3deZEBM/review"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 px-8 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl hover:scale-105 transition-all border border-slate-100 dark:border-slate-700"
          >
            Leave a Review <ExternalLink size={14} />
          </a>
        </div>
      )}

      <button
        onClick={onReturnToLibrary}
        className="mt-12 w-full sm:w-auto px-12 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs uppercase tracking-widest rounded-2xl shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-2 mx-auto"
      >
        <ArrowLeft size={16} /> Return to Library
      </button>
    </motion.div>
  );
};
