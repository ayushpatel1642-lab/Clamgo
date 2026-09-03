import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  LogOut,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Play,
  Download,
  Trash2,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Sliders,
  Bell,
  HeartHandshake,
  Calendar,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { getStoredSettings, saveStoredSettings, UserSettings } from '../lib/settings';
import { playTimerSound, ChimeType } from '../lib/audio';

export default function Settings() {
  const { user, signOut, signIn, getToken } = useAuth();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<UserSettings>(getStoredSettings());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'timeframe' | 'ai' | 'sensory' | 'data'>('profile');

  useEffect(() => {
    setSettings(getStoredSettings());
  }, []);

  const handleUpdate = (patch: Partial<UserSettings>) => {
    const updated = saveStoredSettings(patch);
    setSettings(updated);
    toast.success("Preferences updated", { duration: 1500 });
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Successfully logged out. Take care!");
      navigate('/');
    } catch (e: any) {
      toast.error(e.message || "Failed to log out");
    }
  };

  const handleTestAudio = () => {
    playTimerSound(settings.soundChime, settings.soundVolume);
    toast.success(`Playing preview: ${settings.soundChime} chime`);
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const token = await getToken();
      const [tasksRes, sessionsRes, memoryRes] = await Promise.all([
        fetch('/api/tasks', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/insights', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/memory-dock', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const tasksData = tasksRes.ok ? await tasksRes.json() : [];
      const insightsData = sessionsRes.ok ? await sessionsRes.json() : null;
      const memoryData = memoryRes.ok ? await memoryRes.json() : [];

      const exportBundle = {
        exportedAt: new Date().toISOString(),
        user: {
          uid: user?.uid,
          email: user?.email,
          displayName: user?.displayName
        },
        settings,
        tasks: tasksData,
        insightsMetrics: insightsData?.metrics || null,
        memoryDock: memoryData
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportBundle, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `serene_focus_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      toast.success("Data export downloaded successfully!");
    } catch (err) {
      console.error("Export error", err);
      toast.error("Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  const handleResetTimelineCache = () => {
    if (user?.uid) {
      try {
        localStorage.removeItem(`timeline_schedule_v2_${user.uid}`);
        toast.success("Timeline schedule cache cleared. Timeline will regenerate on next visit.");
      } catch (e) {
        toast.error("Could not clear cache");
      }
    }
  };

  const isGuest = user?.uid === 'demo-guest-user' || user?.email === 'guest@serenefocus.app';

  return (
    <div className="p-6 md:p-12 max-w-4xl mx-auto w-full">
      {/* Header */}
      <header className="mb-8 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#EDF1E9] text-[#3A693A] mb-3">
          <Sliders className="w-3.5 h-3.5" />
          <span>App Preferences & Controls</span>
        </div>
        <h1 className="text-3xl font-bold text-[#191C19] tracking-tight">Settings</h1>
        <p className="text-[#424940] text-base md:text-lg mt-1">
          Configure your daily time frame, AI executive-function algorithms, sensory feedback, and account options.
        </p>
      </header>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-8 border-b border-[#E0E3DB] scrollbar-none">
        {[
          { id: 'profile', label: 'Account & Profile', icon: User },
          { id: 'timeframe', label: 'Time Frame & Schedule', icon: Clock },
          { id: 'ai', label: 'AI Algorithms & Logic', icon: Sparkles },
          { id: 'sensory', label: 'Sensory & Sounds', icon: Volume2 },
          { id: 'data', label: 'Data & Privacy', icon: ShieldCheck }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#3A693A] text-white shadow-sm'
                  : 'bg-white text-[#424940] hover:bg-[#F4F5F2] hover:text-[#191C19] border border-[#E0E3DB]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-8">
        {/* ==================== 1. ACCOUNT & PROFILE ==================== */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-[#FBFDF8] rounded-[32px] p-6 md:p-8 border border-[#E0E3DB] shadow-sm">
              <h2 className="text-xl font-bold text-[#191C19] mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-[#3A693A]" />
                <span>User Account</span>
              </h2>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 rounded-2xl bg-white border border-[#E0E3DB]">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#EDF1E9] text-[#3A693A] font-extrabold text-2xl flex items-center justify-center border border-[#DDE5D9] shrink-0">
                    {user?.displayName ? user.displayName.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || 'U')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg text-[#191C19]">
                        {user?.displayName || 'Serene Focus User'}
                      </h3>
                      {isGuest ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                          Guest Demo
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EDF1E9] text-[#3A693A] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Signed In
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#5A6354] mt-0.5">{user?.email || 'guest@serenefocus.app'}</p>
                    <p className="text-xs text-[#7A8374] mt-1 font-mono">UID: {user?.uid || 'anonymous'}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  {isGuest && (
                    <button
                      onClick={signIn}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#3A693A] text-white rounded-xl font-bold text-sm shadow-sm hover:bg-[#325a32] transition-all cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Upgrade to Google Account</span>
                    </button>
                  )}

                  {/* Log Out Button */}
                  <button
                    onClick={() => setShowLogoutConfirm(true)}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-xl font-bold text-sm transition-all cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>

              {/* Quick Navigation Links */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Link
                  to="/timeline"
                  className="p-4 rounded-2xl bg-[#F4F5F2] hover:bg-[#EDF1E9] border border-[#E0E3DB] flex items-center justify-between text-xs font-bold text-[#191C19] transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#3A693A]" /> Visual Timeline
                  </span>
                  <span>&rarr;</span>
                </Link>
                <Link
                  to="/insights"
                  className="p-4 rounded-2xl bg-[#F4F5F2] hover:bg-[#EDF1E9] border border-[#E0E3DB] flex items-center justify-between text-xs font-bold text-[#191C19] transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#3A693A]" /> Deep Work Insights
                  </span>
                  <span>&rarr;</span>
                </Link>
                <Link
                  to="/habits"
                  className="p-4 rounded-2xl bg-[#F4F5F2] hover:bg-[#EDF1E9] border border-[#E0E3DB] flex items-center justify-between text-xs font-bold text-[#191C19] transition-all"
                >
                  <span className="flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-[#3A693A]" /> Habit Tracker
                  </span>
                  <span>&rarr;</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 2. TIME FRAME & SCHEDULE ==================== */}
        {activeTab === 'timeframe' && (
          <div className="space-y-6">
            <div className="bg-[#FBFDF8] rounded-[32px] p-6 md:p-8 border border-[#E0E3DB] shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-[#3A693A]" />
                <h2 className="text-xl font-bold text-[#191C19]">Custom Time Frame & Daily Hours</h2>
              </div>
              <p className="text-xs md:text-sm text-[#5A6354] mb-6">
                Define the boundaries of your active workday. Timeline blocks and AI scheduling adapt directly to these hours.
              </p>

              <div className="space-y-6">
                {/* Timeline Anchor Mode */}
                <div className="p-5 rounded-2xl bg-white border border-[#E0E3DB]">
                  <label className="block text-sm font-bold text-[#191C19] mb-1">
                    Timeline Schedule Starting Point
                  </label>
                  <p className="text-xs text-[#5A6354] mb-3">
                    Choose whether today's timeline anchors to the current real-world time or begins at your designated workday start hour.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleUpdate({ timelineStartMode: 'dynamic' })}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        settings.timelineStartMode === 'dynamic'
                          ? 'border-[#3A693A] bg-[#EDF1E9] text-[#191C19] font-bold shadow-2xs'
                          : 'border-[#E0E3DB] bg-white text-[#424940] hover:bg-[#F9FAF8]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold">Dynamic (Live Current Time)</span>
                        {settings.timelineStartMode === 'dynamic' && <CheckCircle2 className="w-4 h-4 text-[#3A693A]" />}
                      </div>
                      <span className="text-xs text-[#5A6354]">
                        Schedule flows dynamically from right now onwards.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdate({ timelineStartMode: 'custom' })}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        settings.timelineStartMode === 'custom'
                          ? 'border-[#3A693A] bg-[#EDF1E9] text-[#191C19] font-bold shadow-2xs'
                          : 'border-[#E0E3DB] bg-white text-[#424940] hover:bg-[#F9FAF8]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold">Fixed Daily Schedule</span>
                        {settings.timelineStartMode === 'custom' && <CheckCircle2 className="w-4 h-4 text-[#3A693A]" />}
                      </div>
                      <span className="text-xs text-[#5A6354]">
                        Anchored to your custom workday start time ({settings.customStartTime}).
                      </span>
                    </button>
                  </div>
                </div>

                {/* Day Frame Hours (Start & End) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-white border border-[#E0E3DB]">
                    <label className="block text-sm font-bold text-[#191C19] mb-1">
                      Workday Start Time
                    </label>
                    <p className="text-xs text-[#5A6354] mb-3">When your productive window opens.</p>
                    <input
                      type="time"
                      value={settings.customStartTime}
                      onChange={(e) => handleUpdate({ customStartTime: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-[#DDE5D9] bg-[#FBFDF8] text-[#191C19] font-bold text-base focus:ring-2 focus:ring-[#3A693A] outline-none"
                    />
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-[#E0E3DB]">
                    <label className="block text-sm font-bold text-[#191C19] mb-1">
                      Workday Wrap-Up Time
                    </label>
                    <p className="text-xs text-[#5A6354] mb-3">When your active day concludes.</p>
                    <input
                      type="time"
                      value={settings.customEndTime}
                      onChange={(e) => handleUpdate({ customEndTime: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-[#DDE5D9] bg-[#FBFDF8] text-[#191C19] font-bold text-base focus:ring-2 focus:ring-[#3A693A] outline-none"
                    />
                  </div>
                </div>

                {/* Focus Block & Break Durations */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-white border border-[#E0E3DB]">
                    <label className="block text-sm font-bold text-[#191C19] mb-1">
                      Default Focus Session
                    </label>
                    <p className="text-xs text-[#5A6354] mb-3">Target uninterrupted focus block length.</p>
                    <select
                      value={settings.defaultFocusDuration}
                      onChange={(e) => handleUpdate({ defaultFocusDuration: Number(e.target.value) })}
                      className="w-full px-4 py-3 rounded-xl border border-[#DDE5D9] bg-[#FBFDF8] text-[#191C19] font-bold text-sm focus:ring-2 focus:ring-[#3A693A] outline-none cursor-pointer"
                    >
                      <option value={15}>15 minutes (Gentle / Low Friction)</option>
                      <option value={25}>25 minutes (Classic Pomodoro)</option>
                      <option value={45}>45 minutes (Optimal Deep Work)</option>
                      <option value={60}>60 minutes (Deep Engineering / Flow)</option>
                    </select>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-[#E0E3DB]">
                    <label className="block text-sm font-bold text-[#191C19] mb-1">
                      Default Break Duration
                    </label>
                    <p className="text-xs text-[#5A6354] mb-3">Restorative pause inserted between blocks.</p>
                    <select
                      value={settings.defaultBreakDuration}
                      onChange={(e) => handleUpdate({ defaultBreakDuration: Number(e.target.value) })}
                      className="w-full px-4 py-3 rounded-xl border border-[#DDE5D9] bg-[#FBFDF8] text-[#191C19] font-bold text-sm focus:ring-2 focus:ring-[#3A693A] outline-none cursor-pointer"
                    >
                      <option value={5}>5 minutes (Micro Hydration Reset)</option>
                      <option value={10}>10 minutes (Stretch & Breathe)</option>
                      <option value={15}>15 minutes (Full Stroll & Snack)</option>
                      <option value={30}>30 minutes (Meal / Exercise Break)</option>
                    </select>
                  </div>
                </div>

                {/* Target Daily Focus Goal */}
                <div className="p-5 rounded-2xl bg-white border border-[#E0E3DB]">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-[#191C19]">
                      Daily Deep Work Target: <span className="text-[#3A693A]">{settings.targetDailyFocusHours} Hours</span>
                    </label>
                    <span className="text-xs text-[#5A6354]">ADHD realistic target</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={settings.targetDailyFocusHours}
                    onChange={(e) => handleUpdate({ targetDailyFocusHours: Number(e.target.value) })}
                    className="w-full accent-[#3A693A] cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-[#7A8374] mt-1">
                    <span>1 Hour (Gentle)</span>
                    <span>4 Hours (Standard Peak)</span>
                    <span>8+ Hours (Heavy)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 3. AI ALGORITHMS & LOGIC ==================== */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <div className="bg-[#FBFDF8] rounded-[32px] p-6 md:p-8 border border-[#E0E3DB] shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-[#3A693A]" />
                <h2 className="text-xl font-bold text-[#191C19]">AI Executive-Function Algorithms</h2>
              </div>
              <p className="text-xs md:text-sm text-[#5A6354] mb-6">
                Fine-tune the intelligence logic used across Task Breakdown, Chronological Timeline Scheduling, and Habit Stacking. Powered by Gemini.
              </p>

              <div className="space-y-6">
                {/* Decomposition Granularity */}
                <div className="p-5 rounded-2xl bg-white border border-[#E0E3DB]">
                  <label className="block text-sm font-bold text-[#191C19] mb-1">
                    Task Decomposition Algorithm ("Break Down Everything")
                  </label>
                  <p className="text-xs text-[#5A6354] mb-3">
                    Controls how aggressively the AI dismantles overwhelming tasks into actionable sub-steps.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      {
                        id: 'micro',
                        title: 'ADHD Micro-Friction Reducer',
                        desc: 'Creates a 2-minute friction killer step first to overcome initiation freeze, followed by 3-5 bite-sized actions.'
                      },
                      {
                        id: 'balanced',
                        title: 'Balanced Executive Chunks',
                        desc: 'Standard 15-25 minute work chunks with clear verb-first outcomes and definition-of-done criteria.'
                      },
                      {
                        id: 'deep',
                        title: 'Deep Flow Milestones',
                        desc: '30-45 minute comprehensive milestones suited for complex engineering, research, or writing.'
                      }
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleUpdate({ decompositionGranularity: item.id as any })}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          settings.decompositionGranularity === item.id
                            ? 'border-[#3A693A] bg-[#EDF1E9] text-[#191C19] font-bold shadow-2xs'
                            : 'border-[#E0E3DB] bg-white text-[#424940] hover:bg-[#F9FAF8]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold">{item.title}</span>
                          {settings.decompositionGranularity === item.id && (
                            <CheckCircle2 className="w-4 h-4 text-[#3A693A] shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-[#5A6354] leading-relaxed">{item.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scheduling Algorithm */}
                <div className="p-5 rounded-2xl bg-white border border-[#E0E3DB]">
                  <label className="block text-sm font-bold text-[#191C19] mb-1">
                    Timeline AI Scheduling Logic
                  </label>
                  <p className="text-xs text-[#5A6354] mb-3">
                    Governs how the AI auto-arranges your day when clicking "AI Chronological Sort".
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleUpdate({ schedulingAlgorithm: 'circadian' })}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        settings.schedulingAlgorithm === 'circadian'
                          ? 'border-[#3A693A] bg-[#EDF1E9] text-[#191C19] font-bold shadow-2xs'
                          : 'border-[#E0E3DB] bg-white text-[#424940] hover:bg-[#F9FAF8]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold">Circadian Chronobiology (Recommended)</span>
                        {settings.schedulingAlgorithm === 'circadian' && (
                          <CheckCircle2 className="w-4 h-4 text-[#3A693A]" />
                        )}
                      </div>
                      <span className="text-xs text-[#5A6354]">
                        Places high-cognitive deep work during morning peak stamina, aligns meal times, and reserves post-lunch dips for admin.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdate({ schedulingAlgorithm: 'momentum' })}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        settings.schedulingAlgorithm === 'momentum'
                          ? 'border-[#3A693A] bg-[#EDF1E9] text-[#191C19] font-bold shadow-2xs'
                          : 'border-[#E0E3DB] bg-white text-[#424940] hover:bg-[#F9FAF8]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold">Quick Momentum & Low Friction</span>
                        {settings.schedulingAlgorithm === 'momentum' && (
                          <CheckCircle2 className="w-4 h-4 text-[#3A693A]" />
                        )}
                      </div>
                      <span className="text-xs text-[#5A6354]">
                        Schedules fastest, easiest tasks first to trigger dopamine and build psychological momentum before demanding work.
                      </span>
                    </button>
                  </div>
                </div>

                {/* Habit Tracker Streak Logic */}
                <div className="p-5 rounded-2xl bg-white border border-[#E0E3DB]">
                  <label className="block text-sm font-bold text-[#191C19] mb-1">
                    Habit Streak & Consistency Engine
                  </label>
                  <p className="text-xs text-[#5A6354] mb-3">
                    Controls how habit streaks respond to an occasional missed day.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleUpdate({ habitStreakMode: 'grace' })}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        settings.habitStreakMode === 'grace'
                          ? 'border-[#3A693A] bg-[#EDF1E9] text-[#191C19] font-bold shadow-2xs'
                          : 'border-[#E0E3DB] bg-white text-[#424940] hover:bg-[#F9FAF8]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold">ADHD Forgiveness Grace-Day (Recommended)</span>
                        {settings.habitStreakMode === 'grace' && (
                          <CheckCircle2 className="w-4 h-4 text-[#3A693A]" />
                        )}
                      </div>
                      <span className="text-xs text-[#5A6354]">
                        Missing 1 day grants a "Rest & Recovery Grace Day" without destroying streak morale.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdate({ habitStreakMode: 'strict' })}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        settings.habitStreakMode === 'strict'
                          ? 'border-[#3A693A] bg-[#EDF1E9] text-[#191C19] font-bold shadow-2xs'
                          : 'border-[#E0E3DB] bg-white text-[#424940] hover:bg-[#F9FAF8]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold">Strict Consecutive Streak</span>
                        {settings.habitStreakMode === 'strict' && (
                          <CheckCircle2 className="w-4 h-4 text-[#3A693A]" />
                        )}
                      </div>
                      <span className="text-xs text-[#5A6354]">
                        Traditional streak reset to zero if any calendar day is skipped.
                      </span>
                    </button>
                  </div>
                </div>

                {/* AI Coach Persona */}
                <div className="p-5 rounded-2xl bg-white border border-[#E0E3DB]">
                  <label className="block text-sm font-bold text-[#191C19] mb-1">
                    AI Coach Communication Tone
                  </label>
                  <p className="text-xs text-[#5A6354] mb-3">
                    Style of conversational guidance and encouragement.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleUpdate({ coachingStyle: 'gentle' })}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        settings.coachingStyle === 'gentle'
                          ? 'border-[#3A693A] bg-[#EDF1E9] text-[#191C19] font-bold shadow-2xs'
                          : 'border-[#E0E3DB] bg-white text-[#424940] hover:bg-[#F9FAF8]'
                      }`}
                    >
                      <span className="text-sm font-bold block mb-1">Gentle & Neuro-Compassionate</span>
                      <span className="text-xs text-[#5A6354]">
                        Warm, shame-free validation that protects emotional regulation.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdate({ coachingStyle: 'direct' })}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        settings.coachingStyle === 'direct'
                          ? 'border-[#3A693A] bg-[#EDF1E9] text-[#191C19] font-bold shadow-2xs'
                          : 'border-[#E0E3DB] bg-white text-[#424940] hover:bg-[#F9FAF8]'
                      }`}
                    >
                      <span className="text-sm font-bold block mb-1">Decisive & Action-Oriented</span>
                      <span className="text-xs text-[#5A6354]">
                        Direct, concise bullet points prioritizing immediate physical execution.
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 4. SENSORY & AUDIO ==================== */}
        {activeTab === 'sensory' && (
          <div className="space-y-6">
            <div className="bg-[#FBFDF8] rounded-[32px] p-6 md:p-8 border border-[#E0E3DB] shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="w-5 h-5 text-[#3A693A]" />
                <h2 className="text-xl font-bold text-[#191C19]">Sensory & Focus Audio</h2>
              </div>
              <p className="text-xs md:text-sm text-[#5A6354] mb-6">
                Gentle, non-startling auditory and visual feedback designed for neurodivergent focus environments.
              </p>

              <div className="space-y-6">
                {/* Timer Chime Sound */}
                <div className="p-5 rounded-2xl bg-white border border-[#E0E3DB]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <label className="text-sm font-bold text-[#191C19]">Focus Timer Completion Sound</label>
                      <p className="text-xs text-[#5A6354]">Plays gently when a focus session or break ends.</p>
                    </div>
                    <button
                      onClick={handleTestAudio}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EDF1E9] hover:bg-[#DDE5D9] text-[#3A693A] text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Test Audio</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {[
                      { id: 'bell', label: 'Tibetan Bell' },
                      { id: 'bowl', label: 'Singing Bowl' },
                      { id: 'chime', label: 'Harpsichord' },
                      { id: 'digital', label: 'Soft Digital' },
                      { id: 'none', label: 'Muted' }
                    ].map((sound) => (
                      <button
                        key={sound.id}
                        type="button"
                        onClick={() => {
                          handleUpdate({ soundChime: sound.id as ChimeType });
                          if (sound.id !== 'none') playTimerSound(sound.id as ChimeType, settings.soundVolume);
                        }}
                        className={`p-3 rounded-xl border text-center transition-all text-xs font-bold ${
                          settings.soundChime === sound.id
                            ? 'border-[#3A693A] bg-[#EDF1E9] text-[#3A693A] shadow-2xs'
                            : 'border-[#E0E3DB] bg-white text-[#424940] hover:bg-[#F9FAF8]'
                        }`}
                      >
                        {sound.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Volume Slider */}
                <div className="p-5 rounded-2xl bg-white border border-[#E0E3DB]">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-[#191C19]">
                      Chime Volume: {Math.round(settings.soundVolume * 100)}%
                    </label>
                    {settings.soundVolume === 0 ? (
                      <VolumeX className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-[#3A693A]" />
                    )}
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.soundVolume}
                    onChange={(e) => handleUpdate({ soundVolume: Number(e.target.value) })}
                    className="w-full accent-[#3A693A] cursor-pointer"
                  />
                </div>

                {/* Visual Celebrations (Confetti) */}
                <div className="p-5 rounded-2xl bg-white border border-[#E0E3DB] flex items-center justify-between">
                  <div>
                    <label className="text-sm font-bold text-[#191C19]">Celebratory Confetti Burst</label>
                    <p className="text-xs text-[#5A6354]">Dopamine celebration effect upon completing tasks.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpdate({ confettiEnabled: !settings.confettiEnabled })}
                    className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                      settings.confettiEnabled ? 'bg-[#3A693A]' : 'bg-[#DDE5D9]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        settings.confettiEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 5. DATA & PRIVACY ==================== */}
        {activeTab === 'data' && (
          <div className="space-y-6">
            <div className="bg-[#FBFDF8] rounded-[32px] p-6 md:p-8 border border-[#E0E3DB] shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-5 h-5 text-[#3A693A]" />
                <h2 className="text-xl font-bold text-[#191C19]">Data Management & Portability</h2>
              </div>
              <p className="text-xs md:text-sm text-[#5A6354] mb-6">
                Your focus data belongs strictly to you. Export complete records anytime or reset cached state.
              </p>

              <div className="space-y-4">
                {/* Export Data Button */}
                <div className="p-5 rounded-2xl bg-white border border-[#E0E3DB] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-sm text-[#191C19]">Export My Complete Data (JSON)</h3>
                    <p className="text-xs text-[#5A6354] mt-0.5">
                      Download all pending and completed tasks, focus session endurance logs, and settings.
                    </p>
                  </div>
                  <button
                    onClick={handleExportData}
                    disabled={exporting}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#3A693A] text-white rounded-xl font-bold text-xs shadow-sm hover:bg-[#325a32] transition-all cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{exporting ? 'Exporting...' : 'Download JSON Backup'}</span>
                  </button>
                </div>

                {/* Reset Timeline Cache */}
                <div className="p-5 rounded-2xl bg-white border border-[#E0E3DB] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-sm text-[#191C19]">Reset Local Timeline Order</h3>
                    <p className="text-xs text-[#5A6354] mt-0.5">
                      Restores schedule ordering back to baseline natural chronological sequence.
                    </p>
                  </div>
                  <button
                    onClick={handleResetTimelineCache}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#F4F5F2] hover:bg-[#EDF1E9] text-[#191C19] border border-[#E0E3DB] rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Clear Timeline Cache</span>
                  </button>
                </div>

                {/* Privacy Guarantee Statement */}
                <div className="p-4 rounded-2xl bg-[#EDF1E9] border border-[#DDE5D9] text-xs text-[#3A533A] leading-relaxed">
                  <strong className="block font-bold text-[#101F10] mb-1">Serene Focus Privacy Promise:</strong>
                  Your personal notes, brain dumps, and focus timestamps are encrypted in transit and securely partitioned. No user data is ever sold or utilized to train general public models.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================== LOGOUT CONFIRMATION MODAL ==================== */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FBFDF8] rounded-[28px] max-w-sm w-full p-6 border border-[#E0E3DB] shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#191C19] mb-1">Confirm Log Out</h3>
            <p className="text-xs text-[#5A6354] mb-6 leading-relaxed">
              Are you sure you want to sign out of Serene Focus? Your saved tasks and history will be safely preserved.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 bg-white border border-[#DDE5D9] text-[#424940] hover:bg-[#F4F5F2] rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                Stay
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
