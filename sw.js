// Offline cache for the festival. Network first, so a new deploy shows at once; the cache answers when the signal drops.
const CACHE = 'iop26-v3';
const PRECACHE = ['./', 'index.html', 'styles.css', 'tokens.css', 'base.css', 'plan.js', 'app.js', 'sports-car.svg', 'og-v2.png',
  'fonts/league-spartan-800-latin.woff2', 'fonts/onest-latin.woff2',
  'manifest.webmanifest', 'icons/favicon.svg', 'icons/favicon-32.png', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', event => {
  // cache: 'reload' skips the HTTP cache, so a new version never precaches an old file.
  event.waitUntil(caches.open(CACHE)
    .then(cache => cache.addAll(PRECACHE.map(path => new Request(path, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(fetch(request, { signal: AbortSignal.timeout(3000) })
    .then(response => {
      if (response.ok) {
        const copy = response.clone();
        // Pages are stored without their query, so a shared plan link still opens offline.
        const key = request.mode === 'navigate' ? new Request(url.pathname) : request;
        caches.open(CACHE).then(cache => cache.put(key, copy));
      }
      return response;
    })
    .catch(() => caches.match(request, { ignoreSearch: true })
      .then(hit => hit || (request.mode === 'navigate' ? caches.match('./') : Response.error()))));
});
