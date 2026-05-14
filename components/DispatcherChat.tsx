/**
 * ACS TherapyHub — Dispatcher Scheduling Chat
 * Drop-in chat interface for The Dispatcher AI scheduling agent
 * DROP-IN: Place in components/DispatcherChat.tsx
 * USAGE: Add to client profile page alongside or replacing manual scheduling
 */

import React, { useState, useRef, useEffect } from "react";
import { createDispatcher, DispatcherMessage, SchedulingResult } from "../services/schedulingService";

interface DispatcherChatProps {
  clientId: string;
  clientName: string;
  supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>;
  onAppointmentChanged?: () => void; // Callback to refresh calendar/appointments
  className?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  result?: SchedulingResult;
  timestamp: Date;
  isTyping?: boolean;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DispatcherChat({
  clientId,
  clientName,
  supabase,
  onAppointmentChanged,
  className = "",
}: DispatcherChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `I can help you reschedule, cancel, or confirm appointments for ${clientName}. What do you need?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [dispatcher] = useState(() => createDispatcher(supabase));
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isProcessing) return;

    setInput("");

    // Add user message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    // Add typing indicator
    const typingMsg: ChatMessage = {
      id: "typing",
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isTyping: true,
    };

    setMessages(prev => [...prev, userMsg, typingMsg]);
    setIsProcessing(true);

    try {
      const result = await dispatcher.handleRequest({
        clientId,
        clientName,
        message: text,
        conversationHistory: dispatcher.getConversationHistory() as DispatcherMessage[],
      });

      const assistantMsg: ChatMessage = {
        id: Date.now().toString() + "_r",
        role: "assistant",
        content: result.message,
        result,
        timestamp: new Date(),
      };

      setMessages(prev => [
        ...prev.filter(m => m.id !== "typing"),
        assistantMsg,
      ]);

      // If an appointment was changed, notify parent
      if (result.action === "rescheduled" || result.action === "cancelled") {
        onAppointmentChanged?.();
      }
    } catch (err) {
      setMessages(prev => [
        ...prev.filter(m => m.id !== "typing"),
        {
          id: Date.now().toString() + "_err",
          role: "system",
          content: "Connection error — please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Quick action chips
  const quickActions = [
    "What's the next appointment?",
    "Reschedule to next week",
    "Cancel today's session",
    "Show available slots",
  ];

  return (
    <div className={`flex flex-col bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm ${className}`}
         style={{ minHeight: 420, maxHeight: 560 }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-stone-50 border-b border-stone-200">
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
            <span className="text-xs font-black text-primary">D</span>
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
        </div>
        <div>
          <div className="text-slate-900 text-sm font-bold leading-none">Scheduling Assistant</div>
          <div className="text-slate-500 text-xs mt-0.5">For {clientName}</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-xs text-slate-500 font-bold">Live</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-stone-50/40">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick Actions */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2 bg-stone-50/40">
          {quickActions.map(action => (
            <button
              key={action}
              onClick={() => { setInput(action); inputRef.current?.focus(); }}
              className="text-xs px-3 py-1.5 bg-white hover:bg-amber-50 border border-stone-200 hover:border-amber-200 text-slate-600 hover:text-slate-900 rounded-full transition-all"
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-3 border-t border-stone-200 bg-white">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reschedule, cancel, or check availability..."
            disabled={isProcessing}
            className="flex-1 bg-stone-50 border border-stone-200 focus:border-primary rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="flex-shrink-0 w-9 h-9 bg-primary hover:bg-primary-focus disabled:bg-stone-200 disabled:text-slate-400 text-white rounded-xl flex items-center justify-center transition-all"
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.isTyping) {
    return (
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex-shrink-0 flex items-center justify-center mt-0.5">
          <span className="text-xs text-primary font-black">D</span>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          <div className="flex gap-1 items-center h-4">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-xs bg-primary rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
          <p className="text-white text-sm leading-relaxed">{message.content}</p>
          <p className="text-white/70 text-xs mt-1 text-right">
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
    );
  }

  if (message.role === "system") {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-slate-500 italic">{message.content}</span>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex items-start gap-2">
      <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex-shrink-0 flex items-center justify-center mt-0.5">
        <span className="text-xs text-primary font-black">D</span>
      </div>
      <div className="flex-1 max-w-sm">
        <div className={`
          rounded-2xl rounded-tl-sm px-4 py-3 border shadow-sm
          ${message.result?.action === "denied"
            ? "bg-red-50 border-red-200"
            : message.result?.complianceWarning
            ? "bg-amber-50 border-amber-200"
            : "bg-white border-stone-200"}
        `}>
          <p className="text-slate-700 text-sm leading-relaxed">{message.content}</p>

          {/* Compliance warning */}
          {message.result?.complianceWarning && (
            <div className="mt-2 pt-2 border-t border-amber-200 flex items-start gap-1.5">
              <span className="text-amber-600 flex-shrink-0">⚠</span>
              <span className="text-amber-700 text-xs">{message.result.complianceWarning}</span>
            </div>
          )}

          {/* Action badge */}
          {message.result?.action && message.result.action !== "clarification_needed" && (
            <div className="mt-2 flex items-center gap-2">
              <ActionBadge action={message.result.action} />
              {message.result.requiresTherapistApproval && (
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 font-bold">
                  Pending approval
                </span>
              )}
            </div>
          )}
        </div>
        <p className="text-slate-400 text-xs mt-1 ml-1">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

function ActionBadge({ action }: { action: SchedulingResult["action"] }) {
  const config = {
    rescheduled:          { label: "✓ Rescheduled",   className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    cancelled:            { label: "✗ Cancelled",      className: "bg-stone-100 text-slate-600 border-stone-200" },
    confirmed:            { label: "✓ Confirmed",      className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    pending_approval:     { label: "⏳ Pending",        className: "bg-amber-50 text-amber-700 border-amber-200" },
    denied:               { label: "✗ Denied",         className: "bg-red-50 text-red-700 border-red-200" },
    clarification_needed: { label: "? Clarifying",     className: "bg-stone-100 text-slate-600 border-stone-200" },
  };
  const c = config[action] || config.clarification_needed;
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}
