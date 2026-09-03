import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, BrainCircuit, ListTodo, BotMessageSquare, Sparkles, Plus, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from './AuthProvider';

interface Task {
  id: number;
  title: string;
  status: string;
  estimatedDuration: number;
}

export default function HomeDashboard() {
  const { getToken, user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [somedayTasks, setSomedayTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  
  // Task Creation State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState('25');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const token = await getToken();
      const res = await fetch('/api/tasks', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const pending = data.filter((t: Task) => t.status === 'pending' || t.status === 'in_progress');
        const postponed = data.filter((t: Task) => t.status === 'postponed');
        
        setTasks(pending);
        setSomedayTasks(postponed);
        
        if (pending.length > 0) {
          setActiveTask(pending[0]);
        } else {
          setActiveTask(null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    setIsAdding(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: newTaskTitle,
          estimatedDuration: parseInt(newTaskDuration) || 25
        })
      });
      
      if (res.ok) {
        setNewTaskTitle('');
        setNewTaskDuration('25');
        fetchTasks();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAdding(false);
    }
  };

  const handlePostpone = async (taskId: number) => {
    try {
      const token = await getToken();
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'postponed' })
      });
      fetchTasks();
    } catch (e) {
      console.error(e);
    }
  };

  const handleActivate = async (taskId: number) => {
    try {
      const token = await getToken();
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'pending' })
      });
      fetchTasks();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 md:p-12 max-w-3xl mx-auto w-full">
      <header className="mb-10 pt-4">
        <h1 className="text-3xl font-bold text-[#191C19] mb-2">Good morning, {user?.displayName?.split(' ')[0] || 'there'}</h1>
        <p className="text-[#424940] text-lg">Let's focus on one thing at a time.</p>
      </header>

      {/* Primary Action / Today's Focus */}
      <section className="mb-8">
        <h2 className="text-[10px] font-bold tracking-widest text-[#3A693A] uppercase mb-4">Up Next</h2>
        
        {loading ? (
          <div className="h-48 bg-[#E0E3DB] animate-pulse rounded-[32px]"></div>
        ) : activeTask ? (
          <div className="bg-[#FBFDF8] rounded-[32px] p-6 md:p-8 shadow-sm border border-[#E0E3DB] flex flex-col items-center text-center">
            <h3 className="text-2xl font-bold text-[#101F10] mb-6">{activeTask.title}</h3>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Link 
                to={`/focus-mode/${activeTask.id}`}
                className="flex items-center justify-center gap-2 bg-[#3A693A] text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-[#3A693A]/20 hover:scale-[1.02] active:scale-95 transition-transform"
              >
                <Play className="w-5 h-5 fill-current" />
                Start Focus
              </Link>
              
              <Link
                to={`/task-decomposer/${activeTask.id}`}
                className="flex items-center justify-center gap-2 bg-[#EDF1E9] text-[#3A693A] px-8 py-4 rounded-2xl font-bold hover:bg-[#DDE5D9] transition-colors"
              >
                <Sparkles className="w-5 h-5" />
                Break it down
              </Link>
            </div>
            
            <Link to={`/stuck/${activeTask.id}`} className="mt-6 text-xs text-[#424940] hover:text-[#101F10] font-bold underline underline-offset-4 decoration-[#3A693A]">
              I'm stuck on this
            </Link>
          </div>
        ) : (
          <div className="bg-[#F4F5F2] rounded-[32px] p-8 border border-dashed border-[#E0E3DB] flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-[#FBFDF8] flex items-center justify-center mb-4 shadow-sm">
              <Sparkles className="w-6 h-6 text-[#3A693A]" />
            </div>
            <h3 className="text-lg font-bold text-[#101F10] mb-2">You're all caught up!</h3>
            <p className="text-[#424940] mb-6 max-w-sm">No pending tasks. Need to get some thoughts out of your head?</p>
            <Link 
              to="/brain-dump"
              className="bg-[#3A693A] text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-[#3A693A]/20 hover:scale-[1.02] active:scale-95 transition-transform"
            >
              Start a Brain Dump
            </Link>
          </div>
        )}
      </section>

      {/* Add New Task */}
      <section className="mb-12">
        <h2 className="text-[10px] font-bold tracking-widest text-[#424940] uppercase mb-4 opacity-60">Add Task</h2>
        <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="What do you need to do?"
            className="flex-1 bg-[#FBFDF8] p-4 rounded-2xl border border-[#E0E3DB] focus:border-[#3A693A] focus:ring focus:ring-[#DDE5D9] outline-none text-[#101F10] shadow-sm transition-all"
            required
          />
          <div className="flex gap-3">
            <input
              type="number"
              value={newTaskDuration}
              onChange={(e) => setNewTaskDuration(e.target.value)}
              placeholder="Min"
              min="1"
              className="w-24 bg-[#FBFDF8] p-4 rounded-2xl border border-[#E0E3DB] focus:border-[#3A693A] focus:ring focus:ring-[#DDE5D9] outline-none text-[#101F10] shadow-sm transition-all text-center"
            />
            <button
              type="submit"
              disabled={isAdding || !newTaskTitle.trim()}
              className="bg-[#EDF1E9] text-[#3A693A] px-6 rounded-2xl font-bold hover:bg-[#DDE5D9] transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              <span className="hidden sm:inline">Add</span>
            </button>
          </div>
        </form>
      </section>

      {/* Today's Tasks List */}
      {tasks.length > 1 && (
        <section className="mb-12">
          <h2 className="text-[10px] font-bold tracking-widest text-[#424940] uppercase mb-4 opacity-60">Today's Tasks</h2>
          <div className="flex flex-col gap-3">
            {tasks.slice(1).map(task => (
              <div key={task.id} className="bg-white p-4 rounded-2xl border border-[#E0E3DB] shadow-sm flex items-center justify-between group">
                <span className="font-medium text-[#101F10]">{task.title}</span>
                <div className="flex gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handlePostpone(task.id)} className="text-xs px-3 py-1.5 rounded-full border border-[#E0E3DB] hover:bg-[#F4F5F2] text-[#424940] transition-colors">
                    Later (Someday)
                  </button>
                  <Link to={`/focus-mode/${task.id}`} className="text-xs px-3 py-1.5 rounded-full bg-[#3A693A] text-white hover:bg-[#3A693A]/90 transition-colors flex items-center gap-1">
                    <Play className="w-3 h-3 fill-current" /> Focus
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Someday Tasks */}
      {somedayTasks.length > 0 && (
        <section className="mb-12">
          <h2 className="text-[10px] font-bold tracking-widest text-[#424940] uppercase mb-4 opacity-60">Someday (Postponed)</h2>
          <div className="flex flex-col gap-3">
            {somedayTasks.map(task => (
              <div key={task.id} className="bg-white/50 p-4 rounded-2xl border border-dashed border-[#E0E3DB] flex items-center justify-between group">
                <span className="font-medium text-[#424940]">{task.title}</span>
                <div className="flex gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleActivate(task.id)} className="text-xs px-3 py-1.5 rounded-full border border-[#3A693A] text-[#3A693A] hover:bg-[#EDF1E9] transition-colors">
                    Move to Today
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Access Grid */}
      <section>
        <h2 className="text-[10px] font-bold tracking-widest text-[#424940] uppercase mb-4 opacity-60">Quick Access</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link to="/brain-dump" className="bg-[#FBFDF8] p-5 rounded-2xl border border-[#E0E3DB] shadow-sm hover:border-[#A3C9A3] hover:shadow-md transition-all group flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#EDF1E9] flex items-center justify-center group-hover:scale-110 transition-transform">
              <BrainCircuit className="w-6 h-6 text-[#3A693A]" />
            </div>
            <span className="font-bold text-xs text-[#424940]">Brain Dump</span>
          </Link>
          
          <Link to="/memory-dock" className="bg-[#FBFDF8] p-5 rounded-2xl border border-[#E0E3DB] shadow-sm hover:border-[#A3C9A3] hover:shadow-md transition-all group flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#EDF1E9] flex items-center justify-center group-hover:scale-110 transition-transform">
              <ListTodo className="w-6 h-6 text-[#3A693A]" />
            </div>
            <span className="font-bold text-xs text-[#424940]">Later</span>
          </Link>

          <Link to="/completed" className="bg-[#FBFDF8] p-5 rounded-2xl border border-[#E0E3DB] shadow-sm hover:border-[#A3C9A3] hover:shadow-md transition-all group flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#EDF1E9] flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle className="w-6 h-6 text-[#3A693A]" />
            </div>
            <span className="font-bold text-xs text-[#424940]">Completed</span>
          </Link>

          <Link to="/coach" className="bg-[#FBFDF8] p-5 rounded-2xl border border-[#E0E3DB] shadow-sm hover:border-[#A3C9A3] hover:shadow-md transition-all group flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#EDF1E9] flex items-center justify-center group-hover:scale-110 transition-transform">
              <BotMessageSquare className="w-6 h-6 text-[#3A693A]" />
            </div>
            <span className="font-bold text-xs text-[#424940]">AI Coach</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
