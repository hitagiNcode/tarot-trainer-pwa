/* sw.js — cache-first Service Worker for offline use.
 * Bump CACHE_NAME whenever any cached file is added, renamed or changed so installed PWAs update.
 * All URLs are relative: the site is served from /tarot-trainer-pwa/ on GitHub Pages.
 */
const CACHE_NAME = 'arcana-coach-v2';

const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'engine.js',
  'i18n.js',
  'manifest.json',
  'data/cards.js',
  'data/cards.ja.js',
  'data/spreads.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    })
  );
});
