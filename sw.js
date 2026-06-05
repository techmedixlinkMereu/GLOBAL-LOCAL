// TechMedixLink Service Worker — Network First, No Cache
// Version: tml-v40 — always fetch fresh

const CACHE_VERSION = 'tml-v40';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', async (e) => {
  // Delete ALL caches on every activation
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
  await self.clients.claim();
});

// Always go to network — no caching
self.addEventListener('fetch', (e) => {
  // Only handle GET requests to our own origin
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  
  // Always fetch fresh from network
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .catch(() => caches.match(e.request))
  );
});
