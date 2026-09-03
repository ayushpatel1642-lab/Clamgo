const fs = require('fs');
let content = fs.readFileSync('src/components/TaskDecomposer.tsx', 'utf-8');

const replacement = `
      if (res.ok) {
        const data = await res.json();
        setSteps(data.steps);
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to decompose task");
      }
`;

content = content.replace(/if \(res\.ok\) \{\s*const data = await res\.json\(\);\s*setSteps\(data\.steps\);\s*\}/, replacement);

fs.writeFileSync('src/components/TaskDecomposer.tsx', content, 'utf-8');
