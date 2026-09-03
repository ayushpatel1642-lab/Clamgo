import { toast } from 'sonner';
import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Play, BrainCircuit, ListTodo, BotMessageSquare, Sparkles, Plus, Loader2, CheckCircle, Trash2, Edit2 , CalendarDays, Bell, ListTree, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';
import { useAuth } from './AuthProvider';
import RemindersModal from './RemindersModal';

interface TaskStep {
  id: number;
  taskId: number;
  title: string;
  isCompleted: boolean;
  estimatedDuration?: number;
}

interface Task {
  id: number;
  title: string;
  status: string;
  estimatedDuration: number;
  createdAt: string;
  steps?: TaskStep[];
}

export default function HomeDashboard() {
  const { getToken, user } = useAuth();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [somedayTasks, setSomedayTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showActiveSubtasks, setShowActiveSubtasks] = useState(false);
  const [editingTask, setEditingTask] = useState<{id: number, title: string} | null>(null);
  const [editTitle, setEditTitle] = useState('');
  
  // Recovery State
  const [missedTasks, setMissedTasks] = useState<Task[]>([]);

  
  // Task Creation State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState('25');
  const [isAdding, setIsAdding] = useState(false);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: Task; type: 'today' | 'someday' } | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [dayPlan, setDayPlan] = useState<any>(null);
  const [showRemindersModal, setShowRemindersModal] = useState(false);
  const [remindersCount, setRemindersCount] = useState(0);
  const touchTimer = useRef<any>(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleTouchStart = (e: React.TouchEvent, task: Task, type: 'today' | 'someday') => {
    const touch = e.touches[0];
    touchTimer.current = setTimeout(() => {
      setContextMenu({ x: touch.pageX, y: touch.pageY, task, type });
    }, 500);
  };

  const handleTouchEnd = () => {
    if (touchTimer.current) clearTimeout(touchTimer.current);
  };

  const handleContextMenu = (e: React.MouseEvent, task: Task, type: 'today' | 'someday') => {
    e.preventDefault();
    setContextMenu({ x: e.pageX, y: e.pageY, task, type });
  };

  const fetchRemindersCount = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch('/api/reminders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const list = await res.json();
        const active = list.filter((r: any) => !r.isAcknowledged).length;
        setRemindersCount(active);
      }
    } catch (e) {
      console.error("Failed to fetch reminders count", e);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchRemindersCount();
  }, []);

  const handlePlanDay = async () => {
    setIsPlanning(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/ai/plan-day', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDayPlan(data);
      } else {
        toast.error("Failed to plan day");
      }
    } catch (e: any) {
      toast.error(e.message || "Something went wrong.");
    } finally {
      setIsPlanning(false);
    }
  };

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
        
        // Find missed tasks (created before today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const missed = pending.filter(t => new Date(t.createdAt).getTime() < today.getTime());
        const current = pending.filter(t => new Date(t.createdAt).getTime() >= today.getTime());
        
        if (missed.length > 0) {
           setMissedTasks(missed);
        }
        
        setTasks(current);
        setSomedayTasks(postponed);
        
        if (current.length > 0) {
          setActiveTask(current[0]);
        } else if (missed.length > 0) {
          setActiveTask(missed[0]);
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
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'postponed' })
      });
      if (!res.ok) throw new Error("Failed to postpone");
      fetchTasks();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Something went wrong.");
    }
  };

  const handleActivate = async (taskId: number) => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'pending' })
      });
      if (!res.ok) throw new Error("Failed to activate");
      fetchTasks();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Something went wrong.");
    }
  };

  const handleDelete = async (taskId: number) => {
    try {
      const token = await getToken();
      // Optimistic update for immediate UI response
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setSomedayTasks(prev => prev.filter(t => t.id !== taskId));
      setActiveTask(prev => (prev?.id === taskId ? null : prev));

      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to delete task");
      }
      toast.success("Task deleted successfully");
      fetchTasks();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to delete task.");
      fetchTasks();
    }
  };

  const handleToggleActiveStep = async (stepId: number, currentCompleted: boolean) => {
    if (!activeTask) return;
    const nextCompleted = !currentCompleted;
    setActiveTask(prev => {
      if (!prev) return null;
      return {
        ...prev,
        steps: (prev.steps || []).map(s => s.id === stepId ? { ...s, isCompleted: nextCompleted } : s)
      };
    });

    try {
      const token = await getToken();
      await fetch(`/api/tasks/${activeTask.id}/steps/${stepId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isCompleted: nextCompleted })
      });
    } catch (e) {
      console.error("Failed to toggle step", e);
    }
  };

    const handleEditClick = (taskId: number, currentTitle: string) => {
    setEditingTask({ id: taskId, title: currentTitle });
    setEditTitle(currentTitle);
  };

  const handleSaveEdit = async () => {
    if (!editingTask || !editTitle.trim()) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: editTitle.trim() })
      });
      if (!res.ok) throw new Error("Failed to edit task");
      setEditingTask(null);
      fetchTasks();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Something went wrong.");
    }
  };

  return (
    <div className="p-6 md:p-12 max-w-3xl mx-auto w-full">
      <header className="mb-10 pt-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#191C19] mb-2">Good morning, {user?.displayName?.split(' ')[0] || 'there'}</h1>
          <p className="text-[#424940] text-lg">Let's focus on one thing at a time.</p>
          <div className="mt-4 flex items-center gap-3">
            <button 
              onClick={handlePlanDay} 
              disabled={isPlanning}
              className="flex items-center gap-2 bg-[#EDF1E9] text-[#3A693A] px-4 py-2 rounded-full font-bold hover:bg-[#DDE5D9] transition-colors disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <CalendarDays className="w-4 h-4" />
              {isPlanning ? 'Planning...' : 'Auto Plan My Day'}
            </button>
          </div>
        </div>

        {/* Reminders Button on Top Corner of Home Page */}
        <button 
          onClick={() => setShowRemindersModal(true)}
          className="self-start sm:self-auto flex items-center gap-2.5 bg-[#FBFDF8] hover:bg-[#EDF1E9] border border-[#E0E3DB] hover:border-[#3A693A] text-[#101F10] px-4 py-2.5 rounded-2xl font-bold shadow-xs hover:shadow-sm transition-all active:scale-95 group cursor-pointer"
          title="View and manage reminders"
        >
          <div className="relative flex items-center justify-center">
            <Bell className="w-5 h-5 text-[#3A693A] group-hover:rotate-12 transition-transform" />
            {remindersCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#BA1A1A] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                {remindersCount > 9 ? '9+' : remindersCount}
              </span>
            )}
          </div>
          <span className="text-sm font-bold">Reminders</span>
          {remindersCount > 0 && (
            <span className="text-xs font-bold bg-[#EDF1E9] text-[#3A693A] px-2 py-0.5 rounded-full">
              {remindersCount}
            </span>
          )}
        </button>
      </header>

      {/* Primary Action / Today's Focus */}
      <section className="mb-8">
        <h2 className="text-[10px] font-bold tracking-widest text-[#3A693A] uppercase mb-4">Up Next</h2>
        
        {loading ? (
          <div className="h-48 bg-[#E0E3DB] animate-pulse rounded-[32px]"></div>
        ) : activeTask ? (
          <div className="bg-[#FBFDF8] rounded-[32px] p-6 md:p-8 shadow-sm border border-[#E0E3DB] flex flex-col items-center text-center">
            <h3 className="text-2xl font-bold text-[#101F10] mb-3">{activeTask.title}</h3>

            {/* Sub-tasks Indicator Badge (Hidden by default, reveal on click) */}
            {activeTask.steps && activeTask.steps.length > 0 && (
              <button
                type="button"
                onClick={() => setShowActiveSubtasks(!showActiveSubtasks)}
                className="mb-6 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#EDF1E9] text-[#3A693A] hover:bg-[#DDE5D9] transition-colors border border-[#DDE5D9]"
              >
                <ListTree className="w-3.5 h-3.5" />
                <span>
                  {activeTask.steps.filter(s => s.isCompleted).length}/{activeTask.steps.length} Sub-tasks
                </span>
                {showActiveSubtasks ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
            
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

              <button 
                onClick={() => handleEditClick(activeTask.id, activeTask.title)}
                className="flex items-center justify-center gap-2 bg-white border border-[#E0E3DB] text-[#424940] px-8 py-4 rounded-2xl font-bold hover:bg-[#F4F5F2] transition-colors"
              >
                <Edit2 className="w-5 h-5" />
                Edit
              </button>
              <button 
                onClick={() => handleDelete(activeTask.id)}
                className="flex items-center justify-center gap-2 bg-white border border-[#E0E3DB] text-[#424940] px-4 py-4 rounded-2xl font-bold hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                title="Delete Task"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            {/* Revealed Sub-tasks Block for Active Task */}
            {showActiveSubtasks && activeTask.steps && activeTask.steps.length > 0 && (
              <div className="w-full mt-6 bg-[#F6F8F4] border border-[#DDE5D9] rounded-2xl p-4 text-left">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E0E5DC]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#2E472E]">Sub-tasks</span>
                  <span className="text-xs text-[#5A6354]">
                    {activeTask.steps.filter(s => s.isCompleted).length} of {activeTask.steps.length} done
                  </span>
                </div>
                <div className="space-y-2">
                  {activeTask.steps.map((step) => (
                    <div
                      key={step.id}
                      onClick={() => handleToggleActiveStep(step.id, step.isCompleted)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                        step.isCompleted ? 'bg-white/60 border-[#E2E8DE] opacity-70' : 'bg-white border-[#DDE5D9] hover:border-[#B2D1B2]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                        <button type="button" className="text-[#3A693A] shrink-0">
                          {step.isCompleted ? (
                            <CheckSquare className="w-4 h-4 fill-[#3A693A] text-white" />
                          ) : (
                            <Square className="w-4 h-4 text-[#8C9886]" />
                          )}
                        </button>
                        <span className={`text-sm ${step.isCompleted ? 'line-through text-[#7A8374]' : 'text-[#191C19]'}`}>
                          {step.title}
                        </span>
                      </div>
                      {step.estimatedDuration && (
                        <span className="text-[11px] font-semibold text-[#5A6354] bg-[#EDF1E9] px-2 py-0.5 rounded-md shrink-0">
                          {step.estimatedDuration}m
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
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
              <div key={task.id} className="bg-white p-4 rounded-2xl border border-[#E0E3DB] shadow-sm flex items-center justify-between group cursor-context-menu" onContextMenu={(e) => handleContextMenu(e, task, 'today')} onTouchStart={(e) => handleTouchStart(e, task, 'today')} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchEnd}>
                <span className="font-medium text-[#101F10]">{task.title}</span>
                <div className="flex gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEditClick(task.id, task.title)} className="text-xs px-2 py-1.5 rounded-full border border-[#E0E3DB] hover:bg-[#F4F5F2] text-[#424940] transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(task.id)} className="text-xs px-2 py-1.5 rounded-full border border-[#E0E3DB] hover:bg-[#F4F5F2] text-[#424940] hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
              <div key={task.id} className="bg-white/50 p-4 rounded-2xl border border-dashed border-[#E0E3DB] flex items-center justify-between group cursor-context-menu" onContextMenu={(e) => handleContextMenu(e, task, 'someday')} onTouchStart={(e) => handleTouchStart(e, task, 'someday')} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchEnd}>
                <span className="font-medium text-[#424940]">{task.title}</span>
                <div className="flex gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEditClick(task.id, task.title)} className="text-xs px-2 py-1.5 rounded-full border border-[#E0E3DB] hover:bg-[#F4F5F2] text-[#424940] transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(task.id)} className="text-xs px-2 py-1.5 rounded-full border border-[#E0E3DB] hover:bg-[#F4F5F2] text-[#424940] hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
    
      {dayPlan && (
        <div className="fixed inset-0 z-50 bg-[#F4F5F2]/95 backdrop-blur-sm p-6 flex flex-col items-center justify-center overflow-y-auto">
          <div className="w-full max-w-2xl bg-white p-8 rounded-[32px] border border-[#E0E3DB] shadow-lg flex flex-col gap-6 my-auto">
             <h2 className="text-2xl font-bold text-[#191C19]">Your Day Plan</h2>
             {dayPlan.greeting && <p className="text-[#3A693A] font-medium">{dayPlan.greeting}</p>}
             
             {dayPlan.suggestedTasks && dayPlan.suggestedTasks.length > 0 && (
               <div>
                 <h3 className="text-lg font-bold text-[#424940] mb-3 border-b border-[#E0E3DB] pb-2">Suggested Tasks</h3>
                 <ul className="space-y-3">
                   {dayPlan.suggestedTasks.map((t: any, i: number) => {
                     const taskObj = tasks.find(x => x.id === t.taskId);
                     return (
                       <li key={i} className="bg-[#FBFDF8] p-4 rounded-xl border border-[#E0E3DB]">
                         <p className="font-bold text-[#101F10]">{taskObj ? taskObj.title : `Task ID: ${t.taskId}`}</p>
                         <p className="text-sm text-[#424940] mt-1">{t.reason}</p>
                       </li>
                     );
                   })}
                 </ul>
               </div>
             )}

             {dayPlan.newHabits && dayPlan.newHabits.length > 0 && (
               <div>
                 <h3 className="text-lg font-bold text-[#424940] mb-3 border-b border-[#E0E3DB] pb-2">Habits & Automation</h3>
                 <ul className="list-disc pl-5 space-y-2">
                   {dayPlan.newHabits.map((h: string, i: number) => (
                     <li key={i} className="text-[#424940]">{h}</li>
                   ))}
                 </ul>
               </div>
             )}
             
             <div className="mt-4 flex justify-end">
                <button onClick={() => setDayPlan(null)} className="px-6 py-3 rounded-full font-bold text-white bg-[#3A693A] hover:bg-[#2A4C2A] transition-colors">
                  Got it!
                </button>
             </div>
          </div>
        </div>
      )}
      
      {editingTask && (
        <div className="fixed inset-0 z-50 bg-[#F4F5F2]/95 backdrop-blur-sm p-6 flex flex-col items-center justify-center">
          <div className="w-full max-w-lg bg-white p-8 rounded-[32px] border border-[#E0E3DB] shadow-lg flex flex-col gap-6">
             <h2 className="text-2xl font-bold text-[#191C19]">Edit Task</h2>
             <input 
               type="text"
               value={editTitle}
               onChange={(e) => setEditTitle(e.target.value)}
               className="w-full p-4 rounded-xl bg-[#FBFDF8] border border-[#E0E3DB] focus:border-[#3A693A] outline-none text-[#101F10]"
               autoFocus
               onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); }}
             />
             <div className="flex gap-4 mt-2">
                <button onClick={() => setEditingTask(null)} className="px-6 py-3 rounded-full font-bold text-[#424940] bg-[#F4F5F2] hover:bg-[#E0E3DB] transition-colors">
                  Cancel
                </button>
                <button onClick={handleSaveEdit} className="flex-1 bg-[#3A693A] text-white py-3 px-6 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-[#2A4C2A] transition-colors">
                  Save Changes
                </button>
             </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div 
          className="fixed z-[100] bg-white border border-[#E0E3DB] shadow-xl rounded-xl py-2 min-w-[160px] text-sm text-[#101F10]"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 200), left: Math.min(contextMenu.x, window.innerWidth - 200) }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-2 border-b border-[#E0E3DB] mb-1">
            <span className="font-bold block truncate max-w-[200px]">{contextMenu.task.title}</span>
          </div>
          
          <button 
            className="w-full text-left px-4 py-2 hover:bg-[#F4F5F2] flex items-center gap-2 transition-colors"
            onClick={() => {
              setContextMenu(null);
              handleEditClick(contextMenu.task.id, contextMenu.task.title);
            }}
          >
            <Edit2 className="w-4 h-4" /> Edit
          </button>
          
          {contextMenu.type === 'today' ? (
            <button 
              className="w-full text-left px-4 py-2 hover:bg-[#F4F5F2] flex items-center gap-2 transition-colors"
              onClick={() => {
                setContextMenu(null);
                handlePostpone(contextMenu.task.id);
              }}
            >
              <ListTodo className="w-4 h-4" /> Defer to later
            </button>
          ) : (
            <button 
              className="w-full text-left px-4 py-2 hover:bg-[#F4F5F2] flex items-center gap-2 transition-colors"
              onClick={() => {
                setContextMenu(null);
                handleActivate(contextMenu.task.id);
              }}
            >
              <Play className="w-4 h-4" /> Move to today
            </button>
          )}

          <button 
            className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 transition-colors mt-1 border-t border-[#E0E3DB] pt-2"
            onClick={() => {
              setContextMenu(null);
              handleDelete(contextMenu.task.id);
            }}
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}

      <RemindersModal
        isOpen={showRemindersModal}
        onClose={() => setShowRemindersModal(false)}
        onRemindersChanged={fetchRemindersCount}
      />

    </div>
  );
}