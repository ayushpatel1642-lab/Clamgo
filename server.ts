import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { db } from "./src/db/index.ts";
import { profiles, tasks, taskSteps, brainDumps, memoryItems, focusSessions, aiInteractions, reminders } from "./src/db/schema.ts";
import { eq, desc, asc, and } from "drizzle-orm";
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


async function generateContentWithRetry(request: any, maxRetries = 5): Promise<any> {
  let retries = 0;
  while (true) {
    try {
      return await getAi().models.generateContent(request);
    } catch (error: any) {
      if ((error?.status === 503 || error?.status === 'UNAVAILABLE' || error?.code === 503 || (error.message && error.message.includes('503')) || error?.status === 429 || error?.code === 429 || error?.status === 'RESOURCE_EXHAUSTED' || (error.message && error.message.includes('429'))) && retries < maxRetries) {
        const backoff = Math.pow(2, retries) * 1000 + Math.random() * 1000;
        console.warn(`Gemini API overloaded or rate limited (${error?.status || 503}). Retrying in ${Math.round(backoff)}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        retries++;
      } else {
        throw error;
      }
    }
  }
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
  // Get all reminders for current user
  app.get("/api/reminders", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;

      // Ensure profile exists
      await db.insert(profiles).values({
        uid,
        email: req.user?.email || `${uid}@example.com`,
        displayName: req.user?.name || "User"
      }).onConflictDoNothing();

      let userReminders = await db.select().from(reminders)
        .where(eq(reminders.userId, uid))
        .orderBy(asc(reminders.triggerTime));

      // If user has no reminders, adopt any orphan reminders (e.g. from guest/demo sessions)
      if (userReminders.length === 0) {
        const orphanReminders = await db.select().from(reminders).orderBy(asc(reminders.triggerTime));
        if (orphanReminders.length > 0) {
          await db.update(reminders).set({ userId: uid });
          userReminders = await db.select().from(reminders)
            .where(eq(reminders.userId, uid))
            .orderBy(asc(reminders.triggerTime));
        }
      }

      res.json(userReminders);
    } catch (error: any) {
      console.error("Failed to fetch reminders:", error);
      res.status(500).json({ error: error.message || "Failed to fetch reminders" });
    }
  });

  // Create a new reminder
  app.post("/api/reminders", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const { title, triggerTime } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: "Reminder title is required" });
      }

      // Ensure profile exists
      await db.insert(profiles).values({
        uid,
        email: req.user?.email || `${uid}@example.com`,
        displayName: req.user?.name || "User"
      }).onConflictDoNothing();

      let targetDate = triggerTime ? new Date(triggerTime) : null;
      if (!targetDate || isNaN(targetDate.getTime())) {
        targetDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hr default
      }

      const created = await db.insert(reminders).values({
        userId: uid,
        title: title.trim(),
        triggerTime: targetDate,
        isDelivered: false,
        isAcknowledged: false
      }).returning();

      res.json(created[0]);
    } catch (error: any) {
      console.error("Failed to create reminder:", error);
      res.status(500).json({ error: error.message || "Failed to create reminder" });
    }
  });

  // Update a reminder
  app.put("/api/reminders/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const uid = req.user!.uid;
      const { title, triggerTime, isAcknowledged } = req.body;

      const updateData: any = {};
      if (title !== undefined) updateData.title = title.trim();
      if (triggerTime !== undefined) {
        const d = new Date(triggerTime);
        if (!isNaN(d.getTime())) {
          updateData.triggerTime = d;
          updateData.isDelivered = false; // Reset delivery on time change
        }
      }
      if (isAcknowledged !== undefined) updateData.isAcknowledged = Boolean(isAcknowledged);

      const updated = await db.update(reminders)
        .set(updateData)
        .where(and(eq(reminders.id, id), eq(reminders.userId, uid)))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ error: "Reminder not found" });
      }

      res.json(updated[0]);
    } catch (error: any) {
      console.error("Failed to update reminder:", error);
      res.status(500).json({ error: error.message || "Failed to update reminder" });
    }
  });

  // Delete a reminder
  app.delete("/api/reminders/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const uid = req.user!.uid;

      await db.delete(reminders).where(and(eq(reminders.id, id), eq(reminders.userId, uid)));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete reminder:", error);
      res.status(500).json({ error: error.message || "Failed to delete reminder" });
    }
  });

  // Acknowledge / mark done a reminder
  app.post("/api/reminders/:id/acknowledge", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const uid = req.user!.uid;

      const updated = await db.update(reminders)
        .set({ isAcknowledged: true })
        .where(and(eq(reminders.id, id), eq(reminders.userId, uid)))
        .returning();

      res.json({ success: true, reminder: updated[0] });
    } catch (error: any) {
      console.error("Failed to acknowledge reminder:", error);
      res.status(500).json({ error: error.message || "Failed to acknowledge reminder" });
    }
  });

  // Snooze a reminder
  app.post("/api/reminders/:id/snooze", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const uid = req.user!.uid;
      const minutes = parseInt(req.body.minutes) || 15;

      const newTrigger = new Date(Date.now() + minutes * 60 * 1000);

      const updated = await db.update(reminders)
        .set({
          triggerTime: newTrigger,
          isDelivered: false,
          isAcknowledged: false
        })
        .where(and(eq(reminders.id, id), eq(reminders.userId, uid)))
        .returning();

      res.json({ success: true, reminder: updated[0] });
    } catch (error: any) {
      console.error("Failed to snooze reminder:", error);
      res.status(500).json({ error: error.message || "Failed to snooze reminder" });
    }
  });

  // Due reminders endpoint
  app.get("/api/reminders/due", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const now = new Date();
      // Find unacknowledged reminders that haven't been delivered yet and triggerTime <= now
      const due = await db.select().from(reminders)
        .where(and(
          eq(reminders.userId, uid),
          eq(reminders.isAcknowledged, false),
          eq(reminders.isDelivered, false)
        ));
      
      const actuallyDue = due.filter(r => new Date(r.triggerTime) <= now);

      // Mark delivered so notification toast triggers once
      if (actuallyDue.length > 0) {
        for (const r of actuallyDue) {
          await db.update(reminders).set({ isDelivered: true }).where(eq(reminders.id, r.id));
        }
      }

      res.json(actuallyDue);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch due reminders" });
    }
  });

  
  app.post("/api/timeline/auto-schedule", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const { 
        tasks: currentTasks, 
        currentTime, 
        startTime, 
        endTime, 
        availableHours = 8, 
        algorithmPreference = 'circadian' 
      } = req.body;

      if (!currentTasks || currentTasks.length === 0) {
        return res.json({ schedule: [] });
      }
      
      const timeContext = `Current time: ${currentTime ? new Date(currentTime).toLocaleTimeString() : 'Morning'}. Custom Window: ${startTime || '09:00'} to ${endTime || '18:00'} (~${availableHours}h available). Algorithm Strategy: ${algorithmPreference}.`;

      const prompt = `You are an elite AI chronobiology scheduler and ADHD executive-function architect.
${timeContext}

Pending tasks:
${JSON.stringify(currentTasks.map((t: any) => ({ id: t.id, title: t.title, duration: t.estimatedDuration || 25 })))}

Your objective is to sequence these tasks into a realistic, chronobiologically optimal timeline that respects human circadian energy cycles and real-world causality.

CORE ALGORITHM RULES (${algorithmPreference.toUpperCase()} MODE):
1. CHRONOBIOLOGY & ENERGY CURVES:
   - High cognitive stamina or intimidating tasks MUST be scheduled during morning peak focus windows (approx 9:30 AM to 12:00 PM).
   - Afternoon post-lunch dip (1:30 PM to 3:00 PM) MUST be assigned to lighter, lower-friction tasks or admin/reviews.
   - If algorithm is 'momentum', start the entire day with the single easiest/quickest task (< 15 mins) to trigger dopamine before deep work.

2. ABSOLUTE TEMPORAL SEQUENCING & MEAL CADENCE:
   - Morning routines (Breakfast, Morning Coffee, Planning, Morning Stroll) MUST come first.
   - Breakfast MUST always precede Lunch and Dinner.
   - Midday items (Lunch, Midday walk, Noon sync) MUST occur in the middle of the schedule, strictly after breakfast.
   - Dinner, evening wind-down, and nighttime routines MUST occur after lunch, towards the end.
   - Dinner MUST always come after Lunch.
   - Logical dependencies: Preparation tasks always precede execution (e.g. draft slides before presentation).

3. RESTORATIVE PACING & ADHD BUFFERS:
   - Between intense focus blocks (≥ 40 mins), insert a rejuvenating 5-15 minute restorative break ("Hydrate & Breathe", "Eye Rest & Stretch", "Midday Walk").
   - Total scheduled duration should reasonably fit within the ${availableHours}-hour target window.

OUTPUT FORMAT:
Strict valid JSON only:
{
  "reasoning": "A concise 2-sentence explanation of why tasks were scheduled in this exact chronological and energetic order (highlighting peak hours, meal flow, and momentum).",
  "schedule": [
    { "type": "task", "taskId": number, "duration": number },
    { "type": "break", "title": "string", "duration": number }
  ]
}
`;

      const aiResponse = await generateContentWithRetry({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      let cleanedAiText = aiResponse.text || "{}"; 
      cleanedAiText = cleanedAiText.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim(); 
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

  app.get("/api/tasks", requireAuth, async (req: AuthRequest, res) => {
    try {
      const status = req.query.status as string;
      const uid = req.user!.uid;
      
      let userTasks = await db.select().from(tasks).where(eq(tasks.userId, uid));
      
      // In this isolated single-user container, adopt any existing tasks if active user has none
      if (userTasks.length === 0) {
        const allExisting = await db.select().from(tasks);
        if (allExisting.length > 0) {
          await db.update(tasks).set({ userId: uid });
          userTasks = await db.select().from(tasks).where(eq(tasks.userId, uid));
        }
      }
      
      // Filter in memory for simplicity or add drizzle where clauses
      const filtered = status ? userTasks.filter(t => t.status === status) : userTasks;

      // Attach steps to all returned tasks
      const allSteps = await db.select().from(taskSteps);
      const stepsByTaskId: Record<number, any[]> = {};
      for (const step of allSteps) {
        if (!stepsByTaskId[step.taskId]) {
          stepsByTaskId[step.taskId] = [];
        }
        stepsByTaskId[step.taskId].push(step);
      }
      for (const tId in stepsByTaskId) {
        stepsByTaskId[tId].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
      }

      const tasksWithSteps = filtered.map(t => ({
        ...t,
        steps: stepsByTaskId[t.id] || []
      }));
      
      res.json(tasksWithSteps.sort((a, b) => b.id - a.id));
    } catch (error: any) {
      console.error("Fetch tasks error", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { title, description, estimatedDuration } = req.body;
      const uid = req.user!.uid;

      // Ensure user profile exists
      await db.insert(profiles).values({
        uid,
        email: req.user!.email || `${uid}@app.local`,
        displayName: req.user!.name || 'User'
      }).onConflictDoNothing();

      const result = await db.insert(tasks).values({
        userId: uid,
        title,
        description,
        estimatedDuration
      }).returning();
      
      res.json(result[0]);
    } catch (error: any) {
      console.error("Failed to create task:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // Brain Dump API
  app.post("/api/braindump/process", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { rawText, clientNow, clientLocalFormatted, timeZone } = req.body;
      const uid = req.user!.uid;

      const nowRefIso = (typeof clientNow === 'string' && clientNow.trim()) ? clientNow : new Date().toISOString();
      const localFormatted = (typeof clientLocalFormatted === 'string' && clientLocalFormatted.trim()) ? clientLocalFormatted : new Date().toLocaleString();
      const userTz = (typeof timeZone === 'string' && timeZone.trim()) ? timeZone : "UTC";

      // Call Gemini to structure the data
      const prompt = `You are an ADHD executive-function assistant. The user has provided a "brain dump" of messy thoughts.
Extract actionable items into a structured JSON format. Categorize them into tasks, reminders, and notes.

Brain dump text:
"${rawText}"

The user's current live date and time is: ${localFormatted} (ISO string: ${nowRefIso}, timezone: ${userTz}).
CRITICAL TIME INSTRUCTIONS:
- For reminders, calculate any relative or absolute time mentioned (e.g. "today at 4pm", "tonight", "tomorrow morning", "in 30 minutes", "next Monday", etc.) strictly relative to the user's current live date and time (${localFormatted}).
- Set "triggerTime" to an ISO 8601 string.
- If no specific time is mentioned for a reminder, set triggerTime to exactly 2 hours after ${nowRefIso}.

Output strict JSON only, using this schema:
{
  "tasks": [{ "title": "...", "description": "...", "estimatedDurationMinutes": 30 }],
  "reminders": [{ "title": "...", "triggerTime": "ISO timestamp string" }],
  "notes": [{ "content": "..." }]
}
`;

      const aiResponse = await generateContentWithRetry({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      let cleanedAiText = aiResponse.text || "{}";
      cleanedAiText = cleanedAiText.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
      const organizedData = JSON.parse(cleanedAiText);

      // Sanitize reminders triggerTime so none have invalid dates
      if (Array.isArray(organizedData.reminders)) {
        organizedData.reminders = organizedData.reminders.map((r: any) => {
          let t = r.triggerTime ? new Date(r.triggerTime) : null;
          if (!t || isNaN(t.getTime())) {
            const base = new Date(nowRefIso);
            const fallback = isNaN(base.getTime()) ? new Date() : base;
            t = new Date(fallback.getTime() + 2 * 60 * 60 * 1000);
          }
          return {
            title: r.title || "Reminder",
            triggerTime: t.toISOString()
          };
        });
      }

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

  app.delete("/api/tasks/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const taskId = parseInt(req.params.id);
      if (isNaN(taskId)) {
        return res.status(400).json({ error: "Invalid task ID" });
      }
      
      const success = await db.transaction(async (tx) => {
        const taskCheck = await tx.select().from(tasks).where(eq(tasks.id, taskId));
        if (taskCheck.length === 0) {
          return false;
        }

        // Delete children first
        await tx.delete(taskSteps).where(eq(taskSteps.taskId, taskId));
        await tx.delete(focusSessions).where(eq(focusSessions.taskId, taskId));

        // Delete parent
        await tx.delete(tasks).where(eq(tasks.id, taskId));
        return true;
      });

      if (!success) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete task error:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Task detail API
  app.get("/api/tasks/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const taskId = parseInt(req.params.id);
      if (isNaN(taskId)) {
        return res.status(400).json({ error: "Invalid task ID" });
      }

      const taskResult = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      
      if (taskResult.length === 0) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Ensure active user owns this task so subsequent updates/deletes succeed
      if (taskResult[0].userId !== req.user!.uid) {
        await db.update(tasks).set({ userId: req.user!.uid }).where(eq(tasks.id, taskId));
        taskResult[0].userId = req.user!.uid;
      }

      const stepsResult = await db.select().from(taskSteps).where(eq(taskSteps.taskId, taskId));
      
      res.json({
        task: taskResult[0],
        steps: stepsResult.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
      });
    } catch (error: any) {
      console.error("Fetch task error:", error);
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  app.put("/api/tasks/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const taskId = parseInt(req.params.id);
      if (isNaN(taskId)) {
        return res.status(400).json({ error: "Invalid task ID" });
      }
      const { status, title, estimatedDuration } = req.body;
      
      const updateData: any = {};
      if (status !== undefined) {
        updateData.status = status;
        if (status === 'completed') {
          updateData.updatedAt = new Date();
        }
      }
      if (title !== undefined) updateData.title = title;
      if (estimatedDuration !== undefined) updateData.estimatedDuration = estimatedDuration;
      if (req.body.createdAt !== undefined) updateData.createdAt = new Date(req.body.createdAt);
      
      const taskCheck = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      if (taskCheck.length === 0) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Ensure active user owns this task
      updateData.userId = req.user!.uid;

      if (Object.keys(updateData).length === 1 && updateData.userId) {
        // Only userId was set, no field updates
        return res.json(taskCheck[0]);
      }

      const result = await db.update(tasks)
        .set(updateData)
        .where(eq(tasks.id, taskId))
        .returning();
      res.json(result[0]);
    } catch (error: any) {
      console.error("Update task error:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.put("/api/tasks/:taskId/steps/:stepId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const stepId = parseInt(req.params.stepId);
      if (isNaN(taskId) || isNaN(stepId)) {
        return res.status(400).json({ error: "Invalid ID" });
      }
      const { isCompleted, title, estimatedDuration } = req.body;
      
      const taskResult = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      if (taskResult.length === 0) {
        return res.status(404).json({ error: "Task not found" });
      }

      const updateData: any = {};
      if (isCompleted !== undefined) updateData.isCompleted = Boolean(isCompleted);
      if (title !== undefined) updateData.title = String(title).trim();
      if (estimatedDuration !== undefined) updateData.estimatedDuration = Number(estimatedDuration);

      const result = await db.update(taskSteps)
        .set(updateData)
        .where(and(eq(taskSteps.id, stepId), eq(taskSteps.taskId, taskId)))
        .returning();
      res.json(result[0]);
    } catch (error: any) {
      console.error("Update step error:", error);
      res.status(500).json({ error: "Failed to update step" });
    }
  });

  app.post("/api/tasks/:taskId/steps", requireAuth, async (req: AuthRequest, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      if (isNaN(taskId)) return res.status(400).json({ error: "Invalid task ID" });
      const { title, estimatedDuration } = req.body;
      if (!title || !title.trim()) return res.status(400).json({ error: "Step title is required" });

      const existingSteps = await db.select().from(taskSteps).where(eq(taskSteps.taskId, taskId));
      const created = await db.insert(taskSteps).values({
        taskId,
        title: title.trim(),
        estimatedDuration: estimatedDuration || 10,
        isCompleted: false,
        orderIndex: existingSteps.length
      }).returning();

      res.json(created[0]);
    } catch (error: any) {
      console.error("Create step error:", error);
      res.status(500).json({ error: "Failed to create step" });
    }
  });

  app.delete("/api/tasks/:taskId/steps/:stepId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const stepId = parseInt(req.params.stepId);
      if (isNaN(taskId) || isNaN(stepId)) return res.status(400).json({ error: "Invalid ID" });

      await db.delete(taskSteps).where(and(eq(taskSteps.id, stepId), eq(taskSteps.taskId, taskId)));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete step error:", error);
      res.status(500).json({ error: "Failed to delete step" });
    }
  });

  app.post("/api/tasks/:id/decompose", requireAuth, async (req: AuthRequest, res) => {
    try {
      const taskId = parseInt(req.params.id);
      if (isNaN(taskId)) {
        return res.status(400).json({ error: "Invalid task ID" });
      }
      const uid = req.user!.uid;
      const { granularity = 'micro' } = req.body;

      const taskResult = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      if (taskResult.length === 0) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Ensure active user owns this task
      if (taskResult[0].userId !== uid) {
        await db.update(tasks).set({ userId: uid }).where(eq(tasks.id, taskId));
      }

      const prompt = `You are a world-class ADHD executive-function specialist. The user is experiencing resistance or overwhelm on the following task:
Task Title: "${taskResult[0].title}"
Decomposition Granularity: "${granularity}" (micro = 2-min friction breaker first; balanced = standard 15-20m chunks; deep = milestone blocks).

EXECUTIVE FUNCTION BREAKDOWN ALGORITHM:
1. STEP 1 MUST BE A "MICRO-FRICTION BREAKER" (2-4 mins):
   - Make it physically impossible to fail (e.g., "Open document and type 1-line working title", "Put shoes next to front door", "Open browser tab to project repo").
   - This bypasses the amygdala task-initiation freeze.

2. STEPS 2 TO (N-1) - ACTIONABLE VERB-FIRST MOMENTUM CHUNKS (5-20 mins each):
   - Concrete, single-purpose actions. No vague instructions like "think about ideas". Use exact verbs: "Draft", "Outline", "Review", "Test".

3. FINAL STEP - DEFINITION OF DONE & CLOSURE (2-5 mins):
   - Concrete closure trigger (e.g., "Hit submit/send and close the tab", "Put materials back in box and celebrate").

Output strict JSON only:
{
  "steps": [
    { "title": "Verb-first bite-sized action", "estimatedDurationMinutes": number }
  ]
}
`;

      const aiResponse = await generateContentWithRetry({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      let cleanedAiText = aiResponse.text || "{}"; 
      cleanedAiText = cleanedAiText.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim(); 
      const organizedData = JSON.parse(cleanedAiText);
      
      if (organizedData.steps && organizedData.steps.length > 0) {
        // Delete old steps first
        await db.delete(taskSteps).where(eq(taskSteps.taskId, taskId));

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

      const aiResponse = await generateContentWithRetry({
        model: "gemini-3.8-flash",
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
      let items = await db.select().from(memoryItems).where(eq(memoryItems.userId, req.user!.uid));
      if (items.length === 0) {
        const allExisting = await db.select().from(memoryItems);
        if (allExisting.length > 0) {
          await db.update(memoryItems).set({ userId: req.user!.uid });
          items = await db.select().from(memoryItems).where(eq(memoryItems.userId, req.user!.uid));
        }
      }
      res.json(items.sort((a, b) => b.id - a.id));
    } catch (e: any) {
      res.status(500).json({ error: "Failed to fetch memory dock" });
    }
  });

  app.post("/api/memory-dock", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { content } = req.body;
      const uid = req.user!.uid;

      // Ensure profile exists
      await db.insert(profiles).values({
        uid,
        email: req.user!.email || `${uid}@app.local`,
        displayName: req.user!.name || 'User'
      }).onConflictDoNothing();

      const result = await db.insert(memoryItems).values({
        userId: uid,
        content,
        type: 'note'
      }).returning();
      res.json(result[0]);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to add memory item" });
    }
  });

  app.put("/api/memory-dock/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid item ID" });
      const { content } = req.body;
      const result = await db.update(memoryItems)
        .set({ content, userId: req.user!.uid })
        .where(eq(memoryItems.id, id))
        .returning();
      if (result.length === 0) return res.status(404).json({ error: "Item not found" });
      res.json(result[0]);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to update memory item" });
    }
  });

  app.delete("/api/memory-dock/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid item ID" });
      }

      const success = await db.transaction(async (tx) => {
        const itemCheck = await tx.select().from(memoryItems).where(eq(memoryItems.id, id));
        if (itemCheck.length === 0) {
          return false;
        }

        await tx.delete(memoryItems).where(eq(memoryItems.id, id));
        return true;
      });

      if (!success) {
        return res.status(404).json({ error: "Memory item not found" });
      }

      res.json({ success: true, message: "Memory item deleted successfully" });
    } catch (e: any) {
      console.error("Memory item delete error:", e);
      res.status(500).json({ error: "Failed to delete memory item" });
    }
  });

  // Insights API - Historical Task Completion & Deep Work Optimization Analysis
  app.get("/api/insights", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;

      // Fetch user tasks and focus sessions
      let userTasks = await db.select().from(tasks).where(eq(tasks.userId, uid));
      let userSessions = await db.select().from(focusSessions).where(eq(focusSessions.userId, uid));

      // Container adoption fallback if current user has zero data
      if (userTasks.length === 0 && userSessions.length === 0) {
        const allExistingTasks = await db.select().from(tasks);
        if (allExistingTasks.length > 0) {
          await db.update(tasks).set({ userId: uid });
          userTasks = await db.select().from(tasks).where(eq(tasks.userId, uid));
        }
        const allExistingSessions = await db.select().from(focusSessions);
        if (allExistingSessions.length > 0) {
          await db.update(focusSessions).set({ userId: uid });
          userSessions = await db.select().from(focusSessions).where(eq(focusSessions.userId, uid));
        }
      }

      const completedTasks = userTasks.filter(t => t.status === 'completed');
      const totalCompletedTasks = completedTasks.length;
      const totalSessions = userSessions.length;
      const completedSessionsCount = userSessions.filter(s => s.completed).length;
      const totalMinutes = userSessions.reduce((acc, curr) => acc + (curr.actualDuration || 0), 0);
      const avgDuration = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 25;
      const completionRatePercent = totalSessions > 0 ? Math.round((completedSessionsCount / totalSessions) * 100) : 100;

      const hasSufficientData = (totalCompletedTasks + totalSessions) >= 2;

      // Baseline research-backed circadian focus curve (0-23 hours)
      const baselineCircadian = [
        10, 8, 5, 5, 10, 18, 32, 50, 72, 92, 96, 88, // 0 AM - 11 AM
        58, 42, 68, 84, 76, 54, 40, 36, 38, 44, 30, 16 // 12 PM - 11 PM
      ];

      // Calculate historical metrics across all 24 hours of the day
      const rawHours = Array.from({ length: 24 }, (_, h) => {
        let taskCount = 0;
        let focusMinutes = 0;
        let sessionCount = 0;
        let successfulSessions = 0;

        for (const task of completedTasks) {
          const d = new Date(task.updatedAt || task.createdAt || Date.now());
          if (d.getHours() === h) {
            taskCount++;
          }
        }

        for (const session of userSessions) {
          const d = new Date(session.createdAt || Date.now());
          if (d.getHours() === h) {
            sessionCount++;
            focusMinutes += (session.actualDuration || 0);
            if (session.completed) successfulSessions++;
          }
        }

        return {
          hour: h,
          taskCount,
          focusMinutes,
          sessionCount,
          successfulSessions
        };
      });

      // Find max values for normalization
      const maxTasks = Math.max(...rawHours.map(r => r.taskCount), 1);
      const maxMinutes = Math.max(...rawHours.map(r => r.focusMinutes), 1);

      // Compute composite Deep Work Productivity Score (0-100)
      const hourlyData = rawHours.map((item, h) => {
        const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const label = `${hour12} ${ampm}`;
        const displayHour = `${hour12}:00 ${ampm}`;

        let score = baselineCircadian[h];

        if (hasSufficientData) {
          const taskRatio = item.taskCount / maxTasks;
          const minuteRatio = item.focusMinutes / maxMinutes;
          const sessionSuccessRatio = item.sessionCount > 0 ? (item.successfulSessions / item.sessionCount) : 0.5;

          // Empirical performance score (0-100)
          const empiricalScore = Math.min(100, Math.round(
            (taskRatio * 45) + (minuteRatio * 35) + (sessionSuccessRatio * 20)
          ));

          // If real activity happened in this hour, prioritize empirical score
          if (item.taskCount > 0 || item.sessionCount > 0) {
            score = Math.round(empiricalScore * 0.85 + baselineCircadian[h] * 0.15);
          } else {
            // Regress slightly below baseline if user has enough activity elsewhere
            score = Math.round(baselineCircadian[h] * 0.7);
          }
        }

        // Clamp between 5 and 100
        score = Math.max(5, Math.min(100, score));

        return {
          hour: h,
          label,
          displayHour,
          taskCount: item.taskCount,
          focusMinutes: item.focusMinutes,
          sessionCount: item.sessionCount,
          productivityScore: score,
          energyLevel: score >= 80 ? 'Peak Flow' : score >= 60 ? 'Optimal' : score >= 40 ? 'Moderate' : 'Low / Recharge',
          isOptimal: false,
          isSecondary: false,
          isDip: false
        };
      });

      // Identify Peak Deep Work Window (search contiguous 2-3 hour window between 6 AM and 10 PM)
      let bestWindowStart = 9;
      let highestWindowScore = -1;
      for (let h = 6; h <= 20; h++) {
        const windowScore = (hourlyData[h].productivityScore + hourlyData[(h + 1) % 24].productivityScore + (hourlyData[(h + 2) % 24]?.productivityScore || 0)) / 3;
        if (windowScore > highestWindowScore) {
          highestWindowScore = windowScore;
          bestWindowStart = h;
        }
      }

      // Mark top optimal hours
      for (let i = 0; i < 3; i++) {
        const targetHour = (bestWindowStart + i) % 24;
        hourlyData[targetHour].isOptimal = true;
      }

      // Identify Secondary Window (at least 3 hours away from primary window)
      let secondaryWindowStart = (bestWindowStart + 5) % 24;
      let highestSecondaryScore = -1;
      for (let h = 6; h <= 20; h++) {
        const distance = Math.abs(h - bestWindowStart);
        if (distance >= 3 && distance <= 9) {
          const windowScore = (hourlyData[h].productivityScore + hourlyData[(h + 1) % 24].productivityScore) / 2;
          if (windowScore > highestSecondaryScore) {
            highestSecondaryScore = windowScore;
            secondaryWindowStart = h;
          }
        }
      }

      for (let i = 0; i < 2; i++) {
        const targetHour = (secondaryWindowStart + i) % 24;
        if (!hourlyData[targetHour].isOptimal) {
          hourlyData[targetHour].isSecondary = true;
        }
      }

      // Identify daytime dip / recovery zone (between 11 AM and 4 PM)
      let dipHour = 13; // default 1 PM
      let lowestDipScore = 999;
      for (let h = 11; h <= 15; h++) {
        if (hourlyData[h].productivityScore < lowestDipScore && !hourlyData[h].isOptimal) {
          lowestDipScore = hourlyData[h].productivityScore;
          dipHour = h;
        }
      }
      hourlyData[dipHour].isDip = true;

      const formatHourRange = (start: number, spanHours: number) => {
        const end = (start + spanHours) % 24;
        const fmt = (h: number) => {
          const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
          const ampm = h >= 12 ? 'PM' : 'AM';
          return `${h12}:00 ${ampm}`;
        };
        return `${fmt(start)} – ${fmt(end)}`;
      };

      const optimalWindowLabel = formatHourRange(bestWindowStart, 2.5);
      const secondaryWindowLabel = formatHourRange(secondaryWindowStart, 2);
      const dipWindowLabel = formatHourRange(dipHour, 1);

      // Archetype classification
      let archetype = {
        title: "Morning Momentum Architect",
        subtitle: "Front-loads high cognitive tasks before mental fatigue settles in",
        description: "Your completion velocity peaks strongly in the morning hours. Tasks initiated before noon show the highest completion rate and lowest cognitive friction.",
        recommendations: [
          "Tackle your most intimidating task right at 9:00 AM when focus stamina is highest.",
          "Protect the 9:00 AM – 11:30 AM window from meetings or email notifications.",
          "Use the 1:00 PM dip for low-cognitive admin, brain dumps, or physical recharge."
        ]
      };

      if (bestWindowStart >= 11 && bestWindowStart < 14) {
        archetype = {
          title: "Midday Power Engine",
          subtitle: "Reaches maximum flow during late morning and early afternoon",
          description: "You require a gentle morning ramp-up and hit your cognitive zenith in the midday hours, sustaining prolonged deep focus blocks.",
          recommendations: [
            "Use early mornings for lightweight planning and low-pressure routine tasks.",
            "Schedule deep analytical or creative work between 11:00 AM and 2:00 PM.",
            "Take a structured micro-break around 2:30 PM to maintain stamina."
          ]
        };
      } else if (bestWindowStart >= 14 && bestWindowStart < 18) {
        archetype = {
          title: "Afternoon Flow Rider",
          subtitle: "Thrives when daytime noise calms down and momentum gathers",
          description: "Your focus metrics accelerate notably in the afternoon. Once momentum is sparked, your flow blocks remain consistent with minimal task switching.",
          recommendations: [
            "Front-load organization and routine items early so afternoons remain wide open.",
            "Block 2:00 PM – 4:30 PM as sacred uninterrupted deep work territory.",
            "Break tasks into 25-minute Pomodoros before lunch to prime the afternoon pump."
          ]
        };
      } else if (bestWindowStart >= 18 || bestWindowStart < 6) {
        archetype = {
          title: "Late-Night Hyperfocuser",
          subtitle: "Excels when external demands quiet down and distractions vanish",
          description: "Your performance velocity accelerates as evening arrives, benefiting from uninterrupted calm and reduced cognitive clutter.",
          recommendations: [
            "Embrace your natural circadian curve, but ensure restorative sleep buffers.",
            "Capture spontaneous late-night ideas in the Memory Dock instead of losing sleep.",
            "Set explicit timer checkpoints to prevent accidental time blindness."
          ]
        };
      }

      // Time of Day distribution
      const timeBlocks = [
        { name: "Morning (6 AM - 12 PM)", start: 6, end: 11, color: "#3A693A" },
        { name: "Afternoon (12 PM - 5 PM)", start: 12, end: 16, color: "#52796F" },
        { name: "Evening (5 PM - 10 PM)", start: 17, end: 21, color: "#84A98C" },
        { name: "Night (10 PM - 6 AM)", start: 22, end: 5, color: "#CAD2C5" }
      ];

      const timeOfDayBreakdown = timeBlocks.map(block => {
        let tasksInBlock = 0;
        let minutesInBlock = 0;
        let hoursCount = 0;

        for (let h = 0; h < 24; h++) {
          const inBlock = block.start <= block.end 
            ? (h >= block.start && h <= block.end)
            : (h >= block.start || h <= block.end);
          if (inBlock) {
            hoursCount++;
            tasksInBlock += hourlyData[h].taskCount;
            minutesInBlock += hourlyData[h].focusMinutes;
          }
        }

        return {
          name: block.name,
          taskCount: tasksInBlock,
          focusMinutes: minutesInBlock,
          color: block.color
        };
      });

      const totalBlockTasks = timeOfDayBreakdown.reduce((acc, b) => acc + b.taskCount, 0);
      const timeOfDayWithPercent = timeOfDayBreakdown.map(b => ({
        ...b,
        percentage: totalBlockTasks > 0 ? Math.round((b.taskCount / totalBlockTasks) * 100) : (b.name.includes("Morning") ? 45 : b.name.includes("Afternoon") ? 35 : b.name.includes("Evening") ? 15 : 5)
      }));

      // Day of week distribution (Mon - Sun)
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const dayOfWeekData = dayNames.map((name, index) => {
        // JS getDay(): 0 is Sunday, 1 is Monday, ..., 6 is Saturday
        const targetDay = (index + 1) % 7;
        let count = 0;
        let minutes = 0;

        for (const t of completedTasks) {
          const d = new Date(t.updatedAt || t.createdAt || Date.now());
          if (d.getDay() === targetDay) count++;
        }

        for (const s of userSessions) {
          const d = new Date(s.createdAt || Date.now());
          if (d.getDay() === targetDay) minutes += (s.actualDuration || 0);
        }

        // Baseline realistic distribution if sparse
        const defaultBenchmarkCount = [4, 5, 6, 4, 3, 1, 2][index];
        const defaultBenchmarkMinutes = [90, 120, 140, 100, 75, 30, 45][index];

        return {
          day: name,
          taskCount: hasSufficientData ? count : defaultBenchmarkCount,
          focusMinutes: hasSufficientData ? minutes : defaultBenchmarkMinutes,
          isStrongest: false
        };
      });

      // Mark strongest day
      const maxDayTasks = Math.max(...dayOfWeekData.map(d => d.taskCount));
      dayOfWeekData.forEach(d => {
        if (d.taskCount === maxDayTasks && maxDayTasks > 0) d.isStrongest = true;
      });

      // Recent completed tasks list
      const recentCompletions = completedTasks
        .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
        .slice(0, 10)
        .map(t => {
          const date = new Date(t.updatedAt || t.createdAt);
          const h = date.getHours();
          const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
          const ampm = h >= 12 ? 'PM' : 'AM';
          const timeStr = `${h12}:${date.getMinutes().toString().padStart(2, '0')} ${ampm}`;
          return {
            id: t.id,
            title: t.title,
            duration: t.estimatedDuration || 25,
            completedAt: date.toISOString(),
            timeFormatted: timeStr,
            isPeakHour: hourlyData[h]?.isOptimal || false
          };
        });

      // Recent 10 focus sessions
      const recentSessions = userSessions
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
        .map(s => ({
          duration: s.actualDuration,
          plannedDuration: s.duration,
          completed: s.completed,
          createdAt: s.createdAt
        }));

      res.json({
        hasSufficientData,
        hourlyData,
        optimalWindow: {
          startHour: bestWindowStart,
          endHour: (bestWindowStart + 3) % 24,
          label: optimalWindowLabel,
          peakScore: Math.round(highestWindowScore),
          rationale: "Highest task velocity and sustained attention with minimal drop-off."
        },
        secondaryWindow: {
          startHour: secondaryWindowStart,
          endHour: (secondaryWindowStart + 2) % 24,
          label: secondaryWindowLabel,
          rationale: "Secondary focus surge ideal for medium-effort execution and follow-through."
        },
        recoveryWindow: {
          startHour: dipHour,
          endHour: (dipHour + 1) % 24,
          label: dipWindowLabel,
          suggestion: "Natural cognitive lull. Ideal for low-friction planning, sorting Memory Dock, or taking a break."
        },
        archetype,
        timeOfDayBreakdown: timeOfDayWithPercent,
        dayOfWeekData,
        metrics: {
          totalCompletedTasks,
          totalFocusSessions: totalSessions,
          totalFocusMinutes: totalMinutes,
          avgDuration,
          completionRatePercent,
          peakHourLabel: hourlyData[bestWindowStart]?.displayHour || "10:00 AM"
        },
        recentCompletions,
        recentSessions
      });
    } catch (e: any) {
      console.error("Failed to generate insights:", e);
      res.status(500).json({ error: "Failed to fetch insights" });
    }
  });

  // Seed sample historical data endpoint for testing / instant demonstration
  app.post("/api/insights/seed-demo", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;

      // Create profile if missing
      await db.insert(profiles).values({
        uid,
        email: req.user!.email || `${uid}@app.local`,
        displayName: req.user!.name || 'User'
      }).onConflictDoNothing();

      const now = new Date();
      const demoTasks = [
        { title: "Review quarterly roadmap draft", duration: 45, hourOffset: 9, daysAgo: 1 },
        { title: "Refactor core authentication logic", duration: 60, hourOffset: 10, daysAgo: 1 },
        { title: "Prepare weekly executive summary", duration: 30, hourOffset: 11, daysAgo: 2 },
        { title: "Debug database query timeout", duration: 50, hourOffset: 9, daysAgo: 2 },
        { title: "Clear urgent stakeholder emails", duration: 20, hourOffset: 14, daysAgo: 2 },
        { title: "Draft system architecture RFC", duration: 65, hourOffset: 10, daysAgo: 3 },
        { title: "Sort through memory dock thoughts", duration: 15, hourOffset: 15, daysAgo: 3 },
        { title: "Update project milestone timeline", duration: 35, hourOffset: 9, daysAgo: 4 },
        { title: "Design sprint planning notes", duration: 40, hourOffset: 10, daysAgo: 5 },
        { title: "Sync team dependencies and blockers", duration: 25, hourOffset: 15, daysAgo: 5 },
      ];

      for (const item of demoTasks) {
        const itemDate = new Date(now.getTime() - (item.daysAgo * 24 * 60 * 60 * 1000));
        itemDate.setHours(item.hourOffset, 15, 0, 0);

        const insertedTask = await db.insert(tasks).values({
          userId: uid,
          title: item.title,
          description: "Historical focus task",
          status: 'completed',
          estimatedDuration: item.duration,
          actualDuration: item.duration,
          createdAt: itemDate,
          updatedAt: itemDate
        }).returning();

        await db.insert(focusSessions).values({
          userId: uid,
          taskId: insertedTask[0].id,
          duration: item.duration,
          actualDuration: item.duration,
          completed: true,
          createdAt: itemDate
        });
      }

      res.json({ success: true, message: "Sample historical focus data generated successfully" });
    } catch (e: any) {
      console.error("Seed demo error:", e);
      res.status(500).json({ error: "Failed to seed demo data" });
    }
  });

  // AI Coach API
  
  app.get("/api/ai/coach/history", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const history = await db.select()
        .from(aiInteractions)
        .where(and(eq(aiInteractions.userId, uid), eq(aiInteractions.interactionType, 'coach')))
        .orderBy(aiInteractions.createdAt);
      
      const formatted = [];
      for (const h of history) {
        formatted.push({ role: 'user', content: h.prompt });
        formatted.push({ role: 'assistant', content: h.response });
      }
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch coach history" });
    }
  });

  app.post("/api/ai/coach", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { message, history = [] } = req.body;
      const uid = req.user!.uid;

      // Fetch user context
      const userTasks = await db.select().from(tasks).where(and(eq(tasks.userId, uid), eq(tasks.status, 'pending')));
      const userFocus = await db.select().from(focusSessions).where(eq(focusSessions.userId, uid)).limit(20);
      const totalSessions = userFocus.length;
      const avgDuration = totalSessions > 0 ? userFocus.reduce((acc, curr) => acc + (curr.actualDuration || 0), 0) / totalSessions : 0;
      const userDockItems = await db.select().from(memoryItems).where(eq(memoryItems.userId, uid));

      const contextStr = `
User's Pending Tasks:
${userTasks.map(t => `- ${t.title} (${t.estimatedDuration}m)`).join('\n')}

User's Memory Dock (Later/Ideas):\n${userDockItems.map(d => `- ${d.content}`).join('\n')}\nUser's Average Focus Session Length: ${Math.round(avgDuration)} minutes.\n      `;

      let historyStr = "";
      if (history.length > 0) {
        historyStr = "\nPrevious Conversation:\n" + history.map((m: any) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`).join('\n');
      }

      const prompt = `You are an ADHD executive-function coach. The user says: "${message}". 
Here is their current context to help you give better advice:
${contextStr}
${historyStr}

Provide a very brief, highly actionable, and empathetic response. Avoid generic advice. Be specific and unconventional if needed for ADHD brains. Keep it under 3 paragraphs. You can suggest which task they should work on, or help them organize their thoughts. If they ask you to plan their day (like 'Plan my day' or 'Auto Plan My Day'), provide a very clear, structured schedule based on their tasks and their average focus length. Keep it empathetic and actionable, format with bullet points or numbered lists.`;

      const aiResponse = await generateContentWithRetry({
        model: "gemini-3.8-flash",
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

  // AI Habit Stacking & Habit Coach API
  app.post("/api/habits/ai-insights", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { habits } = req.body;
      const uid = req.user!.uid;

      const habitsContext = Array.isArray(habits) && habits.length > 0
        ? habits.map((h: any) => `- Habit: "${h.title}" (Category: ${h.category}, Past 7 days completed: ${h.completionsLast7Days || 0}/7)`).join('\n')
        : "User is building initial morning hydration, brain dump, and deep work routines.";

      const prompt = `You are an expert ADHD behavioral scientist specializing in BJ Fogg's Habit Stacking methodology and neurodivergent motivation.
Here are the user's current habits:
${habitsContext}

Provide a concise, motivating, and shame-free Habit Stacking recommendation (under 3 sentences).
Formulate at least one specific "Anchor + Micro-Habit" formula (e.g., "After I [Anchor Event], I will immediately [Tiny 2-Minute Habit]").
Explain the neurodivergent rationale clearly and warmly.`;

      const aiResponse = await generateContentWithRetry({
        model: "gemini-3.8-flash",
        contents: prompt,
      });

      res.json({ insight: aiResponse.text?.trim() });
    } catch (error: any) {
      console.error("Habit insights error", error);
      res.status(500).json({ error: "Failed to generate habit insights" });
    }
  });

  // AI Day Planner API
  app.post("/api/ai/plan-day", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      // Fetch user context
      const userTasks = await db.select().from(tasks).where(and(eq(tasks.userId, uid), eq(tasks.status, 'pending')));
      const userFocus = await db.select().from(focusSessions).where(eq(focusSessions.userId, uid)).limit(20);
      
      const totalSessions = userFocus.length;
      const avgDuration = totalSessions > 0 ? userFocus.reduce((acc, curr) => acc + (curr.actualDuration || 0), 0) / totalSessions : 0;
      
      const contextStr = `User's Pending Tasks:
${userTasks.map(t => `- ID: ${t.id}, Title: ${t.title} (${t.estimatedDuration || 10}m)`).join('\n')}
Average focus session length: ${Math.round(avgDuration)} minutes.
      `;
      
      const prompt = `You are an AI day planner that learns from user habits. Given the following context of pending tasks and past focus session duration averages, generate a highly structured schedule for today.
Context:
${contextStr}

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
`;
      const aiResponse = await generateContentWithRetry({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });
      
      let cleanedAiText = aiResponse.text || "{}"; 
      cleanedAiText = cleanedAiText.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim(); 
      const planData = JSON.parse(cleanedAiText);
      
      res.json(planData);
    } catch (error: any) {
      console.error("AI Plan Day Error:", error);
      res.status(500).json({ error: "Failed to plan day" });
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
