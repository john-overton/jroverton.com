/*
 * Open Glades — local dev server (zero dependencies).
 *
 * One command to test the whole site exactly like production:
 *   - serves ../site as static files
 *   - starts the mailer in-process (dry-run unless config.json has a real key)
 *   - proxies /api/* to the mailer so the contact form is SAME-ORIGIN
 *
 * Run:  node dev-server.mjs   then open  http://localhost:8123
 * (No config.json needed — the mailer logs submissions instead of sending.)
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE = join(__dirname, '..', 'site');
const PORT = Number(process.env.DEV_PORT || 8123);
const MAILER = { host: '127.0.0.1', port: Number(process.env.PORT || 8787) };

// Free our ports first so you can just re-run this from the same terminal — kills any
// lingering server from a previous run (macOS/Linux; no-op if nothing is listening).
function freePorts(ports) {
  try {
    const pids = execSync('lsof -ti tcp:' + ports.join(','), { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (pids) { execSync('kill -9 ' + pids.split('\n').join(' '), { stdio: 'ignore' }); console.log('[dev] cleared ports ' + ports.join(', ')); }
  } catch (_) { /* nothing was listening, or lsof unavailable */ }
}
freePorts([PORT, MAILER.port]);

// Starts the mailer (listens on 127.0.0.1:8787 by default).
await import('./mailer.mjs');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8'
};

function proxyApi(req, res) {
  const headers = { ...req.headers };
  // Strip Origin so the mailer treats this like a same-origin/server call (no 403,
  // no CORS needed) — locally the browser only ever talks to this dev server.
  delete headers.origin;
  delete headers.host;
  const upstream = http.request(
    { host: MAILER.host, port: MAILER.port, method: req.method, path: req.url, headers },
    (up) => { res.writeHead(up.statusCode || 502, up.headers); up.pipe(res); }
  );
  upstream.on('error', () => { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end('{"ok":false,"error":"mailer_down"}'); });
  req.pipe(upstream);
}

async function serveStatic(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (pathname === '/' || pathname.endsWith('/')) pathname += 'index.html';
  // prevent path traversal
  const filePath = normalize(join(SITE, pathname));
  if (!filePath.startsWith(SITE)) { res.writeHead(403); return res.end('Forbidden'); }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
}

http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return proxyApi(req, res);
  return serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`[dev] Open Glades site:  http://localhost:${PORT}`);
  console.log(`[dev] contact form proxied to mailer on :${MAILER.port}`);
});
