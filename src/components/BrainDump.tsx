import { toast } from 'sonner';
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowRight, Loader2, CheckCircle2, ListTodo, Bookmark, Bell, Edit2, Mic, Square, Plus, Trash2, Clock, RefreshCw, Calendar } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useNavigate } from 'react-router-dom';

export default function BrainDump() {
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [reviewData, setReviewData] = useState<any>(null);
  const [dumpId, setDumpId] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [hasRecognition, setHasRecognition] = useState(false);
  const [liveClock, setLiveClock] = useState<Date>(new Date());
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const timer = setInterval(() => setLiveClock(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);
  
  const { getToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('clamgo_braindump_text');
    if (saved) setText(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('clamgo_braindump_text', text);
  }, [text]);

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
        if (event.error === 'not-allowed') {
          toast.error("Microphone access denied. Please allow microphone permissions in your browser. Note: You may need to open the app in a new tab.");
        } else {
          toast.error(`Speech recognition error: ${event.error}`);
        }
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
      // Immediate submission
      if (text.trim().length > 5) {
         handleProcess();
      }
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };


  const formatTriggerTime = (timeStr?: string | Date) => {
    if (!timeStr) return 'Anytime';
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return String(timeStr);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const toLocalDatetimeInputValue = (timeStr?: string | Date) => {
    const d = timeStr ? new Date(timeStr) : new Date(Date.now() + 60 * 60 * 1000);
    const valid = isNaN(d.getTime()) ? new Date(Date.now() + 60 * 60 * 1000) : d;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${valid.getFullYear()}-${pad(valid.getMonth() + 1)}-${pad(valid.getDate())}T${pad(valid.getHours())}:${pad(valid.getMinutes())}`;
  };

  const handleReminderTimeChange = (idx: number, localDatetimeVal: string) => {
    if (!reviewData) return;
    const dateObj = new Date(localDatetimeVal);
    const isoString = isNaN(dateObj.getTime()) ? new Date().toISOString() : dateObj.toISOString();
    
    setReviewData((prev: any) => {
      const updated = [...(prev.reminders || [])];
      updated[idx] = { ...updated[idx], triggerTime: isoString };
      return { ...prev, reminders: updated };
    });
  };

  const handleReminderTitleChange = (idx: number, title: string) => {
    if (!reviewData) return;
    setReviewData((prev: any) => {
      const updated = [...(prev.reminders || [])];
      updated[idx] = { ...updated[idx], title };
      return { ...prev, reminders: updated };
    });
  };

  const handleApplyPresetTime = (idx: number, preset: '30m' | '1h' | '3h' | 'tonight' | 'tomorrow_9am' | 'tomorrow_5pm') => {
    if (!reviewData) return;
    const now = new Date();
    let target = new Date();

    if (preset === '30m') {
      target = new Date(now.getTime() + 30 * 60 * 1000);
    } else if (preset === '1h') {
      target = new Date(now.getTime() + 60 * 60 * 1000);
    } else if (preset === '3h') {
      target = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    } else if (preset === 'tonight') {
      target = new Date(now);
      target.setHours(20, 0, 0, 0);
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
    } else if (preset === 'tomorrow_9am') {
      target = new Date(now);
      target.setDate(target.getDate() + 1);
      target.setHours(9, 0, 0, 0);
    } else if (preset === 'tomorrow_5pm') {
      target = new Date(now);
      target.setDate(target.getDate() + 1);
      target.setHours(17, 0, 0, 0);
    }

    setReviewData((prev: any) => {
      const updated = [...(prev.reminders || [])];
      updated[idx] = { ...updated[idx], triggerTime: target.toISOString() };
      return { ...prev, reminders: updated };
    });
  };

  const handleAutoFetchCurrentTime = (idx: number, offsetMinutes = 0) => {
    if (!reviewData) return;
    const now = new Date();
    const target = new Date(now.getTime() + offsetMinutes * 60 * 1000);
    setReviewData((prev: any) => {
      const updated = [...(prev.reminders || [])];
      updated[idx] = { ...updated[idx], triggerTime: target.toISOString() };
      return { ...prev, reminders: updated };
    });
    toast.success(offsetMinutes === 0 ? "Synced with current time!" : `Time set to +${offsetMinutes}m from now`);
  };

  const handleAddReminder = () => {
    if (!reviewData) return;
    const defaultTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    setReviewData((prev: any) => ({
      ...prev,
      reminders: [...(prev.reminders || []), { title: 'New reminder', triggerTime: defaultTime }]
    }));
  };

  const handleRemoveReminder = (idx: number) => {
    if (!reviewData) return;
    setReviewData((prev: any) => ({
      ...prev,
      reminders: (prev.reminders || []).filter((_: any, i: number) => i !== idx)
    }));
  };

  const handleRemoveTask = (idx: number) => {
    if (!reviewData) return;
    setReviewData((prev: any) => ({
      ...prev,
      tasks: (prev.tasks || []).filter((_: any, i: number) => i !== idx)
    }));
  };

  const handleRemoveNote = (idx: number) => {
    if (!reviewData) return;
    setReviewData((prev: any) => ({
      ...prev,
      notes: (prev.notes || []).filter((_: any, i: number) => i !== idx)
    }));
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
        body: JSON.stringify({
          rawText: text,
          clientNow: new Date().toISOString(),
          clientLocalFormatted: new Date().toLocaleString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setReviewData(data.organizedData);
        setDumpId(data.dumpId);
      } else {
        toast.error("Failed to process. Please try again.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Network error.");
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
        localStorage.removeItem('clamgo_braindump_text');
        navigate('/');
      } else {

        toast.error("Failed to save. Please try again.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Network error.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (reviewData) {
    return (
      <div className="p-6 md:p-12 max-w-3xl mx-auto w-full flex flex-col min-h-[calc(100vh-80px)]">
        <header className="mb-8 pt-4">
          <h1 className="text-3xl font-bold text-[#191C19] mb-2">Review Organization</h1>
          <p className="text-[#424940] text-lg">Here's what I extracted. Customize any item or adjust dates and times below.</p>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto mb-8">
          {reviewData.tasks && reviewData.tasks.length > 0 && (
            <div className="bg-[#FBFDF8] p-6 rounded-[32px] border border-[#E0E3DB] shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest text-[#3A693A] uppercase mb-4">
                <ListTodo className="w-5 h-5" /> Tasks ({reviewData.tasks.length})
              </h2>
              <div className="space-y-3">
                {reviewData.tasks.map((task: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-start border-b border-[#E0E3DB] pb-3 last:border-0 last:pb-0 gap-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-[#101F10]">{task.title}</h4>
                      {task.description && <p className="text-sm text-[#424940] mt-1">{task.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold bg-[#EDF1E9] text-[#3A693A] px-2.5 py-1 rounded-full whitespace-nowrap">
                        {task.estimatedDurationMinutes || 15}m
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTask(idx)}
                        className="p-1 text-[#8C9388] hover:text-[#BA1A1A] rounded-lg transition-colors"
                        title="Remove task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
                  <div key={idx} className="flex justify-between items-start border-b border-[#E0E3DB] pb-3 last:border-0 last:pb-0 gap-3">
                    <p className="text-[#101F10] flex-1">{note.content}</p>
                    <button
                      type="button"
                      onClick={() => handleRemoveNote(idx)}
                      className="p-1 text-[#8C9388] hover:text-[#BA1A1A] rounded-lg transition-colors"
                      title="Remove note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reminders section - Fully customizable */}
          <div className="bg-[#FBFDF8] p-6 rounded-[32px] border border-[#E0E3DB] shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest text-[#3A693A] uppercase">
                <Bell className="w-5 h-5" /> Reminders {reviewData.reminders?.length > 0 && `(${reviewData.reminders.length})`}
              </h2>
              <button
                type="button"
                onClick={handleAddReminder}
                className="flex items-center gap-1.5 text-xs font-bold text-[#3A693A] bg-[#EDF1E9] hover:bg-[#DDE5D9] px-3 py-1.5 rounded-full transition-colors active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Reminder
              </button>
            </div>

            <p className="text-xs text-[#5A6054] mb-4 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#3A693A]" />
              Dates and times are automatically parsed from your device clock ({liveClock.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}). You can customize or auto-sync each reminder below.
            </p>

            {(!reviewData.reminders || reviewData.reminders.length === 0) ? (
              <p className="text-sm text-[#72796F] italic">No reminders yet. Click "Add Reminder" above to set one.</p>
            ) : (
              <div className="space-y-4">
                {reviewData.reminders.map((rem: any, idx: number) => (
                  <div key={idx} className="bg-white border border-[#E0E3DB] rounded-2xl p-4 shadow-2xs space-y-3 transition-all hover:border-[#C4C8BA]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <label className="text-[11px] font-semibold text-[#5A6054] block mb-1">Reminder Title</label>
                        <input
                          type="text"
                          value={rem.title || ''}
                          onChange={(e) => handleReminderTitleChange(idx, e.target.value)}
                          placeholder="What would you like to be reminded of?"
                          className="w-full font-bold text-[#101F10] bg-transparent border-b border-[#E0E3DB] focus:border-[#3A693A] focus:outline-none transition-colors pb-1 text-base placeholder-[#A8AEA3]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveReminder(idx)}
                        className="p-1.5 text-[#8C9388] hover:text-[#BA1A1A] hover:bg-[#FFEDEA] rounded-lg transition-colors mt-1 cursor-pointer"
                        title="Delete reminder"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Date & Time Picker + Formatted Badge */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-bold text-[#424940] flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#3A693A]" />
                          Notify at:
                        </span>
                        <span className="text-xs font-bold bg-[#EDF1E9] text-[#3A693A] px-2.5 py-1 rounded-full">
                          {formatTriggerTime(rem.triggerTime)}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 flex-wrap">
                        <input
                          type="datetime-local"
                          value={toLocalDatetimeInputValue(rem.triggerTime)}
                          onChange={(e) => handleReminderTimeChange(idx, e.target.value)}
                          className="bg-[#FBFDF8] border border-[#E0E3DB] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#101F10] focus:border-[#3A693A] focus:ring-1 focus:ring-[#3A693A] focus:outline-none cursor-pointer"
                        />

                        {/* Auto-fetch Current Time button */}
                        <button
                          type="button"
                          onClick={() => handleAutoFetchCurrentTime(idx, 0)}
                          className="text-[11px] font-semibold text-[#3A693A] bg-[#EDF1E9] hover:bg-[#DDE5D9] px-2.5 py-1.5 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                          title="Auto-fetch current device time"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Auto-fetch Current Time
                        </button>

                        {/* Quick Presets */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-medium text-[#72796F]">Presets:</span>
                          <button
                            type="button"
                            onClick={() => handleApplyPresetTime(idx, '30m')}
                            className="text-[11px] font-bold bg-[#F4F5F2] hover:bg-[#DDE5D9] text-[#424940] hover:text-[#101F10] px-2 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            +30m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPresetTime(idx, '1h')}
                            className="text-[11px] font-bold bg-[#F4F5F2] hover:bg-[#DDE5D9] text-[#424940] hover:text-[#101F10] px-2 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            +1h
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPresetTime(idx, 'tonight')}
                            className="text-[11px] font-bold bg-[#F4F5F2] hover:bg-[#DDE5D9] text-[#424940] hover:text-[#101F10] px-2 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            Tonight (8pm)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPresetTime(idx, 'tomorrow_9am')}
                            className="text-[11px] font-bold bg-[#F4F5F2] hover:bg-[#DDE5D9] text-[#424940] hover:text-[#101F10] px-2 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            Tomorrow 9am
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPresetTime(idx, 'tomorrow_5pm')}
                            className="text-[11px] font-bold bg-[#F4F5F2] hover:bg-[#DDE5D9] text-[#424940] hover:text-[#101F10] px-2 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            Tomorrow 5pm
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => setReviewData(null)}
            className="flex-1 bg-white text-[#424940] border border-[#E0E3DB] rounded-2xl py-4 px-6 font-bold shadow-sm hover:bg-[#FBFDF8] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Edit2 className="w-5 h-5" />
            Edit text
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex-[2] bg-[#3A693A] text-white rounded-2xl py-4 px-6 font-bold shadow-lg shadow-[#3A693A]/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
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
      <header className="mb-6 pt-4">
        <h1 className="text-3xl font-bold text-[#191C19] mb-2">Brain Dump</h1>
        <p className="text-[#424940] text-lg">Get it all out. Don't worry about formatting, I'll organize it for you.</p>
      </header>

      {/* Auto-detected Clock & Timezone banner */}
      <div className="bg-[#EDF1E9] border border-[#DDE5D9] rounded-2xl p-3 mb-3 flex items-center justify-between text-xs text-[#2A4F2A]">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#3A693A] shrink-0" />
          <span>
            <strong>Auto-detected Device Clock:</strong>{' '}
            {liveClock.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}, {liveClock.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} ({Intl.DateTimeFormat().resolvedOptions().timeZone})
          </span>
        </div>
        <span className="hidden sm:inline text-[11px] font-semibold text-[#5A6054]">
          Reminders auto-calculate from this time
        </span>
      </div>
      
      <div className="flex-1 flex flex-col gap-4 mb-20">
        <div className="relative flex-1 flex flex-col">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="I need to finish the math assignment but I don't know where to start, also remind me to call mom at 5pm and buy milk..."
            className="flex-1 w-full p-6 pb-20 rounded-[32px] bg-[#FBFDF8] border border-[#E0E3DB] shadow-sm focus:border-[#3A693A] focus:ring focus:ring-[#DDE5D9] focus:ring-opacity-50 transition-all resize-none text-[#101F10] text-lg outline-none"
          />
          
          {recognitionRef.current && (
            <div className="absolute bottom-6 right-6 flex items-center gap-3">
              {isListening && <span className="text-[#3A693A] font-bold animate-pulse text-sm">Listening...</span>}
              <button
                onClick={toggleListening}
                className={`p-4 rounded-full shadow-lg transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-[#EDF1E9] text-[#3A693A] hover:bg-[#DDE5D9]'}`}
              >
                {isListening ? <Square className="w-6 h-6 fill-current" /> : <Mic className="w-6 h-6" />}
              </button>
            </div>
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
