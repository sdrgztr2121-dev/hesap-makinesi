/* Hesap Makinesi - internetsiz çalışma
   Açılış her zaman telefondaki kopyadan (anında). Yeni sürüm arka planda indirilir,
   bir sonraki açılışta devreye girer. */
const CACHE = 'hm-v1.0.15';
const FONTS = ['https://cdn.jsdelivr.net/npm/@fontsource/caveat@5.3.0/files/caveat-latin-400-normal.woff2', 'https://cdn.jsdelivr.net/npm/@fontsource/caveat@5.3.0/files/caveat-latin-ext-400-normal.woff2'];
const FILES = ['./', 'index.html', 'style.css', 'core.js', 'app.js', 'manifest.webmanifest',
  'icons/icon-v2.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // yeni sürümün dosyalarını HTTP önbelleğini atlayarak, eksiksiz indir
    await c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })));
    // yazı tipini eski önbellekten taşı, yoksa indir
    await Promise.all(FONTS.map(async u => {
      const old = await caches.match(u);
      if (old) return c.put(u, old);
      return c.add(new Request(u, { mode: 'cors' })).catch(() => {});
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(e.request, { ignoreSearch: true })
      || (e.request.mode === 'navigate' ? await c.match('./') : null);
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      if (res && res.ok && (url.origin === location.origin || url.href.startsWith('https://cdn.jsdelivr.net/'))) c.put(e.request, res.clone());
      return res;
    } catch (err) {
      return (await c.match('./')) || Response.error();
    }
  })());
});
