import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import { FormDefinition, FormErrors } from '../types';
import { ProgressBar } from './ProgressBar';
import { SuccessScreen } from './SuccessScreen';
import { PrintPreview } from './PrintPreview';
import { ChevronLeft, ChevronRight, Save, Send, AlertTriangle } from 'lucide-react';

interface BaseFormTemplateProps<T> {
  formDefinition: FormDefinition<T>;
  onBackToLibrary: () => void;
}

export const BaseFormTemplate = <T extends object>({ formDefinition, onBackToLibrary }: BaseFormTemplateProps<T>) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<T>(() => {
    const savedData = localStorage.getItem(`draft-${formDefinition.id}`);
    if (savedData) {
      try {
        return JSON.parse(savedData).formData;
      } catch {
        return formDefinition.initialState;
      }
    }
    return formDefinition.initialState;
  });
  const [errors, setErrors] = useState<FormErrors<T>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);
  const [saveStatus, setSaveStatus] = useState<string>('');

  const stepContainerRef = useRef<HTMLDivElement>(null);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const totalSteps = formDefinition.steps.length;

  const progress = useMemo(() => {
    const totalFields = Object.keys(formDefinition.initialState).length;
    if (totalFields === 0) return 0;

    let filledFields = 0;
    for (const key in formData) {
      const value = formData[key as keyof T];
      if (value !== formDefinition.initialState[key as keyof T]) {
        if (typeof value === 'object' && value !== null) {
          if(Object.values(value).some(v => v)) filledFields++;
        } else if(value) {
          filledFields++;
        }
      }
    }
    return (filledFields / totalFields) * 100;
  }, [formData, formDefinition.initialState]);

  const saveDraft = useCallback(() => {
    setSaveStatus('Saving...');
    try {
      const dataToSave = {
        formData: formDataRef.current,
        progress: progress
      };
      localStorage.setItem(`draft-${formDefinition.id}`, JSON.stringify(dataToSave));
      const now = new Date();
      setTimeout(() => setSaveStatus(`Saved at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`), 500);
    } catch (error) {
      setSaveStatus('Draft sync failed.');
    }
  }, [formDefinition.id, progress]);

  useEffect(() => {
    const savedData = localStorage.getItem(`draft-${formDefinition.id}`);
    if (savedData) {
      setSaveStatus('Restored from cloud local-sync.');
    }
    const autoSaveInterval = setInterval(saveDraft, 60000);
    return () => clearInterval(autoSaveInterval);
  }, [saveDraft, formDefinition.id]);

  const handleNext = () => {
    const newErrors = formDefinition.validateStep(step, formData);
    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      if (step < totalSteps) {
        setDirection(1);
        setStep(step + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      const firstErrorKey = Object.keys(newErrors)[0];
      const element = document.getElementById(firstErrorKey);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setDirection(-1);
      setStep(step - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    let allErrors: FormErrors<T> = {};
    for (let i = 1; i <= totalSteps; i++) {
      allErrors = { ...allErrors, ...formDefinition.validateStep(i, formData) };
    }

    setErrors(allErrors);

    if (Object.keys(allErrors).length > 0) {
      const firstErrorKey = Object.keys(allErrors)[0];
      const firstErrorStep = formDefinition.steps.findIndex((_, index) =>
        Object.keys(formDefinition.validateStep(index + 1, formData)).includes(firstErrorKey)
      ) + 1;

      if (firstErrorStep > 0 && firstErrorStep !== step) {
        setDirection(firstErrorStep > step ? 1 : -1);
        setStep(firstErrorStep);
      }
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSubmissionId(`TXN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`);
      setIsSubmitted(true);
      localStorage.removeItem(`draft-${formDefinition.id}`);
    } catch (error) {
      setSubmissionError('Network timeout: Failed to commit clinical data to vault.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formVariants: Variants = {
    hidden: (dir: number) => ({ x: dir > 0 ? 50 : -50, opacity: 0 }),
    visible: { x: 0, opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
    exit: (dir: number) => ({ x: dir < 0 ? 50 : -50, opacity: 0, transition: { duration: 0.2 } }),
  };

  const CurrentStepComponent = formDefinition.steps[step - 1];

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {isSubmitted ? (
        <SuccessScreen formData={formData} formDefinition={formDefinition} onReturnToLibrary={onBackToLibrary} submissionId={submissionId} />
      ) : (
        <div className="space-y-8">
            <header className="flex justify-between items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-white/20 dark:border-slate-800 shadow-xl print:hidden">
                <div>
                   <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">{formDefinition.title}</h1>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{formDefinition.category} Protocol</p>
                </div>
                <button onClick={onBackToLibrary} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors">
                    <X size={24} className="text-slate-400" />
                </button>
            </header>

            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-white/20 dark:border-slate-800 rounded-[3rem] p-8 sm:p-12 shadow-2xl relative overflow-hidden print:bg-transparent print:shadow-none print:border-none print:p-0">
                <ProgressBar progress={progress} step={step} totalSteps={totalSteps} />
                
                <div className="mt-12 relative min-h-[400px]">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={step}
                            ref={stepContainerRef}
                            custom={direction}
                            variants={formVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                        >
                            <CurrentStepComponent formData={formData} setFormData={setFormData} errors={errors} />
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="mt-12 pt-8 border-t border-black/5 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center gap-6 print:hidden">
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button onClick={step === 1 ? onBackToLibrary : handlePrev} className="flex-1 sm:flex-none px-8 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                            <ChevronLeft size={16} /> {step === 1 ? 'Abort' : 'Back'}
                        </button>
                        <button onClick={saveDraft} className="flex-1 sm:flex-none px-8 py-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2">
                            <Save size={16} /> Sync
                        </button>
                    </div>

                    <div className="flex flex-col items-center sm:items-end">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{saveStatus}</p>
                        {step === totalSteps ? (
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="w-full sm:w-auto px-12 py-4 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
                                {isSubmitting ? 'Transmitting...' : 'Commit Data'}
                            </button>
                        ) : (
                            <button onClick={handleNext} className="w-full sm:w-auto px-12 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2">
                                Next Phase <ChevronRight size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {submissionError && (
                    <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 animate-shake">
                        <AlertTriangle size={20} />
                        <span className="text-sm font-bold uppercase tracking-tight">{submissionError}</span>
                    </div>
                )}
            </div>
        </div>
      )}
      <div className="hidden print:block">
        <PrintPreview formData={formData} formDefinition={formDefinition} />
      </div>
    </div>
  );
};

const X = ({ size, className }: { size: number, className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);

const Loader2 = ({ size, className }: { size: number, className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
);
