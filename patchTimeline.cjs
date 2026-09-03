const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /const prompt = `You are an expert ADHD-friendly productivity assistant[\s\S]*?\]\n\}`;/;

const replacement = `      // Fetch steps for these tasks
      let tasksWithSteps = [];
      if (currentTasks.length > 0) {
        const taskIds = currentTasks.map((t: any) => t.id);
        const allSteps = await db.select().from(taskSteps);
        const relevantSteps = allSteps.filter(s => taskIds.includes(s.taskId) && !s.isCompleted);
        
        tasksWithSteps = currentTasks.map((t: any) => {
          const steps = relevantSteps.filter(s => s.taskId === t.id);
          return {
            id: t.id,
            title: t.title,
            duration: t.estimatedDuration,
            steps: steps.map(s => ({ id: s.id, title: s.title, duration: s.estimatedDuration }))
          };
        });
      }

      const prompt = \`You are an expert ADHD-friendly productivity assistant (like Motion or Sunsama). \${timeContext}
The user has the following tasks pending:
\${JSON.stringify(tasksWithSteps)}
Create a highly feasible, realistic schedule.
Rules:
1. Dynamically calculate realistic durations for tasks based on their complexity (usually 15-90 mins per chunk).
2. If a task has "steps", you MUST schedule the individual steps as separate consecutive blocks instead of one large task block. Label them with type: "step". This is critical because the user broke this task down.
3. Adapt the schedule intelligently based on real-time availability (\${timeContext}). Prioritize quick wins first to build momentum.
4. Insert regular breaks (e.g., 5-15 mins) to prevent burnout.
5. Only include tasks that realistically fit into the user's available time frame today.
6. Output JSON strictly matching this schema:
{
  "schedule": [
    { "type": "task", "taskId": number, "duration": number },
    { "type": "step", "taskId": number, "stepId": number, "title": "string", "duration": number },
    { "type": "break", "title": "string", "duration": number }
  ]
}\`;`;

code = code.replace(regex, replacement);
fs.writeFileSync('server.ts', code);
