const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Modify the auto-schedule API to include steps
const target = `      const prompt = \\\`You are an expert ADHD-friendly productivity assistant (like Motion or Sunsama). \${timeContext}
The user has the following tasks pending:
\${JSON.stringify(currentTasks.map((t: any) => ({ id: t.id, title: t.title, duration: t.estimatedDuration })))}
Create a highly feasible, realistic schedule.
Rules:`;

const replacement = `      // Fetch steps for these tasks
      let tasksWithSteps = [];
      if (currentTasks.length > 0) {
        const taskIds = currentTasks.map((t: any) => t.id);
        const allSteps = await db.select().from(taskSteps); // Simple fetch all and filter for now, optimize later if needed
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

      const prompt = \\\`You are an expert ADHD-friendly productivity assistant (like Motion or Sunsama). \${timeContext}
The user has the following tasks pending:
\${JSON.stringify(tasksWithSteps)}
Create a highly feasible, realistic schedule.
Rules:
1. Dynamically calculate realistic durations for tasks based on their complexity (usually 15-90 mins per chunk).
2. If a task has "steps", you MUST schedule the individual steps as separate consecutive blocks instead of one large task block. Label them with type: "step". This is critical because the user broke this task down.
3. Adapt the schedule intelligently based on real-time availability (\${timeContext}). Prioritize quick wins first to build momentum.
4. Output JSON strictly matching this schema:
{
  "schedule": [
    { "type": "task", "taskId": number, "duration": number },
    { "type": "step", "taskId": number, "stepId": number, "title": "string", "duration": number },
    { "type": "break", "title": "string", "duration": number }
  ]
}
Do not include any rules other than those specified here.\`;`;

code = code.replace(
  /const prompt = `You are an expert ADHD-friendly productivity assistant[\s\S]*?\]\n\}`;/,
  replacement
);

fs.writeFileSync('server.ts', code);
