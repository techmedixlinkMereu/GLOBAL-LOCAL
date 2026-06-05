// TechMedixLink Service Worker
// Clears all caches on activation so updates are always fresh

const CACHE_VERSION = 'tml-v32';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Network first — always fetch fresh, fall back to cache only if offline
self.addEventListener('fetch', (e) => {
  // Only handle GET requests for our own files
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // For JS/CSS/HTML — always go to network first, no caching
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // For images — cache with revalidation
  if (url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif)$/)) {
    e.respondWith(
      caches.open(CACHE_VERSION).then(cache =>
        fetch(e.request)
          .then(res => { cache.put(e.request, res.clone()); return res; })
          .catch(() => cache.match(e.request))
      )
    );
    return;
  }
});
