import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Zap, Brain, BatteryMedium, MessageCircleQuestion } from 'lucide-react';
import { useAuth } from './AuthProvider';

export default function ImStuck() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [intervention, setIntervention] = useState<string>('');

  useEffect(() => {
    if (taskId) fetchTask();
  }, [taskId]);

  const fetchTask = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/tasks/${taskId}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setTask(data.task);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getHelp = async (selectedReason: string) => {
    setReason(selectedReason);
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/ai/stuck', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          taskId: taskId || null,
          taskTitle: task?.title,
          reason: selectedReason
        })
      });
      if (res.ok) {
        const data = await res.json();
        setIntervention(data.intervention);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const reasons = [
    { id: 'overwhelm', label: "It's too much", icon: Brain },
    { id: 'unclear', label: "I don't know how", icon: MessageCircleQuestion },
    { id: 'boredom', label: "I'm understimulated", icon: Zap },
    { id: 'energy', label: "I have no energy", icon: BatteryMedium },
  ];

  return (
    <div className="p-6 md:p-12 max-w-2xl mx-auto w-full">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-[#424940] hover:text-[#101F10] mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <header className="mb-10">
        <h1 className="text-3xl font-bold text-[#191C19] mb-2">You're stuck. That's okay.</h1>
        {task ? (
          <p className="text-[#424940] text-lg">Let's figure out what's stopping you from doing "{task.title}".</p>
        ) : (
          <p className="text-[#424940] text-lg">Let's figure out what's causing friction right now.</p>
        )}
      </header>

      {!intervention && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {reasons.map(r => (
            <button
              key={r.id}
              onClick={() => getHelp(r.id)}
              className="bg-[#FBFDF8] p-6 rounded-[32px] border border-[#E0E3DB] shadow-sm hover:border-[#3A693A] hover:shadow-md transition-all flex flex-col items-center text-center gap-4 group"
            >
              <div className="w-14 h-14 rounded-full bg-[#F4F5F2] flex items-center justify-center group-hover:bg-[#EDF1E9] group-hover:text-[#3A693A] transition-colors">
                <r.icon className="w-7 h-7 text-[#424940] group-hover:text-[#3A693A]" />
              </div>
              <span className="font-bold text-[#101F10]">{r.label}</span>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="bg-[#FBFDF8] rounded-[32px] p-12 border border-[#E0E3DB] shadow-sm flex flex-col items-center justify-center text-center h-64">
          <Loader2 className="w-10 h-10 animate-spin text-[#3A693A] mb-6" />
          <p className="text-[#424940] font-bold animate-pulse">Analyzing the friction...</p>
        </div>
      )}

      {intervention && !loading && (
        <div className="bg-[#EDF1E9] rounded-[32px] p-8 border border-[#DDE5D9] shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#3A693A]"></div>
          <h3 className="text-sm font-bold tracking-widest text-[#3A693A] uppercase mb-6">Suggested Intervention</h3>
          <div className="prose prose-[#3A693A] max-w-none text-[#101F10] leading-relaxed whitespace-pre-wrap font-medium">
            {intervention}
          </div>
          
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            {task && (
              <button onClick={() => navigate(`/focus-mode/${task.id}`)} className="bg-[#3A693A] text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-[#3A693A]/20 hover:scale-[1.02] active:scale-95 transition-transform text-center">
                I'm ready to try
              </button>
            )}
            <button onClick={() => setIntervention('')} className="bg-white text-[#424940] border border-[#E0E3DB] px-6 py-3 rounded-2xl font-bold hover:bg-[#FBFDF8] transition-colors text-center">
              This didn't help
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
