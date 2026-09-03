const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Fix DELETE tasks logic
code = code.replace(
  `const result = await tx.delete(tasks)
          .where(and(eq(tasks.id, taskId), eq(tasks.userId, req.user!.uid)))
          .returning();
        
        if (result.length === 0) {
          return false;
        }

        await tx.delete(taskSteps).where(eq(taskSteps.taskId, taskId));
        await tx.delete(focusSessions).where(eq(focusSessions.taskId, taskId));`,
  `const taskCheck = await tx.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, req.user!.uid)));
        if (taskCheck.length === 0) {
          return false;
        }

        // Delete children first
        await tx.delete(taskSteps).where(eq(taskSteps.taskId, taskId));
        await tx.delete(focusSessions).where(eq(focusSessions.taskId, taskId));

        // Delete parent
        await tx.delete(tasks)
          .where(and(eq(tasks.id, taskId), eq(tasks.userId, req.user!.uid)));`
);

// Add PUT for memory dock
if (!code.includes('app.put("/api/memory-dock/:id"')) {
  code = code.replace(
    'app.delete("/api/memory-dock/:id"',
    `app.put("/api/memory-dock/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { content } = req.body;
      const result = await db.update(memoryItems)
        .set({ content })
        .where(and(eq(memoryItems.id, id), eq(memoryItems.userId, req.user!.uid)))
        .returning();
      if (result.length === 0) return res.status(404).json({ error: "Item not found" });
      res.json(result[0]);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to update memory item" });
    }
  });

  app.delete("/api/memory-dock/:id"`
  );
}

// Add Auto Plan endpoint
if (!code.includes('app.post("/api/ai/plan-day"')) {
  code = code.replace(
    '// Vite middleware for development',
    `// AI Day Planner API
  app.post("/api/ai/plan-day", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      // Fetch user context
      const userTasks = await db.select().from(tasks).where(and(eq(tasks.userId, uid), eq(tasks.status, 'pending')));
      const userFocus = await db.select().from(focusSessions).where(eq(focusSessions.userId, uid)).limit(20);
      
      const totalSessions = userFocus.length;
      const avgDuration = totalSessions > 0 ? userFocus.reduce((acc, curr) => acc + (curr.actualDuration || 0), 0) / totalSessions : 0;
      
      const contextStr = \`User's Pending Tasks:
\${userTasks.map(t => \`- ID: \${t.id}, Title: \${t.title} (\${t.estimatedDuration || 10}m)\`).join('\\n')}
Average focus session length: \${Math.round(avgDuration)} minutes.
      \`;
      
      const prompt = \`You are an AI day planner that learns from user habits. Given the following context of pending tasks and past focus session duration averages, generate a highly structured schedule for today.
Context:
\${contextStr}

Format your output as a JSON object with this exact structure:
{
  "greeting": "A short, motivating message based on their average focus duration.",
  "suggestedTasks": [
    { "taskId": <number>, "reason": "Why this task should be done today." }
  ],
  "newHabits": [
    "A small, actionable habit or routine suggestion based on their data."
  ]
}

Only output valid JSON, no markdown blocks. Do not invent task IDs that are not provided.
\`;
      const aiResponse = await generateContentWithRetry({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });
      
      let cleanedAiText = aiResponse.text || "{}"; 
      cleanedAiText = cleanedAiText.replace(/\`\`\`json\\n?/gi, "").replace(/\`\`\`\\n?/g, "").trim(); 
      const planData = JSON.parse(cleanedAiText);
      
      res.json(planData);
    } catch (error: any) {
      console.error("AI Plan Day Error:", error);
      res.status(500).json({ error: "Failed to plan day" });
    }
  });

  // Vite middleware for development`
  );
}

fs.writeFileSync('server.ts', code);
