import React, { useEffect } from 'react';
import { useAuth } from './AuthProvider';

export default function ReminderService() {
  const { getToken, user } = useAuth();

  useEffect(() => {
    if (!user) return;

    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    const checkReminders = async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/reminders/due', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const dueReminders = await res.json();
          dueReminders.forEach((r: any) => {
            if (Notification.permission === 'granted') {
              new Notification('Serene Focus', {
                body: r.title,
                icon: '/vite.svg'
              });
            } else {
              alert(`Reminder: ${r.title}`);
            }
          });
        }
      } catch (e) {
        console.error("Reminder check failed", e);
      }
    };

    // Check immediately, then every 60 seconds
    checkReminders();
    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, [user, getToken]);

  return null;
}
