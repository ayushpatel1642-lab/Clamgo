import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { toast } from 'sonner';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  BarChart
} from 'recharts';
import {
  Clock,
  Target,
  Sparkles,
  Zap,
  CheckCircle2,
  Calendar,
  BatteryCharging,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  RotateCcw,
  TrendingUp,
  Loader2,
  Flame,
  ArrowRight,
  Settings as SettingsIcon
} from 'lucide-react';
import { getStoredSettings } from '../lib/settings';

interface HourlyDataPoint {
  hour: number;
  label: string;
  displayHour: string;
  taskCount: number;
  focusMinutes: number;
  sessionCount: number;
  productivityScore: number;
  energyLevel: string;
  isOptimal: boolean;
  isSecondary: boolean;
  isDip: boolean;
}

interface OptimalWindow {
  startHour: number;
  endHour: number;
  label: string;
  peakScore: number;
  rationale: string;
}

interface SecondaryWindow {
  startHour: number;
  endHour: number;
  label: string;
  rationale: string;
}

interface RecoveryWindow {
  startHour: number;
  endHour: number;
  label: string;
  suggestion: string;
}

interface Archetype {
  title: string;
  subtitle: string;
  description: string;
  recommendations: string[];
}

interface TimeOfDayItem {
  name: string;
  taskCount: number;
  focusMinutes: number;
  color: string;
  percentage: number;
}

interface DayOfWeekItem {
  day: string;
  taskCount: number;
  focusMinutes: number;
  isStrongest: boolean;
}

interface RecentCompletion {
  id: number;
  title: string;
  duration: number;
  completedAt: string;
  timeFormatted: string;
  isPeakHour: boolean;
}

interface InsightsData {
  hasSufficientData: boolean;
  hourlyData: HourlyDataPoint[];
  optimalWindow: OptimalWindow;
  secondaryWindow: SecondaryWindow;
  recoveryWindow: RecoveryWindow;
  archetype: Archetype;
  timeOfDayBreakdown: TimeOfDayItem[];
  dayOfWeekData: DayOfWeekItem[];
  metrics: {
    totalCompletedTasks: number;
    totalFocusSessions: number;
    totalFocusMinutes: number;
    avgDuration: number;
    completionRatePercent: number;
    peakHourLabel: string;
  };
  recentCompletions: RecentCompletion[];
}

