const fs = require('fs');
let content = fs.readFileSync('src/components/AICoach.tsx', 'utf-8');

const effect = `
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/ai/coach/history', {
          headers: { 'Authorization': \`Bearer \${token}\` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) {
            setMessages([
              { role: 'assistant', content: "Hi! I'm your AI Coach. How can I help you manage your focus or tasks today?" },
              ...data
            ]);
          }
        }
      } catch (e) {
        console.error("Failed to load history", e);
      }
    };
    fetchHistory();
  }, []);
`;
content = content.replace(/const quickQuestions = \[/, `${effect}\n  const quickQuestions = [`);
content = content.replace(/import React, \{ useState \} from 'react';/, `import React, { useState, useEffect } from 'react';`);

fs.writeFileSync('src/components/AICoach.tsx', content, 'utf-8');
