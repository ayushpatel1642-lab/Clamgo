import { toast } from 'sonner';
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from './AuthProvider';
import { 
  Clock, 
  Loader2, 
  Play, 
  CheckCircle, 
  Sparkles, 
  Coffee, 
  CalendarClock, 
  ListTree, 
  ChevronDown, 
  ChevronUp, 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  RotateCcw,
  ArrowUp,
  ArrowDown,
  CalendarX,
  PlusCircle,
  Undo2,
  Info,
  X,
  Settings as SettingsIcon,
  AlertCircle
} from 'lucide-react';
import { format, addMinutes, differenceInHours, setHours } from 'date-fns';
import { Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { getStoredSettings } from '../lib/settings';

interface TaskStep {
  id: number;
  taskId: number;
  title: string;
  isCompleted: boolean;
  estimatedDuration?: number;
  orderIndex?: number;
}

interface TaskItem {
  id: number;
  title: string;
  description?: string;
  status: string;
  estimatedDuration?: number;
  steps?: TaskStep[];
}

interface ScheduleItem {
  id?: string; // unique ID for keying
  type: 'task' | 'break';
  taskId?: number;
  title?: string;
  duration: number;
}

// Client-side chronological weight for natural ordering (breakfast before lunch, dinner in evening)
function getTemporalSortWeight(title: string): number {
  const lower = title.toLowerCase();
  
  // Early Morning (weight 100 - 190)
  if (lower.includes('wake up') || lower.includes('wakeup') || lower.includes('morning routine')) return 100;
  if (lower.includes('breakfast') || lower.includes('morning coffee') || lower.includes('morning tea')) return 110;
  if (lower.includes('morning workout') || lower.includes('morning run') || lower.includes('morning walk')) return 120;
  if (lower.includes('plan day') || lower.includes('daily standup') || lower.includes('morning check')) return 130;
  
  // Midday / Lunch (weight 300 - 390)
  if (lower.includes('lunch prep') || lower.includes('make lunch')) return 290;
  if (lower.includes('lunch') || lower.includes('midday') || lower.includes('noon')) return 300;
  if (lower.includes('afternoon coffee') || lower.includes('post-lunch')) return 350;
  
  // Late Afternoon / Evening / Dinner (weight 500 - 590)
  if (lower.includes('afternoon walk') || lower.includes('afternoon tea')) return 450;
  if (lower.includes('dinner prep') || lower.includes('cook dinner') || lower.includes('make dinner')) return 490;
  if (lower.includes('dinner') || lower.includes('supper')) return 500;
  if (lower.includes('evening walk') || lower.includes('evening workout')) return 520;
  if (lower.includes('wind down') || lower.includes('night routine') || lower.includes('bedtime')) return 580;
  
  // Default standard task (weight 200 - standard work hours before lunch)
  return 200;
}

export default function VisualTimeline() {
  const { getToken, user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [availableHours, setAvailableHours] = useState<number>(4);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);

  // Set of task IDs whose sub-task blocks are currently revealed (hidden by default)
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(new Set());
  
  // Track tasks currently decomposing via AI
  const [decomposingTaskId, setDecomposingTaskId] = useState<number | null>(null);

  // New subtask input state per task
  const [newSubtaskInputs, setNewSubtaskInputs] = useState<Record<number, string>>({});
  const [addingSubtaskId, setAddingSubtaskId] = useState<number | null>(null);

  // Manual Break insertion state
  const [showAddBreakModal, setShowAddBreakModal] = useState(false);
  const [breakTitle, setBreakTitle] = useState('Recharge & Hydrate');
  const [breakDuration, setBreakDuration] = useState(15);

  const storageKey = user?.uid ? `timeline_schedule_v2_${user.uid}` : null;
  const settings = getStoredSettings();

  // Custom Time Frame States
  const [timeFrameMode, setTimeFrameMode] = useState<'now' | 'workday' | 'morning' | 'custom'>(
    settings.timelineStartMode === 'custom' ? 'custom' : 'now'
  );
  const [customStartTime, setCustomStartTime] = useState<string>(settings.customStartTime || '09:00');
  const [customEndTime, setCustomEndTime] = useState<string>(settings.customEndTime || '18:00');

  const computedStartTime = useMemo(() => {
    const d = new Date();
    if (timeFrameMode === 'now') {
      return d;
    }
    if (timeFrameMode === 'morning') {
      d.setHours(8, 0, 0, 0);
      return d;
    }
    if (timeFrameMode === 'workday') {
      d.setHours(9, 0, 0, 0);
      return d;
    }
    if (timeFrameMode === 'custom' && customStartTime) {
      const parts = customStartTime.split(':').map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        d.setHours(parts[0], parts[1], 0, 0);
        return d;
      }
    }
    return d;
  }, [timeFrameMode, customStartTime]);

  const totalScheduledMinutes = useMemo(() => {
    return schedule.reduce((acc, item) => acc + (item.duration || 0), 0);
  }, [schedule]);

  const windowMinutes = availableHours * 60;
  const isOverCapacity = totalScheduledMinutes > windowMinutes;
  const bufferMinutes = windowMinutes - totalScheduledMinutes;

  useEffect(() => {
    fetchTimeline();
    const now = new Date();
    const endOfWorkday = setHours(now, 18);
    let diff = differenceInHours(endOfWorkday, now);
    if (diff < 1) diff = 2;
    if (diff > 12) diff = 8;
    setAvailableHours(diff);
  }, []);

  const fetchTimeline = async () => {
    try {
      const token = await getToken();
      const res = await fetch('/api/tasks?status=pending', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data: TaskItem[] = await res.json();
        setTasks(data);

        // Try restoring saved schedule from localStorage
        let savedSchedule: ScheduleItem[] | null = null;
        if (storageKey) {
          try {
            const raw = localStorage.getItem(storageKey);
            if (raw) savedSchedule = JSON.parse(raw);
          } catch (err) {
            console.error("Error reading saved schedule", err);
          }
        }

        if (savedSchedule && savedSchedule.length > 0) {
          // Validate that tasks in savedSchedule still exist
          const validSchedule = savedSchedule.filter(item => {
            if (item.type === 'break') return true;
            return data.some(t => t.id === item.taskId);
          });
          setSchedule(validSchedule);
        } else {
          // Sort chronologically using natural time-of-day order (breakfast before lunch, lunch before dinner)
          const sortedData = [...data].sort((a, b) => getTemporalSortWeight(a.title) - getTemporalSortWeight(b.title));
          const initialSchedule: ScheduleItem[] = sortedData.map((t) => ({
            id: `task-${t.id}-${Date.now()}`,
            type: 'task',
            taskId: t.id,
            duration: t.estimatedDuration || 25
          }));
          setSchedule(initialSchedule);
        }
      }
    } catch (e: any) {
      console.error(e); 
      toast.error(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // Persist schedule changes
  const updateSchedule = (newSchedule: ScheduleItem[]) => {
    setSchedule(newSchedule);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newSchedule));
      } catch (e) {
        console.error("Failed to save schedule to localStorage", e);
      }
    }
  };

  // Find all pending tasks that are NOT in the active schedule (cancelled / unscheduled)
  const unscheduledTasks = useMemo(() => {
    const scheduledTaskIds = new Set(
      schedule.filter(s => s.type === 'task' && s.taskId !== undefined).map(s => s.taskId!)
    );
    return tasks.filter(t => !scheduledTaskIds.has(t.id));
  }, [tasks, schedule]);

  const toggleTaskExpand = (taskId: number) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // ==================== MANUAL REORDERING & CUSTOMIZATION ====================

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= schedule.length) return;

    const nextSchedule = [...schedule];
    const temp = nextSchedule[index];
    nextSchedule[index] = nextSchedule[targetIndex];
    nextSchedule[targetIndex] = temp;

    updateSchedule(nextSchedule);
    toast.success("Schedule reordered");
  };

  const handleAdjustDuration = (index: number, deltaMinutes: number) => {
    const nextSchedule = [...schedule];
    const item = nextSchedule[index];
    const newDuration = Math.max(5, (item.duration || 25) + deltaMinutes);
    nextSchedule[index] = { ...item, duration: newDuration };
    updateSchedule(nextSchedule);

    // If it's a task, update the estimated duration on the server as well
    if (item.type === 'task' && item.taskId) {
      getToken().then(token => {
        fetch(`/api/tasks/${item.taskId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ estimatedDuration: newDuration })
        }).catch(err => console.error("Failed to update task duration", err));
      });
    }
  };

  // Cancel / Remove task or break from today's timeline
  const handleRemoveFromSchedule = (index: number) => {
    const item = schedule[index];
    const nextSchedule = schedule.filter((_, i) => i !== index);
    updateSchedule(nextSchedule);

    if (item.type === 'task') {
      const task = tasks.find(t => t.id === item.taskId);
      toast.info(`"${task?.title || 'Task'}" removed from timeline`, {
        description: "Task is preserved in the Unscheduled shelf below. You can re-add it anytime."
      });
    } else {
      toast.info("Break removed from timeline");
    }
  };

  // Manually add an unscheduled/cancelled task into the schedule
  const handleAddBackToSchedule = (taskId: number, position: 'start' | 'end' = 'end') => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newItem: ScheduleItem = {
      id: `task-${task.id}-${Date.now()}`,
      type: 'task',
      taskId: task.id,
      duration: task.estimatedDuration || 25
    };

    const nextSchedule = position === 'start' ? [newItem, ...schedule] : [...schedule, newItem];
    updateSchedule(nextSchedule);
    toast.success(`Added "${task.title}" back to ${position === 'start' ? 'start of' : 'end of'} timeline`);
  };

  // Manually insert a custom break
  const handleAddCustomBreak = (e: React.FormEvent) => {
    e.preventDefault();
    const newBreak: ScheduleItem = {
      id: `break-${Date.now()}`,
      type: 'break',
      title: breakTitle.trim() || 'Break',
      duration: Number(breakDuration) || 15
    };
    updateSchedule([...schedule, newBreak]);
    setShowAddBreakModal(false);
    toast.success("Break inserted into timeline");
  };

  // Reset timeline to natural chronological order
  const handleResetToNaturalOrder = () => {
    const sortedData = [...tasks].sort((a, b) => getTemporalSortWeight(a.title) - getTemporalSortWeight(b.title));
    const newSchedule: ScheduleItem[] = sortedData.map((t) => ({
      id: `task-${t.id}-${Date.now()}`,
      type: 'task',
      taskId: t.id,
      duration: t.estimatedDuration || 25
    }));
    updateSchedule(newSchedule);
    setAiReasoning(null);
    toast.success("Timeline reset to chronological order");
  };

  // ==================== AI AUTO-SCHEDULE & TEMPORAL SORTING ====================

  const handleAutoSchedule = async () => {
    if (tasks.length === 0) return;
    setScheduling(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/timeline/auto-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          tasks, 
          currentTime: computedStartTime.toISOString(),
          startTime: customStartTime,
          endTime: customEndTime,
          availableHours,
          algorithmPreference: settings.schedulingAlgorithm || 'circadian'
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.schedule && Array.isArray(data.schedule)) {
          const formattedSchedule: ScheduleItem[] = data.schedule.map((item: any, idx: number) => ({
            id: `${item.type}-${item.taskId || idx}-${Date.now()}`,
            type: item.type,
            taskId: item.taskId,
            title: item.title,
            duration: item.duration || 25
          }));
          
          updateSchedule(formattedSchedule);
          if (data.reasoning) {
            setAiReasoning(data.reasoning);
          }
          toast.success("Timeline arranged chronologically by AI!");

          // Re-fetch tasks to get updated durations
          const taskRes = await fetch('/api/tasks?status=pending', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (taskRes.ok) {
            const tData = await taskRes.json();
            setTasks(tData);
          }
        }
      } else {
        throw new Error("Failed to auto-schedule");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to auto-schedule");
    } finally {
      setScheduling(false);
    }
  };

  // ==================== TASK & SUBTASK HANDLERS ====================

  const handleDecomposeInTimeline = async (taskId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDecomposingTaskId(taskId);
    try {
      const token = await getToken();
      const res = await fetch(`/api/tasks/${taskId}/decompose`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ granularity: settings.decompositionGranularity || 'micro' })
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, steps: data.steps } : t));
        setExpandedTaskIds(prev => new Set(prev).add(taskId));
        toast.success("Task broken down into sub-tasks!");
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to decompose task");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to break down task");
    } finally {
      setDecomposingTaskId(null);
    }
  };

  const handleToggleStep = async (taskId: number, stepId: number, currentCompleted: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextCompleted = !currentCompleted;
    
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        steps: (t.steps || []).map(s => s.id === stepId ? { ...s, isCompleted: nextCompleted } : s)
      };
    }));

    try {
      const token = await getToken();
      const res = await fetch(`/api/tasks/${taskId}/steps/${stepId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isCompleted: nextCompleted })
      });
      if (!res.ok) throw new Error("Failed to update step");

      const currentTask = tasks.find(t => t.id === taskId);
      if (currentTask && currentTask.steps) {
        const remainingIncomplete = currentTask.steps.filter(s => s.id !== stepId && !s.isCompleted);
        if (nextCompleted && remainingIncomplete.length === 0) {
          confetti({
            particleCount: 40,
            spread: 45,
            origin: { y: 0.7 },
            colors: ['#3A693A', '#84A98C', '#A3C9A3']
          });
          toast.success("All sub-tasks completed for this task!");
        }
      }
    } catch (err) {
      setTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          steps: (t.steps || []).map(s => s.id === stepId ? { ...s, isCompleted: currentCompleted } : s)
        };
      }));
      toast.error("Failed to update subtask");
    }
  };

  const handleAddSubtask = async (taskId: number, e: React.FormEvent) => {
    e.preventDefault();
    const title = newSubtaskInputs[taskId]?.trim();
    if (!title) return;
    setAddingSubtaskId(taskId);

    try {
      const token = await getToken();
      const res = await fetch(`/api/tasks/${taskId}/steps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, estimatedDuration: 10 })
      });
      if (res.ok) {
        const newStep: TaskStep = await res.json();
        setTasks(prev => prev.map(t => {
          if (t.id !== taskId) return t;
          return { ...t, steps: [...(t.steps || []), newStep] };
        }));
        setNewSubtaskInputs(prev => ({ ...prev, [taskId]: '' }));
        toast.success("Sub-task added");
      } else {
        throw new Error("Failed to add sub-task");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add sub-task");
    } finally {
      setAddingSubtaskId(null);
    }
  };

  const handleDeleteSubtask = async (taskId: number, stepId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = await getToken();
      const res = await fetch(`/api/tasks/${taskId}/steps/${stepId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setTasks(prev => prev.map(t => {
          if (t.id !== taskId) return t;
          return { ...t, steps: (t.steps || []).filter(s => s.id !== stepId) };
        }));
        toast.success("Sub-task removed");
      }
    } catch (err) {
      toast.error("Failed to delete sub-task");
    }
  };

  const handleMarkComplete = async (taskId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
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
        setTasks(prev => prev.filter(t => t.id !== taskId));
        const updated = schedule.filter(s => s.taskId !== taskId);
        updateSchedule(updated);
        setExpandedTaskIds(prev => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
        toast.success("Task completed!");
      }
    } catch (e: any) {
      console.error(e); 
      toast.error(e.message || "Something went wrong.");
    }
  };

  let currentTime = computedStartTime;

  return (
    <div className="p-6 md:p-12 max-w-3xl mx-auto w-full">
      {/* Header & Controls */}
      <header className="mb-6 pt-4 flex flex-col sm:flex-row sm:items-start justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold text-[#191C19]">Timeline</h1>
            <Link
              to="/settings"
              title="Configure Time Frame & AI in Settings"
              className="p-1.5 text-[#5A6354] hover:text-[#191C19] hover:bg-[#EDF1E9] rounded-xl transition-all"
            >
              <SettingsIcon className="w-4 h-4" />
            </Link>
          </div>
          <p className="text-[#424940] text-base md:text-lg">
            Smart chronological schedule with natural time-of-day awareness and full manual customization.
          </p>
          
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-[#FBFDF8] border border-[#E0E3DB] px-3 py-2 rounded-2xl">
              <CalendarClock className="w-4 h-4 text-[#3A693A]" />
              <span className="text-xs font-bold text-[#424940]">Time available today:</span>
              <select 
                value={availableHours} 
                onChange={(e) => setAvailableHours(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-[#3A693A] border-none focus:ring-0 cursor-pointer outline-none"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
                  <option key={h} value={h}>{h} hour{h > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowAddBreakModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#DDE5D9] text-[#2E472E] text-xs font-semibold rounded-2xl hover:bg-[#F6F8F4] transition-colors shadow-2xs"
            >
              <Coffee className="w-3.5 h-3.5 text-[#3A693A]" />
              <span>+ Add Break</span>
            </button>

            <button
              onClick={handleResetToNaturalOrder}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#DDE5D9] text-[#5A6354] hover:text-[#191C19] text-xs font-semibold rounded-2xl hover:bg-[#F6F8F4] transition-colors shadow-2xs"
              title="Reset order to default chronological sequence"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Reset Order</span>
            </button>
          </div>
        </div>
        
        {/* AI Chronological Auto-Schedule Action */}
        <button
          onClick={handleAutoSchedule}
          disabled={scheduling || tasks.length === 0}
          className="flex items-center justify-center gap-2 bg-[#3A693A] text-white px-5 py-3 rounded-2xl font-bold hover:bg-[#3A693A]/90 transition-all shrink-0 disabled:opacity-50 shadow-sm hover:shadow-md"
        >
          {scheduling ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Arranging with AI...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-yellow-300" />
              <span>AI Chronological Sort</span>
            </>
          )}
        </button>
      </header>

      {/* ==================== CUSTOM TIME FRAME SELECTOR & CAPACITY BAR ==================== */}
      <div className="mb-6 p-4 md:p-5 bg-[#FBFDF8] border border-[#E0E3DB] rounded-3xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#3A693A]" />
            <span className="text-xs font-bold text-[#191C19]">Schedule Time Frame Starting Point:</span>
          </div>

          {/* Mode Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#EDF1E9] p-1 rounded-xl">
            {[
              { id: 'now', label: 'Now (Live)' },
              { id: 'workday', label: 'Workday (9 AM)' },
              { id: 'morning', label: 'Morning (8 AM)' },
              { id: 'custom', label: 'Custom Time...' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTimeFrameMode(tab.id as any)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  timeFrameMode === tab.id
                    ? 'bg-white text-[#191C19] shadow-2xs'
                    : 'text-[#5A6354] hover:text-[#191C19]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Start / End Time Inputs */}
        {timeFrameMode === 'custom' && (
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-[#E0E3DB]">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-[#5A6354]">Start at:</label>
              <input
                type="time"
                value={customStartTime}
                onChange={(e) => setCustomStartTime(e.target.value)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-[#DDE5D9] bg-white text-[#191C19] outline-none focus:ring-1 focus:ring-[#3A693A]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-[#5A6354]">Wrap up by:</label>
              <input
                type="time"
                value={customEndTime}
                onChange={(e) => setCustomEndTime(e.target.value)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-[#DDE5D9] bg-white text-[#191C19] outline-none focus:ring-1 focus:ring-[#3A693A]"
              />
            </div>
            <span className="text-[11px] text-[#7A8374]">
              Timeline sequentially anchors from {format(computedStartTime, 'h:mm a')}.
            </span>
          </div>
        )}

        {/* Capacity & Workload Balance Bar */}
        <div className="pt-2 border-t border-[#E0E3DB]/80">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-[#5A6354]">
              Scheduled: <strong className="text-[#191C19]">{Math.floor(totalScheduledMinutes / 60)}h {totalScheduledMinutes % 60}m</strong> of {availableHours}h target window
            </span>
            {isOverCapacity ? (
              <span className="font-bold text-amber-700 flex items-center gap-1 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5" />
                Over capacity by {Math.abs(bufferMinutes)}m
              </span>
            ) : (
              <span className="font-semibold text-[#3A693A] text-[11px]">
                {Math.floor(bufferMinutes / 60)}h {bufferMinutes % 60}m buffer remaining
              </span>
            )}
          </div>

          <div className="w-full bg-[#E0E3DB] h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isOverCapacity ? 'bg-amber-500' : 'bg-[#3A693A]'
              }`}
              style={{ width: `${Math.min(100, (totalScheduledMinutes / windowMinutes) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* AI Reasoning Banner when available */}
      {aiReasoning && (
        <div className="mb-8 p-4 bg-[#EDF1E9] border border-[#DDE5D9] rounded-2xl flex items-start justify-between gap-3 text-xs text-[#2A4F2A]">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-[#3A693A] mt-0.5 shrink-0" />
            <div>
              <strong className="block font-bold text-[#101F10] mb-0.5">AI Temporal Sorting Logic:</strong>
              <p className="text-[#3A533A] leading-relaxed">{aiReasoning}</p>
            </div>
          </div>
          <button
            onClick={() => setAiReasoning(null)}
            className="text-[#647460] hover:text-[#101F10] p-1"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Timeline View */}
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#3A693A]" /></div>
      ) : schedule.length === 0 ? (
        <div className="text-center p-12 bg-[#FBFDF8] rounded-[32px] border border-[#E0E3DB] shadow-sm mb-10">
          <p className="text-[#424940] mb-3">Your timeline has no scheduled tasks.</p>
          {tasks.length > 0 && (
            <button
              onClick={handleResetToNaturalOrder}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#3A693A] text-white text-xs font-bold rounded-xl shadow-sm hover:bg-[#3A693A]/90"
            >
              <PlusCircle className="w-4 h-4" />
              Populate with pending tasks
            </button>
          )}
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 py-4 mb-10">
          <div className="absolute top-0 bottom-0 left-[35px] sm:left-[43px] w-0.5 bg-[#E0E3DB] rounded-full"></div>
          
          <div className="relative flex items-start gap-6 mb-8">
            <div className="w-4 h-4 rounded-full bg-[#3A693A] mt-1 shadow-[0_0_0_4px_rgba(58,105,58,0.2)] z-10 shrink-0"></div>
            <div>
              <h2 className="text-xs font-bold tracking-widest text-[#3A693A] uppercase">
                {timeFrameMode === 'now' ? 'Now' : 'Timeline Anchor'} • {format(computedStartTime, 'h:mm a')}
              </h2>
            </div>
          </div>

          <div className="space-y-6">
            {schedule.map((item, idx) => {
              const taskStart = currentTime;
              const duration = item.duration || 25;
              const taskEnd = addMinutes(taskStart, duration);
              
              currentTime = taskEnd;

              // Break card in timeline
              if (item.type === 'break') {
                return (
                  <div key={item.id || `break-${idx}`} className="relative flex items-center gap-6 group">
                    <div className="w-3 h-3 rounded-full bg-[#E0E3DB] z-10 shrink-0 ml-0.5"></div>
                    <div className="flex-1 bg-[#F9FAF8] border border-dashed border-[#DDE5D9] rounded-2xl px-4 py-3 flex items-center justify-between shadow-2xs hover:border-[#A3C9A3] transition-colors">
                      <div className="flex items-center gap-2 text-[#424940]">
                        <Coffee className="w-4 h-4 text-[#3A693A]" />
                        <span className="font-bold text-sm italic">{item.title || "Break"}</span>
                        <span className="text-xs text-[#6B7265] ml-2">
                          ({format(taskStart, 'h:mm a')} - {format(taskEnd, 'h:mm a')})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Duration adjustment */}
                        <div className="flex items-center gap-1 bg-white border border-[#E0E5DC] rounded-lg px-2 py-0.5 text-xs text-[#424940]">
                          <button
                            onClick={() => handleAdjustDuration(idx, -5)}
                            className="hover:text-[#3A693A] font-bold px-1"
                            title="Decrease 5m"
                          >
                            -
                          </button>
                          <span className="font-semibold">{duration}m</span>
                          <button
                            onClick={() => handleAdjustDuration(idx, 5)}
                            className="hover:text-[#3A693A] font-bold px-1"
                            title="Increase 5m"
                          >
                            +
                          </button>
                        </div>

                        {/* Reorder Buttons */}
                        <div className="flex items-center">
                          <button
                            disabled={idx === 0}
                            onClick={() => handleMoveItem(idx, 'up')}
                            className="p-1 text-[#8C9886] hover:text-[#3A693A] disabled:opacity-30"
                            title="Move up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={idx === schedule.length - 1}
                            onClick={() => handleMoveItem(idx, 'down')}
                            className="p-1 text-[#8C9886] hover:text-[#3A693A] disabled:opacity-30"
                            title="Move down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Remove Break */}
                        <button
                          onClick={() => handleRemoveFromSchedule(idx)}
                          className="p-1 text-[#8C9886] hover:text-red-500 transition-colors"
                          title="Remove break"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              // Task card in timeline
              const task = tasks.find(t => t.id === item.taskId);
              if (!task) return null;

              // Add 5 mins conceptual padding to currentTime after tasks
              currentTime = addMinutes(currentTime, 5);

              const steps = task.steps || [];
              const hasSteps = steps.length > 0;
              const isExpanded = expandedTaskIds.has(task.id);
              const isDecomposing = decomposingTaskId === task.id;
              const completedStepsCount = steps.filter(s => s.isCompleted).length;

              return (
                <div key={item.id || `task-${task.id}-${idx}`} className="relative flex items-start gap-6 group">
                  <div className={`w-3 h-3 rounded-full mt-2 z-10 shrink-0 transition-colors ml-0.5 ${hasSteps ? 'bg-[#3A693A]' : 'bg-[#E0E3DB] group-hover:bg-[#A3C9A3]'}`}></div>
                  
                  <div 
                    onClick={() => toggleTaskExpand(task.id)}
                    className={`flex-1 bg-[#FBFDF8] p-5 md:p-6 rounded-[28px] border transition-all cursor-pointer ${
                      isExpanded 
                        ? 'border-[#3A693A] shadow-md ring-1 ring-[#3A693A]/20' 
                        : 'border-[#E0E3DB] shadow-sm hover:border-[#A3C9A3] hover:shadow-md'
                    }`}
                  >
                    {/* Main Task Card Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                      <div className="flex-1 pr-2">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-lg text-[#101F10]">{task.title}</h3>
                          
                          {/* Hidden / Revealed Subtasks Badge */}
                          {hasSteps && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTaskExpand(task.id);
                              }}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${
                                isExpanded 
                                  ? 'bg-[#3A693A] text-white' 
                                  : 'bg-[#EDF1E9] text-[#3A693A] hover:bg-[#DDE5D9]'
                              }`}
                              title={isExpanded ? "Click to hide sub-tasks block" : "Click to reveal sub-tasks block"}
                            >
                              <ListTree className="w-3.5 h-3.5" />
                              <span>{completedStepsCount}/{steps.length} subtasks</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>

                        {/* Hint for user when hidden */}
                        {hasSteps && !isExpanded && (
                          <p className="text-xs text-[#6B7265] flex items-center gap-1">
                            <span>↳ Click to reveal breakdown block ({steps.length} sub-tasks)</span>
                          </p>
                        )}
                      </div>

                      {/* Manual Reordering & Duration Controls */}
                      <div className="flex items-center gap-2 self-start shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* Duration adjustment controls */}
                        <div className="flex items-center gap-1 bg-[#EDF1E9] border border-[#DDE5D9] px-2 py-0.5 rounded-full text-xs font-bold text-[#3A693A]">
                          <button
                            onClick={() => handleAdjustDuration(idx, -15)}
                            className="hover:text-black px-1 font-bold"
                            title="Decrease 15 mins"
                          >
                            -
                          </button>
                          <span>{duration}m</span>
                          <button
                            onClick={() => handleAdjustDuration(idx, 15)}
                            className="hover:text-black px-1 font-bold"
                            title="Increase 15 mins"
                          >
                            +
                          </button>
                        </div>

                        {/* Up / Down Move Buttons for Manual Customization */}
                        <div className="flex items-center bg-white border border-[#E0E5DC] rounded-xl p-0.5">
                          <button
                            disabled={idx === 0}
                            onClick={() => handleMoveItem(idx, 'up')}
                            className="p-1 text-[#647460] hover:text-[#3A693A] hover:bg-[#EDF1E9] rounded-lg disabled:opacity-25 transition-colors"
                            title="Move earlier in timeline"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={idx === schedule.length - 1}
                            onClick={() => handleMoveItem(idx, 'down')}
                            className="p-1 text-[#647460] hover:text-[#3A693A] hover:bg-[#EDF1E9] rounded-lg disabled:opacity-25 transition-colors"
                            title="Move later in timeline"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Cancel / Remove from Today's Schedule */}
                        <button
                          onClick={() => handleRemoveFromSchedule(idx)}
                          className="p-1.5 text-[#8C9886] hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          title="Remove from today's timeline (keeps in unscheduled list)"
                        >
                          <CalendarX className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Time range & Primary Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-2 text-sm text-[#424940] font-medium">
                        <Clock className="w-4 h-4 text-[#3A693A]" />
                        <span>{format(taskStart, 'h:mm a')} - {format(taskEnd, 'h:mm a')}</span>
                      </div>
                      
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {!hasSteps && (
                          <button
                            type="button"
                            onClick={(e) => handleDecomposeInTimeline(task.id, e)}
                            disabled={isDecomposing}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#3A693A] bg-[#EDF1E9] hover:bg-[#DDE5D9] px-2.5 py-1.5 rounded-full border border-[#DDE5D9] transition-colors disabled:opacity-50 shadow-2xs"
                            title="Break down this main task into sub-tasks with AI"
                          >
                            {isDecomposing ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Breaking down...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3" />
                                <span>Break down</span>
                              </>
                            )}
                          </button>
                        )}

                        <button 
                          onClick={(e) => handleMarkComplete(task.id, e)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-[#424940] border border-[#E0E3DB] hover:bg-[#EDF1E9] transition-colors shadow-2xs"
                        >
                          <CheckCircle className="w-4 h-4 text-[#3A693A]" />
                          Done
                        </button>
                        <Link 
                          to={`/focus-mode/${task.id}`}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-[#3A693A] hover:bg-[#3A693A]/90 transition-colors shadow-sm"
                        >
                          <Play className="w-3.5 h-3.5" fill="currentColor" />
                          Focus
                        </Link>
                      </div>
                    </div>

                    {/* REVEALED SUB-TASKS BLOCK (Reveals when clicking on main task) */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, marginTop: 0 }}
                          animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                          exit={{ opacity: 0, height: 0, marginTop: 0 }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                          onClick={(e) => e.stopPropagation()}
                          className="overflow-hidden"
                        >
                          <div className="bg-[#F6F8F4] border border-[#DDE5D9] rounded-2xl p-4 sm:p-5 shadow-inner">
                            {/* Block Header */}
                            <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-[#E0E5DC]">
                              <div className="flex items-center gap-2">
                                <ListTree className="w-4 h-4 text-[#3A693A]" />
                                <h4 className="text-xs font-bold uppercase tracking-wider text-[#2E472E]">
                                  Sub-tasks Breakdown
                                </h4>
                                <span className="text-[11px] font-semibold text-[#5A6354] bg-[#E9EFE6] px-2 py-0.5 rounded-full">
                                  {completedStepsCount} of {steps.length} completed
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => handleDecomposeInTimeline(task.id, e)}
                                  disabled={isDecomposing}
                                  className="text-[11px] font-semibold text-[#3A693A] hover:underline flex items-center gap-1 disabled:opacity-50"
                                  title="Re-generate subtasks with AI"
                                >
                                  {isDecomposing ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RotateCcw className="w-3 h-3" />
                                  )}
                                  <span className="hidden sm:inline">Regenerate</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleTaskExpand(task.id)}
                                  className="text-[11px] font-semibold text-[#5A6354] hover:text-[#101F10] bg-white border border-[#DDE5D9] px-2.5 py-0.5 rounded-lg shadow-2xs"
                                >
                                  Hide Block
                                </button>
                              </div>
                            </div>

                            {/* Progress bar */}
                            {steps.length > 0 && (
                              <div className="w-full bg-[#E5EBE0] h-1.5 rounded-full mb-4 overflow-hidden">
                                <div 
                                  className="bg-[#3A693A] h-full rounded-full transition-all duration-300"
                                  style={{ width: `${(completedStepsCount / steps.length) * 100}%` }}
                                />
                              </div>
                            )}

                            {/* Sub-tasks list */}
                            {steps.length === 0 ? (
                              <div className="text-center py-4">
                                <p className="text-xs text-[#5A6354] mb-3">No sub-tasks yet for this task.</p>
                                <button
                                  type="button"
                                  onClick={(e) => handleDecomposeInTimeline(task.id, e)}
                                  disabled={isDecomposing}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3A693A] text-white text-xs font-bold rounded-xl shadow-sm hover:bg-[#3A693A]/90 transition-colors"
                                >
                                  {isDecomposing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                  Break down now with AI
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2 mb-4">
                                {steps.map((step, sIdx) => {
                                  return (
                                    <div
                                      key={step.id || sIdx}
                                      onClick={(e) => handleToggleStep(task.id, step.id, Boolean(step.isCompleted), e)}
                                      className={`group/sub flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                                        step.isCompleted 
                                          ? 'bg-white/60 border-[#E2E8DE] opacity-75' 
                                          : 'bg-white border-[#DDE5D9] hover:border-[#B2D1B2] hover:shadow-xs'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                                        <button
                                          type="button"
                                          onClick={(e) => handleToggleStep(task.id, step.id, Boolean(step.isCompleted), e)}
                                          className="text-[#3A693A] focus:outline-none shrink-0"
                                        >
                                          {step.isCompleted ? (
                                            <CheckSquare className="w-4 h-4 fill-[#3A693A] text-white" />
                                          ) : (
                                            <Square className="w-4 h-4 text-[#8C9886] group-hover/sub:text-[#3A693A]" />
                                          )}
                                        </button>
                                        
                                        <span className={`text-sm font-medium leading-snug break-words ${
                                          step.isCompleted 
                                            ? 'line-through text-[#7A8374]' 
                                            : 'text-[#191C19]'
                                        }`}>
                                          {step.title}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                        {step.estimatedDuration && (
                                          <span className="text-[11px] font-semibold text-[#5A6354] bg-[#EDF1E9] px-2 py-0.5 rounded-md">
                                            {step.estimatedDuration}m
                                          </span>
                                        )}

                                        <button
                                          type="button"
                                          onClick={(e) => handleDeleteSubtask(task.id, step.id, e)}
                                          className="opacity-0 group-hover/sub:opacity-100 text-[#8C9886] hover:text-red-600 p-1 transition-opacity"
                                          title="Delete subtask"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Quick Add Sub-task Input */}
                            <form onSubmit={(e) => handleAddSubtask(task.id, e)} className="flex items-center gap-2 pt-1">
                              <input
                                type="text"
                                placeholder="+ Add a quick sub-task..."
                                value={newSubtaskInputs[task.id] || ''}
                                onChange={(e) => setNewSubtaskInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                                className="flex-1 text-xs bg-white border border-[#DDE5D9] rounded-xl px-3 py-2 text-[#191C19] placeholder:text-[#8C9886] focus:outline-none focus:border-[#3A693A] focus:ring-1 focus:ring-[#3A693A]"
                              />
                              <button
                                type="submit"
                                disabled={addingSubtaskId === task.id || !newSubtaskInputs[task.id]?.trim()}
                                className="bg-[#3A693A] text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-[#3A693A]/90 transition-colors disabled:opacity-40 flex items-center gap-1 shrink-0"
                              >
                                {addingSubtaskId === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                <span>Add</span>
                              </button>
                            </form>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* UNSCHEDULED / CANCELLED TASKS SHELF (Customizable manual re-arrangement) */}
      <section className="mt-12 pt-8 border-t border-[#E0E3DB]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[#191C19]">Unscheduled & Cancelled Tasks</h2>
            <span className="text-xs font-semibold bg-[#EDF1E9] text-[#3A693A] px-2.5 py-0.5 rounded-full">
              {unscheduledTasks.length} available
            </span>
          </div>
          <p className="text-xs text-[#6B7265] hidden sm:block">
            Tasks you cancelled or omitted from today can be manually added back anytime.
          </p>
        </div>

        {unscheduledTasks.length === 0 ? (
          <div className="p-6 bg-[#FBFDF8] border border-[#E0E3DB] rounded-2xl text-center text-xs text-[#6B7265]">
            All pending tasks are currently scheduled on your timeline.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {unscheduledTasks.map((t) => (
              <div 
                key={`unscheduled-${t.id}`}
                className="bg-[#FBFDF8] border border-[#E0E3DB] p-4 rounded-2xl flex flex-col justify-between gap-3 shadow-2xs hover:border-[#A3C9A3] transition-all"
              >
                <div>
                  <h4 className="font-bold text-sm text-[#101F10] mb-1">{t.title}</h4>
                  <div className="flex items-center gap-2 text-xs text-[#5A6354]">
                    <span>{t.estimatedDuration || 25} mins</span>
                    {t.steps && t.steps.length > 0 && (
                      <span>• {t.steps.length} subtasks</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[#F0F2ED]">
                  <button
                    onClick={() => handleAddBackToSchedule(t.id, 'start')}
                    className="flex-1 text-[11px] font-bold text-[#3A693A] bg-[#EDF1E9] hover:bg-[#DDE5D9] py-1.5 px-2 rounded-xl transition-colors text-center"
                  >
                    + Add to Start
                  </button>
                  <button
                    onClick={() => handleAddBackToSchedule(t.id, 'end')}
                    className="flex-1 text-[11px] font-bold text-white bg-[#3A693A] hover:bg-[#3A693A]/90 py-1.5 px-2 rounded-xl transition-colors text-center shadow-2xs"
                  >
                    + Add to End
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add Custom Break Modal */}
      <AnimatePresence>
        {showAddBreakModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-xl border border-[#DDE5D9]"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[#191C19] flex items-center gap-2">
                  <Coffee className="w-5 h-5 text-[#3A693A]" />
                  Add Custom Break
                </h3>
                <button 
                  onClick={() => setShowAddBreakModal(false)}
                  className="text-[#8C9886] hover:text-[#191C19]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddCustomBreak} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#424940] mb-1.5">Break Title</label>
                  <input
                    type="text"
                    value={breakTitle}
                    onChange={(e) => setBreakTitle(e.target.value)}
                    placeholder="e.g. Lunch Break, Walk & Coffee"
                    required
                    className="w-full text-sm bg-[#F6F8F4] border border-[#DDE5D9] rounded-xl px-3 py-2 text-[#191C19] focus:outline-none focus:border-[#3A693A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#424940] mb-1.5">Duration</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 15, 30, 45].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setBreakDuration(d)}
                        className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                          breakDuration === d
                            ? 'bg-[#3A693A] text-white border-[#3A693A]'
                            : 'bg-[#F6F8F4] text-[#424940] border-[#DDE5D9] hover:bg-[#EDF1E9]'
                        }`}
                      >
                        {d}m
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddBreakModal(false)}
                    className="flex-1 py-2.5 border border-[#DDE5D9] rounded-xl text-xs font-bold text-[#5A6354] hover:bg-[#F6F8F4]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#3A693A] text-white rounded-xl text-xs font-bold hover:bg-[#3A693A]/90 shadow-sm"
                  >
                    Insert Break
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
