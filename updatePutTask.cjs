const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

content = content.replace(
  /if \(estimatedDuration !== undefined\) updateData\.estimatedDuration = estimatedDuration;/,
  `if (estimatedDuration !== undefined) updateData.estimatedDuration = estimatedDuration;
      if (req.body.createdAt !== undefined) updateData.createdAt = new Date(req.body.createdAt);`
);

fs.writeFileSync('server.ts', content, 'utf-8');
