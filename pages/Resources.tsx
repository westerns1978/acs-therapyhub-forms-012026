
import React, { useState } from 'react';
import Card from '../components/ui/Card';
import { Search, MapPin, ExternalLink, Video, FileText, Phone, ShieldAlert, MessageSquare, Loader2 } from 'lucide-react';
import { searchCommunityResources } from '../services/api';

const therapists = [
    { name: 'David', zoomId: '4920165222' },
    { name: 'Bill', zoomId: '5627181964' },
    { name: 'John', zoomId: '3334445555' },
    { name: 'Karen', zoomId: '6667778888' },
    { name: 'Michelle', zoomId: '9990001111' },
];

const crisisNumbers = [
    { name: '988 Suicide & Crisis Lifeline', phone: '988', desc: 'Free, confidential support 24/7.' },
    { name: 'Life Crisis Services', phone: '314-647-4357', desc: 'Available 24/7 in the US.' },
    { name: 'Behavioral Health Response', phone: '1-800-811-4760', desc: '24/7 support.' },
    { name: 'Veterans Crisis Line', phone: '988 (Press 1)', desc: 'Confidential for Veterans.' },
    { name: 'Crisis Text Line', phone: 'Text 741741', desc: 'Text with a trained crisis counselor.' },
    { name: 'Domestic Violence Hotline', phone: '800-799-7233', desc: '24/7 Support.' },
];

const officialResources = [
    { name: 'Alcoholics Anonymous St. Louis', url: 'https://www.aastl.org/', desc: 'Local meeting schedules and info.' },
    { name: 'Narcotics Anonymous', url: 'https://na.org/', desc: 'Substance abuse support.' },
    { name: 'Missouri Dept. of Mental Health', url: 'https://dmh.mo.gov/', desc: 'State guidance and forms.' },
    { name: 'Smart Recovery', url: 'https://www.smartrecovery.org/', desc: 'Self-management and recovery training.' },
    { name: 'Al-Anon/Alateen', url: 'https://al-anon.org/', desc: 'Support for families of alcoholics.' },
];

const Resources: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<{text: string, chunks: any[]} | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLocating, setIsLocating] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!query.trim()) return;
        
        setIsLoading(true);
        setResults(null);
        try {
            let coords: { latitude: number, longitude: number } | undefined;
            
            // Geolocate user for Maps grounding
            try {
                setIsLocating(true);
                const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
                });
                coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            } catch (err) {
                console.warn("Location services restricted.");
            } finally {
                setIsLocating(false);
            }

            const data = await searchCommunityResources(query, coords);
            setResults(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card title="Crisis Hotlines" className="border-l-4 border-red-500">
                    <div className="space-y-4">
                        {crisisNumbers.map((item, i) => (
                            <div key={i} className="flex justify-between items-center pb-2 border-b border-border last:border-0">
                                <div>
                                    <p className="font-bold text-sm text-red-700 dark:text-red-400">{item.name}</p>
                                    <p className="text-xs text-on-surface-secondary">{item.desc}</p>
                                </div>
                                <a href={`tel:${item.phone.replace(/[^0-9]/g, '')}`} className="flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm font-bold hover:bg-red-100">
                                    <Phone size={12} /> {item.phone}
                                </a>
                            </div>
                        ))}
                    </div>
                </Card>

                <div className="lg:col-span-2 space-y-6">
                    <Card title="Official Resources">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {officialResources.map((res, i) => (
                                <a key={i} href={res.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 p-3 rounded-lg bg-surface dark:bg-slate-800/50 border border-border hover:border-primary hover:shadow-md transition group">
                                    <div className="p-2 bg-primary/10 rounded-full text-primary group-hover:bg-primary group-hover:text-white transition">
                                        <ExternalLink size={16} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm text-primary dark:text-primary group-hover:underline">{res.name}</h4>
                                        <p className="text-xs text-on-surface-secondary">{res.desc}</p>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </Card>

                    <Card title="Therapist Zoom Rooms">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                            {therapists.map(therapist => (
                                <a key={therapist.name} href={`https://zoom.us/j/${therapist.zoomId}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 p-4 bg-surface dark:bg-slate-800/50 rounded-lg border border-border hover:scale-105 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-transform">
                                    <Video className="w-8 h-8 text-blue-500" />
                                    <span className="font-bold text-sm">{therapist.name}</span>
                                </a>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            <Card title="Community Resource Finder" subtitle="Powered by Google Maps Grounding & Gemini 2.5 Flash">
                <form onSubmit={handleSearch} className="relative mb-6">
                    <input 
                        type="text" 
                        value={query} 
                        onChange={(e) => setQuery(e.target.value)} 
                        placeholder="Search for local resources (e.g., 'Recovery centers near 63126', 'Clinics')" 
                        className="w-full pl-4 pr-12 py-4 border border-border rounded-2xl focus:ring-2 focus:ring-primary/20 bg-background dark:bg-dark-surface-secondary shadow-inner"
                    />
                    <button type="submit" disabled={isLoading} className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-primary text-white rounded-xl hover:bg-primary-focus disabled:opacity-50 shadow-lg shadow-primary/20">
                        <Search size={20} />
                    </button>
                </form>

                {(isLoading || isLocating) && (
                    <div className="text-center p-12">
                        <Loader2 className="animate-spin text-primary mx-auto w-10 h-10 mb-4" />
                        <p className="text-xs font-black uppercase text-slate-400 tracking-[0.2em]">
                            {isLocating ? 'Accessing Local Uplink...' : 'Querying Google Maps Infrastructure...'}
                        </p>
                    </div>
                )}

                {results && (
                    <div className="space-y-8 animate-fade-in-up">
                        <div className="prose prose-sm dark:prose-invert max-w-none p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <p className="text-slate-700 dark:text-slate-200 font-medium leading-relaxed">{results.text}</p>
                        </div>
                        
                        {results.chunks.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {results.chunks.map((chunk, i) => {
                                    const maps = chunk.maps;
                                    const web = chunk.web;
                                    const uri = maps?.uri || web?.uri;
                                    const title = maps?.title || web?.title || 'Resource Found';
                                    
                                    if (!uri) return null;

                                    return (
                                        <div key={i} className="group p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm hover:shadow-xl hover:border-primary/20 transition-all">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="bg-primary/5 p-2 rounded-xl text-primary">
                                                    {maps ? <MapPin size={20}/> : <ExternalLink size={20}/>}
                                                </div>
                                                <a href={uri} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-primary hover:text-white transition-all">
                                                    <ExternalLink size={18} />
                                                </a>
                                            </div>
                                            <h4 className="font-black text-slate-800 dark:text-white text-lg tracking-tight mb-1 group-hover:text-primary transition-colors">{title}</h4>
                                            <p className="text-[10px] text-slate-400 font-mono truncate mb-4">{uri}</p>
                                            
                                            {/* Review Snippets from Maps Grounding */}
                                            {maps?.placeAnswerSources?.reviewSnippets?.length > 0 && (
                                                <div className="space-y-2 pt-4 border-t border-slate-50 dark:border-slate-800">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                        <MessageSquare size={12}/> Place Reviews
                                                    </p>
                                                    {maps.placeAnswerSources.reviewSnippets.map((snippet: string, j: number) => (
                                                        <p key={j} className="text-xs text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/30 p-2 rounded-lg leading-relaxed">
                                                            "{snippet}"
                                                        </p>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default Resources;
