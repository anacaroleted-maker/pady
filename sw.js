/* Service worker: makes the app work offline.
   Strategy: "network first" – when you are online you always get the newest
   files (so updates show up automatically); when offline, the saved copy is used. */
const CACHE = 'pady-v2';
const CORE = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'data/index.json',
  'data/rules.json',
  'data/tables.json',
  'data/prepositions.json',
  'data/exercises/nom.json',
  'data/exercises/gen.json',
  'data/exercises/dat.json',
  'data/exercises/acc.json',
  'data/exercises/voc.json',
  'data/exercises/loc.json',
  'data/exercises/ins.json',
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  ev.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await withTimeout(fetch(req, { cache: 'no-cache' }), 4000);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') return cache.match('index.html');
    throw e;
  }
}

function withTimeout(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, err => { clearTimeout(t); reject(err); });
  });
}
