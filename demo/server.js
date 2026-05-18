const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const HTML = path.join(__dirname, 'index.html');

const server = http.createServer((req, res) => {
  fs.readFile(HTML, 'utf8', (err, data) => {
    if (err) { res.writeHead(500); res.end('Demo not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  skeletal-dock demo  →  http://localhost:${PORT}\n`);
  console.log(`  Backend must be running:  npm start  (port 3001)\n`);
});
