// Service worker: lets the app install and work offline.
// Bump VERSION when you change the caching rules; app files update on their own
// because everything except the player data is fetched network-first.
const VERSION = 'v1';
const CACHE = `nba-draft-${VERSION}`;
const SHELL = ['./', './manifest.webmanifest', './data/players.json', './data/franchises.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isData = req.url.includes('/data/');
  e.respondWith(
    isData
      ? // data: cache first, refresh in the background
        caches.match(req).then((hit) => {
          const net = fetch(req).then((res) => { caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; }).catch(() => hit);
          return hit || net;
        })
      : // app files: network first, cache as offline fallback
        fetch(req)
          .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
          .catch(() => caches.match(req).then((hit) => hit || caches.match('./'))),
  );
});
