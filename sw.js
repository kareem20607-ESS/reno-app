/* عامل الخدمة: بيخلّي التطبيق يفتح من غير نت.
   - الملفات اللي ليها رقم نسخة (?v=) والخطوط والأيقونات: من المحفوظ أولًا (ما بتتغيّرش من غير رقم جديد).
   - الصفحة نفسها: من الشبكة أولًا عشان التحديث يوصل فورًا، ولو الشبكة اتأخرت أو وقعت نرجع للمحفوظ. */
var CACHE = 'reno-shell-v9';
var SHELL = ['./', 'index.html', 'css/app.css?v=9', 'css/fonts.css?v=9',
  'fonts/tajawal-arabic-400-normal.woff2', 'fonts/tajawal-arabic-500-normal.woff2', 'fonts/tajawal-arabic-700-normal.woff2', 'fonts/tajawal-arabic-800-normal.woff2',
  'fonts/tajawal-latin-400-normal.woff2', 'fonts/tajawal-latin-500-normal.woff2', 'fonts/tajawal-latin-700-normal.woff2', 'fonts/tajawal-latin-800-normal.woff2',
  'fonts/playfair-display-latin-700-normal.woff2',
  'js/config.js?v=9', 'js/sample.js?v=9', 'js/icons.js?v=9', 'js/pages.js?v=9', 'js/sale.js?v=9', 'js/invoices.js?v=9', 'js/app.js?v=9', 'vendor/zxing.min.js?v=0.21.3',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-180.png'];
var NET_WAIT = 3500;
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
function keep(req, res) { if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); } return res; }
function saved(req) {
  return caches.match(req).then(function (m) { return m || (req.mode === 'navigate' ? caches.match('index.html') : undefined); });
}
function cacheFirst(req) {
  return caches.match(req).then(function (m) { return m || fetch(req).then(function (res) { return keep(req, res); }); });
}
function netFirst(req) {
  return new Promise(function (resolve, reject) {
    var done = false;
    function finish(r) { if (!done && r) { done = true; clearTimeout(t); resolve(r); return true; } return false; }
    var t = setTimeout(function () { saved(req).then(finish); }, NET_WAIT);
    fetch(req).then(function (res) { keep(req, res); finish(res); }, function () {
      saved(req).then(function (m) { if (!finish(m) && !done) { done = true; clearTimeout(t); reject(new TypeError('offline')); } });
    });
  });
}
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  var fixed = url.searchParams.has('v') || /\/(fonts|icons|vendor)\//.test(url.pathname);
  e.respondWith(fixed ? cacheFirst(req) : netFirst(req));
});
