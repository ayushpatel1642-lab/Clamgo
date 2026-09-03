import React, { useState, useEffect } from 'react';
import { Bell, X, Plus, Trash2, CheckCircle2, Clock, Calendar, RefreshCw, ChevronRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from './AuthProvider';
import { apiFetch, safeJson } from '../lib/api';

export interface ReminderItem {
  id: number;
  userId: string;
  title: string;
  triggerTime: string;
  isDelivered: boolean;
  isAcknowledged: boolean;
  createdAt: string;
}

interface RemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRemindersChanged?: () => void;
}

export default function RemindersModal({ isOpen, onClose, onRemindersChanged }: RemindersModalProps) {
  const { getToken } = useAuth();
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'all' | 'completed'>('upcoming');

  // Quick add state
  const [newTitle, setNewTitle] = useState('');
  const [newDateTime, setNewDateTime] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [currentDeviceTime, setCurrentDeviceTime] = useState<Date>(new Date());

  // Keep live time updated
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDeviceTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const toLocalDatetimeInputValue = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // Set default initial date/time to 1 hour from now
  const handleAutoFetchCurrentTime = (offsetMinutes = 60) => {
    const now = new Date();
    const target = new Date(now.getTime() + offsetMinutes * 60 * 1000);
    setNewDateTime(toLocalDatetimeInputValue(target));
    setCurrentDeviceTime(now);
  };

  useEffect(() => {
    if (isOpen) {
      handleAutoFetchCurrentTime(60);
      fetchReminders();
    }
  }, [isOpen]);

  const fetchReminders = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiFetch('/api/reminders', {
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await safeJson<ReminderItem[]>(res, []);
        if (Array.isArray(data)) {
          setReminders(data);
        }
      }
    } catch (err) {
      console.warn("Could not fetch reminders:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error("Please enter a reminder title");
      return;
    }

    setIsAdding(true);
    try {
      const token = await getToken();
      const targetDate = newDateTime ? new Date(newDateTime) : new Date(Date.now() + 60 * 60 * 1000);
      const isoString = isNaN(targetDate.getTime()) ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : targetDate.toISOString();

      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          triggerTime: isoString
        })
      });

      if (res.ok) {
        toast.success("Reminder created!");
        setNewTitle('');
        handleAutoFetchCurrentTime(60);
        await fetchReminders();
        onRemindersChanged?.();
      } else {
        toast.error("Failed to create reminder");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create reminder");
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleAcknowledge = async (reminder: ReminderItem) => {
    try {
      const token = await getToken();
      const endpoint = reminder.isAcknowledged
        ? `/api/reminders/${reminder.id}`
        : `/api/reminders/${reminder.id}/acknowledge`;

      const method = reminder.isAcknowledged ? 'PUT' : 'POST';
      const body = reminder.isAcknowledged ? JSON.stringify({ isAcknowledged: false }) : undefined;

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body
      });

      if (res.ok) {
        toast.success(reminder.isAcknowledged ? "Reminder reopened" : "Reminder marked as completed");
        await fetchReminders();
        onRemindersChanged?.();
      }
    } catch (err: any) {
      toast.error("Failed to update reminder");
    }
  };

  const handleSnooze = async (id: number, minutes: number) => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/reminders/${id}/snooze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ minutes })
      });

      if (res.ok) {
        toast.success(`Snoozed for ${minutes >= 60 ? `${minutes / 60} hour(s)` : `${minutes} mins`}`);
        await fetchReminders();
        onRemindersChanged?.();
      }
    } catch (err) {
      toast.error("Failed to snooze reminder");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/reminders/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        toast.success("Reminder deleted");
        setReminders(prev => prev.filter(r => r.id !== id));
        onRemindersChanged?.();
      }
    } catch (err) {
      toast.error("Failed to delete reminder");
    }
  };

  if (!isOpen) return null;

  const now = new Date();

  const filteredReminders = reminders.filter(r => {
    if (filter === 'completed') return r.isAcknowledged;
    if (filter === 'upcoming') return !r.isAcknowledged;
    return true;
  });

  const activeCount = reminders.filter(r => !r.isAcknowledged).length;

  const formatReminderTime = (timeStr: string) => {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return timeStr;

    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    const timeFormatted = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    if (isToday) return `Today at ${timeFormatted}`;
    if (isTomorrow) return `Tomorrow at ${timeFormatted}`;
    return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${timeFormatted}`;
  };

  const getRelativeBadge = (r: ReminderItem) => {
    if (r.isAcknowledged) {
      return <span className="text-[11px] font-semibold bg-[#EDF1E9] text-[#3A693A] px-2 py-0.5 rounded-full">Completed</span>;
    }
    const d = new Date(r.triggerTime);
    const diffMs = d.getTime() - now.getTime();
    if (diffMs <= 0) {
      return <span className="text-[11px] font-bold bg-[#FFEDEA] text-[#BA1A1A] px-2 py-0.5 rounded-full flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Due now</span>;
    }
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 60) {
      return <span className="text-[11px] font-semibold bg-[#EDF1E9] text-[#3A693A] px-2 py-0.5 rounded-full">in {diffMins}m</span>;
    }
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) {
      return <span className="text-[11px] font-semibold bg-[#EDF1E9] text-[#3A693A] px-2 py-0.5 rounded-full">in {diffHours}h</span>;
    }
    const diffDays = Math.round(diffHours / 24);
    return <span className="text-[11px] font-semibold bg-[#F4F5F2] text-[#5A6054] px-2 py-0.5 rounded-full">in {diffDays}d</span>;
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div 
        className="bg-[#FBFDF8] border border-[#E0E3DB] rounded-[32px] w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#E0E3DB] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EDF1E9] flex items-center justify-center text-[#3A693A]">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#101F10]">Reminders</h2>
                {activeCount > 0 && (
                  <span className="text-xs font-bold bg-[#3A693A] text-white px-2.5 py-0.5 rounded-full">
                    {activeCount} active
                  </span>
                )}
              </div>
              <p className="text-xs text-[#5A6054] flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3 h-3 text-[#3A693A]" />
                Device time: {currentDeviceTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#5A6054] hover:text-[#101F10] hover:bg-[#F4F5F2] rounded-full transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Quick Add Form */}
          <form onSubmit={handleCreateReminder} className="bg-white border border-[#E0E3DB] rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#3A693A] flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Quick Add Reminder
              </span>
              <button
                type="button"
                onClick={() => handleAutoFetchCurrentTime(30)}
                className="text-[11px] font-semibold text-[#3A693A] hover:underline flex items-center gap-1 cursor-pointer"
                title="Automatically fetch live date & time"
              >
                <RefreshCw className="w-3 h-3" />
                Auto-fetch Current Time
              </button>
            </div>

            <div>
              <input
                type="text"
                placeholder="What do you need to be reminded of?"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full font-medium text-[#101F10] text-sm bg-[#FBFDF8] border border-[#E0E3DB] rounded-xl px-3.5 py-2.5 focus:border-[#3A693A] focus:ring-1 focus:ring-[#3A693A] outline-none transition-all placeholder-[#8C9388]"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="datetime-local"
                  value={newDateTime}
                  onChange={(e) => setNewDateTime(e.target.value)}
                  className="bg-[#FBFDF8] border border-[#E0E3DB] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#101F10] focus:border-[#3A693A] outline-none cursor-pointer"
                />
                
                {/* Presets */}
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleAutoFetchCurrentTime(15)}
                    className="text-[10px] font-bold bg-[#F4F5F2] hover:bg-[#DDE5D9] text-[#424940] px-2 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    +15m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAutoFetchCurrentTime(60)}
                    className="text-[10px] font-bold bg-[#F4F5F2] hover:bg-[#DDE5D9] text-[#424940] px-2 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    +1h
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const t = new Date();
                      t.setDate(t.getDate() + 1);
                      t.setHours(9, 0, 0, 0);
                      setNewDateTime(toLocalDatetimeInputValue(t));
                    }}
                    className="text-[10px] font-bold bg-[#F4F5F2] hover:bg-[#DDE5D9] text-[#424940] px-2 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    Tomorrow 9am
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isAdding || !newTitle.trim()}
                className="w-full sm:w-auto bg-[#3A693A] hover:bg-[#3A693A]/90 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </form>

          {/* Filter tabs */}
          <div className="flex items-center justify-between border-b border-[#E0E3DB] pb-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilter('upcoming')}
                className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                  filter === 'upcoming' ? 'bg-[#3A693A] text-white' : 'text-[#5A6054] hover:text-[#101F10] hover:bg-[#EDF1E9]'
                }`}
              >
                Upcoming ({reminders.filter(r => !r.isAcknowledged).length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('completed')}
                className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                  filter === 'completed' ? 'bg-[#3A693A] text-white' : 'text-[#5A6054] hover:text-[#101F10] hover:bg-[#EDF1E9]'
                }`}
              >
                Completed ({reminders.filter(r => r.isAcknowledged).length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                  filter === 'all' ? 'bg-[#3A693A] text-white' : 'text-[#5A6054] hover:text-[#101F10] hover:bg-[#EDF1E9]'
                }`}
              >
                All ({reminders.length})
              </button>
            </div>

            <button
              type="button"
              onClick={fetchReminders}
              className="text-xs text-[#5A6054] hover:text-[#101F10] p-1.5 rounded-lg hover:bg-[#EDF1E9] transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Reminders List */}
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-[#5A6054] gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-[#3A693A]" />
              <span className="text-xs">Loading reminders...</span>
            </div>
          ) : filteredReminders.length === 0 ? (
            <div className="py-12 bg-white border border-[#E0E3DB] rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-2">
              <div className="w-12 h-12 rounded-full bg-[#EDF1E9] flex items-center justify-center text-[#3A693A]">
                <Bell className="w-6 h-6 opacity-60" />
              </div>
              <h4 className="font-bold text-[#101F10] text-sm">
                {filter === 'completed' ? 'No completed reminders' : 'No upcoming reminders'}
              </h4>
              <p className="text-xs text-[#5A6054] max-w-xs">
                {filter === 'completed' 
                  ? 'Reminders you complete or acknowledge will show up here.' 
                  : 'You\'re all caught up! Use the form above or Brain Dump to add reminders with automatic time parsing.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReminders.map((r) => (
                <div
                  key={r.id}
                  className={`bg-white border rounded-2xl p-4 transition-all hover:border-[#C4C8BA] shadow-2xs flex flex-col gap-2.5 ${
                    r.isAcknowledged ? 'border-[#E0E3DB] opacity-75' : 'border-[#E0E3DB]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleAcknowledge(r)}
                        className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                          r.isAcknowledged
                            ? 'bg-[#3A693A] border-[#3A693A] text-white'
                            : 'border-[#8C9388] hover:border-[#3A693A] bg-transparent'
                        }`}
                        title={r.isAcknowledged ? "Mark incomplete" : "Mark as done"}
                      >
                        {r.isAcknowledged && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <h4 className={`font-bold text-sm text-[#101F10] break-words ${r.isAcknowledged ? 'line-through text-[#72796F]' : ''}`}>
                          {r.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-[#5A6054] flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3 text-[#3A693A]" />
                            {formatReminderTime(r.triggerTime)}
                          </span>
                          {getRelativeBadge(r)}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!r.isAcknowledged && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSnooze(r.id, 15)}
                            className="text-[10px] font-bold bg-[#F4F5F2] hover:bg-[#DDE5D9] text-[#424940] px-2 py-1 rounded-lg transition-colors cursor-pointer"
                            title="Snooze 15 minutes"
                          >
                            +15m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSnooze(r.id, 60)}
                            className="text-[10px] font-bold bg-[#F4F5F2] hover:bg-[#DDE5D9] text-[#424940] px-2 py-1 rounded-lg transition-colors cursor-pointer"
                            title="Snooze 1 hour"
                          >
                            +1h
                          </button>
                        </div>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="p-1.5 text-[#8C9388] hover:text-[#BA1A1A] hover:bg-[#FFEDEA] rounded-lg transition-colors cursor-pointer ml-1"
                        title="Delete reminder"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E0E3DB] bg-[#F4F5F2] flex items-center justify-between shrink-0">
          <p className="text-[11px] text-[#72796F]">
            Notifications trigger in-app at the designated time.
          </p>
          <button
            onClick={onClose}
            className="text-xs font-bold text-[#424940] hover:text-[#101F10] bg-white border border-[#E0E3DB] px-4 py-2 rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
