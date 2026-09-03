import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { Clock, Loader2, Play, CheckCircle } from 'lucide-react';
import { format, addMinutes } from 'date-fns';
import { Link } from 'react-router-dom';
import confetti from 'canvas-confetti';

export default function VisualTimeline() {
  const { getToken } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimeline();
  }, []);

  const fetchTimeline = async () => {
    try {
      const token = await getToken();
      const res = await fetch('/api/tasks?status=pending', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkComplete = async (taskId: number) => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'completed' })
      });
      if (res.ok) {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#3A693A', '#84A98C', '#A3C9A3']
        });
        setTasks(tasks.filter(t => t.id !== taskId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const now = new Date();
  let currentTime = now;

  return (
    <div className="p-6 md:p-12 max-w-2xl mx-auto w-full">
      <header className="mb-10 pt-4">
        <h1 className="text-3xl font-bold text-[#191C19] mb-2">Timeline</h1>
        <p className="text-[#424940] text-lg">A realistic look at your day based on estimated durations.</p>
      </header>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#E0E3DB]" /></div>
      ) : tasks.length === 0 ? (
        <div className="text-center p-12 bg-[#FBFDF8] rounded-[32px] border border-[#E0E3DB] shadow-sm">
          <p className="text-[#424940]">Your timeline is clear. Enjoy the space!</p>
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 py-4">
          <div className="absolute top-0 bottom-0 left-[35px] sm:left-[43px] w-0.5 bg-[#E0E3DB] rounded-full"></div>
          
          <div className="relative flex items-start gap-6 mb-12">
            <div className="w-4 h-4 rounded-full bg-[#3A693A] mt-1 shadow-[0_0_0_4px_rgba(58,105,58,0.2)] z-10 shrink-0"></div>
            <div>
              <h2 className="text-xs font-bold tracking-widest text-[#3A693A] uppercase">Now • {format(now, 'h:mm a')}</h2>
            </div>
          </div>

          <div className="space-y-8">
            {tasks.map((task, idx) => {
              const taskStart = currentTime;
              const duration = task.estimatedDuration || 25;
              const taskEnd = addMinutes(taskStart, duration);
              
              // Add a 5 min break after each task conceptually
              currentTime = addMinutes(taskEnd, 5);

              return (
                <div key={task.id} className="relative flex items-start gap-6 group">
                  <div className="w-3 h-3 rounded-full bg-[#E0E3DB] mt-1.5 z-10 shrink-0 group-hover:bg-[#A3C9A3] transition-colors ml-0.5"></div>
                  <div className="flex-1 bg-[#FBFDF8] p-5 rounded-[32px] border border-[#E0E3DB] shadow-sm group-hover:border-[#A3C9A3] group-hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-bold text-[#101F10] pr-4">{task.title}</h3>
                      <span className="text-sm font-bold text-[#3A693A] bg-[#EDF1E9] px-3 py-1 rounded-full border border-[#DDE5D9] whitespace-nowrap">{duration}m</span>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                      <div className="flex items-center gap-2 text-sm text-[#424940] font-medium">
                        <Clock className="w-4 h-4 text-[#3A693A]" />
                        <span>{format(taskStart, 'h:mm a')} - {format(taskEnd, 'h:mm a')}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleMarkComplete(task.id)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold text-[#424940] border border-[#E0E3DB] hover:bg-[#EDF1E9] transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Done
                        </button>
                        <Link 
                          to={`/focus-mode/${task.id}`}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold text-white bg-[#3A693A] hover:bg-[#3A693A]/90 transition-colors shadow-sm"
                        >
                          <Play className="w-4 h-4" fill="currentColor" />
                          Focus
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
