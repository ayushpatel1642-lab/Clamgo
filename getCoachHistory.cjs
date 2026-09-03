const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const historyEndpoint = `
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
`;

content = content.replace(/app\.post\("\/api\/ai\/coach"/, historyEndpoint + '\n  app.post("/api/ai/coach"');

fs.writeFileSync('server.ts', content, 'utf-8');
