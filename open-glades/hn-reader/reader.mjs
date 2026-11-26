/*
 * HN Reader — article extraction service for openglades.com/hn
 *
 *   GET /hn/api/read?id=<HN item id>  ->  { id, url, title, byline, siteName, words, content }
 *   GET /hn/api/health                ->  { ok: true }
 *
 * The browser cannot fetch other sites itself, so this fetches the story's page and
 * reduces it to the article (Mozilla Readability). The reader then shows that in its own
 * colours and text size.
 *
 * This is deliberately NOT a general proxy:
 *   - it takes an HN item id, never a URL; the URL comes from the official HN API
 *   - only http(s) on ports 80/443, and never to private, loopback or link-local addresses
 *     (checked at connect time, on every redirect hop)
 *   - size, time, redirect, concurrency and per-client rate limits
 *
 * Run:  node reader.mjs          (production; nginx proxies /hn/api/ to 127.0.0.1:8788)
 *       node reader.mjs --dev    (also serves ../site, so http://localhost:8788/hn/ works)
 */
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import zlib from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';

const PORT = Number(process.env.PORT || 8788);
const HOST = process.env.HOST || '127.0.0.1';
const DEV = process.argv.includes('--dev');

const MAX_BYTES = 6 * 1024 * 1024;   // largest page we will download
const FETCH_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 5;
const MAX_ACTIVE = 4;                // simultaneous extractions
const RATE_LIMIT = Number(process.env.RATE_LIMIT || 40);              // requests per client per minute
const CACHE_TTL_MS = 6 * 3600 * 1000;
const ERROR_TTL_MS = 10 * 60 * 1000;
const MIN_WORDS = 150;               // less than this is a stub, landing page or app, not an article
const CACHE_MAX = 300;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 HNReader/1.0';

class ReadError extends Error {
  constructor(code, status = 502) { super(code); this.code = code; this.status = status; }
}

// ---------- address checks ----------
const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) blocked.addSubnet(addr, prefix, 'ipv4');
for (const [addr, prefix] of [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['2001:db8::', 32],
  ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
]) blocked.addSubnet(addr, prefix, 'ipv6');

function isPublicAddress(ip) {
  const family = net.isIP(ip);
  if (!family) return false;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) is refused outright. It cannot go in the BlockList:
  // Node matches an ::ffff:0:0/96 rule against every plain IPv4 address too.
  if (family === 6 && /^(::ffff:|0:0:0:0:0:ffff:)/i.test(ip)) return false;
  return !blocked.check(ip, family === 6 ? 'ipv6' : 'ipv4');
}

// Used as the socket's DNS lookup, so the address we validate is the address we connect to.
function safeLookup(hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address))) {
      return callback(new ReadError('blocked_address', 422));
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
}

// ---------- fetching ----------
function fetchPage(urlString, hops = 0) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(urlString); } catch { return reject(new ReadError('bad_url', 422)); }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return reject(new ReadError('bad_url', 422));
    if (u.username || u.password) return reject(new ReadError('bad_url', 422));
    if (u.port && u.port !== '80' && u.port !== '443') return reject(new ReadError('bad_url', 422));
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(host) && !isPublicAddress(host)) return reject(new ReadError('blocked_address', 422));

    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.get(u, {
      lookup: safeLookup,
      timeout: 10000,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'Accept-Language': 'en-US,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    }, (res) => {
      const status = res.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
        res.resume();
        if (hops >= MAX_REDIRECTS) return reject(new ReadError('too_many_redirects'));
        let next;
        try { next = new URL(res.headers.location, u).href; } catch { return reject(new ReadError('bad_url', 422)); }
        return resolve(fetchPage(next, hops + 1));
      }
      if (status < 200 || status >= 300) { res.resume(); return reject(new ReadError('upstream_' + status)); }
      const contentType = String(res.headers['content-type'] || '');
      if (!/html|xml|text\/plain|text\/markdown/i.test(contentType)) { res.destroy(); return reject(new ReadError('not_html', 422)); }

      let stream = res;
      const encoding = String(res.headers['content-encoding'] || '').toLowerCase();
      if (encoding === 'gzip' || encoding === 'x-gzip') stream = res.pipe(zlib.createGunzip());
      else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
      else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());

      const chunks = [];
      let size = 0;
      stream.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BYTES) { req.destroy(); reject(new ReadError('too_large', 422)); return; }
        chunks.push(chunk);
      });
      stream.on('end', () => resolve({ url: u.href, body: Buffer.concat(chunks), contentType }));
      stream.on('error', () => reject(new ReadError('bad_response')));
    });
    const deadline = setTimeout(() => req.destroy(new ReadError('timeout', 504)), FETCH_TIMEOUT_MS);
    req.on('close', () => clearTimeout(deadline));
    req.on('timeout', () => req.destroy(new ReadError('timeout', 504)));
    req.on('error', (e) => reject(e instanceof ReadError ? e : new ReadError(e.code === 'ENOTFOUND' ? 'not_found' : 'fetch_failed')));
  });
}

