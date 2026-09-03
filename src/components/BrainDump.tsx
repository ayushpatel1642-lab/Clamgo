import React, { useState } from 'react';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useNavigate } from 'react-router-dom';

export default function BrainDump() {
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const handleProcess = async () => {
    if (!text.trim()) return;
    setIsProcessing(true);
    
    try {
      const token = await getToken();
      const res = await fetch('/api/braindump/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rawText: text })
      });
      
      if (res.ok) {
        // Navigate to the organized view or timeline
        // The backend should return the structured items for approval, or save them directly
        const data = await res.json();
        // Since we need approval, we could redirect to a review page, but for simplicity
        // we'll just redirect to the home page or a specific review page
        navigate('/');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 md:p-12 max-w-3xl mx-auto w-full flex flex-col min-h-screen">
      <header className="mb-8 pt-4">
        <h1 className="text-3xl font-bold text-[#191C19] mb-2">Brain Dump</h1>
        <p className="text-[#424940] text-lg">Get it all out. Don't worry about formatting, I'll organize it for you.</p>
      </header>

      <div className="flex-1 flex flex-col gap-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="I need to finish the math assignment but I don't know where to start, also remind me to call mom at 5pm and buy milk..."
          className="flex-1 w-full p-6 rounded-[32px] bg-[#FBFDF8] border border-[#E0E3DB] shadow-sm focus:border-[#3A693A] focus:ring focus:ring-[#DDE5D9] focus:ring-opacity-50 transition-all resize-none text-[#101F10] text-lg outline-none"
        />
        
        <button
          onClick={handleProcess}
          disabled={isProcessing || !text.trim()}
          className="w-full bg-[#3A693A] text-white rounded-2xl py-4 px-6 font-bold shadow-lg shadow-[#3A693A]/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Organizing your thoughts...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Organize for me
            </>
          )}
        </button>
      </div>
    </div>
  );
}
