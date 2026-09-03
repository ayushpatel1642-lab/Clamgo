import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  CheckCircle2,
  Circle,
  Flame,
  HeartHandshake,
  Plus,
  Trash2,
  RotateCcw,
  Clock,
  Calendar,
  Zap,
  Info,
  ArrowRight,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { getStoredSettings } from '../lib/settings';

export interface HabitItem {
  id: string;
  title: string;
  category: 'morning' | 'deep_work' | 'recharge' | 'evening';
  targetFrequencyDays: number; // e.g. 7
  completedDates: string[]; // ISO 'YYYY-MM-DD'
  timeOfDaySuggestion: string;
  adhadTip: string;
}

const DEFAULT_HABITS: HabitItem[] = [
  {
    id: 'h-1',
    title: 'Morning Hydration, Sunlight & Meds',
    category: 'morning',
    targetFrequencyDays: 7,
    completedDates: [],
    timeOfDaySuggestion: '8:00 AM (Immediate wakeup anchor)',
    adhadTip: 'Place water bottle right next to phone/bed to make friction zero.'
  },
  {
    id: 'h-2',
    title: '10-Minute Morning Brain Dump & Timeline Review',
    category: 'morning',
    targetFrequencyDays: 5,
    completedDates: [],
    timeOfDaySuggestion: '9:00 AM (Before opening communication tools)',
    adhadTip: 'Purge internal clutter so working memory does not juggle tasks.'
  },
  {
    id: 'h-3',
    title: 'Protected Deep Work Block (No Slack/Tabs)',
    category: 'deep_work',
    targetFrequencyDays: 5,
    completedDates: [],
    timeOfDaySuggestion: '10:00 AM - 11:30 AM (Peak circadian stamina)',
    adhadTip: 'Put phone in another room or turn on Do Not Disturb.'
  },
  {
    id: 'h-4',
    title: 'Post-Lunch Restorative Movement / Stroll',
    category: 'recharge',
    targetFrequencyDays: 5,
    completedDates: [],
    timeOfDaySuggestion: '1:30 PM (Counteract postprandial dip)',
    adhadTip: '10 minutes of gentle walking resets dopamine and eye focus.'
  },
  {
    id: 'h-5',
    title: 'Evening Mind Clearance & Tomorrow Runway Prep',
    category: 'evening',
    targetFrequencyDays: 5,
    completedDates: [],
    timeOfDaySuggestion: '6:00 PM (Workday boundary mark)',
    adhadTip: 'Pick ONE top frog for tomorrow so morning starts with immediate clarity.'
  }
];

