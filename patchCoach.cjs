const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "const userTasks = await db.select().from(tasks).where(and(eq(tasks.userId, uid), eq(tasks.status, 'pending')));",
  "const userTasks = await db.select().from(tasks).where(and(eq(tasks.userId, uid), eq(tasks.status, 'pending')));\n" +
  "      const userFocus = await db.select().from(focusSessions).where(eq(focusSessions.userId, uid)).limit(20);\n" +
  "      const totalSessions = userFocus.length;\n" +
  "      const avgDuration = totalSessions > 0 ? userFocus.reduce((acc, curr) => acc + (curr.actualDuration || 0), 0) / totalSessions : 0;"
);

const oldContextStr = `const contextStr = \`
User's Pending Tasks:
\${userTasks.map(t => \`- \${t.title} (\${t.estimatedDuration}m)\`).join('\\n')}
User's Memory Dock (Later/Ideas):
\${userDockItems.map(d => \`- \${d.content}\`).join('\\n')}
      \`;`;

const newContextStr = `const contextStr = \`
User's Pending Tasks:
\${userTasks.map(t => \`- \${t.title} (\${t.estimatedDuration}m)\`).join('\\n')}
User's Memory Dock (Later/Ideas):
\${userDockItems.map(d => \`- \${d.content}\`).join('\\n')}
User's Average Focus Session Length: \${Math.round(avgDuration)} minutes.
      \`;`;

code = code.replace(oldContextStr, newContextStr);

code = code.replace(
  "You can suggest which task they should work on, or help them organize their thoughts.",
  "You can suggest which task they should work on, or help them organize their thoughts. If they ask you to plan their day (like 'Plan my day' or 'Auto Plan My Day'), provide a very clear, structured schedule based on their tasks and their average focus length. Keep it empathetic and actionable, format with bullet points or numbered lists."
);

fs.writeFileSync('server.ts', code);
