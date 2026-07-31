// AXIOM Landing Page Service Worker
// Scope: /apex/ (landing page only — app has its own SW at /apex/app/)
const CACHE_NAME = 'axiom-landing-v2';
const STATIC_ASSETS = [
  '/apex/',
  '/apex/index.html',
  '/apex/manifest.json',
  '/apex/favicon.ico',
  '/apex/icons/icon-192.png',
  '/apex/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      const local = STATIC_ASSETS.filter(u => !u.startsWith('http'));
      const external = STATIC_ASSETS.filter(u => u.startsWith('http'));
      return cache.addAll(local).then(() =>
        Promise.allSettled(
          external.map(url => fetch(url).then(res => cache.put(url, res)).catch(() => {}))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Only handle requests within /apex/ scope (not /apex/app/)
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/apex/app/')) return; // let app SW handle

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match('/apex/index.html'));
    })
  );
});
