import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import Card from '../components/ui/Card';
import { ChatMessage } from '../types';

const SendIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const UserIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const ImageIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>;
const CameraIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>;
const XCircleIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>;
const ClipboardPlusIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 14h6" /><path d="M12 11v6" /></svg>;

const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
};

const DEFAULT_SYSTEM_INSTRUCTION = `You are Clara. You are a clinical analysis assistant for therapists. When given a client's document (like a handwritten journal entry), analyze it for:
1.  **Emotional Sentiment:** Identify the dominant emotions (e.g., anxiety, hope, frustration) and any shifts in tone.
2.  **Key Themes:** Extract recurring topics or concerns (e.g., family conflict, cravings, work stress).
3.  **Potential Risk Factors:** Flag language that might indicate risk, such as mentions of isolation, hopelessness, substance use triggers, or non-compliance with treatment.
Present your analysis in a structured, easy-to-read format using markdown. Always maintain a professional, objective tone and never provide a diagnosis.`;


const ComplianceAssistant: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'model', parts: [{ text: "Hello! I'm Clara, your clinical co-pilot for clarity. You can ask me questions, or upload an image (like a client's journal entry) for analysis." }] }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [attachedImage, setAttachedImage] = useState<{ data: string; mimeType: string; name: string } | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const [systemInstruction, setSystemInstruction] = useState(DEFAULT_SYSTEM_INSTRUCTION);

    useEffect(() => {
        chatContainerRef.current?.scrollTo(0, chatContainerRef.current.scrollHeight);
    }, [messages, loading]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAttachedImage({
                    data: reader.result as string,
                    mimeType: file.type,
                    name: file.name
                });
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleSend = async () => {
        if ((!input.trim() && !attachedImage) || loading) return;

        const userParts: ChatMessage['parts'] = [];
        if (attachedImage) {
            const base64Data = attachedImage.data.split(',')[1];
            userParts.push({ inlineData: { data: base64Data, mimeType: attachedImage.mimeType } });
        }
        if (input.trim()) {
            userParts.push({ text: input });
        }

        const userMessage: ChatMessage = { role: 'user', parts: userParts };
        setMessages(prev => [...prev, userMessage]);
        
        const currentInput = input;
        const currentImage = attachedImage;
        setInput('');
        setAttachedImage(null);
        setLoading(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

            const apiParts: any[] = [];
            if(currentImage) {
                 const base64Data = currentImage.data.split(',')[1];
                 apiParts.push({ inlineData: { data: base64Data, mimeType: currentImage.mimeType } });
            }
            if(currentInput.trim()) {
                apiParts.push({text: currentInput});
            }

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: apiParts },
                config: {
                    systemInstruction: systemInstruction,
                }
            });

            const modelMessage: ChatMessage = { role: 'model', parts: [{ text: response.text }] };
            setMessages(prev => [...prev, modelMessage]);

        } catch (error) {
            console.error("Error calling Gemini API:", error);
            const errorMessage: ChatMessage = { role: 'model', parts: [{ text: 'Sorry, I encountered an error while processing your request. Please check the console for details and try again.' }] };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
            setSystemInstruction(DEFAULT_SYSTEM_INSTRUCTION); // Reset to default after each send
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    const handleUseSoapTemplate = () => {
        const soapTemplate = `Please generate a SOAP note based on the following session details:

Subjective: 
Objective: 
Assessment: 
Plan: 
`;
        setInput(soapTemplate);
        
        const soapSystemInstruction = `You are Clara. You are an AI assistant specializing in clinical documentation. Your task is to generate a professional SOAP (Subjective, Objective, Assessment, Plan) note based on the provided session details. Ensure the note is concise, clear, and uses appropriate clinical language. Structure your response with the four distinct SOAP sections.`;
        setSystemInstruction(soapSystemInstruction);
        // We could also show a temporary message to the user that the AI is now in "SOAP Note mode"
    };

    return (
        <div className="h-full flex flex-col">
            <Card noPadding className="flex-1 flex flex-col h-[calc(100vh-12rem)]">
                <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto bg-surface space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && (
                                <img src="https://storage.googleapis.com/westerns1978-digital-assets/ACS%20TherapyHub/clara.png" alt="Clara" className="w-8 h-8 rounded-full flex-shrink-0" />
                            )}
                            <div className={`max-w-lg p-3 rounded-2xl ${msg.role === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-background border border-border rounded-bl-none'}`}>
                                <div className="text-sm space-y-2">
                                    {msg.parts.map((part, i) => {
                                        if ('text' in part) {
                                            return <p key={i} className="whitespace-pre-wrap">{part.text}</p>;
                                        }
                                        if ('inlineData' in part) {
                                            return <img key={i} src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} alt="User upload" className="rounded-lg max-w-xs shadow-md" />;
                                        }
                                        return null;
                                    })}
                                </div>
                            </div>
                             {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-on-surface-secondary text-white flex items-center justify-center flex-shrink-0">
                                    <UserIcon />
                                </div>
                            )}
                        </div>
                    ))}
                    {loading && (
                         <div className="flex items-start gap-3 justify-start">
                            <img src="https://storage.googleapis.com/westerns1978-digital-assets/ACS%20TherapyHub/clara.png" alt="Clara" className="w-8 h-8 rounded-full flex-shrink-0" />
                            <div className="max-w-lg p-3 rounded-2xl bg-background border border-border rounded-bl-none">
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="h-2 w-2 bg-primary rounded-full animate-bounce"></span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                 <div className="p-2 border-t border-border flex items-center justify-start gap-2">
                    <span className="text-xs font-medium text-on-surface-secondary ml-2">Templates:</span>
                    <button onClick={handleUseSoapTemplate} className="flex items-center gap-1.5 text-xs bg-gray-100 dark:bg-slate-700 px-3 py-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-slate-600 transition">
                        <ClipboardPlusIcon className="h-4 w-4" /> Generate SOAP Note
                    </button>
                </div>
                <div className="p-4 border-t border-border">
                    {attachedImage && (
                        <div className="relative w-32 mb-2 p-1 border rounded-lg bg-surface">
                            <img src={attachedImage.data} alt="Preview" className="rounded-md h-28 w-28 object-cover" />
                             <button onClick={() => setAttachedImage(null)} className="absolute -top-2 -right-2 bg-gray-600 text-white rounded-full">
                                <XCircleIcon className="w-6 h-6" />
                             </button>
                        </div>
                    )}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Ask a question or describe the image..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            disabled={loading}
                            className="w-full pr-28 pl-4 py-3 border border-border rounded-full focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100"
                        />
                         <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button onClick={() => imageInputRef.current?.click()} disabled={loading} className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition" aria-label="Upload image">
                                <ImageIcon className="text-on-surface-secondary"/>
                            </button>
                            <button onClick={() => cameraInputRef.current?.click()} disabled={loading} className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition" aria-label="Use camera">
                                <CameraIcon className="text-on-surface-secondary"/>
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={loading || (!input.trim() && !attachedImage)}
                                className="bg-primary text-white p-2.5 rounded-full hover:bg-primary-focus transition-transform active:scale-95 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                aria-label="Send message"
                            >
                                <SendIcon />
                            </button>
                         </div>
                    </div>
                </div>
            </Card>
            <input type="file" ref={imageInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
            <input type="file" ref={cameraInputRef} onChange={handleImageChange} accept="image/*" capture="environment" className="hidden" />
        </div>
    );
};

export default ComplianceAssistant;