import React, { useState, useEffect, useRef } from 'react';
import { getClients, getClientCommunications, sendClientMessage, getSupportMessages, sendSupportMessage } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Message, Client } from '../types';
import { Search, Send, Paperclip, Video, Phone, MoreVertical, CheckCheck, Smile, Loader2, LifeBuoy } from 'lucide-react';

const fmtTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
};

// The staff -> support/admin channel is a single fixed conversation (recipient: ACS
// admin / Dan). It persists in client_communications as rows with a NULL client_id and
// type='support' (see services/api.ts: sendSupportMessage) — additive reuse, no new table.
const SUPPORT_ID = '__support__';
const SUPPORT_NAME = 'ACS Support';

const CommunicationCenter: React.FC = () => {
    const { user } = useAuth();
    const sentBy = user?.name || user?.role || 'staff';

    const [activeTab, setActiveTab] = useState<'clients' | 'support'>('clients');
    const [messageList, setMessageList] = useState<Message[]>([]);
    const [conversation, setConversation] = useState<Message[]>([]);
    // For the Clients tab `activeId` is a REAL client uuid; for Support it's the fixed
    // SUPPORT_ID. `activeName` is always the display label.
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeName, setActiveName] = useState<string>('');
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [listError, setListError] = useState<string | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const isSupport = activeId === SUPPORT_ID;

    // Sidebar list. Clients tab is sourced from REAL clients so each conversation maps to
    // a real client_id. Support tab is a single fixed conversation to the ACS admin.
    useEffect(() => {
        let cancelled = false;
        const fetchList = async () => {
            setListError(null);
            if (activeTab === 'support') {
                const item: Message = {
                    id: SUPPORT_ID,
                    sender: 'system',
                    clientName: SUPPORT_NAME,
                    avatarUrl: '',
                    text: 'Questions & feedback → ACS admin (Dan)',
                    timestamp: '',
                    read: true,
                    status: 'read',
                };
                setMessageList([item]);
                setActiveId(SUPPORT_ID);
                setActiveName(SUPPORT_NAME);
                return;
            }
            // Clients tab — wrapped so a slow/failed fetch never leaves a permanent
            // no-conversation (and therefore no-composer) state.
            try {
                const clients = await getClients();
                if (cancelled) return;
                const items: Message[] = clients.map((c: Client) => ({
                    id: c.id,
                    sender: 'client',
                    clientName: c.name,
                    avatarUrl: c.avatarUrl || '',
                    text: (c.program as string) || 'Client',
                    timestamp: '',
                    read: true,
                    status: 'read',
                }));
                setMessageList(items);
                if (items.length > 0) { setActiveId(items[0].id); setActiveName(items[0].clientName); }
                else { setActiveId(null); setActiveName(''); }
            } catch (err) {
                if (cancelled) return;
                console.error('[CommunicationCenter] failed to load client list:', err);
                setMessageList([]);
                setActiveId(null);
                setActiveName('');
                setListError('Could not load client conversations. Switch to Support to message the ACS admin.');
            }
        };
        fetchList();
        return () => { cancelled = true; };
    }, [activeTab]);

    // Conversation history. Clients tab reads REAL rows from client_communications;
    // Support tab reads REAL staff->support rows (client_id NULL, type='support').
    useEffect(() => {
        let cancelled = false;
        const fetchConv = async () => {
            if (!activeId) { setConversation([]); return; }
            try {
                const comms = activeId === SUPPORT_ID
                    ? await getSupportMessages()
                    : await getClientCommunications(activeId);
                if (cancelled) return;
                setConversation(comms.map(cc => ({
                    id: cc.id,
                    sender: 'counselor', // table holds staff-sent (outbound) messages
                    clientName: cc.sentBy,
                    avatarUrl: '',
                    text: cc.message,
                    timestamp: fmtTime(cc.sentAt),
                    read: true,
                    status: 'read',
                })));
            } catch (err) {
                if (cancelled) return;
                console.error('[CommunicationCenter] failed to load conversation:', err);
                setConversation([]);
            }
        };
        fetchConv();
        return () => { cancelled = true; };
    }, [activeId]);

    useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [conversation]);

    const handleSelect = (msg: Message) => {
        // Clients tab: msg.id is the real client uuid. Support tab: the fixed SUPPORT_ID.
        setActiveId(msg.id);
        setActiveName(msg.clientName);
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const text = inputText.trim();
        if (!text || !activeId) return;

        // Both paths persist REAL rows to client_communications (Support uses a NULL
        // client_id + type='support'; Clients uses the client's uuid).
        setSending(true);
        try {
            const saved = activeId === SUPPORT_ID
                ? await sendSupportMessage(text, sentBy)
                : await sendClientMessage(activeId, text, sentBy);
            setConversation(prev => [...prev, {
                id: saved.id,
                sender: 'counselor',
                text: saved.message,
                timestamp: fmtTime(saved.sentAt),
                read: true,
                status: 'sent',
                clientName: 'Me',
                avatarUrl: '',
            }]);
            setInputText('');
        } catch (err) {
            alert('Could not send message: ' + (err as Error).message);
        } finally {
            setSending(false);
        }
    };

    const quickReplies = ["Please confirm your appointment.", "Great job on your progress!", "Please sign the pending document.", "See you next week."];

    return (
        <div className="flex h-[calc(100vh-9rem)] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-xl border border-border dark:border-slate-700 overflow-hidden">
            {/* Sidebar List */}
            <div className="w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-950/50">
                <div className="p-4">
                    <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl mb-4">
                        <button onClick={() => setActiveTab('clients')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${activeTab === 'clients' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}>Clients</button>
                        <button onClick={() => setActiveTab('support')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${activeTab === 'support' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}>Support</button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all shadow-sm" placeholder="Search..." />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
                    {activeTab === 'support' && (
                        <div className="px-3 pb-2 text-[11px] text-slate-400 leading-relaxed">
                            Messages here go straight to the ACS admin (Dan). Use it for app problems, questions, or feedback.
                        </div>
                    )}
                    {messageList.map(msg => (
                        <div
                            key={msg.id}
                            onClick={() => handleSelect(msg)}
                            className={`p-3 mb-1 rounded-xl cursor-pointer transition-all duration-200 ${activeId === msg.id ? 'bg-white dark:bg-slate-800 shadow-md border border-slate-100 dark:border-slate-700 scale-[1.02]' : 'hover:bg-white/50 dark:hover:bg-slate-800/50 border border-transparent'}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`font-bold text-sm flex items-center gap-1.5 ${!msg.read ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {msg.id === SUPPORT_ID && <LifeBuoy size={14} className="text-primary" />}
                                    {msg.clientName}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">{msg.timestamp}</span>
                            </div>
                            <p className={`text-xs truncate leading-relaxed ${!msg.read ? 'font-semibold text-slate-800 dark:text-slate-200' : 'text-slate-500'}`}>{msg.text}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col bg-white/50 dark:bg-slate-900/50 relative">
                {/* Chat Header — shown once a conversation is active */}
                {activeId && (
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10 sticky top-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-lg font-bold text-primary shadow-inner">
                                {isSupport ? <LifeBuoy size={18} /> : activeName[0]}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white leading-tight">{activeName}</h3>
                                {isSupport ? (
                                    <p className="text-[10px] font-bold text-primary">Direct line to ACS admin (Dan)</p>
                                ) : (
                                    <p className="text-[10px] font-bold text-green-600 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> ONLINE</p>
                                )}
                            </div>
                        </div>
                        {!isSupport && (
                            <div className="flex gap-1">
                                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors"><Phone size={18}/></button>
                                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors"><Video size={18}/></button>
                                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors"><MoreVertical size={18}/></button>
                            </div>
                        )}
                    </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {!activeId ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 px-6 text-center">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <Send size={24} className="opacity-50"/>
                            </div>
                            <p className="font-medium">Select a client conversation, or open the <span className="text-primary font-bold">Support</span> tab to message the ACS admin.</p>
                            {listError && <p className="text-xs text-red-500 mt-3 max-w-xs">{listError}</p>}
                        </div>
                    ) : conversation.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm text-center px-6">
                            {isSupport ? 'No messages yet. Send a question or feedback to the ACS admin below.' : 'No messages yet. Start the conversation below.'}
                        </div>
                    ) : (
                        conversation.map(msg => {
                            const isMe = msg.sender === 'counselor';
                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] group`}>
                                        <div className={`px-5 py-3 text-sm shadow-md transition-all ${isMe
                                            ? 'bg-gradient-to-br from-primary to-red-700 text-white rounded-2xl rounded-tr-sm'
                                            : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-sm text-slate-700 dark:text-slate-200'
                                        }`}>
                                            {msg.text}
                                        </div>
                                        <div className={`text-[10px] mt-1.5 text-slate-400 flex items-center gap-1 font-medium ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            {msg.timestamp}
                                            {isMe && <CheckCheck size={12} className={msg.read ? "text-blue-500" : ""} />}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input Area — ALWAYS rendered so there is never a dead empty state with no
                    way to type. Disabled (with a hint) until a conversation is selected. */}
                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                    {/* Quick Replies — client conversations only */}
                    {activeTab === 'clients' && activeId && (
                        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
                            {quickReplies.map(reply => (
                                <button key={reply} onClick={() => setInputText(reply)} className="whitespace-nowrap px-3 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition shadow-sm">
                                    {reply}
                                </button>
                            ))}
                        </div>
                    )}

                    <form onSubmit={handleSend} className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all shadow-inner">
                        <button type="button" disabled={!activeId} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition disabled:opacity-40"><Paperclip size={20}/></button>
                        <input
                            className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-2 text-slate-800 dark:text-white placeholder-slate-400 disabled:cursor-not-allowed"
                            placeholder={!activeId ? 'Select or start a conversation…' : isSupport ? 'Message ACS support…' : 'Type your message...'}
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            disabled={!activeId}
                        />
                        <button type="button" disabled={!activeId} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition disabled:opacity-40"><Smile size={20}/></button>
                        <button type="submit" disabled={!activeId || !inputText.trim() || sending} className="p-2.5 bg-primary text-white rounded-xl hover:bg-primary-focus disabled:opacity-50 disabled:hover:bg-primary transition-all shadow-md active:scale-95">
                            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className={inputText.trim() ? "translate-x-0.5" : ""} />}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CommunicationCenter;
