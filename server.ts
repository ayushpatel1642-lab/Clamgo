import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { db } from "./src/db/index.ts";
import { profiles, tasks, taskSteps, brainDumps, memoryItems, focusSessions, aiInteractions, reminders } from "./src/db/schema.ts";
import { eq, desc, and } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY environment variable is required");
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Setup user profile
  app.post("/api/users/sync", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || "";
      const displayName = req.user!.name || "";

      const result = await db.insert(profiles)
        .values({ uid, email, displayName })
        .onConflictDoUpdate({
          target: profiles.uid,
          set: { email, displayName },
        })
        .returning();

      res.json(result[0]);
    } catch (error: any) {
      console.error("Failed to sync user:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Tasks API
  // Reminders API
  app.get("/api/reminders/due", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const now = new Date();
      // Find unacknowledged reminders where triggerTime <= now
      const due = await db.select().from(reminders)
        .where(and(
          eq(reminders.userId, uid),
          eq(reminders.isAcknowledged, false)
        ));
      
      const actuallyDue = due.filter(r => new Date(r.triggerTime) <= now);

      // Mark them as acknowledged so we don't notify again
      if (actuallyDue.length > 0) {
        const ids = actuallyDue.map(r => r.id);
        // We have to update them one by one or in a batch if Drizzle supports it. 
        // Or simply mark all matching as true.
        for (const r of actuallyDue) {
          await db.update(reminders).set({ isAcknowledged: true }).where(eq(reminders.id, r.id));
        }
      }

      res.json(actuallyDue);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch reminders" });
    }
  });

  app.get("/api/tasks", requireAuth, async (req: AuthRequest, res) => {
    try {
      const status = req.query.status as string;
      let query = db.select().from(tasks).where(eq(tasks.userId, req.user!.uid));
      
      const allTasks = await query;
      // Filter in memory for simplicity or add drizzle where clauses
      const filtered = status ? allTasks.filter(t => t.status === status) : allTasks;
      
      res.json(filtered.sort((a, b) => b.id - a.id));
    } catch (error: any) {
      console.error("Fetch tasks error", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { title, description, estimatedDuration } = req.body;
      const result = await db.insert(tasks).values({
        userId: req.user!.uid,
        title,
        description,
        estimatedDuration
      }).returning();
      
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // Brain Dump API
  app.post("/api/braindump/process", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { rawText } = req.body;
      const uid = req.user!.uid;

      // Call Gemini to structure the data
      const prompt = `You are an ADHD executive-function assistant. The user has provided a "brain dump" of messy thoughts.
Extract actionable items into a structured JSON format. Categorize them into tasks, reminders, ideas, and notes.

Brain dump text:
"${rawText}"

For reminders, if a time or date is mentioned, parse it into an ISO 8601 UTC timestamp string. If no time is mentioned, set it for 2 hours from now. Today's date/time is ${new Date().toISOString()}.

Output strict JSON only, using this schema:
{
  "tasks": [{ "title": "...", "description": "...", "estimatedDurationMinutes": 30 }],
  "reminders": [{ "title": "...", "triggerTime": "ISO timestamp string" }],
  "notes": [{ "content": "..." }]
}
`;

      const aiResponse = await getAi().models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const organizedData = JSON.parse(aiResponse.text || "{}");

      // Save raw dump
      const dumpResult = await db.insert(brainDumps).values({
        userId: uid,
        rawText,
        organizedData,
        isProcessed: false // Not yet confirmed
      }).returning();

      res.json({ success: true, dumpId: dumpResult[0].id, organizedData });
    } catch (error: any) {
      console.error("Brain dump process error", error);
      res.status(500).json({ error: "Failed to process brain dump" });
    }
  });

  app.post("/api/braindump/:id/confirm", requireAuth, async (req: AuthRequest, res) => {
    try {
      const dumpId = parseInt(req.params.id);
      const { organizedData } = req.body;
      const uid = req.user!.uid;

      // Verify ownership
      const dump = await db.select().from(brainDumps).where(and(eq(brainDumps.id, dumpId), eq(brainDumps.userId, uid))).limit(1);
      if (dump.length === 0) {
        return res.status(404).json({ error: "Brain dump not found" });
      }

      // Create tasks
      if (organizedData.tasks && organizedData.tasks.length > 0) {
        const tasksToInsert = organizedData.tasks.map((t: any) => ({
          userId: uid,
          title: t.title,
          description: t.description || "",
          estimatedDuration: t.estimatedDurationMinutes || 15
        }));
        await db.insert(tasks).values(tasksToInsert);
      }

      // Create memory items / notes
      if (organizedData.notes && organizedData.notes.length > 0) {
        const notesToInsert = organizedData.notes.map((n: any) => ({
          userId: uid,
          content: n.content,
          type: "note"
        }));
        await db.insert(memoryItems).values(notesToInsert);
      }

      // Reminders
      if (organizedData.reminders && organizedData.reminders.length > 0) {
        const remindersToInsert = organizedData.reminders.map((r: any) => {
          let triggerTime = new Date();
          if (r.triggerTime) {
            triggerTime = new Date(r.triggerTime);
            if (isNaN(triggerTime.getTime())) {
              triggerTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // fallback 2 hrs
            }
          } else {
            triggerTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // fallback 2 hrs
          }
          return {
            userId: uid,
            title: r.title,
            triggerTime
          };
        });
        await db.insert(reminders).values(remindersToInsert);
      }
      
      await db.update(brainDumps).set({ isProcessed: true, organizedData }).where(eq(brainDumps.id, dumpId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Brain dump confirm error", error);
      res.status(500).json({ error: "Failed to confirm brain dump" });
    }
  });

  // Task detail API
  app.get("/api/tasks/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const taskResult = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      
      if (taskResult.length === 0 || taskResult[0].userId !== req.user!.uid) {
        return res.status(404).json({ error: "Task not found" });
      }

      const stepsResult = await db.select().from(taskSteps).where(eq(taskSteps.taskId, taskId));
      
      res.json({
        task: taskResult[0],
        steps: stepsResult.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  app.put("/api/tasks/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const { status } = req.body;
      const result = await db.update(tasks)
        .set({ status })
        .where(and(eq(tasks.id, taskId), eq(tasks.userId, req.user!.uid)))
        .returning();
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.put("/api/tasks/:taskId/steps/:stepId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const stepId = parseInt(req.params.stepId);
      const { isCompleted } = req.body;
      
      // Verify task belongs to user
      const taskResult = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, req.user!.uid))).limit(1);
      if (taskResult.length === 0) {
        return res.status(404).json({ error: "Task not found" });
      }

      const result = await db.update(taskSteps)
        .set({ isCompleted })
        .where(and(eq(taskSteps.id, stepId), eq(taskSteps.taskId, taskId)))
        .returning();
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update step" });
    }
  });

  app.post("/api/tasks/:id/decompose", requireAuth, async (req: AuthRequest, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const uid = req.user!.uid;

      const taskResult = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      if (taskResult.length === 0 || taskResult[0].userId !== uid) {
        return res.status(404).json({ error: "Task not found" });
      }

      const prompt = `You are an ADHD executive-function assistant. Break down the following task into 3-5 very small, actionable, and concrete steps.
Task: "${taskResult[0].title}"

Output strict JSON only, using this schema:
{
  "steps": [{ "title": "...", "estimatedDurationMinutes": 5 }]
}
`;

      const aiResponse = await getAi().models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const organizedData = JSON.parse(aiResponse.text || "{}");
      
      if (organizedData.steps && organizedData.steps.length > 0) {
        const stepsToInsert = organizedData.steps.map((s: any, idx: number) => ({
          taskId,
          title: s.title,
          estimatedDuration: s.estimatedDurationMinutes || 10,
          orderIndex: idx
        }));
        
        await db.insert(taskSteps).values(stepsToInsert);
      }

      const newSteps = await db.select().from(taskSteps).where(eq(taskSteps.taskId, taskId));

      // Record interaction
      await db.insert(aiInteractions).values({
        userId: uid,
        interactionType: 'decompose',
        prompt: taskResult[0].title,
        response: aiResponse.text || ""
      });

      res.json({ steps: newSteps.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)) });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to decompose task" });
    }
  });

  app.post("/api/focus-sessions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { taskId, duration, actualDuration, completed } = req.body;
      const result = await db.insert(focusSessions).values({
        userId: req.user!.uid,
        taskId: taskId || null,
        duration,
        actualDuration,
        completed
      }).returning();
      
      // If task is provided and focus is completed, maybe mark task as done or add logic
      
      res.json(result[0]);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to record session" });
    }
  });

  app.post("/api/ai/stuck", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { taskId, taskTitle, reason } = req.body;
      const uid = req.user!.uid;

      const prompt = `You are an ADHD executive-function coach. The user is stuck on a task.
Task: ${taskTitle || "General friction, no specific task selected"}
Reason for being stuck: ${reason} (e.g., overwhelm, unclear, boredom, energy)

Provide a very brief (2-3 short paragraphs), highly actionable, and empathetic intervention to help them overcome this specific friction and take just one tiny step forward. Avoid generic advice. Be specific and unconventional if needed for ADHD brains.`;

      const aiResponse = await getAi().models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const intervention = aiResponse.text;

      await db.insert(aiInteractions).values({
        userId: uid,
        interactionType: 'stuck',
        prompt: `Stuck on ${taskTitle} because of ${reason}`,
        response: intervention || ""
      });

      res.json({ intervention });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to generate intervention" });
    }
  });

  // Memory Dock API
  app.get("/api/memory-dock", requireAuth, async (req: AuthRequest, res) => {
    try {
      const items = await db.select().from(memoryItems).where(eq(memoryItems.userId, req.user!.uid));
      res.json(items.sort((a, b) => b.id - a.id));
    } catch (e: any) {
      res.status(500).json({ error: "Failed to fetch memory dock" });
    }
  });

  app.post("/api/memory-dock", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { content } = req.body;
      const result = await db.insert(memoryItems).values({
        userId: req.user!.uid,
        content,
        type: 'note'
      }).returning();
      res.json(result[0]);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to add memory item" });
    }
  });

  app.delete("/api/memory-dock/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(memoryItems).where(and(eq(memoryItems.id, id), eq(memoryItems.userId, req.user!.uid)));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to delete memory item" });
    }
  });

  // Insights API
  app.get("/api/insights", requireAuth, async (req: AuthRequest, res) => {
    try {
      const sessions = await db.select().from(focusSessions).where(eq(focusSessions.userId, req.user!.uid));
      
      const totalSessions = sessions.length;
      const totalMinutes = sessions.reduce((acc, curr) => acc + (curr.actualDuration || 0), 0);
      const avgDuration = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;
      
      // Get last 7 sessions for chart
      const recentSessions = sessions
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
        .reverse()
        .map(s => ({ duration: s.actualDuration, completed: s.completed }));

      res.json({
        totalSessions,
        totalMinutes,
        avgDuration,
        recentSessions
      });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to fetch insights" });
    }
  });

  // AI Coach API
  app.post("/api/ai/coach", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { message, history = [] } = req.body;
      const uid = req.user!.uid;

      // Fetch user context
      const userTasks = await db.select().from(tasks).where(and(eq(tasks.userId, uid), eq(tasks.status, 'pending')));
      const userDockItems = await db.select().from(memoryItems).where(eq(memoryItems.userId, uid));

      const contextStr = `
User's Pending Tasks:
${userTasks.map(t => `- ${t.title} (${t.estimatedDuration}m)`).join('\n')}

User's Memory Dock (Later/Ideas):
${userDockItems.map(d => `- ${d.content}`).join('\n')}
      `;

      let historyStr = "";
      if (history.length > 0) {
        historyStr = "\nPrevious Conversation:\n" + history.map((m: any) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`).join('\n');
      }

      const prompt = `You are an ADHD executive-function coach. The user says: "${message}". 
Here is their current context to help you give better advice:
${contextStr}
${historyStr}

Provide a very brief, highly actionable, and empathetic response. Avoid generic advice. Be specific and unconventional if needed for ADHD brains. Keep it under 3 paragraphs. You can suggest which task they should work on, or help them organize their thoughts.`;

      const aiResponse = await getAi().models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      await db.insert(aiInteractions).values({
        userId: uid,
        interactionType: 'coach',
        prompt: message,
        response: aiResponse.text || ""
      });

      res.json({ reply: aiResponse.text });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to communicate with AI coach" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
