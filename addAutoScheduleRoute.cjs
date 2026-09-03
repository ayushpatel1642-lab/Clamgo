const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const route = `
  app.post("/api/timeline/auto-schedule", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const { tasks: currentTasks } = req.body;

      if (!currentTasks || currentTasks.length === 0) {
        return res.json({ schedule: [] });
      }

      const prompt = \`You are an expert ADHD-friendly productivity assistant (like Motion or Sunsama). 
The user has the following tasks pending for today:
\${JSON.stringify(currentTasks.map((t: any) => ({ id: t.id, title: t.title, duration: t.estimatedDuration })))}

Create a highly feasible, realistic schedule for a human.
Rules:
1. Estimate durations for tasks if they are missing or unrealistic (e.g., usually 15-60 mins per chunk). Break down conceptually into time blocks.
2. Order them to build momentum (e.g., start with a quick/easy win, then a hard task, then easy).
3. Insert regular breaks (e.g., 5-15 mins) to prevent burnout. Label breaks creatively (e.g., "Stretch & Hydrate", "Eye Rest", "Walk around").
4. Ensure every task provided in the input is included exactly once.
5. Output JSON strictly matching this schema:
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
      
      // Update estimated durations based on AI
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

code = code.replace('app.get("/api/tasks"', route + '\n  app.get("/api/tasks"');
fs.writeFileSync('server.ts', code);
