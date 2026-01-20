
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DocumentFile } from '../../types';
import { GoogleGenAI } from '@google/genai';
import {
    Loader2, Download, Maximize, X, ZoomIn, ZoomOut, RotateCw, ArrowLeft, ArrowRight,
    FileCode, FileSpreadsheet, FileArchive, File as FileIcon,
    FileText, MessageSquare, Send, Sparkles, ImageOff, ExternalLink
} from 'lucide-react';

interface DocumentViewerProps {
    document: DocumentFile;
    documentsInFolder: DocumentFile[];
    onNavigate: (direction: 'next' | 'prev') => void;
}

const getUnsupportedFileIcon = (mimeType: string) => {
    if (mimeType.includes('word') || mimeType.includes('officedocument')) {
        return <FileText className="w-24 h-24 text-blue-500" />;
    }
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
        return <FileSpreadsheet className="w-24 h-24 text-green-500" />;
    }
    if (mimeType.includes('zip') || mimeType.includes('archive')) {
        return <FileArchive className="w-24 h-24 text-yellow-500" />;
    }
    return <FileIcon className="w-24 h-24 text-gray-500" />;
};

const DocumentViewer: React.FC<DocumentViewerProps> = ({ document, documentsInFolder, onNavigate }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState<{role: 'user' | 'model', text: string}[]>([]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [hasLoadError, setHasLoadError] = useState(false);
    const viewerRef = useRef<HTMLDivElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const { url, mimeType, filename, fileSize, uploadDate } = document;
    const isPdf = mimeType === 'application/pdf';
    const isImage = mimeType.startsWith('image/');
    
    useEffect(() => {
        setIsLoading(true);
        setHasLoadError(false);
        setZoom(1);
        setRotation(0);
        setChatHistory([]); 
    }, [document.id]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, isChatOpen]);

    const handleLoad = () => setIsLoading(false);
    const handleError = () => {
        setIsLoading(false);
        setHasLoadError(true);
    };

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (event.key === 'ArrowRight' && !isChatOpen) onNavigate('next');
        if (event.key === 'ArrowLeft' && !isChatOpen) onNavigate('prev');
        if (event.key === 'Escape' && window.document.fullscreenElement) {
            window.document.exitFullscreen();
        }
    }, [onNavigate, isChatOpen]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        const handleFullscreenChange = () => setIsFullscreen(!!window.document.fullscreenElement);
        window.document.addEventListener('fullscreenchange', handleFullscreenChange);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [handleKeyDown]);

    const toggleFullscreen = () => {
        if (!viewerRef.current) return;
        if (!window.document.fullscreenElement) {
            viewerRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            window.document.exitFullscreen();
        }
    };

    const handleSendChat = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!chatInput.trim() || isChatLoading) return;
        
        const userMsg = chatInput;
        setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
        setChatInput('');
        setIsChatLoading(true);

        try {
             if (!process.env.API_KEY) throw new Error("API Key missing");
             const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
             
             const context = `
             DOCUMENT CONTEXT:
             Filename: ${filename}
             Summary: ${document.extractedData.summary}
             Extracted Fields: ${JSON.stringify(document.extractedData.fields)}
             
             USER QUERY: ${userMsg}
             
             Answer the user's question based on the document context provided.
             `;

             const response = await ai.models.generateContent({
                 model: 'gemini-2.5-flash',
                 contents: context
             });
             
             setChatHistory(prev => [...prev, { role: 'model', text: response.text }]);

        } catch (err) {
            setChatHistory(prev => [...prev, { role: 'model', text: "Sorry, I couldn't process that request." }]);
        } finally {
            setIsChatLoading(false);
        }
    };
    
    const canNavigate = documentsInFolder.length > 1;
    const currentIndex = documentsInFolder.findIndex(d => d.id === document.id);
    const canGoPrev = canNavigate && currentIndex > 0;
    const canGoNext = canNavigate && currentIndex < documentsInFolder.length - 1;

    const renderContent = () => {
        if (hasLoadError) {
            return (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <ImageOff className="w-16 h-16 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Preview Unavailable</h3>
                    <p className="text-sm text-gray-500 max-w-xs mx-auto mb-4">The file could not be loaded. It may have been deleted or you may be offline.</p>
                    <a href={url} download={filename} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-focus text-sm font-medium">
                        Download File
                    </a>
                </div>
            );
        }

        if (isPdf) {
            return (
                <div className="w-full h-full overflow-auto bg-gray-50 dark:bg-slate-950">
                    <iframe
                        src={`${url}#toolbar=0&navpanes=0`}
                        title={filename}
                        className={`border-0 origin-top-center transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                        style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%`, height: `${100 / zoom}%` }}
                        onLoad={handleLoad}
                        onError={handleError}
                    />
                </div>
            );
        }

        if (isImage) {
            return (
                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto bg-gray-50 dark:bg-slate-950">
                    <img
                        src={url}
                        alt={filename}
                        className={`max-w-full max-h-full object-contain transition-all duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                        style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                        onLoad={handleLoad}
                        onError={handleError}
                    />
                </div>
            );
        }

        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                {getUnsupportedFileIcon(mimeType)}
                <p className="font-semibold mt-4">Preview not available</p>
                <p className="text-sm text-on-surface-secondary">This file type ({mimeType.split('/')[1]}) cannot be displayed.</p>
            </div>
        );
    };

    return (
        <div className="h-full w-full flex bg-gray-100 dark:bg-slate-900">
            <div ref={viewerRef} className="h-full flex-1 flex flex-col bg-white dark:bg-slate-900/50 rounded-lg overflow-hidden border border-border dark:border-slate-700/50 relative transition-all duration-300 shadow-sm">
                <header className="flex-shrink-0 p-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-border dark:border-slate-700/50 flex items-center justify-between z-20 absolute top-0 left-0 right-0">
                    <p className="text-sm font-semibold truncate flex-1 pl-2" title={filename}>{filename}</p>
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => setIsChatOpen(!isChatOpen)} 
                            className={`p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 flex items-center gap-2 text-sm font-medium transition-colors ${isChatOpen ? 'bg-primary/10 text-primary' : 'text-gray-600 dark:text-gray-300'}`}
                            title="Chat with Document"
                        >
                            <Sparkles size={16} /> Ask Clara
                        </button>
                        <div className="h-4 w-px bg-gray-300 dark:bg-slate-600 mx-2"></div>
                        {(isImage || isPdf) && (
                            <>
                                <button onClick={() => setZoom(z => z + 0.1)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700" title="Zoom In"><ZoomIn size={18} /></button>
                                <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700" title="Zoom Out"><ZoomOut size={18} /></button>
                            </>
                        )}
                        {isImage && (
                            <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700" title="Rotate"><RotateCw size={18} /></button>
                        )}
                        <a href={url} target="_blank" rel="noreferrer" className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700" title="Open in New Tab"><ExternalLink size={18} /></a>
                        <a href={url} download={filename} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700" title="Download"><Download size={18} /></a>
                        <button onClick={toggleFullscreen} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700" title="Fullscreen">
                            {isFullscreen ? <X size={18} /> : <Maximize size={18} />}
                        </button>
                    </div>
                </header>
                
                <main className="flex-1 relative overflow-hidden flex items-center justify-center pt-12 pb-8">
                    {isLoading && !hasLoadError && !(!isPdf && !isImage) && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 z-10">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="mt-2 text-sm text-gray-500">Loading document preview...</p>
                        </div>
                    )}
                    {renderContent()}
                </main>
                
                <footer className="flex-shrink-0 p-2 bg-white dark:bg-slate-800 border-t border-border dark:border-slate-700/50 text-xs text-on-surface-secondary flex justify-between items-center z-20 absolute bottom-0 left-0 right-0">
                    <span>Size: {(fileSize / 1024).toFixed(1)} KB</span>
                    <span>Uploaded: {new Date(uploadDate).toLocaleDateString()}</span>
                </footer>

                {canGoPrev && (
                    <button onClick={() => onNavigate('prev')} className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 bg-white/80 dark:bg-black/60 text-gray-700 dark:text-white rounded-full shadow-lg hover:scale-110 transition-all" aria-label="Previous document">
                        <ArrowLeft size={20} />
                    </button>
                )}
                 {canGoNext && (
                    <button onClick={() => onNavigate('next')} className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 bg-white/80 dark:bg-black/60 text-gray-700 dark:text-white rounded-full shadow-lg hover:scale-110 transition-all" aria-label="Next document">
                        <ArrowRight size={20} />
                    </button>
                )}
            </div>

            {isChatOpen && (
                <div className="w-80 flex-shrink-0 bg-white dark:bg-slate-900 border-l border-border dark:border-slate-700 flex flex-col animate-slide-in-up shadow-xl z-20">
                    <div className="p-4 border-b border-border dark:border-slate-700 flex justify-between items-center bg-primary/5">
                         <div className="flex items-center gap-2">
                             <img src="https://storage.googleapis.com/westerns1978-digital-assets/ACS%20TherapyHub/clara2.png" alt="Clara" className="w-6 h-6 rounded-full" />
                             <h3 className="font-bold text-sm">Clara</h3>
                         </div>
                         <button onClick={() => setIsChatOpen(false)} className="text-gray-500 hover:text-gray-700"><X size={18}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-slate-900/50">
                        {chatHistory.length === 0 && (
                            <div className="text-center mt-8">
                                <Sparkles className="w-8 h-8 text-primary/50 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">Ask me anything about this document.<br/>"What are the key dates?"</p>
                            </div>
                        )}
                        {chatHistory.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[90%] rounded-2xl p-3 text-sm ${msg.role === 'user' ? 'bg-primary text-white rounded-br-sm' : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-bl-sm shadow-sm'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isChatLoading && (
                             <div className="flex justify-start">
                                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl rounded-bl-sm p-3 shadow-sm">
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef}></div>
                    </div>
                    <div className="p-4 border-t border-border dark:border-slate-700 bg-white dark:bg-slate-900">
                        <form onSubmit={handleSendChat} className="relative">
                            <input 
                                type="text" 
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Ask about this doc..." 
                                className="w-full pr-10 pl-4 py-3 text-sm border border-gray-200 dark:border-slate-700 rounded-full focus:ring-2 focus:ring-primary focus:border-primary bg-gray-50 dark:bg-slate-800"
                            />
                            <button type="submit" disabled={!chatInput.trim() || isChatLoading} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 text-primary hover:bg-primary/10 rounded-full disabled:opacity-50 transition-colors">
                                <Send size={16} />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentViewer;
