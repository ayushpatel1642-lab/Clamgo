const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /const result = await tx\.delete\(tasks\)[\s\S]*?tx\.delete\(focusSessions\)\.where\(eq\(focusSessions\.taskId, taskId\)\);/m;

const newDelete = `const taskCheck = await tx.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, req.user!.uid)));
        if (taskCheck.length === 0) {
          return false;
        }

        // Delete children first
        await tx.delete(taskSteps).where(eq(taskSteps.taskId, taskId));
        await tx.delete(focusSessions).where(eq(focusSessions.taskId, taskId));

        // Delete parent
        await tx.delete(tasks)
          .where(and(eq(tasks.id, taskId), eq(tasks.userId, req.user!.uid)));`;

code = code.replace(regex, newDelete);
fs.writeFileSync('server.ts', code);