export default function Insights() {
  const { getToken } = useAuth();
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const settings = getStoredSettings();
  const customStartHour = parseInt((settings.customStartTime || '09:00').split(':')[0], 10);
  const customEndHour = parseInt((settings.customEndTime || '18:00').split(':')[0], 10);

  const [selectedChartFilter, setSelectedChartFilter] = useState<'all' | 'tasks' | 'minutes'>('all');
  const [timeZoom, setTimeZoom] = useState<'custom' | 'working' | 'full'>('custom'); // custom window vs 6AM-10PM vs 24 hours

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/insights', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        toast.error("Failed to load insights");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to load insights");
    } finally {
      setLoading(false);
      if (isManualRefresh) setRefreshing(false);
    }
  };

  const handleSeedSampleData = async () => {
    setSeeding(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/insights/seed-demo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success("Realistic historical focus sessions generated!");
        await fetchInsights();
      } else {
        toast.error("Failed to seed sample history");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Network error while generating sample history");
    } finally {
      setSeeding(false);
    }
  };

  // Filter hourly dataset for custom window, working hours (6 AM - 10 PM), or full 24h
  const filteredHourlyData = data?.hourlyData
    ? timeZoom === 'custom'
      ? data.hourlyData.filter(d => d.hour >= customStartHour && d.hour <= customEndHour)
      : timeZoom === 'working'
      ? data.hourlyData.filter(d => d.hour >= 6 && d.hour <= 22)
      : data.hourlyData
    : [];

  // Custom Tooltip for the 24-Hour Composed Chart
  const CustomHourlyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item: HourlyDataPoint = payload[0].payload;
      return (
        <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-[#DDE5D9] shadow-xl text-left min-w-[220px]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E0E3DB]">
            <span className="font-bold text-sm text-[#191C19]">{item.displayHour}</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                item.productivityScore >= 80
                  ? 'bg-[#EDF1E9] text-[#3A693A]'
                  : item.productivityScore >= 60
                  ? 'bg-[#EBF3ED] text-[#4F7E53]'
                  : item.productivityScore >= 40
                  ? 'bg-[#F4F5F2] text-[#5A6354]'
                  : 'bg-amber-50 text-amber-800'
              }`}
            >
              {item.energyLevel}
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-[#424940]">
              <span className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-[#3A693A]" /> Deep Work Score:
              </span>
              <span className="font-bold text-[#191C19]">{item.productivityScore} / 100</span>
            </div>
            <div className="flex justify-between items-center text-[#424940]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#84A98C]" /> Completed Tasks:
              </span>
              <span className="font-bold text-[#191C19]">{item.taskCount}</span>
            </div>
            <div className="flex justify-between items-center text-[#424940]">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#52796F]" /> Focus Logged:
              </span>
              <span className="font-bold text-[#191C19]">{item.focusMinutes} mins</span>
            </div>
          </div>
          {item.isOptimal && (
            <div className="mt-2.5 pt-2 border-t border-[#E0E3DB] flex items-center gap-1 text-[11px] font-bold text-[#3A693A]">
              <Zap className="w-3.5 h-3.5 fill-[#3A693A]" /> Optimal Deep Work Hour
            </div>
          )}
          {item.isDip && (
            <div className="mt-2.5 pt-2 border-t border-[#E0E3DB] flex items-center gap-1 text-[11px] font-semibold text-amber-700">
              <BatteryCharging className="w-3.5 h-3.5" /> Natural Circadian Dip
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 md:p-12 max-w-6xl mx-auto w-full">
      {/* Header */}
      <header className="mb-8 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#EDF1E9] text-[#3A693A] mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Executive Chronobiology Engine</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-[#191C19] tracking-tight">Performance & Deep Work Insights</h1>
            <Link
              to="/settings"
              title="Configure Custom Workday Hours in Settings"
              className="p-1.5 text-[#5A6354] hover:text-[#191C19] hover:bg-[#EDF1E9] rounded-xl transition-all"
            >
              <SettingsIcon className="w-4 h-4" />
            </Link>
          </div>
          <p className="text-[#424940] text-base md:text-lg mt-1 max-w-2xl">
            Analyzing historical task completion timestamps and focus endurance to reveal your optimal hours for deep work.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={() => fetchInsights(true)}
            disabled={refreshing}
            className="flex items-center gap-2 bg-[#FBFDF8] border border-[#E0E3DB] text-[#424940] hover:text-[#191C19] hover:bg-[#F4F5F2] px-4 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            title="Refresh analytics"
          >
            <RotateCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            to="/timeline"
            className="flex items-center gap-2 bg-[#3A693A] text-white hover:bg-[#325a32] px-5 py-2.5 rounded-2xl font-bold text-sm shadow-md shadow-[#3A693A]/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            <span>Apply to Timeline</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-24 bg-[#FBFDF8] rounded-[32px] border border-[#E0E3DB]">
          <Loader2 className="w-10 h-10 animate-spin text-[#3A693A] mb-4" />
          <p className="text-[#424940] font-medium">Computing historical completion patterns and focus curves...</p>
        </div>
      ) : !data ? (
        <div className="bg-[#FBFDF8] rounded-[32px] p-12 border border-[#E0E3DB] text-center shadow-sm">
          <Clock className="w-12 h-12 text-[#84A98C] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#191C19] mb-2">No Performance Records Yet</h3>
          <p className="text-[#424940] max-w-md mx-auto mb-6">
            Complete tasks or focus sessions to begin tracking your circadian performance patterns.
          </p>
          <button
            onClick={handleSeedSampleData}
            disabled={seeding}
            className="bg-[#3A693A] text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-md hover:bg-[#325a32] transition-all"
          >
            {seeding ? "Generating..." : "Load 7-Day Sample History"}
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Sparse Data Informational Callout (if brand new) */}
          {!data.hasSufficientData && (
            <div className="bg-[#EDF1E9] border border-[#DDE5D9] rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-[#191C19]">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#3A693A] shrink-0 shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">Initial Chronotype Baseline Active</h4>
                  <p className="text-xs text-[#424940]">
                    Showing research-grounded circadian focus curves blended with your logged tasks. As you finish more tasks, your personal signature sharpens.
                  </p>
                </div>
              </div>
              <button
                onClick={handleSeedSampleData}
                disabled={seeding}
                className="whitespace-nowrap px-4 py-2 bg-white hover:bg-[#F4F5F2] text-[#3A693A] font-bold text-xs rounded-xl border border-[#DDE5D9] shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                {seeding ? "Generating Sample..." : "Simulate 7-Day History"}
              </button>
            </div>
          )}

          {/* Executive Optimal Hours Highlights Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Primary Deep Work Window Card */}
            <div className="bg-[#3A693A] text-white rounded-[32px] p-6 md:p-7 shadow-lg shadow-[#3A693A]/15 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-xs">
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Peak Deep Work Window</span>
                  </div>
                  <span className="text-xs font-bold text-[#DDE5D9] bg-white/10 px-2 py-0.5 rounded-md">
                    {data.optimalWindow.peakScore} / 100 Flow
                  </span>
                </div>
                <div className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
                  {data.optimalWindow.label}
                </div>
                <p className="text-[#E0E8DC] text-xs md:text-sm leading-relaxed">
                  {data.optimalWindow.rationale}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs text-[#E0E8DC]">
                <span>Recommended: Intimidating / Deep Tasks</span>
                <Link to="/timeline" className="font-bold underline hover:text-white inline-flex items-center gap-1">
                  Schedule <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Secondary Surge Window Card */}
            <div className="bg-[#FBFDF8] border border-[#E0E3DB] rounded-[32px] p-6 md:p-7 shadow-sm flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#EDF1E9] text-[#3A693A] mb-3">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Secondary Focus Surge</span>
                </div>
                <div className="text-3xl font-extrabold text-[#191C19] tracking-tight mb-2">
                  {data.secondaryWindow.label}
                </div>
                <p className="text-[#424940] text-xs md:text-sm leading-relaxed">
                  {data.secondaryWindow.rationale}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E0E3DB] text-xs text-[#5A6354] flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-[#84A98C]" />
                <span>Ideal for execution, code review, or collaborative deep work.</span>
              </div>
            </div>

            {/* Recovery / Energy Dip Card */}
            <div className="bg-[#FBFDF8] border border-[#E0E3DB] rounded-[32px] p-6 md:p-7 shadow-sm flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/60 mb-3">
                  <BatteryCharging className="w-3.5 h-3.5" />
                  <span>Recovery & Recharge Dip</span>
                </div>
                <div className="text-3xl font-extrabold text-[#191C19] tracking-tight mb-2">
                  {data.recoveryWindow.label}
                </div>
                <p className="text-[#424940] text-xs md:text-sm leading-relaxed">
                  {data.recoveryWindow.suggestion}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E0E3DB] text-xs text-[#5A6354] flex items-center gap-1.5">
                <Moon className="w-4 h-4 text-amber-700" />
                <span>Reserve for low-cognitive admin or taking a 15m stroll.</span>
              </div>
            </div>
          </div>

          {/* Key Executive KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#FBFDF8] p-5 rounded-2xl border border-[#E0E3DB] shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5A6354] mb-2">
                <CheckCircle2 className="w-4 h-4 text-[#3A693A]" /> Completed Tasks
              </div>
              <div className="text-3xl font-bold text-[#191C19]">{data.metrics.totalCompletedTasks}</div>
              <div className="text-xs text-[#5A6354] mt-1">Recorded completions</div>
            </div>

            <div className="bg-[#FBFDF8] p-5 rounded-2xl border border-[#E0E3DB] shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5A6354] mb-2">
                <Target className="w-4 h-4 text-[#3A693A]" /> Total Focus Time
              </div>
              <div className="text-3xl font-bold text-[#191C19]">{data.metrics.totalFocusMinutes}m</div>
              <div className="text-xs text-[#5A6354] mt-1">
                Across {data.metrics.totalFocusSessions} focus sessions
              </div>
            </div>

            <div className="bg-[#FBFDF8] p-5 rounded-2xl border border-[#E0E3DB] shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5A6354] mb-2">
                <Clock className="w-4 h-4 text-[#3A693A]" /> Optimal Burst Length
              </div>
              <div className="text-3xl font-bold text-[#191C19]">{data.metrics.avgDuration}m</div>
              <div className="text-xs text-[#5A6354] mt-1">Average focused block</div>
            </div>

            <div className="bg-[#FBFDF8] p-5 rounded-2xl border border-[#E0E3DB] shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5A6354] mb-2">
                <Zap className="w-4 h-4 text-[#3A693A]" /> Focus Completion Rate
              </div>
              <div className="text-3xl font-bold text-[#191C19]">{data.metrics.completionRatePercent}%</div>
              <div className="text-xs text-[#5A6354] mt-1">Sessions finished without quit</div>
            </div>
          </div>

          {/* MAIN RECHARTS VISUALIZER: 24-Hour Cognitive Stamina & Completion Curve */}
          <div className="bg-[#FBFDF8] rounded-[32px] p-6 md:p-8 border border-[#E0E3DB] shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-[#3A693A]" />
                  <h3 className="text-xl font-bold text-[#191C19]">24-Hour Deep Work & Task Velocity Distribution</h3>
                </div>
                <p className="text-xs md:text-sm text-[#424940] mt-1">
                  Cognitive stamina curve (green area) overlaid with hourly task completions and focus minutes.
                </p>
              </div>

              {/* Chart Controls */}
              <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
                <div className="inline-flex bg-[#F4F5F2] p-1 rounded-xl border border-[#E0E3DB] text-xs font-semibold">
                  <button
                    onClick={() => setTimeZoom('custom')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      timeZoom === 'custom' ? 'bg-white text-[#191C19] shadow-2xs font-bold' : 'text-[#424940] hover:text-[#191C19]'
                    }`}
                  >
                    Custom Window ({settings.customStartTime || '09:00'}–{settings.customEndTime || '18:00'})
                  </button>
                  <button
                    onClick={() => setTimeZoom('working')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      timeZoom === 'working' ? 'bg-white text-[#191C19] shadow-2xs font-bold' : 'text-[#424940] hover:text-[#191C19]'
                    }`}
                  >
                    Daytime (6AM–10PM)
                  </button>
                  <button
                    onClick={() => setTimeZoom('full')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      timeZoom === 'full' ? 'bg-white text-[#191C19] shadow-2xs font-bold' : 'text-[#424940] hover:text-[#191C19]'
                    }`}
                  >
                    Full 24 Hours
                  </button>
                </div>

                <div className="inline-flex bg-[#F4F5F2] p-1 rounded-xl border border-[#E0E3DB] text-xs font-semibold">
                  <button
                    onClick={() => setSelectedChartFilter('all')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      selectedChartFilter === 'all' ? 'bg-white text-[#191C19] shadow-2xs font-bold' : 'text-[#424940] hover:text-[#191C19]'
                    }`}
                  >
                    All Metrics
                  </button>
                  <button
                    onClick={() => setSelectedChartFilter('tasks')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      selectedChartFilter === 'tasks' ? 'bg-white text-[#191C19] shadow-2xs font-bold' : 'text-[#424940] hover:text-[#191C19]'
                    }`}
                  >
                    Tasks Only
                  </button>
                  <button
                    onClick={() => setSelectedChartFilter('minutes')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      selectedChartFilter === 'minutes' ? 'bg-white text-[#191C19] shadow-2xs font-bold' : 'text-[#424940] hover:text-[#191C19]'
                    }`}
                  >
                    Focus Minutes
                  </button>
                </div>
              </div>
            </div>

            {/* Recharts Composed Visualizer */}
            <div className="h-[360px] md:h-[420px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={filteredHourlyData} margin={{ top: 15, right: 20, bottom: 25, left: -10 }}>
                  <defs>
                    <linearGradient id="scoreAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3A693A" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#3A693A" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E8E2" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: '#DDE5D9' }}
                    tick={{ fill: '#5A6354', fontSize: 11 }}
                    dy={10}
                  />
                  {/* Left Axis: Productivity Stamina Index 0-100 */}
                  <YAxis
                    yAxisId="scoreAxis"
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#5A6354', fontSize: 11 }}
                    tickFormatter={(val) => `${val}%`}
                  />
                  {/* Right Axis: Completed Task counts and focus minutes */}
                  <YAxis
                    yAxisId="countAxis"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#84A98C', fontSize: 11 }}
                  />
                  <Tooltip content={<CustomHourlyTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: '16px', fontSize: '12px' }}
                  />

                  {/* Highlighted Optimal Deep Work Window Reference Area */}
                  {data.optimalWindow && (
                    <ReferenceArea
                      yAxisId="scoreAxis"
                      x1={`${data.optimalWindow.startHour === 0 ? 12 : data.optimalWindow.startHour > 12 ? data.optimalWindow.startHour - 12 : data.optimalWindow.startHour} ${data.optimalWindow.startHour >= 12 ? 'PM' : 'AM'}`}
                      x2={`${((data.optimalWindow.startHour + 2) % 24) === 0 ? 12 : ((data.optimalWindow.startHour + 2) % 24) > 12 ? ((data.optimalWindow.startHour + 2) % 24) - 12 : ((data.optimalWindow.startHour + 2) % 24)} ${((data.optimalWindow.startHour + 2) % 24) >= 12 ? 'PM' : 'AM'}`}
                      fill="#3A693A"
                      fillOpacity={0.12}
                      stroke="#3A693A"
                      strokeDasharray="4 4"
                    />
                  )}

                  {/* Baseline Threshold Reference Line */}
                  <ReferenceLine
                    yAxisId="scoreAxis"
                    y={65}
                    stroke="#84A98C"
                    strokeDasharray="3 3"
                    label={{ value: "Deep Work Threshold (65%)", fill: "#52796F", fontSize: 10, position: 'insideTopLeft' }}
                  />

                  {/* Productivity Stamina Curve */}
                  {(selectedChartFilter === 'all' || selectedChartFilter === 'tasks') && (
                    <Area
                      yAxisId="scoreAxis"
                      type="monotone"
                      dataKey="productivityScore"
                      name="Deep Work Stamina Score"
                      stroke="#3A693A"
                      strokeWidth={3}
                      fill="url(#scoreAreaGradient)"
                      activeDot={{ r: 6, fill: '#3A693A', stroke: '#fff', strokeWidth: 2 }}
                    />
                  )}

                  {/* Task Completions (Bars) */}
                  {(selectedChartFilter === 'all' || selectedChartFilter === 'tasks') && (
                    <Bar
                      yAxisId="countAxis"
                      dataKey="taskCount"
                      name="Tasks Completed"
                      fill="#84A98C"
                      radius={[6, 6, 0, 0]}
                      barSize={20}
                    />
                  )}

                  {/* Focus Minutes (Line) */}
                  {(selectedChartFilter === 'all' || selectedChartFilter === 'minutes') && (
                    <Line
                      yAxisId="countAxis"
                      type="monotone"
                      dataKey="focusMinutes"
                      name="Focus Minutes Logged"
                      stroke="#52796F"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#52796F' }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Visual Indicator Legend Guide */}
            <div className="mt-4 pt-4 border-t border-[#E0E3DB] flex flex-wrap items-center justify-between text-xs text-[#5A6354] gap-3">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#3A693A]/20 border border-[#3A693A]"></span>
                  <span>Highlighted Band: Optimal Deep Work Zone ({data.optimalWindow.label})</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-[#84A98C]"></span>
                  <span>Dashed Line: Deep Work Threshold</span>
                </span>
              </div>
              <span className="text-[#3A693A] font-medium">
                Peak Hour: {data.metrics.peakHourLabel}
              </span>
            </div>
          </div>

          {/* Secondary Charts Grid: Time of Day & Weekly Rhythm */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 2: Time-of-Day Donut Distribution */}
            <div className="bg-[#FBFDF8] rounded-[32px] p-6 md:p-8 border border-[#E0E3DB] shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sun className="w-5 h-5 text-[#3A693A]" />
                  <h3 className="text-lg font-bold text-[#191C19]">Circadian Phase Breakdown</h3>
                </div>
                <p className="text-xs text-[#5A6354]">
                  Where your completed accomplishments naturally concentrate across the day.
                </p>
              </div>

              <div className="h-64 my-4 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.timeOfDayBreakdown}
                      dataKey="percentage"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      stroke="#FBFDF8"
                      strokeWidth={3}
                    >
                      {data.timeOfDayBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any, item: any) => [
                        `${value}% (${item.payload.taskCount} tasks, ${item.payload.focusMinutes}m)`,
                        name
                      ]}
                      contentStyle={{ borderRadius: '16px', border: '1px solid #DDE5D9', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Breakdown Legend List */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {data.timeOfDayBreakdown.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-[#F4F5F2]/70">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[#191C19] truncate">{item.name.split(' ')[0]}</div>
                      <div className="text-[11px] text-[#5A6354]">
                        {item.percentage}% ({item.taskCount} tasks)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 3: Day-of-Week Focus Consistency */}
            <div className="bg-[#FBFDF8] rounded-[32px] p-6 md:p-8 border border-[#E0E3DB] shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-5 h-5 text-[#3A693A]" />
                  <h3 className="text-lg font-bold text-[#191C19]">Weekly Completion Rhythm</h3>
                </div>
                <p className="text-xs text-[#5A6354]">
                  Weekly output velocity identifying your most productive days.
                </p>
              </div>

              <div className="h-64 my-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.dayOfWeekData} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E8E2" />
                    <XAxis dataKey="day" tickLine={false} axisLine={{ stroke: '#DDE5D9' }} tick={{ fill: '#5A6354', fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#5A6354', fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        name === 'taskCount' ? `${val} tasks` : `${val} mins`,
                        name === 'taskCount' ? 'Completed Tasks' : 'Focus Minutes'
                      ]}
                      contentStyle={{ borderRadius: '16px', border: '1px solid #DDE5D9', fontSize: '12px' }}
                    />
                    <Bar dataKey="taskCount" name="taskCount" radius={[6, 6, 0, 0]}>
                      {data.dayOfWeekData.map((entry, index) => (
                        <Cell
                          key={`day-cell-${index}`}
                          fill={entry.isStrongest ? '#3A693A' : '#84A98C'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="p-3 bg-[#EDF1E9] rounded-2xl flex items-center justify-between text-xs text-[#191C19]">
                <span className="font-medium">
                  Strongest Weekly Output: <strong className="text-[#3A693A]">{data.dayOfWeekData.find(d => d.isStrongest)?.day || 'Wednesday'}</strong>
                </span>
                <span className="text-[#5A6354]">Consistently hits highest completion volume</span>
              </div>
            </div>
          </div>

          {/* Archetype & ADHD Strategy Playbook */}
          <div className="bg-[#FBFDF8] rounded-[32px] p-6 md:p-8 border border-[#E0E3DB] shadow-sm">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-[#E0E3DB]">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#EDF1E9] text-[#3A693A] mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>ADHD Performance Profile</span>
                </div>
                <h3 className="text-2xl font-bold text-[#191C19]">{data.archetype.title}</h3>
                <p className="text-sm font-medium text-[#3A693A] mt-0.5">{data.archetype.subtitle}</p>
                <p className="text-sm text-[#424940] mt-3 max-w-2xl leading-relaxed">
                  {data.archetype.description}
                </p>
              </div>

              <div className="p-4 bg-[#F4F5F2] rounded-2xl border border-[#E0E3DB] shrink-0 text-left md:text-right">
                <div className="text-xs text-[#5A6354] uppercase tracking-wider font-bold">Suggested Block Duration</div>
                <div className="text-2xl font-bold text-[#191C19] mt-1">{data.metrics.avgDuration} – {data.metrics.avgDuration + 15} mins</div>
                <div className="text-xs text-[#3A693A] font-medium mt-1">Matched to personal stamina</div>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#5A6354] mb-3">
                Tailored Executive-Function Strategies
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.archetype.recommendations.map((rec, i) => (
                  <div key={i} className="bg-white p-4 rounded-2xl border border-[#E0E3DB] flex items-start gap-3 shadow-2xs">
                    <div className="w-6 h-6 rounded-lg bg-[#EDF1E9] text-[#3A693A] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-xs md:text-sm text-[#191C19] leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Historical Completion Log (Proof of Personalization) */}
          {data.recentCompletions && data.recentCompletions.length > 0 && (
            <div className="bg-[#FBFDF8] rounded-[32px] p-6 md:p-8 border border-[#E0E3DB] shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-[#191C19]">Recent Task Completion History</h3>
                  <p className="text-xs text-[#5A6354]">
                    Historical timestamps analyzed to derive your peak productivity windows.
                  </p>
                </div>
                <Link
                  to="/completed"
                  className="text-xs font-bold text-[#3A693A] hover:underline inline-flex items-center gap-1"
                >
                  View All Completed <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="divide-y divide-[#E0E3DB]/70">
                {data.recentCompletions.map((item) => (
                  <div key={item.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-[#3A693A] shrink-0" />
                      <span className="font-semibold text-sm text-[#191C19] truncate">{item.title}</span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {item.isPeakHour ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#EDF1E9] text-[#3A693A]">
                          <Zap className="w-3 h-3 fill-current" /> Peak Hour
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#7A8374] px-2 py-1">Off-Peak</span>
                      )}
                      <span className="text-xs font-medium text-[#424940] bg-[#F4F5F2] px-2.5 py-1 rounded-lg border border-[#E0E3DB]">
                        {item.timeFormatted}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
