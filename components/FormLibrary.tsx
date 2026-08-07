
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FormDefinition } from '../types';
import { FormDetailModal } from './FormDetailModal';
import { Search, Star, Info, Plus, Play, CheckCircle, Filter, Zap, LayoutGrid, Clock, ShieldCheck, UserPlus, Link2, Check } from 'lucide-react';
import { getClients } from '../services/api';
import { Client } from '../types';
import AssignFormModal from './forms/AssignFormModal';

// Definitions come from the ONE shared index (config/formDefinitions, 2026-07-28)
// so this list and the submission viewers cannot drift — the #36 catalog hazard.
import { FORM_DEFINITION_BY_ID } from '../config/formDefinitions';
// PDF twin metadata lives on FORM_REGISTRY (the catalog), which this surface does NOT
// iterate — it renders FORM_DEFINITION_BY_ID. Resolving by id keeps the registry the
// single source of truth for pdfSlug WITHOUT consolidating the two catalogs (that's
// DEFERRED #36, deliberately still open). A form absent from the registry, or present
// with no pdfSlug, simply renders no link.
import { FORM_REGISTRY_BY_ID, pdfUrlFor, isRetiredForm } from '../config/formRegistry';

export type View = 'library' | 'satop-registration' | 'registration' | 'satop-intake' | 'recovery-plan' | 'consent-treatment' | 'meeting-report' | 'emergency-contact' | 'discharge-summary' | 'telehealth-feedback' | 'satop-checklist' | 'authorization-release' | 'chart-checklist' | 'session-attendance' | 'hipaa-ack' | 'telehealth-consent' | 'late-cancellation';

interface FormLibraryProps {
  onSelectForm: (form: View) => void;
}

// Every library id doubles as its View token; 'meeting-report' etc. included.
// Derived from the shared index — adding a form there surfaces it here.
// Retired forms are withdrawn HERE — this is the staff surface where a form is
// chosen to fill or assign, and the only live picker for the two staff-audience
// retirements (chart-checklist, session-attendance; David 2026-08-02). Their
// definitions stay in FORM_DEFINITION_BY_ID on purpose so existing submissions
// still render real labels; only the card disappears. See FormRegistryEntry.retired.
const allForms = (Object.keys(FORM_DEFINITION_BY_ID) as View[])
  .filter(id => !isRetiredForm(id))
  .map(id => ({
    id,
    definition: FORM_DEFINITION_BY_ID[id],
    view: id as View,
  }));

/**
 * How many of the forms ON THIS PAGE are cert-gate items, resolved through the
 * REGISTRY (`requiredForCompletion`) rather than counted by hand.
 *
 * Counted over `allForms`, NOT over the whole registry, so the number can never
 * describe forms this page does not show. That distinction is not academic —
 * the two catalogs genuinely disagree (DEFERRED #36, still open):
 *
 *   FORM_DEFINITION_BY_ID   16 keys  ->  14 after the 2 retirements  = cards rendered
 *   FORM_REGISTRY (live)    15
 *   the difference          `treatment-plan` is live in the registry but has NO
 *                           definition, so it cannot render a card here.
 *
 * The old subtitle said "14 forms available" — which was right about the cards —
 * but the raw 16 keys and the registry's 15 are both floating around, and none of
 * the three numbers was sourced. This one is.
 */
const REQUIRED_ON_THIS_PAGE = allForms
  .filter(f => FORM_REGISTRY_BY_ID[f.id]?.requiredForCompletion)
  .length;

