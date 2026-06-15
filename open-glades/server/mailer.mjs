/*
 * Open Glades — contact mailer.
 * A tiny dependency-light Node HTTP server that accepts the contact form POST and
 * relays it through SendGrid. The SendGrid API key is read from config.json (NOT
 * committed) so it never reaches the browser. nginx reverse-proxies /api/ here.
 *
 * Run: node mailer.mjs   (reads ./config.json, falls back to ./config.example.json)
 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadConfig() {
  for (const name of ['config.json', 'config.example.json']) {
    try {
      const raw = readFileSync(join(__dirname, name), 'utf8');
      const cfg = JSON.parse(raw);
      if (name !== 'config.json') console.warn('[mailer] config.json not found — using config.example.json (dry-run likely)');
      return cfg;
    } catch (_) { /* try next */ }
  }
  throw new Error('No config.json or config.example.json found');
}

const cfg = loadConfig();
const PORT = Number(process.env.PORT || cfg.port || 8787);
const HOST = process.env.HOST || cfg.host || '127.0.0.1';
const KEY = process.env.SENDGRID_API_KEY || cfg.sendgridApiKey || '';
const DRY_RUN = !KEY || /x{6,}/.test(KEY); // placeholder key => log instead of send
const ALLOWED = new Set(cfg.allowedOrigins || []);

// lazy SendGrid loader so the server still boots (dry-run) without the dep installed
let sgMail = null;
async function getSendgrid() {
  if (sgMail) return sgMail;
  const mod = await import('@sendgrid/mail');
  sgMail = mod.default || mod;
  sgMail.setApiKey(KEY);
  return sgMail;
}

// ---- naive per-IP rate limit (sliding window) ----------------------------
const HITS = new Map(); // ip -> [timestamps]
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 5;
function rateLimited(ip) {
  const now = Date.now();
  const arr = (HITS.get(ip) || []).filter(t => now - t < WINDOW_MS);
  arr.push(now);
  HITS.set(ip, arr);
  return arr.length > MAX_PER_WINDOW;
}

function clip(v, n) { return String(v == null ? '' : v).slice(0, n).trim(); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

function send(res, status, obj, extraHeaders) {
  const body = JSON.stringify(obj);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  }, extraHeaders || {}));
  res.end(body);
}

function corsHeaders(origin) {
  if (origin && ALLOWED.has(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
  }
  return {};
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const origin = req.headers.origin;

  if (url.pathname === '/api/health') {
    return send(res, 200, { ok: true, dryRun: DRY_RUN });
  }

  if (url.pathname !== '/api/contact') {
    return send(res, 404, { ok: false, error: 'not_found' });
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    return res.end();
  }
  if (req.method !== 'POST') {
    return send(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  // Reject cross-origin requests from origins we don't trust (same-origin has no
  // Origin header on some browsers, and server-side callers have none — allow those).
  if (origin && ALLOWED.size > 0 && !ALLOWED.has(origin)) {
    return send(res, 403, { ok: false, error: 'forbidden_origin' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  if (rateLimited(ip)) {
    return send(res, 429, { ok: false, error: 'rate_limited' }, corsHeaders(origin));
  }

  let raw = '';
  let tooBig = false;
  req.on('data', chunk => {
    raw += chunk;
    if (raw.length > 20_000) { tooBig = true; req.destroy(); }
  });
  req.on('end', async () => {
    if (tooBig) return send(res, 413, { ok: false, error: 'payload_too_large' }, corsHeaders(origin));

    let data;
    try { data = JSON.parse(raw || '{}'); } catch (_) {
      return send(res, 400, { ok: false, error: 'bad_json' }, corsHeaders(origin));
    }

    // honeypot — bots fill the hidden "website" field; humans never do.
    if (clip(data.website, 200)) {
      return send(res, 200, { ok: true }, corsHeaders(origin)); // pretend success, drop silently
    }

    const name = clip(data.name, 120);
    const company = clip(data.company, 160);
    const phone = clip(data.phone, 60);
    const email = clip(data.email, 200);
    const message = clip(data.message, 5000);

    if (!name || !isEmail(email)) {
      return send(res, 400, { ok: false, error: 'invalid_fields' }, corsHeaders(origin));
    }

    const lines = [
      `Name:    ${name}`,
      `Email:   ${email}`,
      company ? `Company: ${company}` : null,
      phone ? `Phone:   ${phone}` : null,
      '',
      'Message:',
      message || '(none)'
    ].filter(l => l !== null);
    const text = lines.join('\n');
    const html = `<h2>New contact — Open Glades</h2>
<p><strong>Name:</strong> ${escapeHtml(name)}<br/>
<strong>Email:</strong> ${escapeHtml(email)}<br/>
${company ? `<strong>Company:</strong> ${escapeHtml(company)}<br/>` : ''}
${phone ? `<strong>Phone:</strong> ${escapeHtml(phone)}<br/>` : ''}</p>
<p><strong>Message:</strong></p>
<p style="white-space:pre-wrap">${escapeHtml(message || '(none)')}</p>`;

    const msg = {
      to: cfg.contactTo,
      from: { email: cfg.contactFrom, name: cfg.contactFromName || 'Open Glades Website' },
      replyTo: { email, name },
      subject: `${cfg.subjectPrefix || '[Open Glades] Contact'} — ${name}`,
      text,
      html
    };

    if (DRY_RUN) {
      console.log('[mailer] DRY RUN — would send:\n' + text + '\n');
      return send(res, 200, { ok: true, dryRun: true }, corsHeaders(origin));
    }

    try {
      const sg = await getSendgrid();
      await sg.send(msg);
      return send(res, 200, { ok: true }, corsHeaders(origin));
    } catch (err) {
      console.error('[mailer] send failed:', err && err.message ? err.message : err);
      return send(res, 502, { ok: false, error: 'send_failed' }, corsHeaders(origin));
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[mailer] listening on http://${HOST}:${PORT}  (dryRun=${DRY_RUN})`);
});
