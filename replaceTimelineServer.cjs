const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const route = `
  app.post("/api/timeline/auto-schedule", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const { tasks: currentTasks, currentTime, availableHours = 8 } = req.body;

      if (!currentTasks || currentTasks.length === 0) {
        return res.json({ schedule: [] });
      }
      
      const timeContext = currentTime ? \`The current local time is \${new Date(currentTime).toLocaleTimeString()}. The user has roughly \${availableHours} hours of available time left today.\` : '';

      const prompt = \`You are an expert ADHD-friendly productivity assistant (like Motion or Sunsama). 
\${timeContext}

The user has the following tasks pending:
\${JSON.stringify(currentTasks.map((t: any) => ({ id: t.id, title: t.title, duration: t.estimatedDuration })))}

Create a highly feasible, realistic schedule.
Rules:
1. Dynamically calculate realistic durations for tasks based on their complexity (usually 15-90 mins per chunk). If a task is inherently large, break it down conceptually into a time block.
2. Adapt the schedule intelligently based on real-time availability (\${timeContext}). If there are too many tasks for the remaining time, prioritize them: include the most critical/momentum-building ones today, and for the ones that don't fit, mark them as 'postpone' (we will just return them as tasks, but perhaps schedule fewer of them or just fit what you can). Actually, for now, just schedule what fits reasonably in the available hours, prioritizing quick wins first to build momentum.
3. Order them to build momentum (e.g., start with a quick/easy win, then a hard task, then easy).
4. Insert regular breaks (e.g., 5-15 mins) to prevent burnout. Label breaks creatively (e.g., "Stretch & Hydrate", "Eye Rest", "Walk around").
5. Only include tasks that realistically fit into the user's available time frame today. It is OK to leave some tasks out if they do not fit; they will simply remain pending in the backlog.
6. Output JSON strictly matching this schema:
{
  "schedule": [
    { "type": "task", "taskId": number, "duration": number },
    { "type": "break", "title": "string", "duration": number }
  ]
}
\`;

      const aiResponse = await getAi().models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      let cleanedAiText = aiResponse.text || "{}"; 
      cleanedAiText = cleanedAiText.replace(/\`\`\`json\\n?/gi, "").replace(/\`\`\`\\n?/g, "").trim(); 
      const organizedData = JSON.parse(cleanedAiText);
      
      // Update estimated durations based on AI for the scheduled ones
      if (organizedData.schedule) {
        for (const item of organizedData.schedule) {
          if (item.type === 'task' && item.taskId) {
            await db.update(tasks).set({ estimatedDuration: item.duration }).where(and(eq(tasks.id, item.taskId), eq(tasks.userId, uid)));
          }
        }
      }
      
      res.json(organizedData);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to auto-schedule" });
    }
  });
`;

// Replace the old route block.
// I'll use a regex to match from app.post("/api/timeline/auto-schedule" to its closing block.
const regex = /app\.post\("\/api\/timeline\/auto-schedule", requireAuth, async \(req: AuthRequest, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ error: "Failed to auto-schedule" \}\);\n\s*\}\n\s*\}\);/;
if (regex.test(code)) {
  code = code.replace(regex, route.trim());
  fs.writeFileSync('server.ts', code);
  console.log("Successfully replaced auto-schedule route.");
} else {
  console.log("Could not find auto-schedule route to replace.");
}

