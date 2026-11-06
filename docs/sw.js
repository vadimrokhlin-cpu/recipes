// שומר את קבצי האפליקציה בטלפון כדי שתיפתח גם בלי אינטרנט.
// הדומיין משותף עם אפליקציית הקניות: לכן מוחקים כאן רק מטמונים עם הקידומת שלנו.
// כשמטמון חסר (למשל אם אפליקציה אחרת מחקה אותו), הקבצים נטענים מהרשת ונשמרים מחדש.
const PREFIX = 'recipes-';
const CACHE = PREFIX + 'v6';
const FILES = ['./', 'index.html', 'style.css', 'core.js', 'app.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))
  )));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
