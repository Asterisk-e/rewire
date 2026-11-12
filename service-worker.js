const VERSION = 'local-studio-v2';
const SHELL = `${VERSION}-shell`;
const MODEL_CACHE = `${VERSION}-models`;
const APP_FILES = [
  './', './index.html', './manifest.webmanifest', './assets/styles.css',
  './assets/app.js', './assets/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('local-studio-') && ![SHELL, MODEL_CACHE].includes(key)).map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return;

  const isModelAsset = /\/(models|vendor)\//.test(url.pathname);
  if (isModelAsset) {
    event.respondWith((async () => {
      const cache = await caches.open(MODEL_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        try { await cache.put(request, response.clone()); }
        catch (error) { console.warn('Offline cache quota may be full:', error); }
      }
      return response;
    })());
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match('./index.html')) || Response.error()));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone(); caches.open(SHELL).then((cache) => cache.put(request, copy)).catch(() => {});
    }
    return response;
  })));
});
