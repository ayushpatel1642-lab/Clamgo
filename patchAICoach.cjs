const fs = require('fs');
let code = fs.readFileSync('src/components/AICoach.tsx', 'utf8');

code = code.replace(
  /"Plan my evening\.",/g,
  '"Auto Plan My Day",'
);

fs.writeFileSync('src/components/AICoach.tsx', code);
