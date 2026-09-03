const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "if (error?.status === 503 && retries < maxRetries) {",
  "if ((error?.status === 503 || error?.status === 'UNAVAILABLE' || error?.code === 503 || (error.message && error.message.includes('503'))) && retries < maxRetries) {"
);

fs.writeFileSync('server.ts', code);
