const fs = require('fs');
let serverContent = fs.readFileSync('server.ts', 'utf-8');

const confirmPattern = /app\.post\("\/api\/braindump\/:id\/confirm", requireAuth, async \(req: AuthRequest, res\) => \{[\s\S]*?res\.json\(\{ success: true \}\);\n    \} catch \(e: any\) \{\n      res\.status\(500\)\.json\(\{ error: "Failed to process brain dump confirmation" \}\);\n    \}\n  \}\);/g;

const newConfirm = `app.post("/api/braindump/:id/confirm", requireAuth, async (req: AuthRequest, res) => {
    try {
      const dumpId = parseInt(req.params.id);
      const { organizedData } = req.body;
      const uid = req.user!.uid;

      // Verify ownership outside transaction or inside
      const dump = await db.select().from(brainDumps).where(and(eq(brainDumps.id, dumpId), eq(brainDumps.userId, uid))).limit(1);
      if (dump.length === 0) {
        return res.status(404).json({ error: "Brain dump not found" });
      }

      await db.transaction(async (tx) => {
        // Create tasks
        if (organizedData.tasks && organizedData.tasks.length > 0) {
          const tasksToInsert = organizedData.tasks.map((t: any) => ({
            userId: uid,
            title: t.title,
            description: t.description || "",
            estimatedDuration: t.estimatedDurationMinutes || 15
          }));
          await tx.insert(tasks).values(tasksToInsert);
        }

        // Create memory items / notes
        if (organizedData.notes && organizedData.notes.length > 0) {
          const notesToInsert = organizedData.notes.map((n: any) => ({
            userId: uid,
            content: n.content,
            type: "note"
          }));
          await tx.insert(memoryItems).values(notesToInsert);
        }

        // Reminders
        if (organizedData.reminders && organizedData.reminders.length > 0) {
          const remindersToInsert = organizedData.reminders.map((r: any) => {
            let triggerTime = null;
            if (r.triggerTime) {
              const d = new Date(r.triggerTime);
              if (!isNaN(d.getTime())) {
                triggerTime = d;
              }
            }
            return {
              userId: uid,
              title: r.title,
              triggerTime,
              isDelivered: false,
              isAcknowledged: false
            };
          });
          await tx.insert(reminders).values(remindersToInsert);
        }

        await tx.update(brainDumps).set({ status: 'processed' }).where(eq(brainDumps.id, dumpId));
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to process brain dump confirmation" });
    }
  });`;

serverContent = serverContent.replace(confirmPattern, newConfirm);

fs.writeFileSync('server.ts', serverContent, 'utf-8');
