const CACHE = 'route-optimizer-v40';
const ASSETS = [
  'https://jacobsmolik1.github.io/RouteOptimizer/',
  'https://jacobsmolik1.github.io/RouteOptimizer/index.html',
  'https://jacobsmolik1.github.io/RouteOptimizer/manifest.json',
  'https://jacobsmolik1.github.io/RouteOptimizer/icons/icon-192.png',
  'https://jacobsmolik1.github.io/RouteOptimizer/icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  // Do NOT call skipWaiting() automatically — the page triggers it via message
  // so users can update on their own terms without disrupting in-progress work.
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
