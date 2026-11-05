/* Hesap Makinesi - internetsiz çalışma */
const CACHE = 'hm-v1.0.2';
const FONTS = ['https://cdn.jsdelivr.net/npm/@fontsource/caveat@5.3.0/files/caveat-latin-400-normal.woff2', 'https://cdn.jsdelivr.net/npm/@fontsource/caveat@5.3.0/files/caveat-latin-ext-400-normal.woff2'];
const FILES = ['./', 'index.html', 'style.css', 'core.js', 'app.js', 'manifest.webmanifest',
  'icons/icon-v2.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES).then(() => Promise.all(FONTS.map(u => c.add(new Request(u, { mode: 'cors' })).catch(() => {})))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      const net = fetch(e.request).then(res => {
        if (res && res.ok && (new URL(e.request.url).origin === location.origin || e.request.url.startsWith('https://cdn.jsdelivr.net/'))) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => hit || caches.match('index.html'));
      return hit || net;
    })
  );
});
