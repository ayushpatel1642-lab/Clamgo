import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { BotMessageSquare, Loader2, Send } from 'lucide-react';

export default function AICoach() {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: "Hi! I'm your AI Coach. How can I help you manage your focus or tasks today?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const quickQuestions = [
    "What should I do now?",
    "I'm overwhelmed.",
    "I only have 15 minutes.",
    "I can't focus.",
    "Plan my evening.",
    "Help me start."
  ];

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
    } catch (e) {
      console.error(e); alert(e.message || "Something went wrong.");
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I'm having trouble connecting right now." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-12 max-w-2xl mx-auto w-full h-[calc(100vh-100px)] md:h-screen flex flex-col pt-4">
      <header className="mb-6 shrink-0">
        <h1 className="text-3xl font-bold text-[#191C19] mb-2 flex items-center gap-3">
          <BotMessageSquare className="w-8 h-8 text-[#3A693A]" />
          AI Coach
        </h1>
        <p className="text-[#424940]">Concise, actionable guidance for your executive function.</p>
      </header>

      <div className="flex-1 bg-[#FBFDF8] rounded-[32px] border border-[#E0E3DB] shadow-sm flex flex-col overflow-hidden mb-6 md:mb-0">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-[#3A693A] text-white rounded-tr-sm' : 'bg-[#EDF1E9] text-[#101F10] rounded-tl-sm'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#EDF1E9] rounded-2xl rounded-tl-sm p-4 text-[#424940] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Thinking...
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-[#F4F5F2] border-t border-[#E0E3DB]">
          <div className="flex flex-wrap gap-2 mb-4">
            {quickQuestions.map((q) => (
              <button 
                key={q}
                onClick={() => handleSend(q)}
                className="bg-[#FBFDF8] border border-[#E0E3DB] text-[#424940] text-xs font-bold px-3 py-1.5 rounded-full hover:border-[#3A693A] hover:text-[#3A693A] transition-colors whitespace-nowrap"
              >
                {q}
              </button>
            ))}
          </div>
          
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              className="flex-1 bg-[#FBFDF8] p-3 px-5 rounded-full border border-[#E0E3DB] focus:border-[#3A693A] focus:ring focus:ring-[#DDE5D9] outline-none transition-all text-[#101F10]"
            />
            <button 
              type="submit"
              disabled={!input.trim() || loading}
              className="p-3 bg-[#3A693A] text-white rounded-full hover:bg-[#3A693A]/90 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
