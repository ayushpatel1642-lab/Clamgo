const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /User's Memory Dock \(Later\/Ideas\):\n\$\{userDockItems\.map\(d => \`- \$\{d\.content\}\`\)\.join\('\\n'\)\}\n      `;/,
  "User's Memory Dock (Later/Ideas):\\n${userDockItems.map(d => `- ${d.content}`).join('\\n')}\\nUser's Average Focus Session Length: ${Math.round(avgDuration)} minutes.\\n      `;"
);

fs.writeFileSync('server.ts', code);
