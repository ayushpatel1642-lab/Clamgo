const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const retryFn = `
async function generateContentWithRetry(request: any, maxRetries = 3): Promise<any> {
  let retries = 0;
  while (true) {
    try {
      return await getAi().models.generateContent(request);
    } catch (error: any) {
      if (error?.status === 503 && retries < maxRetries) {
        const backoff = Math.pow(2, retries) * 1000 + Math.random() * 1000;
        console.warn(\`Gemini API overloaded (503). Retrying in \${Math.round(backoff)}ms...\`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        retries++;
      } else {
        throw error;
      }
    }
  }
}
`;

if (!code.includes('async function generateContentWithRetry')) {
    code = code.replace('async function startServer()', retryFn + '\nasync function startServer()');
    fs.writeFileSync('server.ts', code);
    console.log("Fixed server.ts");
} else {
    console.log("Already fixed?");
}
