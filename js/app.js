/* واجهة رينو الخاصة: الدخول، الرئيسية، القائمة والأقسام، الكتالوج، تفاصيل المنتج، المسح بالكاميرا، والقراءة من غير نت. */
(function () {
  'use strict';
  var CFG = window.RENO_CONFIG || {};
  var LIVE = !!(CFG.CLIENT_ID && CFG.API_URL);
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var app = $('#app');
  var S = {
    data: null, models: [], byCode: {}, byBarcode: {},
    q: '', cat: 'الكل', avail: 'all', filterOpen: false, catScroll: 0,
    token: null, user: null, loginErr: '',
    perf: { loadMs: null, scanMs: null, engine: '' },
    loading: false, installEvt: null,
    offline: false, dataAt: null, netErr: false
  };

  /* ---------- أدوات ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var AR = '٠١٢٣٤٥٦٧٨٩';
  function ar(v) { return String(v).replace(/[0-9]/g, function (d) { return AR[d]; }).replace(/,/g, '،').replace(/\./g, '٫'); }
  function num(n) { return ar(Math.round(Number(n) || 0).toLocaleString('en-US')); }
  function money(n) { return '<span class="price num">' + num(n) + '<small>جـ</small></span>'; }
  function secs(ms) { return ar((ms / 1000).toFixed(1)); }
  function timeAr(d) { var h = d.getHours(), m = d.getMinutes(); return ar((h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m) + ' ' + (h < 12 ? 'ص' : 'م'); }
  function dateAr(d) {
    try { return ar(new Intl.DateTimeFormat('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d).replace(/[،,]/g, '')); }
    catch (e) { return ar(d.toLocaleDateString()); }
  }
  var SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL'];
  function sizeRank(s) { var i = SIZE_ORDER.indexOf(String(s).toUpperCase()); if (i >= 0) return i; var n = parseFloat(s); return isNaN(n) ? 900 : 100 + n; }
  function sizeLabel(s) { s = String(s || '').trim(); var m = s.match(/^from\s+(\d+)\s+to\s+(\d+)\s*kg$/i); return m ? m[1] + '–' + m[2] + ' kg' : (s || '—'); }
  function garment(cat) {
    cat = cat || '';
    if (/فساتين|قمصان نوم|لانجري|تنانير/.test(cat)) return window.GARMENT.dress;
    if (/بناطيل/.test(cat)) return window.GARMENT.pants;
    if (/بيجامات|ساتان|أطقم|تيشيرتات|بلايز|ترينجات|جواكت/.test(cat)) return window.GARMENT.top;
    return window.GARMENT.hanger;
  }
  /* وقت آخر نسخة بيانات: «النهارده ٢:١٠ م»، «إمبارح ٩:٠٥ م»، أو التاريخ. */
  function whenAr(ms) {
    var d = new Date(ms), n = new Date(), y = new Date(n.getTime() - 864e5);
    var day = d.toDateString() === n.toDateString() ? 'النهارده' : d.toDateString() === y.toDateString() ? 'إمبارح' : ar(d.getDate() + '/' + (d.getMonth() + 1));
    return day + ' ' + timeAr(d);
  }
  var toastT;
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3200); }
  function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }

  /* ---------- البيانات ---------- */
  function setData(d) {
    S.data = d;
    var limit = Number(d.lowLimit) || 2, groups = {}, order = [];
    S.byBarcode = {};
    (d.items || []).forEach(function (r) {
      var it = { b: String(r[0]), n: String(r[1] || ''), m: String(r[2] || ''), s: sizeLabel(r[3]), p: Number(r[4]) || 0, q: Number(r[5]) || 0, src: String(r[6] || '') };
      S.byBarcode[it.b.toUpperCase()] = it;
      var key = it.m || it.b;
      if (!groups[key]) { groups[key] = { code: key, name: it.n, items: [], total: 0, price: it.p, src: it.src }; order.push(key); }
      var g = groups[key]; g.items.push(it); g.total += it.q; if (it.p && (!g.price || it.p < g.price)) g.price = it.p;
    });
    S.models = order.map(function (k) {
      var g = groups[k];
      g.items.sort(function (a, b) { return sizeRank(a.s) - sizeRank(b.s); });
      g.cat = ((d.cats || {})[k] || '').replace(/[‪-‮‎‏]/g, '') || 'أخرى';
      var fromSheet = (d.avail || {})[k];
      g.state = fromSheet === 'متاح' ? 'ok' : fromSheet === 'قليل' ? 'low' : fromSheet === 'خلص' ? 'out'
        : g.total <= 0 ? 'out' : g.items.some(function (i) { return i.q <= limit; }) ? 'low' : 'ok';
      g.rank = g.state === 'ok' ? 1 : g.state === 'low' ? 2 : 3;
      g.hay = (g.name + ' ' + g.code + ' ' + g.cat + ' ' + g.items.map(function (i) { return i.b; }).join(' ')).toLowerCase();
      return g;
    }).sort(function (a, b) { return a.rank - b.rank || a.code.localeCompare(b.code, 'en', { numeric: true }); });
    S.byCode = {}; S.models.forEach(function (m) { S.byCode[m.code] = m; });
  }
  function categories() {
    var c = {}; S.models.forEach(function (m) { c[m.cat] = (c[m.cat] || 0) + 1; });
    return Object.keys(c).filter(function (k) { return k !== 'أخرى'; }).sort(function (a, b) { return c[b] - c[a]; }).concat(c['أخرى'] ? ['أخرى'] : []);
  }

  /* ---------- الدخول ---------- */
  function parseJwt(t) { try { var p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(p)))); } catch (e) { return null; } }
  function setToken(t) {
    var p = t && parseJwt(t);
    if (!p || p.exp * 1000 < Date.now() + 30000) { S.token = null; S.user = null; try { sessionStorage.removeItem('reno_idt'); } catch (e) { } return false; }
    S.token = t; S.user = { name: p.given_name || p.name || '', email: p.email || '' };
    try { sessionStorage.setItem('reno_idt', t); } catch (e) { }
    return true;
  }
  /* الدخول بتحويل الصفحة كلها لجوجل والرجوع برمز الدخول. ده بيشتغل في أي متصفح موبايل، ومش محتاج نافذة منبثقة. */
  var REDIRECT = location.origin + location.pathname.replace(/[^/]*$/, '');
  function rnd() { var a = new Uint8Array(16); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function startLogin(silent) {
    var nonce = rnd(), hint = load('reno_hint');
    store('reno_nonce', { n: nonce, at: Date.now(), silent: !!silent, back: location.hash });
    location.assign('https://accounts.google.com/o/oauth2/v2/auth?client_id=' + encodeURIComponent(CFG.CLIENT_ID) +
      '&response_type=id_token&scope=' + encodeURIComponent('openid email profile') + '&redirect_uri=' + encodeURIComponent(REDIRECT) +
      '&nonce=' + nonce + (silent && hint ? '&prompt=none&login_hint=' + encodeURIComponent(hint) : '&prompt=select_account'));
  }
  /* بيقرا نتيجة الرجوع من جوجل من آخر العنوان، وبيمسحها من العنوان فورًا. بيرجّع true لو كان فيه نتيجة. */
  function finishLogin() {
    var h = location.hash.replace(/^#/, '');
    if (!/(^|&)(id_token|error)=/.test(h)) return false;
    var q = {}; h.split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); });
    var st = load('reno_nonce') || {}; store('reno_nonce', null);
    history.replaceState(null, '', location.pathname + location.search + (/^#(home|catalog|scan|p\/)/.test(st.back || '') ? st.back : '#home'));
    if (q.error) {
      if (!st.silent) S.loginErr = q.error === 'access_denied' ? 'الدخول اتلغى، أو الحساب ده مش مضاف في وضع التجربة عند جوجل.' : 'جوجل رفضت طلب الدخول (' + q.error + '). جرّبي تاني.';
      return true;
    }
    var p = parseJwt(q.id_token || '');
    if (!p || !st.n || p.nonce !== st.n || Date.now() - st.at > 600000) { S.loginErr = 'طلب الدخول ما اكتملش. جرّبي تاني.'; return true; }
    if (setToken(q.id_token)) { store('reno_hint', S.user.email); S.loginErr = ''; S.fresh = true; }
    return true;
  }
  function signOut() {
    try { sessionStorage.removeItem('reno_idt'); } catch (e) { }
    store('reno_cache', null); S.token = null; S.user = null; S.data = null; S.models = [];
    S.offline = false; S.dataAt = null; S.netErr = false;
    store('reno_hint', null); store('reno_nonce', null);
    closeDrawer(); render();
  }
  var ERR = {
    not_allowed: 'الإيميل ده مش في قائمة المسموح لهم. كلّمي صاحب الحساب يضيفه.',
    bad_token: 'جلسة الدخول انتهت. سجّلي الدخول تاني.', no_token: 'سجّلي الدخول الأول.',
    server: 'حصلت مشكلة في قراءة البيانات. جرّبي تاني بعد دقيقة.'
  };
  /* ---------- الشغل من غير نت ----------
     آخر نسخة بيانات بتفضل على الجهاز. لو مفيش نت، التطبيق بيفتح بيها (للقراءة والمسح) لحد ٢٤ ساعة من آخر تحديث،
     ولنفس الحساب اللي كان داخل بس. تسجيل الخروج بيمسحها. */
  var OFFLINE_MAX = 24 * 3600 * 1000, PROBE = 'https://www.gstatic.com/generate_204';
  function usableCache() {
    var c = load('reno_cache'), h = load('reno_hint');
    return c && c.data && c.at && h && c.email === h && Date.now() - c.at < OFFLINE_MAX ? c : null;
  }
  /* بيتأكد إن جوجل واصل فعلًا قبل ما نحوّل الصفحة ليه؛ التحويل من غير نت بيسيب المستخدمة على صفحة خطأ. */
  function probe() {
    if (navigator.onLine === false) return Promise.resolve(false);
    return new Promise(function (res) {
      var done = false, ac = window.AbortController ? new AbortController() : null;
      function fin(v) { if (done) return; done = true; clearTimeout(t); if (!v && ac) { try { ac.abort(); } catch (e) { } } res(v); }
      var t = setTimeout(function () { fin(false); }, 3000);
      fetch(PROBE, { mode: 'no-cors', cache: 'no-store', signal: ac ? ac.signal : undefined }).then(function () { fin(true); }, function () { fin(false); });
    });
  }
  function goOffline(c) {
    S.offline = true; S.dataAt = c.at; S.loginErr = '';
    S.user = { name: (c.data.user && c.data.user.name) || '', email: c.email };
    setData(c.data); render();
  }
  /* الدخول بعد التأكد من الاتصال. من غير نت: آخر نسخة لو موجودة، وإلا رسالة واضحة. */
  function tryLogin(silent) {
    return probe().then(function (up) {
      if (up) { if (silent) { try { sessionStorage.setItem('reno_silent', '1'); } catch (e) { } } return startLogin(silent); }
      if (S.data) { S.offline = true; netChanged(); toast('لسه مفيش اتصال بالنت.'); return; }
      var c = usableCache(); if (c) return goOffline(c);
      S.loginErr = 'مفيش اتصال بالنت. افتحي النت وجرّبي تاني.'; render();
    });
  }
  /* زر «تحديث»: بجلسة شغّالة بنقرا البيانات، ومن غيرها بنجدّد الدخول الأول. */
  function tokenFresh() { var p = S.token && parseJwt(S.token); return !!(p && p.exp * 1000 > Date.now() + 30000); }
  function reconnect() { if (tokenFresh()) return bootstrap(true); return tryLogin(true); }
  /* تغيّر حالة الاتصال: الرئيسية بتترسم تاني (كارت المزامنة)، وباقي الشاشات الشريط بس عشان البحث والكاميرا ما يتقطعوش. */
  function netChanged() { if (current && current.name === 'home') render(); else paintNet(); }
  function paintNet() {
    var el = $('.netbar'); if (!el) return;
    if (!LIVE || !S.offline || !S.data) { el.hidden = true; el.innerHTML = ''; return; }
    el.innerHTML = '<span>' + (navigator.onLine === false ? 'من غير نت' : 'البيانات ما اتحدّثتش') + (S.dataAt ? ' · آخر تحديث ' + whenAr(S.dataAt) : '') + '</span><button data-act="retry">تحديث</button>';
    el.hidden = false;
  }

  function bootstrap(manual) {
    if (!LIVE || S.loading) return;
    S.loading = true; S.netErr = false; if (!S.data) render();
    var t0 = performance.now(), ac = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ac) { try { ac.abort(); } catch (e) { } } }, 25000);
    fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'bootstrap', idToken: S.token }), signal: ac ? ac.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'server' }; }); }, function () { return null; })
      .then(function (d) {
        clearTimeout(timer); S.loading = false;
        if (d === null) { /* الشبكة ما وصلتش */
          if (S.data) { S.offline = true; netChanged(); if (manual) toast('لسه مفيش اتصال. اللي ظاهر آخر نسخة اتحمّلت.'); }
          else { S.netErr = true; render(); }
          return;
        }
        if (!d.ok) {
          var code = d.error || 'server';
          if (code === 'not_allowed' || code === 'bad_token' || code === 'no_token') {
            setToken(null);
            if (code !== 'not_allowed' && !S.fresh && load('reno_hint')) return startLogin(true);
            S.loginErr = ERR[code]; store('reno_cache', null); S.data = null; S.offline = false; S.dataAt = null; render();
          }
          else if (S.data) { toast(ERR.server); paintNet(); }
          else { S.netErr = true; render(); }
          return;
        }
        S.perf.loadMs = performance.now() - t0; S.offline = false; S.dataAt = Date.now();
        if (d.user && d.user.name && S.user) S.user.name = d.user.name;
        setData(d); store('reno_cache', { at: S.dataAt, email: S.user && S.user.email, data: d }); render();
        if (manual) toast('البيانات اتحدّثت.');
      });
  }

  /* ---------- القوالب ---------- */
  var IC = window.IC;
  function head(o) {
    return '<header class="head"><div class="head-row">' +
      (o.back ? '<button class="hbtn" data-act="back" aria-label="رجوع">' + IC.back + '</button>' : '<button class="hbtn" data-act="menu" aria-label="القائمة">' + IC.menu + '</button>') +
      (o.brand ? '<div class="brand">RENO</div>' : '<h1>' + esc(o.title) + '</h1>') +
      (o.right ? '<button class="hbtn" data-act="' + o.right.act + '" aria-label="' + o.right.label + '">' + o.right.icon + '</button>' : '<span class="hbtn ghost"></span>') +
      '</div><div class="netbar" role="status" hidden></div></header>';
  }
  function nav(on) {
    var tabs = [['home', 'الرئيسية', IC.home], ['catalog', 'الكتالوج', IC.grid], ['scan', 'بيع', IC.plusCircle], ['sync', 'المزامنة', IC.sync], ['log', 'السجل', IC.list]];
    return '<nav class="nav" aria-label="التنقل">' + tabs.map(function (t) {
      return '<button data-act="tab" data-tab="' + t[0] + '"' + (t[0] === on ? ' class="on" aria-current="page"' : '') + '>' + t[2] + '<span>' + t[1] + '</span></button>';
    }).join('') + '</nav>';
  }
  function strip() {
    if (LIVE) return '';
    return '<div class="strip">' + IC.alert + '<div><b>بيانات عيّنة للتجربة.</b> الدخول بحساب جوجل والبيانات الحقيقية لسه ما اتفعّلوش. الشكل والمسح بالكاميرا شغّالين.</div></div>';
  }
  function badge(m) {
    if (m.state === 'out') return '<span class="badge out">خلص</span>';
    return '<span class="badge ' + (m.state === 'low' ? 'low' : 'ok') + ' num">متاح ' + num(m.total) + '</span>';
  }

  function viewHome() {
    var d = S.data, k = d.kpis || {}, now = new Date();
    var name = (S.user && S.user.name) || (d.user && d.user.name) || '';
    var t = Number(k.salesToday) || 0, y = Number(k.salesYesterday) || 0, sub = '<span class="k-sub">جنيه</span>';
    if (y > 0) { var pc = Math.round((t - y) / y * 100); sub = '<span class="k-sub ' + (pc >= 0 ? 'up' : 'down') + ' num">' + (pc >= 0 ? '▲' : '▼') + ' ' + num(Math.abs(pc)) + '٪</span>'; }
    var sy = d.sync || {}, cls = 'sync', st, ss;
    if (d.demo || sy.last == null) { cls += ' off'; st = 'حالة المزامنة'; ss = 'بتظهر هنا بعد تفعيل الدخول'; }
    else if (S.offline) { cls += ' off'; st = 'حالة المزامنة وقت آخر تحديث'; ss = (sy.ok ? 'كانت شغّالة' : 'كان فيها مشكلة') + ' · آخر نبضة ' + timeAr(new Date(sy.last)); }
    else if (sy.ok) { st = 'المزامنة شغّالة'; ss = 'آخر تحديث ' + timeAr(new Date(sy.last)) + ' – متصل بشوبيفاي'; }
    else { cls += ' bad'; st = 'فيه مشكلة في المزامنة'; ss = 'آخر نبضة ' + timeAr(new Date(sy.last)); }
    var tiles = [['scan', 'بيع جديد', IC.cart], ['catalog', 'الكتالوج', IC.grid], ['soon', 'جرد مخزون', IC.box], ['soon', 'المشتريات', IC.truck], ['soon', 'تسليم خامات', IC.scissors], ['soon', 'التقارير', IC.chart]];
    return head({ brand: true, right: { act: 'search', label: 'بحث', icon: IC.search } }) +
      '<main class="view">' + strip() +
      '<section class="hello"><div><h2>أهلاً ' + esc(name) + '</h2><p>' + dateAr(now) + '</p></div><div class="avatar" aria-hidden="true">' + esc((name || 'ر').charAt(0)) + '</div></section>' +
      '<section class="kpis">' +
      '<div class="card kpi"><span class="k-label">مبيعات اليوم</span><span class="k-val num">' + num(t) + '</span>' + sub + '</div>' +
      '<div class="card kpi"><span class="k-label">عدد الأصناف</span><span class="k-val num">' + num(k.activeItems != null ? k.activeItems : (d.items || []).length) + '</span><span class="k-sub">صنف نشط</span></div>' +
      '<div class="card kpi"><span class="k-label">تحت الحد</span><span class="k-val gold num">' + num(k.lowStock || 0) + '</span><span class="k-sub">تحتاج طلب</span></div>' +
      '</section>' +
      '<h3 class="sec-title">اختصارات سريعة</h3>' +
      '<section class="tiles">' + tiles.map(function (x) {
        return '<button class="card tile" data-act="tile" data-to="' + x[0] + '"><span class="t-ic">' + x[2] + '</span><span>' + x[1] + '</span></button>';
      }).join('') + '</section>' +
      '<button class="' + cls + '" data-act="tab" data-tab="sync"><span class="dot"></span><span class="s-txt"><b>' + st + '</b><small>' + ss + '</small></span>' + IC.sync + '</button>' +
      '</main>' + nav('home');
  }

  function modelCard(m) {
    return '<button class="card model" data-act="open" data-code="' + esc(m.code) + '">' +
      '<span class="g-tile">' + garment(m.cat) + '</span>' +
      '<span class="m-body"><span class="m-name" dir="auto">' + esc(m.name) + '</span>' +
      '<span class="m-sub">' + esc(m.cat) + ' · <span class="ltr">' + esc(m.code) + '</span></span>' +
      '<span class="sizes">' + m.items.map(function (i) { return '<span class="size ltr">' + esc(i.s) + '</span>'; }).join('') + '</span>' +
      '<span class="m-foot">' + money(m.price) + badge(m) + '</span></span></button>';
  }
  function catalogList() {
    var q = S.q.trim().toLowerCase(), list = S.models.filter(function (m) { return (S.cat === 'الكل' || m.cat === S.cat) && (S.avail === 'all' || m.state === S.avail) && (!q || m.hay.indexOf(q) >= 0); });
    if (!list.length) return '<div class="empty"><b>مفيش نتيجة</b>جرّبي اسم تاني أو كود الموديل أو الباركود.</div>';
    return '<p class="count-line num">' + num(list.length) + ' موديل</p><div class="models">' + list.map(modelCard).join('') + '</div>';
  }
  function viewCatalog() {
    var cats = ['الكل'].concat(categories());
    var av = [['all', 'كل الحالات'], ['ok', 'متاح'], ['low', 'قليل'], ['out', 'خلص']];
    return head({ back: true, title: 'الكتالوج', right: { act: 'filter', label: 'تصفية بحالة التوفر', icon: IC.filter } }) +
      '<main class="view">' +
      '<label class="search">' + IC.search + '<input id="q" type="search" inputmode="search" autocomplete="off" enterkeyhint="search" placeholder="دوّري باسم المنتج أو الباركود…" value="' + esc(S.q) + '"><button class="clear" data-act="clear" aria-label="مسح البحث"' + (S.q ? '' : ' hidden') + '>' + IC.close + '</button><button class="in-btn" data-act="scan" aria-label="مسح باركود">' + IC.barcode + '</button></label>' +
      '<div class="chips" role="tablist">' + cats.map(function (c) { return '<button class="chip' + (c === S.cat ? ' on' : '') + '" data-act="cat" data-cat="' + esc(c) + '" role="tab">' + esc(c) + '</button>'; }).join('') + '</div>' +
      '<div class="chips" id="avail"' + (S.filterOpen || S.avail !== 'all' ? '' : ' hidden') + '>' + av.map(function (a) { return '<button class="chip' + (a[0] === S.avail ? ' on' : '') + '" data-act="avail" data-av="' + a[0] + '">' + a[1] + '</button>'; }).join('') + '</div>' +
      '<div id="list">' + catalogList() + '</div>' +
      '</main>' + nav('catalog');
  }

  function viewProduct(code) {
    var m = S.byCode[code];
    if (!m) return head({ back: true, title: 'تفاصيل المنتج' }) + '<main class="view"><div class="empty"><b>الموديل ده مش موجود</b>ممكن يكون اتوقف أو الكود اتغيّر.</div></main>' + nav('catalog');
    var limit = Number(S.data.lowLimit) || 2;
    return head({ back: true, title: 'تفاصيل المنتج' }) +
      '<main class="view">' +
      '<section class="hero"><span class="g-tile">' + garment(m.cat) + '</span><div class="hero-body"><h2 dir="auto">' + esc(m.name) + '</h2><p>' + esc(m.cat) + ' · <span class="ltr">' + esc(m.code) + '</span></p>' +
      '<div class="hero-foot">' + money(m.price) + (S.data.demo ? '' : '<span class="badge ok">' + IC.check + 'مرتبط بشوبيفاي</span>') + '</div></div></section>' +
      '<h3 class="sec-title">المخزون حسب المقاس</h3>' +
      '<section class="stock-grid">' + m.items.map(function (i) {
        return '<div class="card stock"><b class="ltr">' + esc(i.s) + '</b><span class="num ' + (i.q <= 0 ? 'zero' : i.q <= limit ? 'low' : '') + '">' + num(i.q) + '</span></div>';
      }).join('') + '</section>' +
      '<section class="card rows">' +
      '<div class="row"><span class="r-k">كود الموديل</span><span class="r-v ltr">' + esc(m.code) + '</span></div>' +
      '<div class="row"><span class="r-k">عدد الأصناف</span><span class="r-v num">' + num(m.items.length) + '</span></div>' +
      '<div class="row"><span class="r-k">المصدر</span><span class="r-v">' + esc(m.src || '—') + '</span></div>' +
      '<div class="row"><span class="r-k">إجمالي الرصيد</span><span class="r-v accent num">' + num(m.total) + ' قطعة</span></div>' +
      '</section>' +
      '<h3 class="sec-title">المقاسات والباركود</h3>' +
      '<section class="card rows">' + m.items.map(function (i) {
        return '<div class="row"><span class="r-k"><span class="ltr">' + esc(i.s) + '</span> · <span class="ltr">' + esc(i.b) + '</span></span><span class="r-v num">' + num(i.q) + '</span></div>';
      }).join('') + '</section>' +
      '<button class="card act" data-act="soon"><span>عرض حركات المخزون</span>' + IC.next + '</button>' +
      '</main>' + nav('catalog');
  }

  function resultCard() {
    var r = scan.result; if (!r) return '<div class="empty" style="padding:18px 8px">لسه ما اتمسحش أي صنف.</div>';
    var meta = r.ms != null ? '<p class="scan-meta num">اتقرا في ' + secs(r.ms) + ' ثانية' + (S.perf.engine ? ' · ' + S.perf.engine : '') + '</p>' : '';
    if (!r.item) return meta + '<div class="card result unknown"><span class="g-tile">' + window.GARMENT.hanger + '</span><div class="res-body"><b class="ltr" style="text-align:right">' + esc(r.code) + '</b><small>' + (S.data.demo ? 'الباركود اتقرا. الصنف هيظهر بعد تفعيل البيانات الحقيقية.' : 'الباركود ده مش موجود في المنتجات.') + '</small></div></div>';
    var it = r.item, m = S.byCode[it.m || it.b] || {};
    return meta + '<div class="card result"><button class="g-tile" data-act="open" data-code="' + esc(it.m || it.b) + '" aria-label="تفاصيل المنتج">' + garment(m.cat) + '</button>' +
      '<button class="res-body" data-act="open" data-code="' + esc(it.m || it.b) + '"><b dir="auto" style="text-align:right">' + esc(it.n) + ' · <span class="ltr">' + esc(it.s) + '</span></b>' +
      '<small><span class="ltr">' + esc(it.b) + '</span> · متاح <span class="num">' + num(it.q) + '</span></small>' + money(it.p) + '</button>' +
      '<button class="add" data-act="add" aria-label="إضافة للفاتورة">' + IC.plus + '</button></div>';
  }
  function viewScan() {
    return head({ back: true, title: 'مسح الباركود' }) +
      '<main class="view flush">' +
      '<section class="scan-stage" id="scan-stage"><video id="cam" playsinline muted></video><div class="shade"></div>' +
      '<div class="frame"><i></i><i></i><i></i><i></i><span class="laser"></span></div>' +
      '<button class="torch" id="torch" data-act="torch" aria-label="الكشاف" hidden>' + IC.torch + '</button>' +
      '<p class="scan-hint">وجّهي الكاميرا ناحية الباركود</p>' +
      '<div class="scan-msg" id="scan-msg"><p>بنفتح الكاميرا…</p></div></section>' +
      '<div class="pad" style="display:flex;flex-direction:column;gap:16px;padding-top:16px">' +
      '<p class="muted" style="margin:0 2px -8px;font-size:14.5px">آخر صنف تم مسحه</p>' +
      '<div id="result">' + resultCard() + '</div>' +
      '<div class="card" id="manual-box"><button class="act center" data-act="manual">' + IC.barcode + '<span>إدخال الباركود يدويًا</span></button></div>' +
      '</div></main>' + nav('scan');
  }
  function pageBtn(pg, cls) {
    return '<button class="card ' + cls + (pg.to ? '' : ' soon') + '" data-act="page" data-to="' + esc(pg.to || '') + '">' +
      '<span class="pg-top"><span class="pg-ic">' + lu(pg.i) + '</span>' + (pg.to ? '' : '<span class="tag">قريبًا</span>') + '</span>' +
      (cls === 'pg-card' ? '<span class="pg-txt"><b>' + esc(pg.n) + '</b><small>' + esc(pg.d) + '</small></span>' : '<span class="pg-name">' + esc(pg.n) + '</span>') + '</button>';
  }
  function viewSection(id) {
    var sec = PAGES.filter(function (x) { return x.id === id; })[0];
    if (!sec) return head({ back: true, title: 'القائمة' }) + '<main class="view"><div class="empty"><b>القسم ده مش موجود</b></div></main>' + nav('');
    return head({ back: true, title: sec.n }) +
      '<main class="view"><p class="lead num">' + countAr(sec.pages.length) + ' | ' + esc(sec.d) + '</p>' +
      '<section class="pg-grid">' + sec.pages.map(function (pg) { return pageBtn(pg, 'pg-card'); }).join('') + '</section></main>' + nav('');
  }
  function viewAll() {
    return head({ back: true, title: 'القائمة' }) +
      '<main class="view" style="gap:20px"><p class="lead">كل صفحات التطبيق في مكان واحد، مجمّعة بالأقسام</p>' +
      PAGES.map(function (sec) {
        return '<section class="all-sec"><div class="all-head"><h2>' + esc(sec.n) + '</h2><span class="num">' + countAr(sec.pages.length) + '</span></div>' +
          '<div class="all-grid">' + sec.pages.map(function (pg) { return pageBtn(pg, 'pg-tile'); }).join('') + '</div></section>';
      }).join('') + '</main>' + nav('');
  }
  function viewLogin() {
    return '<div class="login"><div class="login-top"><div class="mark">RENO</div><div class="sub">STORE</div></div>' +
      '<div class="login-card"><h2>أهلاً بيكي</h2><p>سجّلي الدخول بحساب جوجل المسجّل عند الإدارة.</p>' +
      (S.loginErr ? '<div class="login-err">' + esc(S.loginErr) + '</div>' : '') +
      '<button class="btn login-btn" data-act="login">الدخول بحساب جوجل</button>' +
      '<small class="login-note">هتتحوّلي لصفحة جوجل وترجعي هنا تلقائي.</small></div></div>';
  }
  function viewNetErr() {
    return head({ brand: true }) + '<main class="view"><div class="empty"><b>البيانات ما وصلتش</b>اتأكدي إن النت شغّال وجرّبي تاني.' +
      '<div style="margin-top:16px"><button class="btn" data-act="retry">جرّبي تاني</button></div></div></main>' + nav('home');
  }
  function viewLoading() {
    return head({ brand: true }) + '<main class="view"><div class="skeleton" style="height:64px"></div><div class="skeleton" style="height:104px"></div><div class="skeleton"></div><div class="skeleton"></div></main>' + nav('home');
  }

  /* ---------- التنقل ---------- */
  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#\/?/, '')), p = h.split('/');
    if (p[0] === 'catalog') return { name: 'catalog' };
    if (p[0] === 'p' && p[1]) return { name: 'product', code: p.slice(1).join('/') };
    if (p[0] === 'scan') return { name: 'scan' };
    if (p[0] === 'all') return { name: 'all' };
    if (p[0] === 's' && p[1]) return { name: 'section', id: p[1] };
    return { name: 'home' };
  }
  var current = null;
  function render() {
    var r = route();
    if (current && current.name === 'catalog' && r.name !== 'catalog') S.catScroll = window.scrollY;
    if (current && current.name === 'scan' && r.name !== 'scan') scanStop();
    if (LIVE && !S.token && !(S.offline && S.data)) { current = { name: 'login' }; app.innerHTML = viewLogin(); return; }
    if (!S.data) { current = { name: 'loading' }; app.innerHTML = S.netErr ? viewNetErr() : viewLoading(); return; }
    var was = current && current.name; current = r;
    app.innerHTML = r.name === 'catalog' ? viewCatalog() : r.name === 'product' ? viewProduct(r.code) : r.name === 'scan' ? viewScan() : r.name === 'all' ? viewAll() : r.name === 'section' ? viewSection(r.id) : viewHome();
    if (r.name === 'catalog') window.scrollTo(0, was === 'product' ? S.catScroll : 0); else window.scrollTo(0, 0);
    if (r.name === 'scan' && was !== 'scan') scanStart();
    else if (r.name === 'scan') scanAttach();
    paintNet();
  }
  function go(h) { if (location.hash === '#' + h) render(); else location.hash = h; }

  /* ---------- المسح بالكاميرا ---------- */
  var scan = { stream: null, detector: null, reader: null, timer: null, last: '', lastAt: 0, t0: 0, canvas: null, busy: false, result: null, torchOn: false, starting: false };
  var FORMATS = ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'codabar', 'qr_code'];
  function scanMsg(text, retry) {
    var el = $('#scan-msg'); if (!el) return;
    if (text == null) { el.hidden = true; return; }
    el.hidden = false; el.innerHTML = '<p>' + esc(text) + '</p>' + (retry ? '<button class="btn-gold" data-act="rescan">جرّبي تاني</button>' : '');
  }
  function loadZxing() {
    return new Promise(function (res, rej) {
      if (window.ZXing) return res();
      var s = document.createElement('script'); s.src = 'vendor/zxing.min.js?v=0.21.3'; s.onload = function () { res(); }; s.onerror = rej; document.head.appendChild(s);
    });
  }
  function zxReader() {
    if (scan.reader) return scan.reader;
    var Z = window.ZXing, hints = new Map();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.CODE_93, Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.ITF, Z.BarcodeFormat.CODABAR, Z.BarcodeFormat.QR_CODE]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    scan.reader = new Z.MultiFormatReader(); scan.reader.setHints(hints); return scan.reader;
  }
  function decodeCanvas(c) {
    var Z = window.ZXing;
    try { return zxReader().decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(c)))).getText(); }
    catch (e) { return null; }
  }
  window.__renoDecodeCanvas = function (c) { return loadZxing().then(function () { return decodeCanvas(c); }); };
  function scanStop() {
    clearTimeout(scan.timer); scan.timer = null;
    if (scan.stream) { scan.stream.getTracks().forEach(function (t) { t.stop(); }); scan.stream = null; }
    scan.torchOn = false; scan.starting = false;
  }
  function scanAttach() {
    var v = $('#cam'); if (!v || !scan.stream) return;
    if (v.srcObject !== scan.stream) { v.srcObject = scan.stream; v.play().catch(function () { }); }
    scanMsg(null); torchUi();
  }
  function torchUi() {
    var b = $('#torch'), tr = scan.stream && scan.stream.getVideoTracks()[0], caps = tr && tr.getCapabilities ? tr.getCapabilities() : {};
    if (b) { b.hidden = !caps.torch; b.classList.toggle('on', scan.torchOn); }
  }
  function scanStart() {
    if (scan.starting || scan.stream) { scanAttach(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { scanMsg('المتصفح ده مش بيدعم الكاميرا. استخدمي إدخال الباركود يدويًا.'); return; }
    scan.starting = true; scanMsg('بنفتح الكاميرا…');
    navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(function (st) {
        scan.starting = false;
        if (!current || current.name !== 'scan') { st.getTracks().forEach(function (t) { t.stop(); }); return; }
        scan.stream = st; scanAttach();
        var native = Promise.resolve(null);
        if ('BarcodeDetector' in window) {
          native = window.BarcodeDetector.getSupportedFormats().then(function (f) {
            var use = FORMATS.filter(function (x) { return f.indexOf(x) >= 0; });
            return use.indexOf('code_128') >= 0 ? new window.BarcodeDetector({ formats: use }) : null;
          }).catch(function () { return null; });
        }
        return native.then(function (det) {
          scan.detector = det;
          if (det) { S.perf.engine = 'قارئ الجهاز'; return; }
          S.perf.engine = 'قارئ التطبيق'; return loadZxing();
        }).then(function () { scan.t0 = performance.now(); loop(); });
      })
      .catch(function (e) {
        scan.starting = false;
        var n = e && e.name;
        scanMsg(n === 'NotAllowedError' || n === 'SecurityError' ? 'الكاميرا مقفولة على الموقع ده. افتحي إذن الكاميرا من إعدادات المتصفح وجرّبي تاني.'
          : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'مفيش كاميرا متاحة على الجهاز ده. استخدمي إدخال الباركود يدويًا.'
            : 'ماقدرناش نفتح الكاميرا. جرّبي تاني.', true);
      });
  }
  function loop() {
    clearTimeout(scan.timer);
    if (!scan.stream || !current || current.name !== 'scan') return;
    var v = $('#cam'), next = function () { scan.timer = setTimeout(loop, 120); };
    if (!v || v.readyState < 2 || !v.videoWidth || scan.busy) return next();
    if (scan.detector) {
      scan.busy = true;
      scan.detector.detect(v).then(function (codes) { scan.busy = false; if (codes && codes.length) onCode(codes[0].rawValue, 'cam'); next(); })
        .catch(function () { scan.busy = false; next(); });
      return;
    }
    var c = scan.canvas || (scan.canvas = document.createElement('canvas'));
    var vw = v.videoWidth, vh = v.videoHeight, sw = Math.round(vw * 0.86), sh = Math.round(vh * 0.6), k = Math.min(1, 900 / sw);
    c.width = Math.round(sw * k); c.height = Math.round(sh * k);
    c.getContext('2d', { willReadFrequently: true }).drawImage(v, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    var txt = decodeCanvas(c); if (txt) onCode(txt, 'cam'); next();
  }
  function onCode(raw, src) {
    var code = String(raw || '').trim().toUpperCase(); if (!code) return;
    var now = performance.now();
    if (src === 'cam' && code === scan.last && now - scan.lastAt < 2500) return;
    scan.last = code; scan.lastAt = now;
    var ms = src === 'cam' ? now - scan.t0 : null; if (ms != null) S.perf.scanMs = ms;
    scan.t0 = now;
    scan.result = { code: code, item: S.byBarcode[code] || null, ms: ms };
    if (navigator.vibrate) { try { navigator.vibrate(60); } catch (e) { } }
    var box = $('#result'); if (box) box.innerHTML = resultCard();
  }

  /* ---------- القائمة الجانبية ---------- */
  var PAGES = window.RENO_PAGES || [];
  function lu(body, cls) { return '<svg class="' + (cls || 'ic') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>'; }
  function countAr(n) { return n === 1 ? 'صفحة واحدة' : n === 2 ? 'صفحتان' : n <= 10 ? num(n) + ' صفحات' : num(n) + ' صفحة'; }
  function openDrawer() {
    var d = $('#drawer'), u = S.user || {}, name = u.name || (S.data && S.data.user && S.data.user.name) || 'رينو';
    var p = S.perf, lines = ['نسخة <span class="ltr">' + esc(CFG.BUILD || '') + '</span>'];
    if (LIVE && S.dataAt) lines.push('آخر تحديث ' + whenAr(S.dataAt));
    if (p.loadMs != null) lines.push('تحميل البيانات ' + secs(p.loadMs) + ' ث');
    if (p.scanMs != null) lines.push('آخر مسح ' + secs(p.scanMs) + ' ث');
    d.innerHTML = '<div class="dr-title">RENO STORE</div>' +
      '<div class="dr-list">' +
      '<button class="dr-item all" data-act="nav" data-to="all"><span>كل الصفحات</span>' + IC.grid + '</button>' +
      PAGES.map(function (sec) { return '<button class="dr-item" data-act="nav" data-to="s/' + sec.id + '"><span>' + esc(sec.n) + '</span>' + lu(sec.i) + '</button>'; }).join('') +
      '</div><div class="dr-foot">' +
      '<div class="dr-user"><div class="avatar" aria-hidden="true">' + esc(name.charAt(0)) + '</div><div class="dr-who"><b>' + esc(name) + '</b><small>' + esc(u.email || (LIVE ? '' : 'بيانات عيّنة')) + '</small></div></div>' +
      '<div class="dr-tools">' + (LIVE ? '<button data-act="refresh">تحديث البيانات</button>' : '') + '<button data-act="install">تثبيت التطبيق</button></div>' +
      (LIVE ? '<button class="dr-out" data-act="signout">تسجيل الخروج</button>' : '') +
      '<div class="dr-meta">' + lines.join(' · ') + '</div></div>';
    d.hidden = false; $('#drawer-scrim').hidden = false;
  }
  function closeDrawer() { $('#drawer').hidden = true; $('#drawer-scrim').hidden = true; }
  function install() {
    closeDrawer();
    if (S.installEvt) { S.installEvt.prompt(); S.installEvt = null; return; }
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return toast('التطبيق متثبّت فعلًا على الجهاز ده.');
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return toast('من زر المشاركة في Safari اختاري «إضافة إلى الشاشة الرئيسية».');
    toast('من قائمة المتصفح (⋮) اختاري «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».');
  }

  /* ---------- الأحداث ---------- */
  document.addEventListener('click', function (e) {
    if (e.target.id === 'drawer-scrim') return closeDrawer();
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.getAttribute('data-act');
    if (a === 'menu') return openDrawer();
    if (a === 'login') { b.disabled = true; b.textContent = 'بنحوّلك لجوجل…'; return tryLogin(false); }
    if (a === 'retry') { b.disabled = true; toast('بنحدّث البيانات…'); return reconnect(); }
    if (a === 'back') { if (history.length > 1 && current && current.name !== 'home') history.back(); else go('home'); return; }
    if (a === 'search') { go('catalog'); setTimeout(function () { var q = $('#q'); if (q) q.focus(); }, 60); return; }
    if (a === 'scan') return go('scan');
    if (a === 'tab' || a === 'tile') {
      var t = b.getAttribute('data-tab') || b.getAttribute('data-to'); closeDrawer();
      if (t === 'home' || t === 'catalog' || t === 'scan') return go(t);
      return toast(t === 'sync' ? 'صفحة حالة المزامنة لسه ما اتبنتش. الحالة ظاهرة في الرئيسية.' : 'الصفحة دي لسه ما اتبنتش. هتتفعّل في مرحلتها.');
    }
    if (a === 'nav') { closeDrawer(); return go(b.getAttribute('data-to')); }
    if (a === 'page') { var to = b.getAttribute('data-to'); return to ? go(to) : toast('الصفحة دي لسه ما اتبنتش. هتتفعّل في مرحلتها.'); }
    if (a === 'soon') return toast('الصفحة دي لسه ما اتبنتش. هتتفعّل في مرحلتها.');
    if (a === 'add') return toast('الإضافة للفاتورة هتشتغل مع نظام الفاتورة.');
    if (a === 'open') return go('p/' + encodeURIComponent(b.getAttribute('data-code')));
    if (a === 'cat' || a === 'avail') {
      if (a === 'cat') S.cat = b.getAttribute('data-cat'); else S.avail = b.getAttribute('data-av');
      b.parentNode.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', c === b); }); $('#list').innerHTML = catalogList(); return;
    }
    if (a === 'filter') { S.filterOpen = !S.filterOpen; var box = $('#avail'); if (box) box.hidden = !(S.filterOpen || S.avail !== 'all'); return; }
    if (a === 'clear') { S.q = ''; var q = $('#q'); q.value = ''; b.hidden = true; $('#list').innerHTML = catalogList(); q.focus(); return; }
    if (a === 'rescan') { scanStop(); return scanStart(); }
    if (a === 'torch') {
      var tr = scan.stream && scan.stream.getVideoTracks()[0]; if (!tr) return;
      scan.torchOn = !scan.torchOn; tr.applyConstraints({ advanced: [{ torch: scan.torchOn }] }).catch(function () { scan.torchOn = false; }).then(torchUi); return;
    }
    if (a === 'manual') {
      $('#manual-box').innerHTML = '<form class="manual" id="manual-form"><input id="manual-in" inputmode="latin" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="RN000001" aria-label="الباركود"><button class="btn" type="submit">بحث</button></form>';
      $('#manual-in').focus(); return;
    }
    if (a === 'refresh') { closeDrawer(); toast('بنحدّث البيانات…'); return reconnect(); }
    if (a === 'install') return install();
    if (a === 'signout') return signOut();
  });
  document.addEventListener('input', function (e) {
    if (e.target.id !== 'q') return;
    S.q = e.target.value; var c = $('.search .clear'); if (c) c.hidden = !S.q; $('#list').innerHTML = catalogList();
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'manual-form') return; e.preventDefault();
    var v = $('#manual-in').value; if (v.trim()) { onCode(v, 'manual'); $('#manual-in').value = ''; }
  });
  window.addEventListener('hashchange', render);
  document.addEventListener('visibilitychange', function () {
    if (!current || current.name !== 'scan') return;
    if (document.hidden) scanStop(); else scanStart();
  });
  window.addEventListener('offline', function () { if (LIVE && S.data) { S.offline = true; netChanged(); } });
  window.addEventListener('online', function () { if (!LIVE || !S.offline) return; if (tokenFresh()) bootstrap(); else paintNet(); });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); S.installEvt = e; });

  /* ---------- التشغيل ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () { });
  }
  if (!LIVE) { setData(window.RENO_SAMPLE); render(); }
  else {
    var came = finishLogin(), saved = null;
    if (!S.token) { try { saved = sessionStorage.getItem('reno_idt'); } catch (e) { } if (saved) setToken(saved); }
    if (S.token) {
      var c = load('reno_cache'); if (c && c.data && c.email === S.user.email) { S.dataAt = c.at || null; setData(c.data); }
      render(); bootstrap();
    } else {
      var tried = null; try { tried = sessionStorage.getItem('reno_silent'); } catch (e) { }
      var oc = came ? null : usableCache();
      if (!came && !tried && load('reno_hint')) tryLogin(true);       /* شاشة البداية فاضلة لحد ما نعرف فيه نت ولا لأ */
      else if (oc && navigator.onLine === false) goOffline(oc);
      else render();
    }
  }
})();
