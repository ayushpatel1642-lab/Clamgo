import { toast } from 'sonner';
import React, { useEffect, useRef } from 'react';
import { useAuth } from './AuthProvider';
import { apiFetch, safeJson } from '../lib/api';

export default function ReminderService() {
  const { getToken, user } = useAuth();
  const userId = user?.uid;
  
  // Keep track of delivered ids in a ref so we don't cause infinite re-render cycles
  const deliveredIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!userId) return;
    
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && window.Notification) {
        if (Notification.permission === 'default') {
          Notification.requestPermission?.().catch(() => {});
        }
      }
    } catch (e) {
      // Ignored: iframe or browser environment blocks notification permission requests
    }

    const checkReminders = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        
        const res = await apiFetch('/api/reminders/due', {
          headers: { 
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (res.ok) {
          const actuallyDue = await safeJson<any[]>(res, []);
          if (Array.isArray(actuallyDue)) {
            actuallyDue.forEach((r: any) => {
              if (!deliveredIdsRef.current.has(r.id)) {
                deliveredIdsRef.current.add(r.id);
                
                try {
                  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                    new Notification('Serene Focus', { body: r.title, icon: '/favicon.ico' });
                  }
                } catch (e) {
                  // Ignore iframe notification error
                }
                
                toast.message(`Reminder: ${r.title}`, {
                  description: `Scheduled for ${new Date(r.triggerTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`,
                  action: {
                    label: 'Got it',
                    onClick: async () => {
                      try {
                        await apiFetch(`/api/reminders/${r.id}/acknowledge`, { 
                          method: 'POST', 
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                      } catch (e) {
                        console.warn("Failed to acknowledge reminder", e);
                      }
                    }
                  },
                  duration: Number.POSITIVE_INFINITY, // Persist until acknowledged
                });
              }
            });
          }
        }
      } catch (e: any) {
        // Silently handle benign polling drops or transient network states
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 20000);
    return () => clearInterval(interval);
  }, [userId]);

  return null;
}
