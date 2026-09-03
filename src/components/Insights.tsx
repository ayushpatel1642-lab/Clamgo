import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { BarChart3, Clock, Target, Loader2 } from 'lucide-react';

export default function Insights() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      const token = await getToken();
      const res = await fetch('/api/insights', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-12 max-w-3xl mx-auto w-full">
      <header className="mb-10 pt-4">
        <h1 className="text-3xl font-bold text-[#191C19] mb-2">Insights</h1>
        <p className="text-[#424940] text-lg">Real data on how you work, so you can plan better.</p>
      </header>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#E0E3DB]" /></div>
      ) : !stats || stats.totalSessions === 0 ? (
        <div className="bg-[#FBFDF8] rounded-[32px] p-12 border border-[#E0E3DB] text-center shadow-sm">
          <BarChart3 className="w-10 h-10 text-[#424940] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#101F10] mb-2">Not enough data yet</h3>
          <p className="text-[#424940] max-w-sm mx-auto">Complete a few focus sessions and check back here to see your patterns.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#FBFDF8] p-6 rounded-[32px] border border-[#E0E3DB] shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-3 text-[#424940] mb-4">
              <Target className="w-5 h-5 text-[#3A693A]" />
              <h3 className="font-bold uppercase tracking-wider text-xs">Focus Sessions</h3>
            </div>
            <div>
              <div className="text-5xl font-bold text-[#101F10] mb-1">{stats.totalSessions}</div>
              <p className="text-[#424940]">sessions completed</p>
            </div>
          </div>

          <div className="bg-[#FBFDF8] p-6 rounded-[32px] border border-[#E0E3DB] shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-3 text-[#424940] mb-4">
              <Clock className="w-5 h-5 text-[#3A693A]" />
              <h3 className="font-bold uppercase tracking-wider text-xs">Total Focused Time</h3>
            </div>
            <div>
              <div className="text-5xl font-bold text-[#101F10] mb-1">{stats.totalMinutes}</div>
              <p className="text-[#424940]">minutes in the zone</p>
            </div>
          </div>

          <div className="bg-[#3A693A] text-white p-8 rounded-[32px] md:col-span-2 shadow-sm relative overflow-hidden flex flex-col md:flex-row gap-8 items-center">
            <div className="relative z-10 flex-1">
              <h3 className="text-[10px] font-bold tracking-widest text-[#DDE5D9] uppercase mb-4 opacity-80">Completion Pattern</h3>
              <p className="text-xl font-bold leading-relaxed max-w-lg mb-6">
                You tend to complete tasks in {stats.avgDuration} minute chunks. 
                {stats.avgDuration > 30 ? " You have great endurance!" : " Short bursts work best for you."}
              </p>
            </div>
            
            {stats.recentSessions && stats.recentSessions.length > 0 && (
              <div className="relative z-10 flex items-end gap-2 h-32 shrink-0">
                {stats.recentSessions.map((session: any, idx: number) => {
                  const maxDuration = Math.max(...stats.recentSessions.map((s: any) => s.duration), 60);
                  const height = Math.max((session.duration / maxDuration) * 100, 10);
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2">
                      <div className="w-8 bg-[#84A98C] rounded-t-md opacity-80 hover:opacity-100 transition-opacity" style={{ height: `${height}%` }}></div>
                      <div className="text-[10px] font-bold text-[#DDE5D9]">{session.duration}m</div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="absolute right-0 bottom-0 opacity-5 transform translate-x-1/4 translate-y-1/4 pointer-events-none">
              <BarChart3 className="w-64 h-64 text-[#DDE5D9]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
