import { toast } from 'sonner';
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Play, Loader2, ListTree, ArrowLeft, Sparkles, Zap, ShieldCheck, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { getStoredSettings } from '../lib/settings';

interface Task {
  id: number;
  title: string;
  status: string;
}

interface Step {
  id: number;
  title: string;
  estimatedDuration: number;
  isCompleted: boolean;
}

export default function TaskDecomposer() {
  const { taskId } = useParams();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const settings = getStoredSettings();

  const [task, setTask] = useState<Task | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [decomposing, setDecomposing] = useState(false);
  const [granularity, setGranularity] = useState<'micro' | 'balanced' | 'deep'>(
    settings.decompositionGranularity || 'micro'
  );

  useEffect(() => {
    fetchTaskAndSteps();
  }, [taskId]);

  const fetchTaskAndSteps = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTask(data.task);
        setSteps(data.steps);
      }
    } catch (e: any) {
      console.error(e); toast.error(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleDecompose = async () => {
    setDecomposing(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/tasks/${taskId}/decompose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ granularity })
      });
      
      if (res.ok) {
        const data = await res.json();
        setSteps(data.steps);
        toast.success("Task broken down with ADHD micro-friction algorithm!");
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to decompose task");
      }

    } catch (e: any) {
      console.error(e); toast.error(e.message || "Something went wrong.");
    } finally {
      setDecomposing(false);
    }
  };

  const handleToggleStep = async (stepId: number, isCompleted: boolean) => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/tasks/${taskId}/steps/${stepId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isCompleted })
      });
      if (res.ok) {
        setSteps(steps.map(s => s.id === stepId ? { ...s, isCompleted } : s));
      }
    } catch (e) {
      console.error(e); toast.error(e.message || "Something went wrong.");
    }
  };

  if (loading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#E0E3DB]" /></div>;
  }

  if (!task) {
    return (
      <div className="p-12 text-center text-[#424940] max-w-md mx-auto">
        <h2 className="text-xl font-bold text-[#101F10] mb-2">Task not found</h2>
        <p className="text-sm mb-6">This task might have been completed, deleted, or doesn't exist.</p>
        <Link to="/" className="inline-flex items-center gap-2 bg-[#3A693A] text-white px-6 py-3 rounded-2xl font-bold shadow-sm hover:scale-[1.02] transition-transform">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    );
  }

  const nextStep = steps.find(s => !s.isCompleted);

  return (
    <div className="p-6 md:p-12 max-w-3xl mx-auto w-full">
      <Link to="/" className="inline-flex items-center gap-2 text-[#424940] hover:text-[#101F10] mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>

      <header className="mb-10">
        <h1 className="text-3xl font-bold text-[#191C19] mb-2">{task.title}</h1>
        <p className="text-[#424940] text-lg">Let's break this down into tiny, manageable steps.</p>
      </header>

      {/* AI Granularity Mode Control */}
      <div className="mb-6 p-4 bg-[#FBFDF8] border border-[#E0E3DB] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#3A693A]" />
          <div>
            <span className="text-xs font-bold text-[#191C19] block">AI Decomposition Granularity</span>
            <span className="text-[11px] text-[#5A6354]">
              {granularity === 'micro' && 'Step 1 is a 2-min starter action to break task-initiation freeze.'}
              {granularity === 'balanced' && 'Standard focused steps (10-20 mins) with clear verbs.'}
              {granularity === 'deep' && 'Deep milestone blocks (20-35 mins) for extended focus.'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-[#EDF1E9] p-1 rounded-xl self-start sm:self-auto">
          {[
            { id: 'micro', label: 'Micro (2-min Breaker)' },
            { id: 'balanced', label: 'Balanced' },
            { id: 'deep', label: 'Deep Blocks' }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setGranularity(mode.id as any)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                granularity === mode.id
                  ? 'bg-white text-[#191C19] shadow-2xs'
                  : 'text-[#5A6354] hover:text-[#191C19]'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {steps.length === 0 ? (
        <div className="bg-[#FBFDF8] rounded-[32px] p-8 border border-[#E0E3DB] flex flex-col items-center text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-[#DDE5D9] flex items-center justify-center mb-6">
            <ListTree className="w-6 h-6 text-[#3A693A]" />
          </div>
          <h3 className="text-xl font-bold text-[#101F10] mb-2">Feeling overwhelmed?</h3>
          <p className="text-[#424940] mb-8 max-w-sm">
            Our ADHD executive-function engine will shatter this task into micro-actions with a guaranteed zero-friction first step.
          </p>
          
          <button
            onClick={handleDecompose}
            disabled={decomposing}
            className="w-full sm:w-auto bg-[#3A693A] text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-[#3A693A]/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-transform flex items-center justify-center gap-2 cursor-pointer"
          >
            {decomposing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating Micro-Steps with AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-yellow-300" />
                <span>Break Down Task</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {nextStep && (
            <section className="bg-[#FBFDF8] p-6 rounded-[32px] border border-[#A3C9A3] shadow-sm ring-1 ring-[#DDE5D9]">
              <h2 className="text-xs font-bold tracking-widest text-[#3A693A] uppercase mb-4">The Obvious Next Action</h2>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-bold text-[#101F10]">{nextStep.title}</h3>
                  <p className="text-[#424940] mt-1">Estimated: {nextStep.estimatedDuration} min</p>
                </div>
                <Link 
                  to={`/focus-mode/${task.id}?stepId=${nextStep.id}`}
                  className="flex items-center justify-center gap-2 bg-[#3A693A] text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-[#3A693A]/20 hover:scale-[1.02] active:scale-95 transition-transform shrink-0"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Start Focus
                </Link>
              </div>
            </section>
          )}

          
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] font-bold tracking-widest text-[#424940] opacity-60 uppercase">All Steps</h2>
              <button 
                onClick={handleDecompose}
                disabled={decomposing}
                className="text-xs font-bold text-[#3A693A] flex items-center gap-1 hover:bg-[#EDF1E9] px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
              >
                {decomposing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Sparkles className="w-3 h-3" /> Regenerate</>}
              </button>
            </div>
            <div className="space-y-3">

              {steps.map((step, idx) => (
                <div 
                  key={step.id} 
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-colors ${step.isCompleted ? 'bg-[#F4F5F2] border-[#E0E3DB] opacity-60' : 'bg-[#FBFDF8] border-[#E0E3DB] hover:border-[#A3C9A3]'}`}
                >
                  <button 
                    onClick={() => handleToggleStep(step.id, !step.isCompleted)}
                    className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors ${step.isCompleted ? 'bg-[#3A693A] border-[#3A693A]' : 'bg-transparent border-[#A3C9A3] hover:border-[#3A693A]'}`}
                  >
                    {step.isCompleted && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </button>
                  <div className="flex-1 cursor-pointer" onClick={() => handleToggleStep(step.id, !step.isCompleted)}>
                    <h4 className={`font-bold ${step.isCompleted ? 'text-[#424940] line-through' : 'text-[#101F10]'}`}>
                      {step.title}
                    </h4>
                  </div>
                  <div className="text-sm text-[#424940] font-bold shrink-0 bg-[#F4F5F2] px-3 py-1 rounded-full border border-[#E0E3DB]">
                    {step.estimatedDuration}m
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
