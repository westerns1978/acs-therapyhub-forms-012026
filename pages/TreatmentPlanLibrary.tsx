import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ClipboardList,
  Search,
  Target,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  TREATMENT_PLAN_TEMPLATES,
  TreatmentPlanTemplate,
  TemplateCategory,
  CATEGORY_STYLES,
} from '../data/treatmentPlanTemplates';

const CATEGORIES: ('All' | TemplateCategory)[] = [
  'All',
  'SATOP',
  'Gambling Recovery',
  'Opioid Recovery',
  'Anger Management',
  'Mental Health',
];

const countInterventions = (t: TreatmentPlanTemplate) =>
  t.problems.reduce((acc, p) => acc + p.interventions.length, 0);

const TemplateCard: React.FC<{
  template: TreatmentPlanTemplate;
  index: number;
  onApply: (t: TreatmentPlanTemplate) => void;
}> = ({ template, index, onApply }) => {
  const style = CATEGORY_STYLES[template.category];
  const interventionCount = countInterventions(template);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, scale: 1.01 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={`bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-border dark:border-slate-700 rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col group h-full hover:shadow-2xl ring-1 ${style.ring}`}
    >
      <div className="p-8 flex-grow">
        <div className="flex items-center gap-2 mb-6">
          <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg ${style.badge}`}>
            {template.category}
          </span>
        </div>

        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-tight transition-colors">
          {template.title}
        </h2>

        <p className="text-slate-500 dark:text-slate-400 mt-4 text-sm font-medium leading-relaxed line-clamp-3">
          {template.description}
        </p>

        <div className="grid grid-cols-3 gap-3 mt-8">
          <div className="text-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-black/5">
            <p className={`text-2xl font-black ${style.accent} tracking-tighter`}>{template.problems.length}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Problems</p>
          </div>
          <div className="text-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-black/5">
            <p className={`text-2xl font-black ${style.accent} tracking-tighter`}>{interventionCount}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Interventions</p>
          </div>
          <div className="text-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-black/5 flex flex-col items-center justify-center">
            <Clock size={16} className={style.accent} />
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1 leading-tight">{template.estimatedDuration.split('/')[0].trim()}</p>
          </div>
        </div>

        <ul className="mt-6 space-y-2">
          {template.problems.slice(0, 3).map((p) => (
            <li key={p.title} className="flex items-start gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <Target size={12} className={`mt-0.5 flex-shrink-0 ${style.accent}`} />
              <span className="line-clamp-1">{p.title}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-6 bg-slate-50/50 dark:bg-slate-950/50 border-t border-black/5 dark:border-white/5 mt-auto">
        <button
          onClick={() => onApply(template)}
          className="w-full py-4 bg-primary hover:bg-primary-focus text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 active:scale-95"
        >
          <CheckCircle2 size={14} /> Use This Template
        </button>
      </div>
    </motion.div>
  );
};

const TreatmentPlanLibrary: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | TemplateCategory>('All');
  const [searchParams] = useSearchParams();
  // ?for=<clientId> — set by ClientWorkspace's empty-state CTA so the
  // customize modal opens with the right client preselected.
  const preselectedClientId = searchParams.get('for') || undefined;

  const filteredTemplates = useMemo(() => {
    return TREATMENT_PLAN_TEMPLATES.filter((t) => {
      const matchesCategory = activeCategory === 'All' || t.category === activeCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.problems.some((p) => p.title.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, activeCategory]);

  // Opens the CustomizeTreatmentPlanModal owned by MainLayout via window event.
  // Real Supabase clients are loaded inside the modal (no more DEMO_CLIENTS).
  const handleApplyTemplate = (template: TreatmentPlanTemplate) => {
    window.dispatchEvent(new CustomEvent('open-treatment-plan-modal', {
      detail: { mode: { kind: 'apply-template', template, preselectedClientId } },
    }));
  };

  return (
    <div className="space-y-12 pb-20 animate-fade-in-up">
      <header className="flex flex-col md:flex-row justify-between items-center gap-8 border-b border-black/5 dark:border-white/5 pb-12">
        <div className="max-w-2xl text-center md:text-left">
          <div className="flex items-center gap-3 justify-center md:justify-start mb-4">
            <div className="bg-primary/10 p-3 rounded-2xl">
              <ClipboardList className="text-primary" size={32} />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.5em] text-slate-400">
              ACS Treatment Plans
            </span>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-slate-900 dark:text-white leading-tight">
            Treatment Plan <span className="text-primary">Library</span>
          </h1>
          <p className="mt-4 text-lg text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            Start a new client's plan from a clinically reviewed template. Customize problems, goals, and interventions per ACS standards.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-2xl border border-black/5 dark:border-white/5 text-center min-w-[240px]">
          <p className="text-5xl font-black text-primary tracking-tighter">
            {TREATMENT_PLAN_TEMPLATES.length}
          </p>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mt-2">
            Available Templates
          </p>
        </div>
      </header>

      <div className="sticky top-20 z-30 p-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-3xl rounded-[3rem] border border-border dark:border-slate-800 shadow-2xl flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 group w-full">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-all group-focus-within:scale-110" size={20} />
          <input
            type="text"
            placeholder="Search templates by title, description, or problem..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-16 pr-8 py-5 bg-white/50 dark:bg-slate-800/50 border-none rounded-3xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:ring-4 focus:ring-primary/10 transition-all font-bold tracking-tight shadow-inner text-lg"
          />
        </div>

        <div className="flex flex-wrap gap-2 justify-center p-1 bg-black/5 dark:bg-white/5 rounded-[2rem] border border-black/5">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
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
        {filteredTemplates.length > 0 ? (
          filteredTemplates.map((template, index) => (
            <TemplateCard
              key={template.id}
              template={template}
              index={index}
              onApply={handleApplyTemplate}
            />
          ))
        ) : (
          <div className="col-span-full py-40 text-center animate-fade-in-up">
            <div className="bg-slate-100 dark:bg-slate-800 w-32 h-32 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner border border-black/5">
              <ClipboardList size={48} className="text-slate-300 dark:text-slate-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-400 uppercase tracking-[0.3em]">
              No Templates Found
            </h3>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('All');
              }}
              className="mt-6 text-primary font-black uppercase text-[10px] tracking-widest hover:underline"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

export default TreatmentPlanLibrary;
