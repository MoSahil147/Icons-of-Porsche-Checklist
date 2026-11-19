// Offline cache for the festival. og-v3.png is left out: only link previews use it, never the page.
// Network first, so a new deploy shows at once; the cache answers when the signal drops.
const CACHE = 'iop26-v20'; // a new name clears the old cache on activate
const PRECACHE = ['./', 'index.html', 'styles.css', 'tokens.css', 'base.css', 'plan.js', 'sports-car.svg',
  'js/main.js', 'js/state.js', 'js/checklist.js', 'js/story.js', 'js/paint.js', 'js/link.js', 'js/engine.js', 'js/rail.js',
  'fonts/league-spartan-800-latin.woff2', 'fonts/onest-latin.woff2',
  'manifest.webmanifest', 'icons/favicon.svg', 'icons/favicon-32.png', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/cursor-911.png', 'icons/cursor-911-go.png'];

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

  event.respondWith((async () => {
    // The 3 s limit covers the wait for a response only. A slow body on weak signal still completes.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(request, { signal: controller.signal });
      clearTimeout(timer);
      if (response.ok) {
        const copy = response.clone();
        // Pages are stored without their query, so a shared plan link still opens offline.
        const key = request.mode === 'navigate' ? new Request(url.pathname) : request;
        caches.open(CACHE).then(cache => cache.put(key, copy));
      }
      return response;
    } catch {
      clearTimeout(timer);
      const hit = await caches.match(request, { ignoreSearch: true });
      return hit || (request.mode === 'navigate' ? caches.match('./') : Response.error());
    }
  })());
});
