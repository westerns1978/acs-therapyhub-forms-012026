import React, { useState, useEffect, useRef } from 'react';
import { getMessages, getConversation, getStaffMessages } from '../services/api';
import { Message } from '../types';
import { Search, Send, Paperclip, Video, Phone, MoreVertical, CheckCheck, Smile } from 'lucide-react';

const CommunicationCenter: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'clients' | 'team'>('clients');
    const [messageList, setMessageList] = useState<Message[]>([]);
    const [conversation, setConversation] = useState<Message[]>([]);
    const [activeClientId, setActiveClientId] = useState<string | null>(null);
    const [inputText, setInputText] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchList = async () => {
            const data = activeTab === 'clients' ? await getMessages() : await getStaffMessages();
            setMessageList(data);
            if (data.length > 0) setActiveClientId(data[0].clientName);
        };
        fetchList();
    }, [activeTab]);

    useEffect(() => {
        if (activeClientId) {
            const fetchConv = async () => {
                const data = await getConversation(activeClientId);
                setConversation(data);
            };
            fetchConv();
        }
    }, [activeClientId]);

    useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [conversation]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        const newMsg: Message = {
            id: Date.now().toString(),
            sender: 'counselor',
            text: inputText,
            timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            read: true,
            status: 'sent',
            clientName: 'Me',
            avatarUrl: ''
        };
        setConversation(prev => [...prev, newMsg]);
        setInputText('');
    };

    const quickReplies = ["Please confirm your appointment.", "Great job on your progress!", "Please sign the pending document.", "See you next week."];

    return (
        <div className="flex h-[calc(100vh-9rem)] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 dark:border-slate-700 overflow-hidden">
            {/* Sidebar List */}
            <div className="w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-950/50">
                <div className="p-4">
                    <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl mb-4">
                        <button onClick={() => setActiveTab('clients')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${activeTab === 'clients' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}>Clients</button>
                        <button onClick={() => setActiveTab('team')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${activeTab === 'team' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}>Team</button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all shadow-sm" placeholder="Search..." />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
                    {messageList.map(msg => (
                        <div 
                            key={msg.id} 
                            onClick={() => setActiveClientId(msg.clientName)}
                            className={`p-3 mb-1 rounded-xl cursor-pointer transition-all duration-200 ${activeClientId === msg.clientName ? 'bg-white dark:bg-slate-800 shadow-md border border-slate-100 dark:border-slate-700 scale-[1.02]' : 'hover:bg-white/50 dark:hover:bg-slate-800/50 border border-transparent'}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`font-bold text-sm ${!msg.read ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{msg.clientName}</span>
                                <span className="text-[10px] text-slate-400 font-medium">{msg.timestamp}</span>
                            </div>
                            <p className={`text-xs truncate leading-relaxed ${!msg.read ? 'font-semibold text-slate-800 dark:text-slate-200' : 'text-slate-500'}`}>{msg.text}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col bg-white/50 dark:bg-slate-900/50 relative">
                {activeClientId ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10 sticky top-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-lg font-bold text-primary shadow-inner">
                                    {activeClientId[0]}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white leading-tight">{activeClientId}</h3>
                                    <p className="text-[10px] font-bold text-green-600 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> ONLINE</p>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors"><Phone size={18}/></button>
                                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors"><Video size={18}/></button>
                                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors"><MoreVertical size={18}/></button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {conversation.map(msg => {
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
                            })}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                            {/* Quick Replies */}
                            <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
                                {quickReplies.map(reply => (
                                    <button key={reply} onClick={() => setInputText(reply)} className="whitespace-nowrap px-3 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition shadow-sm">
                                        {reply}
                                    </button>
                                ))}
                            </div>
                            
                            <form onSubmit={handleSend} className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all shadow-inner">
                                <button type="button" className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"><Paperclip size={20}/></button>
                                <input 
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-2 text-slate-800 dark:text-white placeholder-slate-400"
                                    placeholder="Type your message..."
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                />
                                <button type="button" className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"><Smile size={20}/></button>
                                <button type="submit" disabled={!inputText.trim()} className="p-2.5 bg-primary text-white rounded-xl hover:bg-primary-focus disabled:opacity-50 disabled:hover:bg-primary transition-all shadow-md active:scale-95">
                                    <Send size={18} className={inputText.trim() ? "translate-x-0.5" : ""} />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <Send size={24} className="opacity-50"/>
                        </div>
                        <p className="font-medium">Select a conversation to start chatting</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommunicationCenter;