
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FormDefinition } from '../types';
import { FormDetailModal } from './FormDetailModal';
import { Search, Star, Info, Plus, Play, CheckCircle, Filter, Zap, LayoutGrid, Clock, ShieldCheck, UserPlus } from 'lucide-react';
import { getClients } from '../services/api';
import { Client } from '../types';
import AssignFormModal from './forms/AssignFormModal';

// Definitions
import { SATOP_INTAKE_DEFINITION } from './forms/SatopClientIntakeForm';
import { RECOVERY_PLAN_DEFINITION } from './forms/ContinuingRecoveryPlanForm';
import { CONSENT_FORM_DEFINITION } from './forms/ConsentForTreatmentForm';
import { MEETING_REPORT_DEFINITION } from './forms/MeetingReportForm';
import { EMERGENCY_CONTACT_DEFINITION } from './forms/EmergencyContactForm';
import { DISCHARGE_SUMMARY_DEFINITION } from './forms/DischargeSummaryForm';
import { TELEHEALTH_FEEDBACK_DEFINITION } from './forms/TelehealthFeedbackForm';
import { SATOP_CHECKLIST_DEFINITION } from './forms/SatopChecklistForm';
import { AUTHORIZATION_RELEASE_DEFINITION } from './forms/AuthorizationForReleaseForm';
import { CHART_CHECKLIST_DEFINITION } from './forms/ChartChecklistForm';
import { SESSION_ATTENDANCE_DEFINITION } from './forms/SessionAttendanceForm';

export type View = 'library' | 'satop-intake' | 'recovery-plan' | 'consent-treatment' | 'meeting-report' | 'emergency-contact' | 'discharge-summary' | 'telehealth-feedback' | 'satop-checklist' | 'authorization-release' | 'chart-checklist' | 'session-attendance';

interface FormLibraryProps {
  onSelectForm: (form: View) => void;
}

const allForms = [
  { id: 'satop-intake', definition: SATOP_INTAKE_DEFINITION, view: 'satop-intake' as View },
  { id: 'recovery-plan', definition: RECOVERY_PLAN_DEFINITION, view: 'recovery-plan' as View },
  { id: 'consent-treatment', definition: CONSENT_FORM_DEFINITION, view: 'consent-treatment' as View },
  { id: 'meeting-report', definition: MEETING_REPORT_DEFINITION, view: 'meeting-report' as View },
  { id: 'emergency-contact', definition: EMERGENCY_CONTACT_DEFINITION, view: 'emergency-contact' as View },
  { id: 'discharge-summary', definition: DISCHARGE_SUMMARY_DEFINITION, view: 'discharge-summary' as View },
  { id: 'telehealth-feedback', definition: TELEHEALTH_FEEDBACK_DEFINITION, view: 'telehealth-feedback' as View },
  { id: 'satop-checklist', definition: SATOP_CHECKLIST_DEFINITION, view: 'satop-checklist' as View },
  { id: 'authorization-release', definition: AUTHORIZATION_RELEASE_DEFINITION, view: 'authorization-release' as View },
  { id: 'chart-checklist', definition: CHART_CHECKLIST_DEFINITION, view: 'chart-checklist' as View },
  { id: 'session-attendance', definition: SESSION_ATTENDANCE_DEFINITION, view: 'session-attendance' as View },
];

