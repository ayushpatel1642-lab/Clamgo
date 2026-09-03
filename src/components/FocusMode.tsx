import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Play, Pause, Square, ArrowLeft, CheckCircle2, Loader2, MessageCircleQuestion } from 'lucide-react';
import { useAuth } from './AuthProvider';
import confetti from 'canvas-confetti';

export default function FocusMode() {
  const { taskId } = useParams();
  const [searchParams] = useSearchParams();
  const stepId = searchParams.get('stepId');
  const { getToken } = useAuth();
  const navigate = useNavigate();
  
  const [duration, setDuration] = useState(25); // minutes
  const [timeLeft, setTimeLeft] = useState(25 * 60); // seconds
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [task, setTask] = useState<any>(null);
  const [step, setStep] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Stuck modal state
  const [showStuckModal, setShowStuckModal] = useState(false);
  const [stuckLoading, setStuckLoading] = useState(false);
  const [stuckReason, setStuckReason] = useState('');
  const [stuckIntervention, setStuckIntervention] = useState('');
  
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
        if (stepId && data.steps) {
          const foundStep = data.steps.find((s: any) => s.id.toString() === stepId);
          if (foundStep) {
            setStep(foundStep);
            setDuration(foundStep.estimatedDuration || 25);
            setTimeLeft((foundStep.estimatedDuration || 25) * 60);
          }
        } else if (data.task.estimatedDuration) {
          setDuration(data.task.estimatedDuration);
          setTimeLeft(data.task.estimatedDuration * 60);
        }
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

  const handleComplete = async (markDone: boolean = false) => {
    setIsActive(false);
    setIsPaused(false);
    setSaving(true);
    
    try {
      const token = await getToken();
      const actualDuration = Math.ceil((duration * 60 - timeLeft) / 60);
      
      const promises: Promise<any>[] = [
        fetch('/api/focus-sessions', {
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
        })
      ];

      const shouldMarkComplete = markDone || timeLeft === 0;

      if (shouldMarkComplete) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3A693A', '#84A98C', '#A3C9A3']
        });
      }

      if (shouldMarkComplete && taskId) {
        if (stepId) {
          promises.push(
            fetch(`/api/tasks/${taskId}/steps/${stepId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ isCompleted: true })
            })
          );
        } else {
          promises.push(
            fetch(`/api/tasks/${taskId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ status: 'completed' })
            })
          );
        }
      }
      
      await Promise.all(promises);
      
      if (taskId && stepId) {
        navigate(`/tasks/${taskId}/decompose`);
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleStop = () => handleComplete(false);

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

  const handleStuck = async (reason: string) => {
    setStuckReason(reason);
    setStuckLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/ai/stuck', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason, taskTitle: step ? step.title : (task?.title || 'Current task') })
      });
      if (res.ok) {
        const data = await res.json();
        setStuckIntervention(data.advice);
      }
    } catch (e) {
      console.error(e);
      setStuckIntervention("Take a deep breath. Try breaking this task down into one even smaller step. What's the very next physical action?");
    } finally {
      setStuckLoading(false);
    }
  };

  const closeStuckModal = () => {
    setShowStuckModal(false);
    setStuckIntervention('');
    setStuckReason('');
    setIsPaused(false);
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
          {(task || step) && (
            <div className="text-[#1A1C19] font-bold px-4 py-2 bg-white shadow-sm border border-[#E0E3DB] rounded-full max-w-sm truncate text-center">
              {step ? step.title : task?.title}
            </div>
          )}
        </header>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center mb-12 rounded-full bg-gradient-to-br from-[#DDE5D9] to-[#A3C9A3] shadow-2xl border-[8px] border-white/40">
            <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none">
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
                  onClick={() => handleComplete(true)}
                  disabled={saving}
                  className="w-16 h-16 rounded-full bg-white shadow-sm border border-[#E0E3DB] text-[#3A693A] flex items-center justify-center hover:bg-[#FBFDF8] transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-8 h-8" />
                </button>
              </>
            )}
          </div>
          
          {isActive && (
            <button
              onClick={() => {
                setShowStuckModal(true);
                setIsPaused(true);
              }}
              className="mt-8 flex items-center gap-2 text-xs text-[#424940] hover:text-[#101F10] font-bold px-4 py-2 bg-white/50 rounded-full transition-colors"
            >
              <MessageCircleQuestion className="w-4 h-4" />
              I'm stuck
            </button>
          )}
        </div>
      </div>

      {showStuckModal && (
        <div className="absolute inset-0 z-50 bg-[#F4F5F2]/95 backdrop-blur-sm p-6 flex flex-col md:p-12 items-center overflow-y-auto">
          <div className="w-full max-w-xl mx-auto flex flex-col mt-12 mb-12">
            <header className="mb-8 flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-bold text-[#191C19] mb-2">You're stuck. That's okay.</h2>
                <p className="text-[#424940] text-lg">Let's get you un-stuck. What's the main blocker right now?</p>
              </div>
              <button onClick={closeStuckModal} className="p-3 bg-white rounded-full border border-[#E0E3DB]">
                <Square className="w-4 h-4" />
              </button>
            </header>

            {!stuckIntervention ? (
              <div className="grid gap-3">
                {[
                  "I don't know where to start",
                  "It feels too big / overwhelming",
                  "I'm too tired / low energy",
                  "I keep getting distracted",
                  "I'm feeling anxious about it"
                ].map(r => (
                  <button
                    key={r}
                    onClick={() => handleStuck(r)}
                    disabled={stuckLoading}
                    className="text-left bg-white p-5 rounded-2xl border border-[#E0E3DB] shadow-sm hover:border-[#3A693A] transition-all font-bold text-[#101F10] disabled:opacity-50"
                  >
                    {r}
                  </button>
                ))}
                
                {stuckLoading && (
                  <div className="flex items-center gap-3 text-[#3A693A] font-bold p-4">
                    <Loader2 className="w-5 h-5 animate-spin" /> Thinking...
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white p-8 rounded-[32px] border border-[#E0E3DB] shadow-sm flex flex-col gap-6">
                <div className="text-[#101F10] whitespace-pre-wrap leading-relaxed text-lg">
                  {stuckIntervention}
                </div>
                
                <div className="flex gap-4 mt-4">
                  <button 
                    onClick={() => {
                      closeStuckModal();
                      setIsPaused(false);
                    }}
                    className="flex-1 bg-[#3A693A] text-white py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-transform"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    Back to work
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
