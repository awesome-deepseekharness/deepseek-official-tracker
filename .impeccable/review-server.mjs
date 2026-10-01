import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// Minimal static server for local visual review of site/dist.
//
// Necessary because the built page links its stylesheet as /_astro/<hash>.css —
// an absolute path. Under file:// that resolves to the filesystem root, the
// stylesheet 404s, and the screenshot shows unstyled HTML: a capture that looks
// like a catastrophic design failure and is really a harness artifact. Serving
// over HTTP is the only way to see what actually ships.

const ROOT = path.resolve('site/dist');
const PORT = Number(process.argv[2] || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, url);
  if (url.endsWith('/')) file = path.join(file, 'index.html');
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`serving ${ROOT} on http://127.0.0.1:${PORT}`));