// Fire for Effect service worker: keeps the game available so the installed app always opens,
// even offline. Network first, so deploys show up immediately.
const CACHE = 'fire-for-effect-v17';
const SHELL = ['./', 'game.js', 'audio.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  '/assets/fonts/fonts.css', '/assets/fonts/vt323-400-latin.woff2', '/assets/fonts/pressstart2p-400-latin.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fire-for-effect-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./') : Response.error())))
  );
});
