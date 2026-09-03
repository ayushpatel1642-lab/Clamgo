const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const replacement = `
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
`;

content = content.replace(
  /if \(organizedData\.steps && organizedData\.steps\.length > 0\) \{\s*const stepsToInsert = organizedData\.steps\.map\(\(s: any, idx: number\) => \(\{[\s\S]*?\}\)\);\s*await db\.insert\(taskSteps\)\.values\(stepsToInsert\);\s*\}/, 
  replacement
);

fs.writeFileSync('server.ts', content, 'utf-8');
