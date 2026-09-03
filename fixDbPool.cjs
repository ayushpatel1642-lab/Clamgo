const fs = require('fs');
let code = fs.readFileSync('src/db/index.ts', 'utf8');

code = code.replace(
  "      connectionTimeoutMillis: 15000,\\n    });",
  "      connectionTimeoutMillis: 15000,\\n      idleTimeoutMillis: 30000,\\n    });"
);

fs.writeFileSync('src/db/index.ts', code);
