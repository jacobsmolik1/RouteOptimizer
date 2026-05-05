const CACHE = 'route-optimizer-v21';
const ASSETS = [
  'https://jacobsmolik1.github.io/RouteOptimizer/',
  'https://jacobsmolik1.github.io/RouteOptimizer/index.html',
  'https://jacobsmolik1.github.io/RouteOptimizer/manifest.json',
  'https://jacobsmolik1.github.io/RouteOptimizer/icons/icon-192.png',
  'https://jacobsmolik1.github.io/RouteOptimizer/icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
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
