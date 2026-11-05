/* Hesap Makinesi - internetsiz çalışma */
const CACHE = 'hm-v1.0.3';
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
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) {
    // yazı tipi: önce önbellek
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }
      return res;
    })));
    return;
  }
  // uygulama dosyaları: önce internet (en güncel sürüm), yoksa önbellek
  e.respondWith((async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(e.request, { cache: 'no-cache', signal: ctrl.signal });
      clearTimeout(t);
      if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }
      return res;
    } catch (err) {
      return (await caches.match(e.request, { ignoreSearch: true })) || (await caches.match('index.html'));
    }
  })());
});