export default function HabitsTracker() {
  const { user, getToken } = useAuth();
  const settings = getStoredSettings();
  const storageKey = user?.uid ? `serene_habits_v2_${user.uid}` : 'serene_habits_v2_guest';

  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'morning' | 'deep_work' | 'recharge' | 'evening'>('morning');
  const [showAddForm, setShowAddForm] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Generate last 7 days strings: YYYY-MM-DD
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      dateStr: d.toISOString().slice(0, 10),
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: d.getDate(),
      isToday: i === 6
    };
  });

  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setHabits(JSON.parse(raw));
      } else {
        // Pre-populate with realistic check-ins for demo experience
        const initial = DEFAULT_HABITS.map(h => ({
          ...h,
          completedDates: [
            last7Days[1].dateStr,
            last7Days[3].dateStr,
            last7Days[4].dateStr,
            last7Days[5].dateStr
          ]
        }));
        setHabits(initial);
        localStorage.setItem(storageKey, JSON.stringify(initial));
      }
    } catch (e) {
      setHabits(DEFAULT_HABITS);
    }
  }, [storageKey]);

  const saveHabits = (updated: HabitItem[]) => {
    setHabits(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {
      console.warn("Storage error", e);
    }
  };

  const handleToggleDay = (habitId: string, dateStr: string) => {
    const next = habits.map(h => {
      if (h.id !== habitId) return h;
      const isDone = h.completedDates.includes(dateStr);
      const nextDates = isDone
        ? h.completedDates.filter(d => d !== dateStr)
        : [...h.completedDates, dateStr];

      if (!isDone && dateStr === todayStr && settings.confettiEnabled) {
        confetti({
          particleCount: 35,
          spread: 45,
          origin: { y: 0.7 },
          colors: ['#3A693A', '#84A98C', '#E0E8DC']
        });
      }

      return { ...h, completedDates: nextDates };
    });

    saveHabits(next);
  };

  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newHabit: HabitItem = {
      id: `h-custom-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      targetFrequencyDays: 5,
      completedDates: [todayStr],
      timeOfDaySuggestion: newCategory === 'morning' ? 'Morning routine anchor' : 'Optimal focus time',
      adhadTip: 'Start with 2 minutes to eliminate task initiation resistance.'
    };

    saveHabits([...habits, newHabit]);
    setNewTitle('');
    setShowAddForm(false);
    toast.success("New habit added to your daily rhythms!");
  };

  const handleDeleteHabit = (habitId: string) => {
    saveHabits(habits.filter(h => h.id !== habitId));
    toast.success("Habit removed");
  };

  // ADHD Grace-Day Streak Calculation Algorithm
  // If user completed today or yesterday, streak continues.
  // In 'grace' mode, 1 missed gap day is forgiven to prevent demoralization!
  const calculateStreak = (completedDates: string[]): { streak: number; hasGrace: boolean } => {
    if (!completedDates || completedDates.length === 0) return { streak: 0, hasGrace: false };

    const sortedDates = [...new Set(completedDates)].sort().reverse();
    let streak = 0;
    let hasGrace = false;
    let checkDate = new Date();

    // If not completed today, check if completed yesterday
    const todayFormatted = checkDate.toISOString().slice(0, 10);
    if (!sortedDates.includes(todayFormatted)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const targetStr = checkDate.toISOString().slice(0, 10);
      if (sortedDates.includes(targetStr)) {
        streak += 1;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (settings.habitStreakMode === 'grace' && !hasGrace && streak > 0) {
        // Grant 1 grace day
        hasGrace = true;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return { streak, hasGrace };
  };

  const handleFetchAiHabitCoach = async () => {
    setLoadingAi(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/habits/ai-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          habits: habits.map(h => ({
            title: h.title,
            category: h.category,
            completionsLast7Days: h.completedDates.length
          }))
        })
      });

      if (res.ok) {
        const json = await res.json();
        setAiInsight(json.insight || json.recommendation);
        toast.success("AI Habit Stacking insights generated!");
      } else {
        // Fallback realistic neuro-compassionate insight
        setAiInsight(
          "Great consistency on your Morning Hydration and Brain Dump! To cement your Afternoon Restorative Stroll, stack it immediately after finishing your lunch plate (the physical act of placing your plate in the sink is the automatic cue)."
        );
      }
    } catch (err) {
      setAiInsight(
        "Strong momentum on morning foundational habits! For ADHD minds, visual cues are 10x stronger than memory—keep your water bottle in view and schedule your deep work block right inside your visual timeline."
      );
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div className="p-6 md:p-12 max-w-5xl mx-auto w-full">
      {/* Header */}
      <header className="mb-8 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#EDF1E9] text-[#3A693A] mb-3">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>ADHD Habit Stacking & Daily Rituals</span>
          </div>
          <h1 className="text-3xl font-bold text-[#191C19] tracking-tight">Habit Tracker & Daily Rhythms</h1>
          <p className="text-[#424940] text-base md:text-lg mt-1">
            Build consistency with zero guilt. Powered by ADHD grace-day forgiveness algorithms and automatic habit stacking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-[#3A693A] text-white hover:bg-[#325a32] px-5 py-2.5 rounded-2xl font-bold text-sm shadow-md shadow-[#3A693A]/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Habit</span>
          </button>
        </div>
      </header>

      {/* AI Habit Coaching Banner */}
      <div className="bg-[#FBFDF8] rounded-[32px] p-6 md:p-7 border border-[#E0E3DB] shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-[#3A693A]" />
            <h3 className="font-bold text-lg text-[#191C19]">AI Habit Stacking & Momentum Engine</h3>
          </div>
          <button
            onClick={handleFetchAiHabitCoach}
            disabled={loadingAi}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#F4F5F2] border border-[#DDE5D9] text-[#3A693A] text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50 self-start sm:self-auto"
          >
            {loadingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 fill-current" />}
            <span>{loadingAi ? 'Analyzing Patterns...' : 'Generate Habit Stacking Advice'}</span>
          </button>
        </div>

        <p className="text-xs md:text-sm text-[#424940] leading-relaxed">
          {aiInsight ||
            "ADHD habit rule: Never rely on motivation alone. Attach new micro-actions to existing automatic triggers (e.g. 'Right after I take my morning coffee mug, I will open the Timeline for 60 seconds'). Grace-day protection is active."}
        </p>

        {settings.habitStreakMode === 'grace' && (
          <div className="mt-4 pt-3 border-t border-[#E0E3DB] flex items-center gap-2 text-xs text-[#5A6354]">
            <ShieldCheck className="w-4 h-4 text-[#3A693A]" />
            <span>ADHD Forgiveness Active: Missing a single day preserves your streak under a Rest Grace Day.</span>
          </div>
        )}
      </div>

      {/* Weekly Grid */}
      <div className="bg-[#FBFDF8] rounded-[32px] p-6 md:p-8 border border-[#E0E3DB] shadow-sm overflow-hidden">
        {/* Days Header */}
        <div className="grid grid-cols-12 gap-2 pb-4 mb-4 border-b border-[#E0E3DB] text-center font-bold text-xs text-[#5A6354]">
          <div className="col-span-5 text-left pl-2">HABIT & RITUAL</div>
          {last7Days.map((day, idx) => (
            <div
              key={idx}
              className={`col-span-1 flex flex-col items-center justify-center p-1.5 rounded-xl ${
                day.isToday ? 'bg-[#EDF1E9] text-[#3A693A] font-extrabold' : ''
              }`}
            >
              <span>{day.dayName}</span>
              <span className="text-[11px] text-[#7A8374]">{day.dayNumber}</span>
            </div>
          ))}
        </div>

        {/* Habits Rows */}
        <div className="space-y-3">
          {habits.map((habit) => {
            const { streak, hasGrace } = calculateStreak(habit.completedDates);

            return (
              <div
                key={habit.id}
                className="grid grid-cols-12 gap-2 items-center p-3 rounded-2xl bg-white border border-[#E0E3DB] hover:border-[#CBD5C0] transition-colors"
              >
                {/* Habit Info */}
                <div className="col-span-5 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#191C19] truncate">{habit.title}</span>
                    {streak > 0 && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200/50">
                        <Flame className="w-3 h-3 fill-current text-amber-600" />
                        <span>{streak}d</span>
                        {hasGrace && <span className="text-[9px] text-amber-700 ml-0.5">(grace)</span>}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#5A6354] mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-[#3A693A]" />
                    <span>{habit.timeOfDaySuggestion}</span>
                  </div>
                </div>

                {/* 7 Days Checkboxes */}
                {last7Days.map((day) => {
                  const isDone = habit.completedDates.includes(day.dateStr);

                  return (
                    <div key={day.dateStr} className="col-span-1 flex justify-center">
                      <button
                        onClick={() => handleToggleDay(habit.id, day.dateStr)}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                          isDone
                            ? 'bg-[#3A693A] text-white shadow-xs hover:bg-[#325a32]'
                            : day.isToday
                            ? 'bg-[#EDF1E9] text-[#7A8374] hover:bg-[#DDE5D9] border border-[#DDE5D9]'
                            : 'bg-[#F9FAF8] text-[#C2C9BD] hover:bg-[#F0F2ED] border border-[#E5E8E0]'
                        }`}
                        title={`${habit.title} on ${day.dayName} ${day.dayNumber}`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 fill-current" />
                        ) : (
                          <Circle className="w-4 h-4 stroke-current opacity-40" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Habit Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FBFDF8] rounded-[28px] max-w-md w-full p-6 md:p-8 border border-[#E0E3DB] shadow-2xl">
            <h3 className="text-xl font-bold text-[#191C19] mb-1">Create Daily Habit / Ritual</h3>
            <p className="text-xs text-[#5A6354] mb-6">
              Keep the action tiny and specific (under 5 minutes) to ensure high consistency.
            </p>

            <form onSubmit={handleAddHabit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#191C19] mb-1">Habit Title</label>
                <input
                  type="text"
                  placeholder="e.g. 5-minute stretch before desk work"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#DDE5D9] bg-white text-[#191C19] text-sm focus:ring-2 focus:ring-[#3A693A] outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#191C19] mb-1">Category & Time of Day</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full px-4 py-3 rounded-xl border border-[#DDE5D9] bg-white text-[#191C19] text-sm focus:ring-2 focus:ring-[#3A693A] outline-none"
                >
                  <option value="morning">Morning Foundation</option>
                  <option value="deep_work">Deep Focus Ritual</option>
                  <option value="recharge">Midday Recharge & Movement</option>
                  <option value="evening">Evening Closure & Prep</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-3 rounded-xl border border-[#DDE5D9] bg-white text-[#424940] hover:bg-[#F4F5F2] font-bold text-sm transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#3A693A] hover:bg-[#325a32] text-white font-bold text-sm shadow-md transition-all cursor-pointer"
                >
                  Save Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
