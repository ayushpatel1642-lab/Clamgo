const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "if ((error?.status === 503 || error?.status === 'UNAVAILABLE' || error?.code === 503 || (error.message && error.message.includes('503'))) && retries < maxRetries) {",
  "if ((error?.status === 503 || error?.status === 'UNAVAILABLE' || error?.code === 503 || (error.message && error.message.includes('503')) || error?.status === 429 || error?.code === 429 || error?.status === 'RESOURCE_EXHAUSTED' || (error.message && error.message.includes('429'))) && retries < maxRetries) {"
);

code = code.replace(
  "console.warn(\`Gemini API overloaded (503). Retrying in \${Math.round(backoff)}ms...\`);",
  "console.warn(\`Gemini API overloaded or rate limited (\${error?.status || 503}). Retrying in \${Math.round(backoff)}ms...\`);"
);

fs.writeFileSync('server.ts', code);
