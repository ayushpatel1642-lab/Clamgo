const fs = require('fs');
let content = fs.readFileSync('src/components/ReminderService.tsx', 'utf-8');

const newService = `import { toast } from 'sonner';
import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';

export default function ReminderService() {
  const { getToken, user } = useAuth();
  // Keep track of delivered ids so we don't spam toasts
  const [deliveredIds, setDeliveredIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!user) return;
    
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const checkReminders = async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/reminders/due', {
          headers: { 'Authorization': \`Bearer \${token}\` }
        });
        if (res.ok) {
          const actuallyDue = await res.json();
          
          actuallyDue.forEach((r: any) => {
            if (!deliveredIds.has(r.id)) {
              setDeliveredIds(prev => new Set(prev).add(r.id));
              
              if (Notification.permission === 'granted') {
                new Notification('Serene Focus', { body: r.title, icon: '/favicon.ico' });
              }
              
              toast.message(r.title, {
                action: {
                  label: 'Got it',
                  onClick: async () => {
                    await fetch(\`/api/reminders/\${r.id}/acknowledge\`, {
                       method: 'POST',
                       headers: { 'Authorization': \`Bearer \${token}\` }
                    });
                  }
                },
                duration: Number.POSITIVE_INFINITY, // Persist until acknowledged
              });
            }
          });
        }
      } catch (e) {
        console.error("Reminder check failed", e);
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, [user, getToken, deliveredIds]);

  return null;
}
`;

fs.writeFileSync('src/components/ReminderService.tsx', newService, 'utf-8');
