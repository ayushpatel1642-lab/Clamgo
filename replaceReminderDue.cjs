const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const oldPattern = /app\.get\("\/api\/reminders\/due", requireAuth, async \(req: AuthRequest, res\) => \{[\s\S]*?\}\);\n  \}\);/m;

const newEndpoint = `app.get("/api/reminders/due", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const now = new Date();

      // Find all due and unacknowledged reminders
      const due = await db.select().from(reminders)
        .where(and(
          eq(reminders.userId, uid),
          eq(reminders.isAcknowledged, false)
        ));
      
      const actuallyDue = due.filter(r => new Date(r.triggerTime) <= now);
      
      // Separate into newly delivered vs already delivered
      const newlyDelivered = actuallyDue.filter(r => !r.isDelivered);
      
      if (newlyDelivered.length > 0) {
        // Mark as delivered
        await db.transaction(async (tx) => {
          for (const r of newlyDelivered) {
            await tx.update(reminders).set({ isDelivered: true }).where(eq(reminders.id, r.id));
          }
        });
      }

      res.json(actuallyDue);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to fetch reminders" });
    }
  });

  app.post("/api/reminders/:id/acknowledge", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const id = parseInt(req.params.id);
      await db.update(reminders).set({ isAcknowledged: true }).where(and(eq(reminders.id, id), eq(reminders.userId, uid)));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to acknowledge reminder" });
    }
  });
`;

content = content.replace(oldPattern, newEndpoint);

fs.writeFileSync('server.ts', content, 'utf-8');
