/* عامل الخدمة: بيخلّي هيكل التطبيق يفتح من غير نت. الشبكة أولًا عشان التحديثات توصل فورًا. */
var CACHE = 'reno-shell-v3';
var SHELL = ['./', 'index.html', 'css/app.css?v=3', 'css/fonts.css?v=3', 'fonts/tajawal-arabic-400-normal.woff2', 'fonts/tajawal-arabic-500-normal.woff2', 'fonts/tajawal-arabic-700-normal.woff2', 'fonts/tajawal-arabic-800-normal.woff2', 'fonts/tajawal-latin-400-normal.woff2', 'fonts/tajawal-latin-700-normal.woff2', 'fonts/playfair-display-latin-700-normal.woff2', 'js/config.js?v=3', 'js/sample.js?v=3', 'js/icons.js?v=3', 'js/app.js?v=3', 'manifest.webmanifest', 'icons/icon-192.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(function (res) {
    if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () { return caches.match(req).then(function (m) { return m || caches.match('index.html'); }); }));
});
