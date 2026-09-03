import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pause, Square, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from './AuthProvider';

export default function FocusMode() {
  const { taskId } = useParams();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  
  const [duration, setDuration] = useState(25); // minutes
  const [timeLeft, setTimeLeft] = useState(25 * 60); // seconds
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [task, setTask] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  
  const endTimeRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (taskId) {
      fetchTask();
    }
  }, [taskId]);

  useEffect(() => {
    if (isActive && !isPaused && timeLeft > 0) {
      if (!endTimeRef.current) {
        endTimeRef.current = Date.now() + timeLeft * 1000;
      }
      
      timerRef.current = setInterval(() => {
        if (endTimeRef.current) {
          const newTimeLeft = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
          setTimeLeft(newTimeLeft);
          if (newTimeLeft === 0) {
            handleComplete();
          }
        }
      }, 200); // Check more frequently than 1s for smoother sync
    } else {
      endTimeRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, isPaused, timeLeft]);

  const fetchTask = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTask(data.task);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStart = () => {
    setIsActive(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleComplete = async () => {
    setIsActive(false);
    setIsPaused(false);
    setSaving(true);
    
    try {
      const token = await getToken();
      const actualDuration = Math.ceil((duration * 60 - timeLeft) / 60);
      
      await fetch('/api/focus-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          taskId: taskId ? parseInt(taskId) : null,
          duration,
          actualDuration,
          completed: timeLeft === 0
        })
      });
      
      navigate('/');
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsActive(false);
    setIsPaused(false);
    setTimeLeft(duration * 60);
  };

  const setTimer = (mins: number) => {
    setDuration(mins);
    setTimeLeft(mins * 60);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = 100 - ((timeLeft / (duration * 60)) * 100);

  return (
    <div className="min-h-screen bg-[#F4F5F2] text-[#1A1C19] p-6 md:p-12 flex flex-col relative overflow-hidden">
      {/* Background Orb Animation */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vw] h-[120vw] md:w-[60vw] md:h-[60vw] pointer-events-none mix-blend-multiply flex items-center justify-center">
        <div 
          className={`w-full h-full rounded-full blur-3xl transition-all duration-1000 ${isActive && !isPaused ? 'opacity-40 animate-[spin_10s_linear_infinite]' : 'opacity-20 scale-100'}`}
          style={{
            background: 'conic-gradient(from 0deg at 50% 50%, #3A693A, transparent, #84A98C, transparent, #3A693A)',
          }}
        />
        <div 
          className={`absolute inset-0 rounded-full blur-2xl transition-all duration-1000 ${isActive && !isPaused ? 'opacity-30 animate-pulse scale-110' : 'opacity-10 scale-100'}`}
          style={{
            background: 'radial-gradient(circle, #3A693A 0%, transparent 60%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto w-full flex flex-col h-full flex-1">
        <header className="flex justify-between items-center mb-12">
          <button onClick={() => navigate(-1)} className="p-3 rounded-full bg-white shadow-sm border border-[#E0E3DB] hover:bg-[#FBFDF8] transition-colors">
            <ArrowLeft className="w-6 h-6 text-[#1A1C19]" />
          </button>
          {task && (
            <div className="text-[#1A1C19] font-bold px-4 py-2 bg-white shadow-sm border border-[#E0E3DB] rounded-full">
              {task.title}
            </div>
          )}
        </header>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center mb-12 rounded-full bg-gradient-to-br from-[#DDE5D9] to-[#A3C9A3] shadow-2xl border-[8px] border-white/40">
            <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none opacity-0">
              {/* Keep SVG for logic but hide it since design doesn't use stroke circle for progress in this exact way, though we could keep a subtle stroke. Let's make it very subtle. */}
              <circle
                cx="50%"
                cy="50%"
                r="48%"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="4"
              />
              <circle
                cx="50%"
                cy="50%"
                r="48%"
                fill="none"
                stroke="#3A693A"
                strokeWidth="4"
                strokeDasharray="100 100"
                strokeDashoffset={100 - progress}
                className="transition-all duration-1000 ease-linear"
                pathLength="100"
              />
            </svg>
            <div className="text-center">
              <div className="text-6xl md:text-8xl font-bold tracking-tighter tabular-nums text-[#101F10]">
                {formatTime(timeLeft)}
              </div>
              <div className="text-xs uppercase tracking-widest text-[#3A693A] font-bold mt-1">Deep Work</div>
            </div>
          </div>

          {!isActive && (
            <div className="flex flex-wrap justify-center gap-3 mb-12">
              {[5, 10, 15, 25, 45].map((mins) => (
                <button
                  key={mins}
                  onClick={() => setTimer(mins)}
                  className={`px-6 py-2 rounded-full font-bold transition-colors shadow-sm border border-[#E0E3DB] ${duration === mins ? 'bg-[#3A693A] text-white' : 'bg-white text-[#424940] hover:bg-[#FBFDF8]'}`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-6">
            {!isActive ? (
              <button
                onClick={handleStart}
                className="w-20 h-20 rounded-full bg-[#3A693A] text-white flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-[#3A693A]/20"
              >
                <Play className="w-8 h-8 fill-current ml-1" />
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  className="w-16 h-16 rounded-full bg-white text-[#424940] shadow-sm border border-[#E0E3DB] flex items-center justify-center hover:bg-[#FBFDF8] transition-colors"
                >
                  <Square className="w-6 h-6 fill-current" />
                </button>

                <button
                  onClick={isPaused ? handleStart : handlePause}
                  className="w-24 h-24 rounded-full bg-[#3A693A] text-white flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-[#3A693A]/20"
                >
                  {isPaused ? <Play className="w-10 h-10 fill-current ml-1" /> : <Pause className="w-10 h-10 fill-current" />}
                </button>

                <button
                  onClick={handleComplete}
                  disabled={saving}
                  className="w-16 h-16 rounded-full bg-white shadow-sm border border-[#E0E3DB] text-[#3A693A] flex items-center justify-center hover:bg-[#FBFDF8] transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-8 h-8" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