const FormCard: React.FC<{
  form: { definition: FormDefinition<any>; view: View };
  onSelect: (form: View) => void;
  onToggleFavorite: (id: string) => void;
  onPreview: (def: FormDefinition<any>) => void;
  onAssign: (def: FormDefinition<any>) => void;
  isFavorite: boolean;
  index: number;
}> = ({ form, onSelect, onToggleFavorite, onPreview, onAssign, isFavorite, index }) => {
  const { definition, view } = form;
  const draft = localStorage.getItem(`draft-${definition.id}`);
  const progress = draft ? JSON.parse(draft).progress : 0;

  const difficultyColors = {
    Simple: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
    Moderate: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
    Complex: 'bg-primary/10 text-primary border-primary/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, scale: 1.01 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/40 dark:border-slate-700 rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col group h-full hover:shadow-2xl"
    >
      <div className="p-8 flex-grow">
        <div className="flex justify-between items-start mb-6">
             <div className="flex items-center gap-2">
                 <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg ${definition.category === 'Legal' ? 'bg-indigo-500 text-white' : 'bg-primary text-white'}`}>{definition.category}</span>
                 {definition.isNew && <span className="px-3 py-1 bg-accent text-white text-[9px] font-black uppercase tracking-widest rounded-lg">New</span>}
             </div>
             <button 
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(definition.id); }} 
                className={`p-2.5 rounded-xl transition-all active:scale-90 ${isFavorite ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-black/5 dark:bg-white/5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20'}`}
             >
                <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
             </button>
        </div>

        <div className="flex items-start justify-between gap-2">
             <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter group-hover:text-primary transition-colors leading-none">
                {definition.title}
             </h2>
             <button onClick={() => onPreview(definition)} className="p-1 text-slate-300 hover:text-slate-600 dark:hover:text-white transition-colors shrink-0">
                <Info size={18} />
             </button>
        </div>
        
        <p className="text-slate-500 dark:text-slate-400 mt-4 text-sm font-medium leading-relaxed line-clamp-2">
            {definition.description}
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-8">
          {definition.tags?.map(tag => (
              <span key={tag} className="px-2.5 py-1 text-[9px] font-black uppercase tracking-tighter rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-black/5">
                {tag}
              </span>
          ))}
          <span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-tighter rounded-md border ${difficultyColors[definition.difficulty || 'Simple']}`}>
            {definition.difficulty}
          </span>
          <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-tighter rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/10 flex items-center gap-1.5">
            <Clock size={10}/> {definition.estimatedTime}
          </span>
        </div>

        {progress > 0 && (
          <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-black/5">
            <div className="flex justify-between items-end mb-2">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Saved Draft</span>
                <span className="text-xs font-black text-emerald-500">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden shadow-inner">
              <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-6 bg-slate-50/50 dark:bg-slate-950/50 border-t border-black/5 dark:border-white/5 mt-auto flex gap-3">
        <button
          onClick={() => onSelect(view)}
          className="flex-1 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 group active:scale-95"
        >
          {progress > 0 ? <Zap size={14} fill="currentColor" className="animate-pulse"/> : <Play size={14} fill="currentColor" />}
          {progress > 0 ? 'Continue' : 'Start'}
        </button>
        <button
          onClick={() => onAssign(definition)}
          className="flex-1 py-4 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-sm transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 active:scale-95"
        >
          <UserPlus size={14} /> Assign
        </button>
      </div>
    </motion.div>
  );
};

export const FormLibrary: React.FC<FormLibraryProps> = ({ onSelectForm }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('favoriteForms');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [previewingForm, setPreviewingForm] = useState<FormDefinition<any> | null>(null);
  const [assigningForm, setAssigningForm] = useState<FormDefinition<any> | null>(null);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    const fetchClients = async () => {
        const data = await getClients();
        setClients(data || []);
    };
    fetchClients();
  }, []);

  useEffect(() => {
    localStorage.setItem('favoriteForms', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    const handleSlash = (e: KeyboardEvent) => {
        if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
            e.preventDefault();
            document.getElementById('form-search')?.focus();
        }
    };
    window.addEventListener('keydown', handleSlash);
    return () => window.removeEventListener('keydown', handleSlash);
  }, []);

  const toggleFavorite = (formId: string) => {
    setFavorites(prev => prev.includes(formId) ? prev.filter(id => id !== formId) : [...prev, formId]);
  };

  const categories = ['All', 'Intake', 'Assessment', 'Treatment', 'Legal', 'Clinical'];

  const filteredForms = useMemo(() => {
    return allForms
      .filter(form => {
        const matchesCategory = activeCategory === 'All' || form.definition.category === activeCategory;
        const matchesSearch =
          form.definition.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          form.definition.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          form.definition.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        const aFav = favorites.includes(a.id);
        const bFav = favorites.includes(b.id);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return a.definition.title.localeCompare(b.definition.title);
      });
  }, [searchQuery, activeCategory, favorites]);

  return (
    <div className="space-y-12 pb-20 animate-fade-in-up">
      <header className="flex flex-col md:flex-row justify-between items-center gap-8 border-b border-black/5 dark:border-white/5 pb-12">
          <div className="max-w-2xl text-center md:text-left">
              <div className="flex items-center gap-3 justify-center md:justify-start mb-4">
                  <div className="bg-primary/10 p-3 rounded-2xl"><ShieldCheck className="text-primary" size={32}/></div>
                  <span className="text-xs font-black uppercase tracking-[0.5em] text-slate-400">ACS Clinical Forms</span>
              </div>
              <h1 className="text-6xl font-black tracking-tighter text-slate-900 dark:text-white leading-tight">Forms <span className="text-primary">Library</span></h1>
              <p className="mt-4 text-lg text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Browse and complete HIPAA-compliant clinical forms. Auto-save enabled.
              </p>
          </div>
          
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-2xl border border-black/5 dark:border-white/5 text-center min-w-[240px]">
              <p className="text-5xl font-black text-primary tracking-tighter">{allForms.length}</p>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mt-2">Available Forms</p>
          </div>
      </header>

      <div className="sticky top-20 z-30 p-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-3xl rounded-[3rem] border border-white/40 dark:border-slate-800 shadow-2xl flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-all group-focus-within:scale-110" size={20} />
            <input
              id="form-search"
              type="text"
              placeholder="Search forms... (Press '/' to search)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-16 pr-8 py-5 bg-white/50 dark:bg-slate-800/50 border-none rounded-3xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:ring-4 focus:ring-primary/10 transition-all font-bold tracking-tight shadow-inner text-lg"
            />
          </div>
          
          <div className="flex flex-wrap gap-2 justify-center p-1 bg-black/5 dark:bg-white/5 rounded-[2rem] border border-black/5">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                  activeCategory === category 
                    ? 'bg-white dark:bg-slate-700 text-primary shadow-lg scale-105 border-2 border-primary/20' 
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredForms.length > 0 ? (
          filteredForms.map((form, index) => (
            <FormCard 
                key={form.id} 
                form={form} 
                onSelect={onSelectForm} 
                index={index} 
                onToggleFavorite={toggleFavorite} 
                onPreview={setPreviewingForm} 
                onAssign={setAssigningForm}
                isFavorite={favorites.includes(form.id)} 
            />
          ))
        ) : (
          <div className="col-span-full py-40 text-center animate-fade-in-up">
            <div className="bg-slate-100 dark:bg-slate-800 w-32 h-32 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner border border-black/5">
                <LayoutGrid size={48} className="text-slate-300 dark:text-slate-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-400 uppercase tracking-[0.3em]">No Forms Found</h3>
            <button onClick={() => { setSearchQuery(''); setActiveCategory('All'); }} className="mt-6 text-primary font-black uppercase text-[10px] tracking-widest hover:underline">Clear Filters</button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {previewingForm && <FormDetailModal form={previewingForm} onClose={() => setPreviewingForm(null)} />}
      </AnimatePresence>

      {assigningForm && (
        <AssignFormModal 
            isOpen={!!assigningForm} 
            onClose={() => setAssigningForm(null)} 
            onFormAssigned={() => {}} 
            clients={clients}
            forms={[{ id: assigningForm.id, title: assigningForm.title, category: 'Intake', description: assigningForm.description, format: 'electronic' }]}
        />
      )}
    </div>
  );
};
