const http = require('http');
const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/tasks',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test' }
}, res => {
  let d = ''; res.on('data', c => d+=c); res.on('end', () => console.log('Task:', d));
});
req.write(JSON.stringify({ title: 'Finish the react app' }));
req.end();
