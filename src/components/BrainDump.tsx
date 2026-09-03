import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowRight, Loader2, CheckCircle2, ListTodo, Bookmark, Bell, Edit2, Mic, Square } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useNavigate } from 'react-router-dom';

export default function BrainDump() {
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [reviewData, setReviewData] = useState<any>(null);
  const [dumpId, setDumpId] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [hasRecognition, setHasRecognition] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  const { getToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      setHasRecognition(true);

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (finalTranscript) {
          setText(prev => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

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
        const data = await res.json();
        setReviewData(data.organizedData);
        setDumpId(data.dumpId);
      } else {
        alert("Failed to process. Please try again.");
      }
    } catch (error) {
      console.error(error);
      alert("Network error.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = async () => {
    if (!dumpId || !reviewData) return;
    setIsProcessing(true);
    
    try {
      const token = await getToken();
      const res = await fetch(`/api/braindump/${dumpId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ organizedData: reviewData })
      });
      
      if (res.ok) {
        navigate('/');
      } else {
        alert("Failed to save. Please try again.");
      }
    } catch (error) {
      console.error(error);
      alert("Network error.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (reviewData) {
    return (
      <div className="p-6 md:p-12 max-w-3xl mx-auto w-full flex flex-col min-h-[calc(100vh-80px)]">
        <header className="mb-8 pt-4">
          <h1 className="text-3xl font-bold text-[#191C19] mb-2">Review Organization</h1>
          <p className="text-[#424940] text-lg">Here's what I extracted. Look good?</p>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto mb-8">
          {reviewData.tasks && reviewData.tasks.length > 0 && (
            <div className="bg-[#FBFDF8] p-6 rounded-[32px] border border-[#E0E3DB] shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest text-[#3A693A] uppercase mb-4">
                <ListTodo className="w-5 h-5" /> Tasks
              </h2>
              <div className="space-y-3">
                {reviewData.tasks.map((task: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-start border-b border-[#E0E3DB] pb-3 last:border-0 last:pb-0">
                    <div>
                      <h4 className="font-bold text-[#101F10]">{task.title}</h4>
                      {task.description && <p className="text-sm text-[#424940] mt-1">{task.description}</p>}
                    </div>
                    <span className="text-xs font-bold bg-[#EDF1E9] text-[#3A693A] px-2 py-1 rounded-full whitespace-nowrap">
                      {task.estimatedDurationMinutes}m
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reviewData.notes && reviewData.notes.length > 0 && (
            <div className="bg-[#FBFDF8] p-6 rounded-[32px] border border-[#E0E3DB] shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest text-[#3A693A] uppercase mb-4">
                <Bookmark className="w-5 h-5" /> Notes (Later)
              </h2>
              <div className="space-y-3">
                {reviewData.notes.map((note: any, idx: number) => (
                  <div key={idx} className="border-b border-[#E0E3DB] pb-3 last:border-0 last:pb-0">
                    <p className="text-[#101F10]">{note.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reviewData.reminders && reviewData.reminders.length > 0 && (
            <div className="bg-[#FBFDF8] p-6 rounded-[32px] border border-[#E0E3DB] shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest text-[#3A693A] uppercase mb-4">
                <Bell className="w-5 h-5" /> Reminders
              </h2>
              <div className="space-y-3">
                {reviewData.reminders.map((rem: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-start border-b border-[#E0E3DB] pb-3 last:border-0 last:pb-0">
                    <h4 className="font-bold text-[#101F10]">{rem.title}</h4>
                    <span className="text-xs font-bold bg-[#EDF1E9] text-[#3A693A] px-2 py-1 rounded-full whitespace-nowrap">
                      {rem.triggerTime ? new Date(rem.triggerTime).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : 'Anytime'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => setReviewData(null)}
            className="flex-1 bg-white text-[#424940] border border-[#E0E3DB] rounded-2xl py-4 px-6 font-bold shadow-sm hover:bg-[#FBFDF8] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Edit2 className="w-5 h-5" />
            Edit text
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex-[2] bg-[#3A693A] text-white rounded-2xl py-4 px-6 font-bold shadow-lg shadow-[#3A693A]/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            Save & Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-12 max-w-3xl mx-auto w-full flex flex-col min-h-screen">
      <header className="mb-8 pt-4">
        <h1 className="text-3xl font-bold text-[#191C19] mb-2">Brain Dump</h1>
        <p className="text-[#424940] text-lg">Get it all out. Don't worry about formatting, I'll organize it for you.</p>
      </header>
      
      <div className="flex-1 flex flex-col gap-4 mb-20">
        <div className="relative flex-1 flex flex-col">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="I need to finish the math assignment but I don't know where to start, also remind me to call mom at 5pm and buy milk..."
            className="flex-1 w-full p-6 pb-20 rounded-[32px] bg-[#FBFDF8] border border-[#E0E3DB] shadow-sm focus:border-[#3A693A] focus:ring focus:ring-[#DDE5D9] focus:ring-opacity-50 transition-all resize-none text-[#101F10] text-lg outline-none"
          />
          {recognitionRef.current && (
            <button
              onClick={toggleListening}
              className={`absolute bottom-6 right-6 p-4 rounded-full shadow-lg transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-[#EDF1E9] text-[#3A693A] hover:bg-[#DDE5D9]'}`}
            >
              {isListening ? <Square className="w-6 h-6 fill-current" /> : <Mic className="w-6 h-6" />}
            </button>
          )}
        </div>
        
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