// Category badge colors — off-red on purpose (2026-08-07). Every category except
// Legal used to fall through to `bg-primary` (ACS red), so a grid of a dozen cards
// showed a wall of solid red pills with no connection to the ONE thing red is meant
// to mean on this page: the active filter chip below, and each card's own "Start /
// Continue" affordance. Five distinct non-red hues (Legal's indigo already existed
// and is kept) so a glance at the filter bar's solid-red chip is unambiguous about
// what "active" means, instead of competing with a card's own decoration.
const CATEGORY_BADGE_CLASS: Record<string, string> = {
  Legal: 'bg-indigo-500 text-white',
  Intake: 'bg-blue-500 text-white',
  Assessment: 'bg-teal-500 text-white',
  Treatment: 'bg-violet-500 text-white',
  Clinical: 'bg-cyan-600 text-white',
  default: 'bg-slate-500 text-white',
};

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
  // Drafts are keyed per (form, client) as `acsdraft:v2:<formId>:<clientId>` since
  // 2026-07-27; the library has no client context, so it cannot and must not probe
  // them. This read is retained only as a no-op: `progress` was never written by
  // BaseFormTemplate either, so the "Saved Draft %" panel it gates has never
  // rendered. Wire it to a real per-client lookup or delete it — don't restore the
  // unscoped key.
  const draft = null;
  const progress = 0;

  // Blank PDF twin, resolved from the registry by id (see the import note). Unset
  // pdfSlug → no action rendered at all; there is no disabled/greyed state, because a
  // link to a file that does not exist would return Firebase's 200 + SPA shell.
  const pdfSlug = FORM_REGISTRY_BY_ID[definition.id]?.pdfSlug;
  // Required-for-certification (the 3.206(13)(F) cert-gate set) — a NEW signal on
  // this card (2026-08-07). The card previously showed no compliance signal at all;
  // this reads the SAME registry field the completion gate itself uses, so the badge
  // can never say "required" when the gate doesn't agree. Amber, never red — red is
  // reserved for the primary action on this card, and required-ness is a status, not
  // a call to action.
  const isRequired = FORM_REGISTRY_BY_ID[definition.id]?.requiredForCompletion === true;
  const [copied, setCopied] = useState(false);
  const copyPdfLink = async () => {
    if (!pdfSlug) return;
    try {
      await navigator.clipboard.writeText(pdfUrlFor(pdfSlug));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied (insecure context / permission). Say so rather than
      // showing the success tick for a copy that did not happen.
      window.prompt('Copy this link:', pdfUrlFor(pdfSlug));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, scale: 1.01 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      // Brand pass (2026-08-07): hover used to re-color the WHOLE border, which read
      // as too much red across a grid of a dozen cards at once. Only the left edge
      // (a 4px rule, not the full ring) now carries the interaction color, and ONLY
      // for non-required cards — a required card's amber left rule is a standing
      // compliance signal, not a hover state, and must not flicker to red when a
      // counselor merely moves the mouse over it.
      className={`bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-border dark:border-slate-700 border-l-4 ${
        isRequired ? 'border-l-warning-500 dark:border-l-warning-500' : 'border-l-transparent group-hover:border-l-primary transition-colors'
      } rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col group h-full hover:shadow-2xl`}
    >
      <div className="p-8 flex-grow">
        <div className="flex justify-between items-start mb-6">
             <div className="flex items-center gap-2">
                 <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg ${CATEGORY_BADGE_CLASS[definition.category] ?? CATEGORY_BADGE_CLASS.default}`}>{definition.category}</span>
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

        {/* Density pass: category (top-left) is the single accent; here we keep only a muted
            time chip. Difficulty + tag/required chips dropped — one signal, not five. */}
        <div className="flex flex-wrap items-center gap-2 mt-8">
          <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-tighter rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-black/5 flex items-center gap-1.5">
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
        {/* The card's "Open" affordance — the ONE persistent (non-hover) brand mark
            per card, per the one-solid-red-per-surface rule (2026-08-07). Was solid
            black (bg-slate-900 dark:bg-white), a color language that appeared on this
            card and nowhere else in the app's action grammar. */}
        <button
          onClick={() => onSelect(view)}
          className="flex-1 py-4 bg-primary hover:bg-primary-focus text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 group active:scale-95"
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
        {pdfSlug && (
          <button
            onClick={copyPdfLink}
            title="Copy a link to the blank PDF — paste it into a text or email to the client"
            aria-label={`Copy PDF link for ${definition.title}`}
            className={`px-4 py-4 border rounded-2xl shadow-sm transition-all transform hover:scale-[1.02] flex items-center justify-center active:scale-95 ${
              copied
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-primary'
            }`}
          >
            {copied ? <Check size={14} /> : <Link2 size={14} />}
          </button>
        )}
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
    <div className="space-y-8 pb-20 animate-fade-in-up">
      {/* ONE ROW (2026-08-07). The card work shipped earlier; this is the layout
          half that did not. What it replaces: a 6xl "Forms Library" wordmark with
          a 0.5em-tracked eyebrow and a 32px icon tile in its own full-width block
          (pb-12, space-y-12), then a SECOND full-width sticky bar below it holding
          a text-lg py-5 search input — roughly 340px of chrome before the first
          card on a 900px-tall screen.

          Now: identity, count, search and filters on a single sticky row. The row
          keeps `sticky top-20` because filtering a long grid while scrolled is the
          actual job; it is just no longer two stacked bars to do it.

          The subtitle no longer says "HIPAA-compliant". Nothing on this page
          verifies that, and the app is currently on a shared multi-tenant database
          with no BAA (SECURITY_BACKLOG) — the same honesty class as the print
          attestations, which say what was actually checked and nothing more.
          "Auto-save enabled" also went: it described the form runner, not the
          library, and this row is now a control strip rather than ad copy. */}
      <header className="sticky top-20 z-30 flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-3 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl border border-border dark:border-slate-800 shadow-card">
          <div className="flex items-center gap-3 shrink-0 pl-1">
              <div className="bg-primary/10 p-2 rounded-xl shrink-0"><ShieldCheck className="text-primary" size={20}/></div>
              <div className="min-w-0">
                  <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
                    Forms <span className="text-primary">Library</span>
                  </h1>
                  {/* Both numbers are DERIVED, not typed. `allForms` is the cards
                      actually rendered (definitions minus retirements); the required
                      count resolves each of those ids through FORM_REGISTRY. */}
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {allForms.length} forms · {REQUIRED_ON_THIS_PAGE} required for completion
                  </p>
              </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:justify-end min-w-0 flex-1">
            <div className="relative group w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
              <input
                id="form-search"
                type="text"
                placeholder="Search forms…  /"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-border dark:border-dark-border rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>

            <div className="flex flex-wrap gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  // Solid ACS red for the active chip, not a red-tinted-white pill — now
                  // that no card badge is red by default (see CATEGORY_BADGE_CLASS), this
                  // is the ONE solid-red element in the filter bar, so "active" reads
                  // unambiguously instead of competing with a dozen red category badges.
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] transition-all ${
                    activeCategory === category
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
      </header>

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
            // Was `() => {}` — a genuine no-op: the modal stayed open after a
            // successful assign with no acknowledgement, which reads as "nothing
            // happened" and invites a second click (and a duplicate row, since
            // assignForm has no uniqueness constraint). Closing IS the feedback
            // here; this page renders no per-client assignment state to refetch.
            onFormAssigned={() => setAssigningForm(null)}
            clients={clients}
            forms={[{ id: assigningForm.id, title: assigningForm.title, category: 'Intake', description: assigningForm.description, format: 'electronic' }]}
        />
      )}
    </div>
  );
};
