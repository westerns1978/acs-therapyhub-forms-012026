
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

import { FormDefinition, FormErrors } from '../types';
import { ProgressBar } from './ProgressBar';
import { SuccessScreen } from './SuccessScreen';
import { PrintPreview } from './PrintPreview';
import { supabase } from '../services/supabase';
import { ChevronLeft, Save, Send, AlertTriangle, Loader2, X } from 'lucide-react';

interface BaseFormTemplateProps<T> {
  formDefinition: FormDefinition<T>;
  onBackToLibrary: () => void;
}

export const BaseFormTemplate = <T extends object>({ formDefinition, onBackToLibrary }: BaseFormTemplateProps<T>) => {
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
  const [saveStatus, setSaveStatus] = useState<string>('');

  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const progress = useMemo(() => {
    const totalFields = formDefinition.fieldDefinitions.length;
    if (totalFields === 0) return 0;

    let filledFields = 0;
    formDefinition.fieldDefinitions.forEach(field => {
      const value = formData[field.id as keyof T];
      const initialValue = formDefinition.initialState[field.id as keyof T];
      
      if (JSON.stringify(value) !== JSON.stringify(initialValue)) {
        if (typeof value === 'object' && value !== null) {
          if(Object.values(value).some(v => v)) filledFields++;
        } else if(value !== null && value !== '' && value !== false) {
          filledFields++;
        }
      }
    });
    return Math.min(100, (filledFields / totalFields) * 100);
  }, [formData, formDefinition.fieldDefinitions, formDefinition.initialState]);

  const saveDraft = useCallback(() => {
    setSaveStatus('Saving...');
    try {
      const dataToSave = {
        formData: formDataRef.current,
      };
      localStorage.setItem(`draft-${formDefinition.id}`, JSON.stringify(dataToSave));
      const now = new Date();
      setTimeout(() => setSaveStatus(`Saved at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toUpperCase()}`), 500);
    } catch (error) {
      setSaveStatus('Save failed');
    }
  }, [formDefinition.id]);

  useEffect(() => {
    const savedData = localStorage.getItem(`draft-${formDefinition.id}`);
    if (savedData) {
      setSaveStatus('Draft loaded');
    }
    const autoSaveInterval = setInterval(saveDraft, 60000);
    return () => clearInterval(autoSaveInterval);
  }, [saveDraft, formDefinition.id]);

  const handleSubmit = async () => {
    const allErrors = formDefinition.validateStep(formData);
    setErrors(allErrors);

    if (Object.keys(allErrors).length > 0) {
      const firstErrorKey = Object.keys(allErrors)[0];
      const element = document.getElementById(firstErrorKey);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const clientData = sessionStorage.getItem('portal_client');
      const client = clientData ? JSON.parse(clientData) : null;
      
      const { data: submission, error: submitError } = await supabase
        .from('form_submissions')
        .insert({
          client_id: client?.id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          form_type: formDefinition.category,
          form_name: formDefinition.title,
          status: 'completed',
          data: formData,
          submitted_at: new Date().toISOString()
        })
        .select()
        .single();

      if (submitError) {
        throw new Error(submitError.message);
      }

      const formId = submission?.id 
        ? `ACS-${submission.id.slice(0, 8).toUpperCase()}`
        : `ACS-FORM-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      setSubmissionId(formId);
      setIsSubmitted(true);
      localStorage.removeItem(`draft-${formDefinition.id}`);
    } catch (error) {
      setSubmissionError('Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-24 px-4 sm:px-0">
      {isSubmitted ? (
        <SuccessScreen formData={formData} formDefinition={formDefinition} onReturnToLibrary={onBackToLibrary} submissionId={submissionId} />
      ) : (
        <div className="space-y-8">
            <header className="flex flex-col sm:flex-row justify-between items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl p-8 rounded-[2.5rem] border border-white/20 dark:border-slate-800 shadow-2xl print:hidden gap-6">
                <div>
                   <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">{formDefinition.category}</span>
                   <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white mt-1">{formDefinition.title}</h1>
                </div>
                <button onClick={onBackToLibrary} className="p-4 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-3xl transition-all hover:scale-110 active:scale-95 group shadow-sm border border-black/5 dark:border-white/5">
                    <X size={24} className="text-slate-400 group-hover:text-primary" />
                </button>
            </header>
            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-3xl border border-white/20 dark:border-slate-800 rounded-[3.5rem] p-8 sm:p-16 shadow-2xl relative overflow-hidden print:bg-transparent print:shadow-none print:border-none print:p-0">
                <ProgressBar progress={progress} />
                <div className="absolute top-8 right-16 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Form Progress</div>
                
                <div className="mt-16 relative min-h-[400px] space-y-6">
                    {formDefinition.fieldDefinitions.map(field => (
                        <div key={field.id}>
                            <label htmlFor={field.id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">{field.label}</label>
                            {field.type === 'textarea' ? (
                                <textarea
                                    id={field.id}
                                    value={(formData as any)[field.id] || ''}
                                    onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                />
                            ) : (
                                <input
                                    type={field.type}
                                    id={field.id}
                                    value={(formData as any)[field.id] || ''}
                                    onChange={(e) => setFormData({ ...formData, [field.id]: field.type === 'number' ? parseInt(e.target.value) : e.target.value })}
                                    min={field.min}
                                    max={field.max}
                                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                />
                            )}
                            {errors[field.id as keyof T] && <p className="text-red-500 text-xs mt-1">{errors[field.id as keyof T]}</p>}
                        </div>
                    ))}
                </div>
            </div>

                <div className="mt-16 pt-10 border-t border-black/5 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center gap-8 print:hidden">
                    <div className="flex gap-4 w-full sm:w-auto">
                        <button onClick={onBackToLibrary} className="flex-1 sm:flex-none px-10 py-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 shadow-sm">
                            <ChevronLeft size={16} /> Back
                        </button>
                        <button onClick={saveDraft} className="flex-1 sm:flex-none px-10 py-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2">
                            <Save size={16} /> Save Draft
                        </button>
                    </div>

                    <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] mb-3">{saveStatus}</p>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-16 py-5 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-2xl shadow-primary/30 hover:scale-105 transition-all disabled:opacity-50 flex items-center justify-center gap-3 border border-white/10"
                        >
                            {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}
                            {isSubmitting ? 'Submitting...' : 'Submit Form'}
                        </button>
                    </div>
                </div>

                {submissionError && (
                    <div className="mt-8 p-6 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center gap-4 text-red-600 dark:text-red-400 animate-shake">
                        <div className="bg-red-600 text-white p-2 rounded-xl"><AlertTriangle size={20} /></div>
                        <span className="text-sm font-black uppercase tracking-widest">Submission failed. Please try again.</span>
                    </div>
                )}
            </div>
      )} 
      <div className="hidden print:block">
        <PrintPreview formData={formData} formDefinition={formDefinition} />
      </div>
    </div>
  );
};
