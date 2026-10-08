// AXIOM App Service Worker — path-agnostic: works wherever the app is hosted
// (any repo name, subfolder, or custom domain). Nothing here hardcodes a path.
const VERSION = 'axiom-app-v3.1';   // keep in sync with AX_VERSION in index.html
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// Install: cache the shell one file at a time, so a single missing file can never abort the whole install.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => Promise.allSettled(SHELL.map(u => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fonts: cache-first (they never change)
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(caches.open(VERSION).then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }
      catch (e) { return hit || Response.error(); }
    }));
    return;
  }

  // Everything else cross-origin (Yahoo, proxies, Groq, FMP, news) is live data: never cache, never intercept.
  if (url.origin !== self.location.origin) return;

  // Page loads: NETWORK-FIRST so a new version of the app is picked up immediately; cached copy only when offline.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith((async () => {
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch(req, { signal: ctrl.signal }); clearTimeout(t);
        if (res && res.ok) { const c = await caches.open(VERSION); c.put(req, res.clone()); }
        return res;
      } catch (e) {
        return (await caches.match(req)) || (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Static files (icons, manifest, screenshots): stale-while-revalidate
  event.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req);
    const net = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
