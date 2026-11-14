/* NOTHING service worker — app shell, runtime asset cache, and model cache. No telemetry. */
const V = 'nothing-v1';
const SHELL = `${V}-shell`;
const RUNTIME = `${V}-runtime`;
const MODELS = 'nothing-models-v1'; // shared with src/services/models/store.ts
const scope = self.registration.scope;
const at = (p) => new URL(p, scope).href;
const SHELL_URLS = ['./', './index.html', './offline.html', './manifest.webmanifest', './icons/icon.svg'].map(at);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('nothing-v') && k !== SHELL && k !== RUNTIME) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return; // never touch cross-origin traffic

  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r)
        .then((res) => { const cp = res.clone(); caches.open(SHELL).then((c) => c.put(at('./index.html'), cp)); return res; })
        .catch(async () => (await caches.match(at('./index.html'))) || caches.match(at('./offline.html')))
    );
    return;
  }

  // Model files: user-imported files live in the models cache and are served first.
  if (u.href.startsWith(at('models/'))) {
    e.respondWith((async () => {
      const m = await caches.open(MODELS);
      const hit = await m.match(r.url);
      if (hit) return hit;
      const res = await fetch(r);
      const ct = res.headers.get('content-type') || '';
      if (res.ok && res.status === 200 && !ct.includes('text/html')) m.put(r.url, res.clone());
      return res;
    })());
    return;
  }

  e.respondWith((async () => {
    const c = await caches.open(RUNTIME);
    const hit = await c.match(r);
    const net = fetch(r).then((res) => { if (res.ok && res.status === 200) c.put(r, res.clone()); return res; }).catch(() => null);
    return hit || (await net) || Response.error();
  })());
});
