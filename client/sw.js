// Caches only the static app shell. API responses are never cached, so no technical content is served unverified from cache.
const SHELL = ['./', 'index.html', 'app.js', 'styles.css', 'manifest.webmanifest'];
self.addEventListener('install', (e) => e.waitUntil(caches.open('sbr-shell-v1').then((c) => c.addAll(SHELL))));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/api/') || e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
