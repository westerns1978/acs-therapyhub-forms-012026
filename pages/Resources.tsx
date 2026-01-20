
import React, { useState } from 'react';
import Card from '../components/ui/Card';
import { Search, MapPin, ExternalLink, Video, FileText, Phone, ShieldAlert } from 'lucide-react';
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

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!query.trim()) return;
        
        setIsLoading(true);
        setResults(null);
        try {
            const data = await searchCommunityResources(query);
            setResults(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
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

            <Card title="Community Resource Finder" subtitle="Powered by Google Maps Grounding">
                <form onSubmit={handleSearch} className="relative mb-6">
                    <input 
                        type="text" 
                        value={query} 
                        onChange={(e) => setQuery(e.target.value)} 
                        placeholder="Search for resources (e.g., 'Food pantries near 63126', 'Shelters')" 
                        className="w-full pl-4 pr-12 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-background dark:bg-dark-surface-secondary"
                    />
                    <button type="submit" disabled={isLoading} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary text-white rounded-md hover:bg-primary-focus disabled:opacity-50">
                        <Search size={20} />
                    </button>
                </form>

                {isLoading && <div className="text-center p-8"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div><p className="mt-4 text-sm text-on-surface-secondary">Searching Google Maps...</p></div>}

                {results && (
                    <div className="space-y-6 animate-fade-in-up">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                            <p>{results.text}</p>
                        </div>
                        
                        {results.chunks.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {results.chunks.map((chunk, i) => {
                                    if (chunk.web?.uri) {
                                        return (
                                            <a key={i} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="block p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition group">
                                                <h4 className="font-bold text-primary group-hover:underline">{chunk.web.title}</h4>
                                                <p className="text-xs text-gray-500 truncate">{chunk.web.uri}</p>
                                            </a>
                                        );
                                    }
                                    return null;
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
