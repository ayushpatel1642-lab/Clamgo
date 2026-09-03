import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { CheckCircle, Loader2 } from 'lucide-react';

export default function CompletedTasks() {
  const { getToken } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const token = await getToken();
      const res = await fetch('/api/tasks?status=completed', {
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

  return (
    <div className="p-6 md:p-12 max-w-2xl mx-auto w-full">
      <header className="mb-10 pt-4">
        <h1 className="text-3xl font-bold text-[#191C19] mb-2">Completed Tasks</h1>
        <p className="text-[#424940] text-lg">Everything you've achieved.</p>
      </header>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#E0E3DB]" /></div>
      ) : tasks.length === 0 ? (
        <div className="text-center p-12 bg-[#FBFDF8] rounded-[32px] border border-[#E0E3DB] shadow-sm">
          <p className="text-[#424940]">No completed tasks yet. Time to get to work!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map(task => (
            <div key={task.id} className="bg-[#F4F5F2] p-5 rounded-[24px] border border-[#E0E3DB] shadow-sm flex items-center gap-4">
              <CheckCircle className="w-6 h-6 text-[#A3C9A3]" />
              <div className="flex-1">
                <h3 className="font-bold text-[#424940] line-through">{task.title}</h3>
                <div className="text-xs text-[#3A693A] mt-1">{task.estimatedDuration}m</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
