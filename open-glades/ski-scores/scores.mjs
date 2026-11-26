/*
 * Glade Run — leaderboard service for openglades.com/ski (zero dependencies).
 *
 *   GET  /ski/api/scores  ->  { top: [{ n, s, t, d, c, j, at }] }   best 25 runs
 *   POST /ski/api/run     ->  { token }                             taken when a run starts
 *   POST /ski/api/scores  <-  { token, n, s, t, d, c, j }  ->  { ok, rank, top }
 *   GET  /ski/api/health  ->  { ok: true }
 *
 * n = initials (2-3 letters), s = score, t = seconds on slope, d = metres,
 * c = longest clean streak in seconds, j = jumps.
 *
 * A browser game cannot be made cheat-proof. This only raises the bar: a run token proves
 * the run took at least as long as it claims, each token saves once, the numbers have to be
 * possible in the game, initials are checked against a block list, and posts are rate-limited.
 *
 * Run:  node scores.mjs          (production; nginx proxies /ski/api/ to 127.0.0.1:8789)
 *       node scores.mjs --dev    (also serves ../site, so http://localhost:8789/ski/ works)
 * Scores live in $STATE_DIRECTORY (set by systemd), $DATA_DIR, or ./data.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8789);
const HOST = process.env.HOST || '127.0.0.1';
const DEV = process.argv.includes('--dev');
const DATA_DIR = process.env.DATA_DIR || process.env.STATE_DIRECTORY || join(__dirname, 'data');
const FILE = join(DATA_DIR, 'scores.json');
const SITE = join(__dirname, '..', 'site');

const TOP = 25;            // rows returned
const KEEP = 500;          // rows stored
const POSTS_PER_MIN = 8;   // per client
const MAX_RUN_S = 3 * 3600;

// Initials that spell something rude. Keep in step with the list in site/ski/game.js.
const BLOCK = new Set(('ASS AZZ ARS FUK FUC FCK FUX FUQ FKU FKN FUG FAG FGT SEX SXY TIT TTS CUM KUM JIZ JZZ DIK DIC DCK DIX DIQ COK COC KOK CNT KNT CUN ' +
  'PUS PSY VAG VAJ HOR HOE WHR SLT SLU BCH SHT POO PEE PIS PSS NIG NGR NGA NIP KKK NAZ FAP WTF STF KYS DIE KIL RAP RPE PED PDO ANL ANU BUT BTT TWT WNK ' +
  'SUK SUC BJS SMD GTF PRN MLF THT XXX FU FK BJ HJ').split(' '));

const SECRET = crypto.randomBytes(32);
const usedTokens = new Map();   // token -> expiry
let scores = [];
let writing = Promise.resolve();

async function load() {
  try {
    const a = JSON.parse(await readFile(FILE, 'utf8'));
    if (Array.isArray(a)) scores = a.filter((r) => r && typeof r.n === 'string' && Number.isFinite(r.s));
  } catch { scores = []; }
  scores.sort((a, b) => b.s - a.s);
}
function persist() {
  const body = JSON.stringify(scores);
  writing = writing.then(async () => {
    await mkdir(DATA_DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    await writeFile(tmp, body);
    await rename(tmp, FILE);
  }).catch((e) => console.error('[ski] could not save scores:', e.message));
  return writing;
}

function sign(ts) { return crypto.createHmac('sha256', SECRET).update(String(ts)).digest('base64url').slice(0, 22); }
function newToken() { const ts = Date.now(); return ts + '.' + sign(ts); }
function tokenAge(token) {
  if (typeof token !== 'string' || token.length > 64) return null;
  const [ts, mac] = token.split('.');
  if (!/^\d{12,14}$/.test(ts || '') || !mac) return null;
  const want = sign(ts);
  if (mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  return (Date.now() - Number(ts)) / 1000;
}

const hits = new Map();
function rateLimited(client) {
  const now = Date.now(); let h = hits.get(client);
  if (!h || now - h.start > 60000) { h = { start: now, count: 0 }; hits.set(client, h); }
  h.count++;
  return h.count > POSTS_PER_MIN;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, h] of hits) if (now - h.start > 120000) hits.delete(k);
  for (const [k, exp] of usedTokens) if (exp < now) usedTokens.delete(k);
}, 60000).unref();

function clientOf(req) {
  const ra = req.socket.remoteAddress || '';
  const local = ra === '127.0.0.1' || ra === '::1' || ra === '::ffff:127.0.0.1';
  const fwd = local && req.headers['x-real-ip'];   // only trust the header from our own proxy
  return String(fwd || ra);
}
function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(obj));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let n = 0; const parts = [];
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(new Error('too_large')); req.destroy(); } else parts.push(c); });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', reject);
  });
}
function sameOrigin(req) {
  const o = req.headers.origin; if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}
function topRows() { return scores.slice(0, TOP).map(({ n, s, t, d, c, j, at }) => ({ n, s, t, d, c, j, at })); }

// Is this run possible? Top speed is about 22 m/s; points come from distance (at most 10 per
// metre at x5), air, hops, near misses and lost items (generously, 2500 a second) plus a small allowance.
function plausible(r) {
  if (r.t < 2 || r.t > MAX_RUN_S) return false;
  if (r.d < 0 || r.d > r.t * 24 + 50) return false;
  if (r.s < 0 || r.s > r.d * 10 + r.t * 2500 + 5000) return false;
  if (r.c < 0 || r.c > r.t + 1) return false;
  if (r.j < 0 || r.j > r.t * 3 + 5) return false;
  return true;
}

async function postScore(req, res) {
  if (!sameOrigin(req)) return sendJson(res, 403, { error: 'origin' });
  if (rateLimited(clientOf(req))) return sendJson(res, 429, { error: 'rate_limited' });
  let b;
  try { b = JSON.parse(await readBody(req, 2048)); } catch { return sendJson(res, 400, { error: 'bad_request' }); }
  if (!b || typeof b !== 'object') return sendJson(res, 400, { error: 'bad_request' });

  const n = String(b.n || '').toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(n) || BLOCK.has(n)) return sendJson(res, 422, { error: 'initials' });
  const r = { n, s: Math.floor(Number(b.s)), t: Math.round(Number(b.t) * 10) / 10, d: Math.floor(Number(b.d)), c: Math.round(Number(b.c)), j: Math.floor(Number(b.j)) };
  if (![r.s, r.t, r.d, r.c, r.j].every(Number.isFinite) || !plausible(r)) return sendJson(res, 422, { error: 'implausible' });

  const age = tokenAge(b.token);
  if (age === null || age > MAX_RUN_S + 600 || age + 3 < r.t) return sendJson(res, 422, { error: 'token' });
  if (usedTokens.has(b.token)) return sendJson(res, 409, { error: 'already_saved' });
  usedTokens.set(b.token, Date.now() + (MAX_RUN_S + 900) * 1000);

  r.at = new Date().toISOString();
  scores.push(r); scores.sort((a, c) => c.s - a.s);
  if (scores.length > KEEP) scores.length = KEEP;
  const rank = scores.indexOf(r) + 1;
  if (rank > 0) persist();
  sendJson(res, 200, { ok: true, rank: rank || null, top: topRows() });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8'
};
async function serveStatic(req, res) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const filePath = normalize(join(SITE, pathname));
  if (!filePath.startsWith(SITE)) { res.writeHead(403); return res.end('Forbidden'); }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404 Not Found'); }
}

await load();
http.createServer((req, res) => {
  const path = (req.url || '').split('?')[0];
  if (path === '/ski/api/health') return sendJson(res, 200, { ok: true });
  if (path === '/ski/api/scores' && req.method === 'GET') return sendJson(res, 200, { top: topRows() });
  if (path === '/ski/api/scores' && req.method === 'POST') return postScore(req, res).catch(() => sendJson(res, 500, { error: 'server' }));
  if (path === '/ski/api/run' && req.method === 'POST') {
    if (!sameOrigin(req)) return sendJson(res, 403, { error: 'origin' });
    req.resume();
    return sendJson(res, 200, { token: newToken() });
  }
  if (path.startsWith('/ski/api/')) return sendJson(res, 404, { error: 'not_found' });
  if (DEV && req.method === 'GET') return serveStatic(req, res);
  res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404 Not Found');
}).listen(PORT, HOST, () => {
  console.log(`[ski] leaderboard on http://${HOST}:${PORT}${DEV ? '/ski/  (dev: serving ../site)' : ''}  data: ${FILE}`);
});