function decodeBody(body, contentType) {
  let charset = (contentType.match(/charset=["']?([\w-]+)/i) || [])[1];
  if (!charset) charset = (body.subarray(0, 4096).toString('latin1').match(/<meta[^>]+charset=["']?\s*([\w-]+)/i) || [])[1];
  try { return new TextDecoder(charset || 'utf-8').decode(body); } catch { return new TextDecoder('utf-8').decode(body); }
}

// ---------- extraction ----------
async function hnItem(id) {
  const r = await fetch('https://hacker-news.firebaseio.com/v0/item/' + id + '.json', { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new ReadError('hn_unavailable');
  return r.json();
}

const quietConsole = new VirtualConsole();   // pages' CSS/JS errors are not our problem
// Scripts are never run. The caller must close() the returned window, or jsdom keeps the page in memory.
function parseWindow(html, url) {
  return new JSDOM(html, { url, virtualConsole: quietConsole }).window;
}
function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function countWords(text) { const t = text.trim(); return t ? t.split(/\s+/).length : 0; }

// --- kinds of link that are not ordinary articles but can still be shown well ---

// GitHub repository front page: the rendered README, straight from GitHub's API.
async function githubReadme(u) {
  const m = u.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (u.hostname !== 'github.com' || !m) return null;
  let r;
  try {
    r = await fetch(`https://api.github.com/repos/${m[1]}/${m[2]}/readme`, {
      headers: { 'Accept': 'application/vnd.github.html+json', 'User-Agent': 'HNReader/1.0' },
      signal: AbortSignal.timeout(8000),
    });
  } catch { return null; }
  if (!r.ok) return null;   // no README, or the anonymous API allowance is used up: fall back to the page
  const html = await r.text();
  return { title: `${m[1]}/${m[2]}`, siteName: 'GitHub', byline: m[1], content: html, text: html.replace(/<[^>]*>/g, ' '), minWords: 20 };
}

// arXiv abstract page: title, authors and abstract (Readability drags in the page furniture).
function arxivAbstract(u, doc) {
  if (!/(^|\.)arxiv\.org$/.test(u.hostname) || !u.pathname.startsWith('/abs/')) return null;
  const strip = (el, label) => (el ? el.textContent.replace(label, '').replace(/\s+/g, ' ').trim() : '');
  const title = strip(doc.querySelector('h1.title'), /^\s*Title:/);
  const authors = strip(doc.querySelector('.authors'), /^\s*Authors?:/);
  const abstract = strip(doc.querySelector('blockquote.abstract'), /^\s*Abstract:/);
  if (!abstract) return null;
  const id = u.pathname.slice(5);
  return {
    title, siteName: 'arXiv', byline: authors.slice(0, 200), text: abstract, minWords: 20,
    content: `<p>${escapeHtml(abstract)}</p><p><a href="https://arxiv.org/pdf/${escapeHtml(id)}">Full paper (PDF)</a></p>`,
  };
}

// Plain text and raw Markdown files: paragraphs, or the text as written when it is laid out by hand.
function plainText(text) {
  const blocks = text.replace(/\r\n?/g, '\n').split(/\n{2,}/).map((b) => b.replace(/\s+$/, '')).filter((b) => b.trim());
  const content = blocks.map((b) => (/^( {2,}|\t)|\n( {2,}|\t)/.test(b)
    ? `<pre>${escapeHtml(b)}</pre>`
    : `<p>${escapeHtml(b.replace(/\n/g, ' '))}</p>`)).join('');
  return { title: '', content, text };
}

async function extract(id) {
  const item = await hnItem(id);
  if (!item || item.deleted || item.dead) throw new ReadError('no_item', 404);
  if (!item.url) throw new ReadError('no_url', 422);
  let itemUrl;
  try { itemUrl = new URL(item.url); } catch { throw new ReadError('bad_url', 422); }

  let found = await githubReadme(itemUrl);
  let finalUrl = itemUrl.href;
  if (!found) {
    const page = await fetchPage(item.url);
    finalUrl = page.url;
    const body = decodeBody(page.body, page.contentType);
    if (/text\/plain|text\/markdown/i.test(page.contentType)) {
      found = plainText(body);
    } else {
      const win = parseWindow(body, finalUrl);
      try {
        found = arxivAbstract(new URL(finalUrl), win.document);
        if (!found) {
          let article = null;
          try { article = new Readability(win.document, { charThreshold: 300 }).parse(); } catch { /* fall through */ }
          if (article && article.content) {
            found = { title: article.title, byline: article.byline, siteName: article.siteName, content: article.content, text: article.textContent || '' };
          }
        }
      } finally {
        win.close();
      }
    }
  }

  const words = found ? countWords(found.text) : 0;
  if (!found || words < (found.minWords || MIN_WORDS)) throw new ReadError('no_article', 422);
  return {
    id,
    url: finalUrl,
    title: (found.title || item.title || '').trim(),
    byline: (found.byline || '').trim().slice(0, 200) || null,
    siteName: (found.siteName || '').trim().slice(0, 100) || null,
    words,
    content: found.content,   // untrusted HTML: the reader rebuilds it from an allowlist
  };
}

// ---------- cache + limits ----------
const cache = new Map();      // id -> { at, ok, value }
const inFlight = new Map();   // id -> Promise
let active = 0;

function cached(id) {
  const hit = cache.get(id);
  if (!hit) return null;
  if (Date.now() - hit.at > (hit.ok ? CACHE_TTL_MS : ERROR_TTL_MS)) { cache.delete(id); return null; }
  cache.delete(id); cache.set(id, hit);   // refresh LRU position
  return hit;
}
function remember(id, ok, value) {
  cache.set(id, { at: Date.now(), ok, value });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

async function read(id) {
  const hit = cached(id);
  if (hit) { if (hit.ok) return hit.value; throw hit.value; }
  if (inFlight.has(id)) return inFlight.get(id);
  if (active >= MAX_ACTIVE) throw new ReadError('busy', 503);
  active++;
  const job = extract(id)
    .then((value) => { remember(id, true, value); return value; })
    .catch((e) => {
      const err = e instanceof ReadError ? e : new ReadError('extract_failed');
      if (err.code !== 'busy' && err.code !== 'hn_unavailable') remember(id, false, err);
      throw err;
    })
    .finally(() => { active--; inFlight.delete(id); });
  inFlight.set(id, job);
  return job;
}

const hits = new Map();   // client -> { count, resetAt }
function rateLimited(client) {
  const now = Date.now();
  let h = hits.get(client);
  if (!h || now > h.resetAt) { h = { count: 0, resetAt: now + 60000 }; hits.set(client, h); }
  h.count++;
  if (hits.size > 5000) for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
  return h.count > RATE_LIMIT;
}

// ---------- http ----------
function sendJson(res, status, body, cacheControl = 'no-store') {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cacheControl,
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(body));
}

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..', 'site');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};
async function serveStatic(pathname, res) {
  if (pathname === '/hn') { res.writeHead(301, { Location: '/hn/' }); return res.end(); }
  if (pathname.endsWith('/')) pathname += 'index.html';
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

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { return sendJson(res, 400, { error: 'bad_request' }); }
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'method_not_allowed' });

  if (url.pathname === '/hn/api/health') return sendJson(res, 200, { ok: true, cached: cache.size, active });

  if (url.pathname === '/hn/api/read') {
    const id = url.searchParams.get('id') || '';
    if (!/^\d{1,10}$/.test(id)) return sendJson(res, 400, { error: 'bad_id' });
    // Behind nginx the real client is in X-Real-IP; the service itself only listens on localhost.
    const client = String(req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown');
    if (rateLimited(client)) return sendJson(res, 429, { error: 'rate_limited' });
    try {
      return sendJson(res, 200, await read(Number(id)), 'private, max-age=900');
    } catch (e) {
      return sendJson(res, e.status || 502, { error: e.code || 'extract_failed' });
    }
  }

  if (DEV) return serveStatic(decodeURIComponent(url.pathname), res);
  sendJson(res, 404, { error: 'not_found' });
});

server.listen(PORT, HOST, () => {
  console.log(`[hn-reader] listening on http://${HOST}:${PORT}` + (DEV ? `  (dev: open http://localhost:${PORT}/hn/)` : ''));
});
