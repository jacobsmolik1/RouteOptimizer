const CACHE = 'route-optimizer-v120';
// Relative so it works under whatever origin serves the app (routes.jacobsmolik.com via the
// Cloudflare Worker, or github.io directly) — absolute github.io URLs would be cross-origin
// and useless on routes.jacobsmolik.com.
const CORE = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  // Auto-activate a new build instead of waiting for every tab to close — this is what lets
  // updates land "when they get on the website" with no manual Reset & Update.
  self.skipWaiting();
  // Best-effort precache — one missing asset must not fail the whole install.
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // never touch API writes
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;        // leave Supabase / cross-origin alone

  const isNav = req.mode === 'navigate'
    || req.destination === 'document'
    || (req.headers.get('accept') || '').includes('text/html');

  if (isNav) {
    // NETWORK-FIRST for the app HTML: an online visit always pulls the newest build. Fall back
    // to the cached copy only when offline or the network is slow (2.5s), so it still loads fast
    // on bad warehouse wifi. A fresh, non-redirected OK response refreshes the cache for next time
    // (skip redirects so an expired access-gate page never gets cached as the app).
    e.respondWith(new Promise(resolve => {
      let done = false;
      const finish = r => { if (!done && r) { done = true; resolve(r); } };
      const timer = setTimeout(() => caches.match(req).then(c => finish(c)), 2500);
      fetch(req).then(resp => {
        clearTimeout(timer);
        if (resp && resp.ok && !resp.redirected) { const clone = resp.clone(); caches.open(CACHE).then(c => c.put(req, clone)).catch(() => {}); }
        finish(resp);
      }).catch(() => { clearTimeout(timer); caches.match(req).then(c => finish(c || Response.error())); });
    }));
    return;
  }

  // Other same-origin assets (icons, manifest): cache-first for speed, then network + cache.
  e.respondWith(caches.match(req).then(cached => cached || fetch(req).then(resp => {
    if (resp && resp.ok) { const clone = resp.clone(); caches.open(CACHE).then(c => c.put(req, clone)).catch(() => {}); }
    return resp;
  })));
});
