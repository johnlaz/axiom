// AXIOM App Service Worker
// Scope: /apex/app/
const CACHE_NAME = 'axiom-app-v2';
const STATIC_ASSETS = [
  '/apex/app/',
  '/apex/app/index.html',
  '/apex/app/manifest.json',
  '/apex/app/favicon.ico',
  '/apex/app/icons/icon-192.png',
  '/apex/app/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap'
];

// Install: pre-cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      const localAssets = STATIC_ASSETS.filter(url => !url.startsWith('http'));
      const externalAssets = STATIC_ASSETS.filter(url => url.startsWith('http'));
      return cache.addAll(localAssets).then(() =>
        Promise.allSettled(
          externalAssets.map(url =>
            fetch(url).then(res => cache.put(url, res)).catch(() => {})
          )
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for local assets, network-first for API calls
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Pass through API calls (Yahoo Finance, Gemini, etc.)
  if (
    url.hostname !== location.hostname ||
    url.pathname.includes('/api/') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('yahoo') ||
    url.hostname.includes('groq')
  ) {
    return; // let network handle it
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match('/apex/app/index.html'));
    })
  );
});
