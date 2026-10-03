// AXIOM Landing Page Service Worker — path-agnostic.
// Handles the landing page only; the app (./app/) registers its own service worker.
const VERSION = 'axiom-landing-v3.0';
const SHELL = ['./', './index.html', './manifest.json', './favicon.ico', './icons/icon-192.png', './icons/icon-512.png'];
const APP_PATH = new URL('./app/', self.registration.scope).pathname;   // e.g. /axiom/app/

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

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // fonts etc. load normally
  if (url.pathname.startsWith(APP_PATH)) return;            // let the app's own SW handle /app/

  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith((async () => {
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch(req, { signal: ctrl.signal }); clearTimeout(t);
        if (res && res.ok) { const c = await caches.open(VERSION); c.put(req, res.clone()); }
        return res;
      } catch (e) {
        return (await caches.match(req)) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req);
    const net = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
