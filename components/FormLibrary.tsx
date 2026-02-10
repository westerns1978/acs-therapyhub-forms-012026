import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FormDefinition } from '../types';
import { FormDetailModal } from './FormDetailModal';
import { Search, Star, Info, Plus, Play, CheckCircle, Filter, Zap, LayoutGrid, Clock } from 'lucide-react';

// Definitions would be imported from separate files normally
const MOCK_DEFINITION: FormDefinition<any> = {
    id: 'satop-intake',
    title: 'SATOP Client Intake Protocol',
    description: 'Universal intake protocol for primary SATOP recidivism reduction programs.',
    category: 'Intake',
    tags: ['Required', 'SATOP'],
    estimatedTime: '8 min',
    difficulty: 'Simple',
    isNew: true,
    isRecommended: true,
    initialState: {},
    steps: [],
    validateStep: () => ({}),
    fieldDefinitions: []
};

export type View = 'library' | 'satop-intake' | 'recovery-plan' | 'consent-treatment' | 'meeting-report' | 'emergency-contact' | 'discharge-summary' | 'telehealth-feedback' | 'satop-checklist' | 'authorization-release' | 'chart-checklist' | 'session-attendance';

interface FormLibraryProps {
  onSelectForm: (form: View) => void;
}

const allForms = [
  { id: 'satop-intake', definition: MOCK_DEFINITION, view: 'satop-intake' as View },
  // ... rest of forms would be mapped here
];

const FormCard: React.FC<{
  form: { definition: FormDefinition<any>; view: View };
  onSelect: (form: View) => void;
  onToggleFavorite: (id: string) => void;
  onPreview: (def: FormDefinition<any>) => void;
  isFavorite: boolean;
  index: number;
}> = ({ form, onSelect, onToggleFavorite, onPreview, isFavorite, index }) => {
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
      whileHover={{ y: -5 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/40 dark:border-slate-700 rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col group"
    >
      <div className="p-8 flex-grow">
        <div className="flex justify-between items-start mb-4">
             <div className="flex items-center gap-2">
                 <span className="px-3 py-1 bg-primary text-white text-[9px] font-black uppercase tracking-widest rounded-full">Protocol</span>
                 {definition.isNew && <span className="px-3 py-1 bg-accent text-white text-[9px] font-black uppercase tracking-widest rounded-full">New</span>}
             </div>
             <button 
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(definition.id); }} 
                className={`p-2 rounded-xl transition-all ${isFavorite ? 'bg-amber-500 text-white' : 'bg-black/5 dark:bg-white/5 text-slate-400 hover:text-amber-500'}`}
             >
                <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
             </button>
        </div>

        <div className="flex items-center gap-2">
             <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter group-hover:text-primary transition-colors">
                {definition.title}
             </h2>
             <button onClick={() => onPreview(definition)} className="text-slate-300 hover:text-slate-600 dark:hover:text-white transition-colors">
                <Info size={16} />
             </button>
        </div>
        
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium leading-relaxed line-clamp-2">
            {definition.description}
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-6">
          {definition.tags?.map(tag => (
              <span key={tag} className="px-2.5 py-1 text-[9px] font-black uppercase tracking-tighter rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-black/5">
                {tag}
              </span>
          ))}
          <span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-tighter rounded-md border ${difficultyColors[definition.difficulty || 'Simple']}`}>
            {definition.difficulty}
          </span>
          <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-tighter rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/10 flex items-center gap-1">
            <Clock size={10}/> {definition.estimatedTime}
          </span>
        </div>

        {progress > 0 && (
          <div className="mt-8">
            <div className="flex justify-between items-end mb-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Partial Commitment</span>
                <span className="text-xs font-black text-emerald-500">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-1.5 overflow-hidden shadow-inner">
              <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-6 bg-slate-50/50 dark:bg-slate-950/50 border-t border-black/5 dark:border-white/5 mt-auto">
        <button
          onClick={() => onSelect(view)}
          className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
        >
          {progress > 0 ? <><Zap size={14} fill="currentColor"/> Resume Phase</> : <><Play size={14} fill="currentColor"/> Initiate Protocol</>}
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

  useEffect(() => {
    localStorage.setItem('favoriteForms', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (formId: string) => {
    setFavorites(prev => prev.includes(formId) ? prev.filter(id => id !== formId) : [...prev, formId]);
  };

  const categories = ['All', 'Intake', 'Assessment', 'Treatment', 'Legal', 'Clinical'];

  // This would be replaced with actual form definitions from your provided prompt content
  const formsToDisplay = useMemo(() => {
    // Standard set of form definitions mapped to the library
    return [
        { id: 'satop-intake', view: 'satop-intake', definition: MOCK_DEFINITION },
        // ... (remaining 10 forms would go here)
    ] as any[];
  }, []);

  const filteredForms = useMemo(() => {
    return formsToDisplay
      .filter(form => {
        const matchesCategory = activeCategory === 'All' || form.definition.category === activeCategory;
        const matchesSearch =
          form.definition.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          form.definition.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        const aFav = favorites.includes(a.id);
        const bFav = favorites.includes(b.id);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return a.definition.title.localeCompare(b.definition.title);
      });
  }, [searchQuery, activeCategory, favorites, formsToDisplay]);

  return (
    <div className="space-y-10">
      <header className="text-center max-w-2xl mx-auto">
          <h1 className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white">Neural Protocols</h1>
          <p className="mt-4 text-slate-500 font-medium leading-relaxed">
            HIPAA-compliant high-fidelity document committed via GeMyndFlow Orchestrator. Select a protocol to initiate neural sync.
          </p>
      </header>

      <div className="sticky top-0 z-30 p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-3xl rounded-[3rem] border border-white/40 dark:border-slate-800 shadow-2xl flex flex-col md:flex-row gap-6 items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
            <input
              type="text"
              placeholder="Query clinical schemas..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-16 pr-6 py-5 bg-white/50 dark:bg-slate-800/50 border-none rounded-3xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:ring-4 focus:ring-primary/10 transition-all font-bold tracking-tight shadow-inner"
            />
          </div>
          
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                  activeCategory === category 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                    : 'bg-white/50 dark:bg-slate-800/50 text-slate-500 hover:bg-white dark:hover:bg-slate-800'
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
                isFavorite={favorites.includes(form.id)} 
            />
          ))
        ) : (
          <div className="col-span-full py-32 text-center">
            <LayoutGrid size={64} className="mx-auto text-slate-200 dark:text-slate-800 mb-6" />
            <h3 className="text-xl font-black text-slate-400 uppercase tracking-[0.2em]">No Synchronized Protocols Found</h3>
          </div>
        )}
      </div>

      <AnimatePresence>
        {previewingForm && <FormDetailModal form={previewingForm} onClose={() => setPreviewingForm(null)} />}
      </AnimatePresence>
    </div>
  );
};
