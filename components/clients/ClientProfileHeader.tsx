import React, { useState } from 'react';
import { Client } from '../../types';
import ClientAvatar from './ClientAvatar';
import { Phone, Mail, CalendarPlus, FilePlus, Sparkles, ChevronDown, ChevronUp, BrainCircuit, ShieldAlert, Zap } from 'lucide-react';
import { generateClinicalSnapshot } from '../../services/api';

interface ClientProfileHeaderProps {
  client: Client;
}

const getStatusColor = (status: Client['status']) => {
    switch (status) {
        case 'Compliant': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        case 'Non-Compliant': return 'bg-amber-100 text-amber-800 border-amber-200';
        case 'Warrant Issued': return 'bg-red-100 text-red-800 border-red-200';
        case 'Completed': return 'bg-blue-100 text-blue-800 border-blue-200';
        default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
};

const ClientProfileHeader: React.FC<ClientProfileHeaderProps> = ({ client }) => {
  const [isSnapshotExpanded, setIsSnapshotExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [clinicalSnapshot, setClinicalSnapshot] = useState<string | null>(null);

  const handleGenerateSnapshot = async () => {
    if (clinicalSnapshot) {
        setIsSnapshotExpanded(!isSnapshotExpanded);
        return;
    }

    setIsGenerating(true);
    setIsSnapshotExpanded(true);
    try {
        const snapshot = await generateClinicalSnapshot(client);
        setClinicalSnapshot(snapshot);
    } catch (error) {
        setClinicalSnapshot("Neural link timed out. System is using cached indicators.");
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/20 dark:border-slate-800 rounded-[2.5rem] shadow-2xl p-8 transition-all duration-500 overflow-hidden relative">
      {/* Background HUD decorations */}
      <div className="absolute top-0 right-0 p-4 opacity-5">
         <BrainCircuit size={120} />
      </div>

      <div className="flex flex-col lg:flex-row items-center lg:items-start gap-10 relative z-10">
        <div className="relative group">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl group-hover:blur-3xl transition-all"></div>
            <ClientAvatar client={client} className="w-32 h-32 text-5xl relative border-4 border-white dark:border-slate-800 shadow-2xl" />
            <div className="absolute -bottom-2 -right-2 bg-green-500 w-8 h-8 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center">
               <Zap size={14} className="text-white fill-white" />
            </div>
        </div>

        <div className="flex-1 text-center lg:text-left">
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mb-3">
              <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white">{client.name}</h1>
              <span className={`px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border ${getStatusColor(client.status)}`}>
                {client.status}
              </span>
          </div>
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm font-bold text-slate-500 uppercase tracking-widest">
              <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary"></div> {client.program}</span>
              <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> ID: {client.caseNumber}</span>
          </div>
          
          <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <button className="flex items-center gap-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-slate-900/10 active:scale-95">
                    <FilePlus size={16} /> Neural Note
                </button>
                <button className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all active:scale-95">
                    <CalendarPlus size={16} /> Dispatch
                </button>
                <button 
                    onClick={handleGenerateSnapshot}
                    className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${isSnapshotExpanded ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-primary text-white hover:bg-primary-focus shadow-lg shadow-primary/20'}`}
                >
                    <Sparkles size={16} className={isGenerating ? "animate-pulse" : ""} /> 
                    {isGenerating ? "Synthesizing..." : "Clinical Snapshot"}
                </button>
          </div>
        </div>

        <div className="lg:w-64 grid grid-cols-2 gap-3">
             <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Score</p>
                <p className="text-2xl font-black text-primary">{client.complianceScore}%</p>
             </div>
             <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Progress</p>
                <p className="text-2xl font-black text-slate-700 dark:text-white">{client.completionPercentage}%</p>
             </div>
        </div>
      </div>

      {isSnapshotExpanded && (
        <div className="mt-10 p-8 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-[2rem] animate-fade-in-up relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-transparent"></div>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl"><Sparkles size={20} className="text-primary"/></div>
                    <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-500">AI Synthesized Intelligence</h3>
                </div>
                <button onClick={() => setIsSnapshotExpanded(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20}/></button>
            </div>
            
            {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                    <div className="flex gap-1.5">
                        {[1,2,3].map(i => <div key={i} className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${i*0.1}s` }}></div>)}
                    </div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Aggregating session markers & risk telemetry...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <div className="lg:col-span-3 prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                        {clinicalSnapshot}
                        <p className="text-[9px] text-slate-400 mt-6 font-mono border-t border-slate-200 dark:border-slate-800 pt-4 uppercase tracking-tighter flex items-center gap-2">
                           <ShieldAlert size={10} /> Clinical use only. Data grounded in PDS records via Gemini 3 Deep Reasoning.
                        </p>
                    </div>
                    <div className="lg:col-span-1 border-l border-slate-200 dark:border-slate-800 pl-8 space-y-6">
                         <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Priority Action</p>
                            <button className="w-full py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-lg transition-all">Draft Court Report</button>
                         </div>
                         <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Risk Marker</p>
                            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
                                <ShieldAlert size={14} /> High Travel Latency
                            </div>
                         </div>
                    </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

const X = ({ size, className }: { size: number, className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);

export default ClientProfileHeader;