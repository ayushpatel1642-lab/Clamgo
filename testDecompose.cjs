const http = require('http');
async function run() {
  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/tasks',
    method: 'GET',
    headers: { 'Authorization': 'Bearer fake' }
  }, res => {
    let d = ''; res.on('data', c => d+=c); res.on('end', () => console.log('Tasks:', d));
  });
  req.end();
}
run();
