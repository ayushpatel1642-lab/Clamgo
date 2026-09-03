import { toast } from 'sonner';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthProvider';
import { BotMessageSquare, Loader2, Send, Sparkles, RefreshCw, User } from 'lucide-react';

export default function AICoach() {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: "Hi! I'm your AI Coach. How can I help you manage your focus, organize your tasks, or break through feeling overwhelmed today?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);
  
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/ai/coach/history', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) {
            setMessages([
              { role: 'assistant', content: "Hi! I'm your AI Coach. How can I help you manage your focus, organize your tasks, or break through feeling overwhelmed today?" },
              ...data
            ]);
          }
        }
      } catch (e) {
        console.error("Failed to load history", e);
      }
    };
    fetchHistory();
  }, []);

  const quickQuestions = [
    "What should I do right now?",
    "I'm feeling overwhelmed.",
    "I only have 15 minutes.",
    "I can't focus on anything.",
    "Auto Plan My Day",
    "Help me start my hardest task.",
    "Break down my next step."
  ];

  const handleClearChat = () => {
    setMessages([
      { role: 'assistant', content: "Chat cleared! How can I help you right now?" }
    ]);
    toast.success("Started a new conversation");
  };

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);

    try {
      const token = await getToken();
      
      const historyToSend = messages.slice(1).map(m => ({ role: m.role, content: m.content }));
      
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: text, history: historyToSend })
      });
      
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Something went wrong.");
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I'm having trouble connecting right now. Please check your connection and try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl xl:max-w-6xl mx-auto h-[calc(100vh-5.5rem)] md:h-[calc(100vh-1rem)] flex flex-col px-3 sm:px-6 md:px-8 py-2 md:py-4 min-h-0">
      <header className="mb-3 shrink-0 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#191C19] flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#3A693A] flex items-center justify-center text-white shadow-sm">
              <BotMessageSquare className="w-5 h-5" />
            </div>
            AI Coach
          </h1>
          <p className="text-xs sm:text-sm text-[#424940] mt-0.5">Concise, actionable guidance designed for executive function.</p>
        </div>

        <button
          type="button"
          onClick={handleClearChat}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#5A6054] hover:text-[#101F10] bg-[#EDF1E9] hover:bg-[#DDE5D9] px-3 py-1.5 rounded-full transition-colors cursor-pointer shrink-0"
          title="Start a new chat"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Chat</span>
        </button>
      </header>

      <div className="flex-1 min-h-0 bg-[#FBFDF8] rounded-2xl md:rounded-[28px] border border-[#E0E3DB] shadow-sm flex flex-col overflow-hidden">
        {/* Messages viewport */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-[#3A693A] text-white flex items-center justify-center shrink-0 mt-1 shadow-2xs">
                  <BotMessageSquare className="w-4 h-4" />
                </div>
              )}
              
              <div
                className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 text-sm sm:text-base leading-relaxed shadow-2xs whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#3A693A] text-white rounded-tr-sm'
                    : 'bg-[#EDF1E9] text-[#101F10] rounded-tl-sm border border-[#E0E3DB]/70'
                }`}
              >
                {msg.content}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-[#101F10] text-white flex items-center justify-center shrink-0 mt-1 shadow-2xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl bg-[#3A693A] text-white flex items-center justify-center shrink-0 mt-1 shadow-2xs">
                <BotMessageSquare className="w-4 h-4" />
              </div>
              <div className="bg-[#EDF1E9] rounded-2xl rounded-tl-sm p-4 text-[#424940] flex items-center gap-2.5 text-sm border border-[#E0E3DB]/70">
                <Loader2 className="w-4 h-4 animate-spin text-[#3A693A]" />
                Thinking through your next step...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input and quick suggestions bar */}
        <div className="p-3 sm:p-4 bg-[#F4F5F2] border-t border-[#E0E3DB] shrink-0">
          {/* Quick Questions single-row scrollable carousel */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2.5 scrollbar-none flex-nowrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5A6054] flex items-center gap-1 shrink-0">
              <Sparkles className="w-3 h-3 text-[#3A693A]" /> Quick:
            </span>
            {quickQuestions.map((q) => (
              <button 
                key={q}
                type="button"
                onClick={() => handleSend(q)}
                className="bg-[#FBFDF8] border border-[#E0E3DB] text-[#424940] text-xs font-semibold px-3 py-1.5 rounded-full hover:border-[#3A693A] hover:text-[#3A693A] hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer active:scale-95"
              >
                {q}
              </button>
            ))}
          </div>
          
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
            className="flex items-center gap-2.5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for advice, focus hacks, or what to do next..."
              className="flex-1 bg-[#FBFDF8] p-3 px-5 rounded-full border border-[#E0E3DB] focus:border-[#3A693A] focus:ring-2 focus:ring-[#DDE5D9] outline-none transition-all text-[#101F10] text-sm sm:text-base placeholder-[#8C9388]"
            />
            <button 
              type="submit"
              disabled={!input.trim() || loading}
              className="p-3 bg-[#3A693A] text-white rounded-full hover:bg-[#3A693A]/90 disabled:opacity-40 transition-all shadow-sm cursor-pointer active:scale-95 shrink-0"
              title="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
