/* شاشات البيع: السلة (٢.١)، إضافة صنف (٢.٢)، الدفع (٢.٣)، تم البيع (٢.٤)، وطابور الإرسال.
   الفاتورة بتتبعت لسكريبت الكتابة بمفتاح فريد: لو اتبعتت مرتين بتتسجّل مرة واحدة.
   لو النت قاطع بتتحفظ على الجهاز وتتبعت لوحدها لما يرجع. */
(window.RENO_EXT = window.RENO_EXT || []).push(function (R) {
  'use strict';
  var S = R.S, CFG = R.CFG, esc = R.esc, num = R.num, IC = R.IC;
  var $ = function (s) { return document.querySelector(s); };
  var SHOWROOM = 'معرض', MAX_QTY = 99;
  var CAN_WRITE = !R.LIVE || !!CFG.WRITE_URL;

  /* ---------- الحالة المحفوظة على الجهاز ---------- */
  var cart = R.load('reno_cart') || {};
  function freshCart() { return { channel: SHOWROOM, name: '', phone: '', discount: 0, lines: [], pay: 'كاش', recv: null }; }
  if (!cart.lines) cart = freshCart();
  function saveCart() { R.store('reno_cart', cart); }
  var outbox = R.load('reno_outbox') || [];
  function saveOutbox() { R.store('reno_outbox', outbox); }
  var ui = { editCust: false, editDisc: false, q: '', added: '', sending: false, payErr: '', lastKey: R.load('reno_last_sale') || '' };

  /* ترتيب العرض زي لوحات التصميم؛ أي قيمة جديدة في الإعدادات بتيجي في الآخر */
  var CH_ORDER = [SHOWROOM, 'واتساب', 'انستجرام', 'أونلاين'], PAY_ORDER = ['كاش', 'بطاقة', 'محفظة إلكترونية', 'تحويل بنكي'];
  function sortLike(list, order) { return list.slice().sort(function (a, b) { var i = order.indexOf(a), j = order.indexOf(b); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); }); }
  function meta() {
    var m = R.load('reno_meta') || {};
    return { role: m.role || 'مبيعات', discountMax: typeof m.discountMax === 'number' ? m.discountMax : 0.1,
      channels: sortLike(m.channels && m.channels.length ? m.channels : CH_ORDER, CH_ORDER),
      pays: sortLike(m.pays && m.pays.length ? m.pays : PAY_ORDER, PAY_ORDER) };
  }
  function isAdmin() { return meta().role === 'Admin'; }
  function loadMeta() {
    if (!R.LIVE || !CFG.WRITE_URL || !S.token) return;
    R.post(CFG.WRITE_URL, { action: 'meta', idToken: S.token }).then(function (d) {
      if (d && d.ok) R.store('reno_meta', { role: d.user && d.user.role, discountMax: d.discountMax, channels: d.channels, pays: d.pays, at: Date.now() });
    });
  }

  /* ---------- حسابات السلة ---------- */
  function item(b) { return S.byBarcode[String(b).toUpperCase()] || null; }
  function lineOf(b) { for (var i = 0; i < cart.lines.length; i++) if (cart.lines[i].b === b) return cart.lines[i]; return null; }
  function totals() {
    var gross = 0, pieces = 0;
    cart.lines.forEach(function (l) { var it = item(l.b); if (it) { gross += l.q * it.p; pieces += l.q; } });
    var maxDisc = isAdmin() ? gross : Math.floor(gross * meta().discountMax + 1e-9);
    var disc = Math.min(Math.max(0, Math.floor(Number(cart.discount) || 0)), gross);
    return { gross: gross, pieces: pieces, discount: disc, net: gross - disc, maxDisc: maxDisc, over: disc > maxDisc };
  }
  function piecesAr(n) { return n === 1 ? 'قطعة واحدة' : n === 2 ? 'قطعتين' : n <= 10 ? num(n) + ' قطع' : num(n) + ' قطعة'; }
  function egp(n) { return '<span class="num">' + num(n) + '</span> ج.م'; }
  R.cartCount = function () { return totals().pieces; };

  /** بيضيف قطعة للسلة. بيرجّع نص سبب الرفض، أو '' لو اتضافت. */
  function addOne(b) {
    var it = item(b); if (!it) return 'الصنف ده مش موجود في القائمة.';
    if (!(it.p > 0)) return 'الصنف ده من غير سعر بيع.';
    var l = lineOf(it.b), want = (l ? l.q : 0) + 1;
    if (want > MAX_QTY) return 'أقصى كمية للصنف ' + num(MAX_QTY) + '.';
    if (want > it.q && !isAdmin()) return it.q <= 0 ? 'الصنف ده خلص من المخزون.' : 'المتاح من الصنف ده ' + piecesAr(it.q) + ' بس.';
    if (l) l.q = want; else cart.lines.push({ b: it.b, q: 1 });
    saveCart(); return '';
  }
  function setQty(b, q) {
    var it = item(b), l = lineOf(b); if (!l) return '';
    if (q < 1) { cart.lines = cart.lines.filter(function (x) { return x !== l; }); saveCart(); return ''; }
    if (q > MAX_QTY) return 'أقصى كمية للصنف ' + num(MAX_QTY) + '.';
    if (it && q > l.q && q > it.q && !isAdmin()) return 'المتاح من الصنف ده ' + piecesAr(Math.max(it.q, 0)) + ' بس.';
    l.q = q; saveCart(); return '';
  }
  /* صنف في السلة اتشال من القائمة (اتوقّف أو اتمسح) بيتشال منها */
  function pruneCart() {
    if (!S.data) return;
    var n = cart.lines.length; cart.lines = cart.lines.filter(function (l) { return !!item(l.b); });
    if (cart.lines.length !== n) saveCart();
  }

  /* ---------- طابور الإرسال ---------- */
  var HOLD_MS = 60000;
  /** القطع اللي اتباعت من الجهاز ده ولسه رصيد الشيت ما اتخصمش منها. */
  R.hold = function () {
    var h = {};
    outbox.forEach(function (e) {
      if (e.state === 'failed') return;
      if (e.movedAt && S.dataAt && S.dataAt > e.movedAt + HOLD_MS) return;
      e.op.lines.forEach(function (l) { h[l.b] = (h[l.b] || 0) + l.q; });
    });
    return h;
  };
  function entry(key) { for (var i = 0; i < outbox.length; i++) if (outbox[i].key === key) return outbox[i]; return null; }
  function waiting() { return outbox.filter(function (e) { return e.state === 'pending'; }); }
  function failed() { return outbox.filter(function (e) { return e.state === 'failed'; }); }
  function prune() {
    var now = Date.now();
    outbox = outbox.filter(function (e) { return !(e.state === 'sent' && e.movedAt && now - e.movedAt > 6 * 3600000) && !(e.state === 'sent' && now - e.at > 3 * 86400000); });
    saveOutbox();
  }
  var REASON = {
    over_stock: 'الكمية أكتر من المتاح في المخزون', price_changed: 'سعر الصنف اتغيّر', discount_limit: 'الخصم أكتر من المسموح', inactive: 'فيه صنف موقوف',
    unknown_barcode: 'فيه صنف مش موجود', bad_discount: 'قيمة الخصم مش مظبوطة', bad_phone: 'رقم الموبايل مش مظبوط', dup_barcode: 'فيه صنف متكرر', bad_qty: 'فيه كمية مش مظبوطة',
    bad_price: 'فيه صنف من غير سعر', bad_channel: 'قناة البيع مش في القائمة', bad_pay: 'طريقة الدفع مش في القائمة', bad_shipping: 'قيمة الشحن مش مظبوطة', not_allowed: 'الحساب ده مش مسموح له بالتسجيل', structure: 'تبويب الإدخال في الشيت اتغيّر. كلّمي الإدارة'
  };
  var RETRY = { bad_token: 1, no_token: 1, busy: 1, rate: 1, server: 1 };
  function detailText(d) {
    if (!d) return '';
    var det = d.detail || {}, it = det.barcode ? item(det.barcode) : null, nm = it ? ' (' + it.n + ' · ' + it.s + ')' : '';
    if (d.error === 'over_stock') return 'المتاح ' + piecesAr(Math.max(det.available || 0, 0)) + ' بس' + nm + '.';
    if (d.error === 'price_changed') return 'السعر دلوقتي ' + num(det.price) + ' ج.م' + nm + '.';
    if (d.error === 'discount_limit') return 'أقصى خصم للفاتورة دي ' + num(det.max) + ' ج.م.';
    return nm ? nm.trim() : '';
  }
  /** بيبعت فاتورة واحدة. النتيجة: 'sent' · 'pending' (الشبكة أو الجلسة) · 'rejected' (قاعدة اترفضت). */
  function send(e) {
    if (!R.LIVE) {     /* وضع العيّنة: مفيش سكريبت، فالنتيجة محاكاة */
      return new Promise(function (res) { setTimeout(function () { e.state = 'sent'; e.orderNo = 'ORD-' + e.key.slice(0, 6).toUpperCase(); e.sentAt = Date.now(); saveOutbox(); res('sent'); }, 350); });
    }
    if (!CFG.WRITE_URL || !S.token || !R.tokenFresh() || navigator.onLine === false) { e.offline = true; saveOutbox(); return Promise.resolve('pending'); }
    e.tries = (e.tries || 0) + 1;
    var op = JSON.parse(JSON.stringify(e.op)); if (e.offline) op.queued = true;
    return R.post(CFG.WRITE_URL, { action: 'sale', idToken: S.token, op: op }).then(function (d) {
      if (d === null) { e.offline = true; saveOutbox(); return 'pending'; }
      if (d.ok) { e.state = 'sent'; e.orderNo = d.orderNo; e.sentAt = Date.now(); e.flagged = !!d.flagged; e.err = ''; saveOutbox(); return 'sent'; }
      if (RETRY[d.error]) { e.err = d.error; saveOutbox(); return 'pending'; }
      e.err = d.error; e.errText = (REASON[d.error] || 'السيرفر رفض الفاتورة') + (detailText(d) ? ': ' + detailText(d) : '.'); e.state = 'failed'; saveOutbox(); return 'rejected';
    });
  }
  var flushing = false;
  function flush() {
    if (flushing || !waiting().length) return Promise.resolve();
    if (R.LIVE && (!S.token || !R.tokenFresh() || navigator.onLine === false)) return Promise.resolve();
    flushing = true;
    var list = waiting(), i = 0, sent = 0;
    function next() {
      if (i >= list.length) return Promise.resolve();
      return send(list[i++]).then(function (r) { if (r === 'sent') sent++; if (r === 'pending') return; return next(); });
    }
    return next().then(function () {
      flushing = false;
      if (sent) { R.toast(sent === 1 ? 'الفاتورة المحفوظة اتسجّلت.' : num(sent) + ' فواتير محفوظة اتسجّلوا.'); R.reapply(); rerender(); }
    }, function () { flushing = false; });
  }
  /* بنسأل السيرفر: الفواتير اللي اتبعتت، المحرك نقلها ولا لسه؟ */
  function checkMoved() {
    var keys = outbox.filter(function (e) { return e.state === 'sent' && !e.movedAt; }).map(function (e) { return e.key; }).slice(0, 50);
    if (!keys.length || !R.LIVE || !CFG.WRITE_URL || !S.token || !R.tokenFresh()) return;
    R.post(CFG.WRITE_URL, { action: 'status', idToken: S.token, keys: keys }).then(function (d) {
      if (!d || !d.ok) return; var ch = false;
      keys.forEach(function (k) { var f = d.found && d.found[k], e = entry(k); if (e && f && f.moved) { e.movedAt = Date.now(); ch = true; } });
      if (ch) { saveOutbox(); if (cur() === 'done') rerender(); }
    });
  }
  function cur() { var h = location.hash.replace(/^#\/?/, '').split('/'); return h[0] === 'sale' ? (h[1] || 'cart') : ''; }
  function rerender() { if (cur()) R.render(); }
  (R.on.data = R.on.data || []).push(function () { pruneCart(); prune(); flush(); checkMoved(); });
  (R.on.online = R.on.online || []).push(function () { setTimeout(flush, 800); });

  /* ---------- أيقونات الشاشات دي ---------- */
  var I = function (body) { return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>'; };
  var IX = {
    user: I('<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>'), trash: I('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>'),
    minus: I('<path d="M6 12h12"/>'), plus: I('<path d="M12 6v12M6 12h12"/>'), search: I('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>'),
    scan: I('<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M8 8.5v7M11 8.5v7M14 8.5v7M17 8.5v7"/>'),
    check: I('<path d="m5 12.5 4.5 4.5L19 7.5"/>'), clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    cash: I('<rect x="3" y="6.5" width="18" height="11" rx="2"/><circle cx="12" cy="12" r="2.4"/><path d="M6.5 9.5v.01M17.5 14.5v.01"/>'), card: I('<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>'),
    phone: I('<rect x="7" y="3" width="10" height="18" rx="2.2"/><path d="M11 18h2"/>'), bank: I('<path d="M4 9.5 12 4l8 5.5M5.5 10v8M9.5 10v8M14.5 10v8M18.5 10v8M3.5 20h17"/>'),
    printer: I('<path d="M7 8V4h10v4M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="6" rx="1"/>'), chat: I('<path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17h-7l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 5Z"/>'),
    alert: I('<path d="M12 4 3 19.5h18z"/><path d="M12 10v4.5M12 17.2v.3"/>')
  };
  var PAY_IC = { 'كاش': IX.cash, 'بطاقة': IX.card, 'محفظة إلكترونية': IX.phone, 'تحويل بنكي': IX.bank };
  function ltr(t) { return '<span class="ltr">' + esc(t) + '</span>'; }
  function phoneAr(p) { return p ? R.ar(p.slice(0, 4) + ' ' + p.slice(4, 7) + ' ' + p.slice(7)) : ''; }
  function normPhone(v) {
    var s = String(v || '').replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[\s\-().]/g, '');
    if (!s) return ''; s = s.replace(/^(\+|00)?20(?=1\d{9}$)/, '0'); if (/^1\d{9}$/.test(s)) s = '0' + s;
    return /^01[0125]\d{8}$/.test(s) ? s : null;
  }
  function digits(v) { return Math.floor(Number(String(v || '').replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[^\d]/g, '')) || 0); }

  /* ---------- ٢.١ السلة ---------- */
  function outboxStrip() {
    var w = waiting().length, out = '';
    if (!CAN_WRITE) out += '<div class="strip">' + IX.alert + '<div><b>التسجيل لسه ما اتفعّلش.</b> تقدري تجرّبي الشاشات، والتأكيد هيشتغل بعد نشر سكريبت الكتابة.</div></div>';
    if (w) out += '<div class="strip wait">' + IX.clock + '<div><b>' + (w === 1 ? 'فاتورة واحدة محفوظة على الجهاز' : num(w) + ' فواتير محفوظة على الجهاز') + '</b> وهتتسجّل لما النت يرجع.</div><button data-act="s-flush">إرسال</button></div>';
    failed().forEach(function (e) {
      out += '<div class="strip bad">' + IX.alert + '<div><b>فاتورة ما اتسجّلتش</b> (' + R.whenAr(e.at) + ' · ' + egp(e.net) + '). ' + esc(e.errText || '') + '</div>' +
        '<span class="strip-btns"><button data-act="s-restore" data-key="' + e.key + '">رجّعيها للسلة</button><button data-act="s-drop" data-key="' + e.key + '">احذفيها</button></span></div>';
    });
    return out;
  }
  function custCard() {
    if (ui.editCust) {
      return '<form class="card cust-edit" data-form="s-cust-save" novalidate>' +
        '<label>اسم العميلة<input id="c-name" maxlength="60" autocomplete="off" value="' + esc(cart.name) + '" placeholder="اختياري"></label>' +
        '<label>الموبايل<input id="c-phone" class="ltr" inputmode="tel" maxlength="16" autocomplete="off" value="' + esc(cart.phone) + '" placeholder="01XXXXXXXXX"></label>' +
        '<div class="row-btns"><button type="button" class="btn ghost" data-act="s-cust-cancel">إلغاء</button><button class="btn" type="submit">حفظ</button></div></form>';
    }
    var has = cart.name || cart.phone;
    return '<div class="card cust"><span class="cust-ic">' + IX.user + '</span><div class="cust-body">' +
      (has ? '<b>' + esc(cart.name || 'عميلة') + '</b>' + (cart.phone ? '<small class="ltr-n">' + phoneAr(cart.phone) + '</small>' : '')
        : '<b>عميلة المعرض</b><small>من غير اسم. الإضافة اختيارية.</small>') +
      '</div><button class="link-btn" data-act="s-cust-edit">' + (has ? 'تغيير' : 'إضافة') + '</button></div>';
  }
  function lineCard(l) {
    var it = item(l.b), m = S.byCode[it.m || it.b] || {}, over = l.q > it.q;
    return '<div class="card line" data-b="' + esc(it.b) + '"><div class="line-top"><span class="l-tile">' + R.garment(m.cat) + '</span>' +
      '<div class="line-body"><div class="l-name" dir="auto">' + esc(it.n) + '</div><div class="l-meta">مقاس ' + ltr(it.s) + ' · ' + ltr(it.b) + '</div></div>' +
      '<button class="l-del" data-act="s-del" data-b="' + esc(it.b) + '" aria-label="حذف الصنف من الفاتورة">' + IX.trash + '</button></div>' +
      '<div class="line-bot"><div class="stepper"><button data-act="s-inc" data-b="' + esc(it.b) + '" aria-label="زوّدي الكمية">' + IX.plus + '</button><span class="num" aria-live="polite">' + num(l.q) + '</span>' +
      '<button data-act="s-dec" data-b="' + esc(it.b) + '" aria-label="قلّلي الكمية">' + IX.minus + '</button></div>' +
      '<div class="l-sum"><small>' + num(l.q) + ' × ' + egp(it.p) + '</small><b>' + egp(l.q * it.p) + '</b></div></div>' +
      (over ? '<div class="l-warn">' + (it.q <= 0 ? 'الصنف ده خلص من المخزون.' : 'المتاح ' + piecesAr(it.q) + ' بس.') + (isAdmin() ? ' هتتسجّل بتنبيه.' : '') + '</div>' : '') + '</div>';
  }
  function discRow(t) {
    if (ui.editDisc) {
      return '<form class="card disc-edit" data-form="s-disc-save" novalidate><label for="d-val">خصم الفاتورة (ج.م)</label>' +
        '<div class="disc-in"><input id="d-val" class="num" inputmode="numeric" maxlength="6" autocomplete="off" value="' + (t.discount || '') + '" placeholder="0">' +
        '<button type="button" class="btn ghost" data-act="s-disc-cancel">إلغاء</button><button class="btn" type="submit">تم</button></div>' +
        '<small>' + (isAdmin() ? 'أقصى خصم قيمة الفاتورة.' : 'أقصى خصم ' + egp(t.maxDisc) + ' (' + num(Math.round(meta().discountMax * 100)) + '٪). أكتر من كده للمدير.') + '</small></form>';
    }
    return '<button class="card disc" data-act="s-disc-edit"><span>خصم الفاتورة</span>' + (t.discount ? '<b class="gold">خصم ' + egp(t.discount) + '</b>' : '<b class="muted">إضافة خصم</b>') + '</button>';
  }
  function viewCart() {
    pruneCart();
    var t = totals(), chans = meta().channels.slice(0, 4);
    var lines = cart.lines.map(lineCard).join('');
    return R.head({ title: 'فاتورة جديدة', chip: 'مسودة' }) +
      '<main class="view sale cart' + (cart.lines.length ? ' has-foot' : '') + '">' + outboxStrip() +
      '<div class="seg" role="group" aria-label="قناة البيع">' + chans.map(function (c) { return '<button data-act="s-chan" data-c="' + esc(c) + '" aria-pressed="' + (c === cart.channel) + '"' + (c === cart.channel ? ' class="on"' : '') + '>' + esc(c) + '</button>'; }).join('') + '</div>' +
      custCard() +
      '<div class="add-row"><button class="add-scan" data-act="nav" data-to="scan">' + IX.scan + 'مسح باركود</button><button class="add-find" data-act="nav" data-to="sale/add">' + IX.search + 'بحث عن صنف</button></div>' +
      (lines ? lines + discRow(t) : '<div class="empty"><b>الفاتورة فاضية</b>امسحي باركود القطعة أو ابحثي عنها بالاسم أو الكود.</div>') +
      '</main>' +
      (cart.lines.length ? '<div class="sale-foot above-nav"><div class="f-net"><span>الصافي</span><b><span class="num">' + num(t.net) + '</span><i>ج.م</i></b></div>' +
        '<div class="f-sub">' + piecesAr(t.pieces) + (t.discount ? '، قبل الخصم ' + egp(t.gross) : '') + '</div>' +
        (t.over ? '<div class="f-err">الخصم أكتر من المسموح (' + egp(t.maxDisc) + ').</div>' : '') +
        '<div class="f-btns"><button class="btn ghost" data-act="s-clear">تفريغ</button><button class="btn big" data-act="s-pay"' + (t.over ? ' disabled' : '') + '>متابعة للدفع</button></div></div>' : '') +
      R.nav('sale');
  }

  /* ---------- ٢.٢ إضافة صنف ---------- */
  function addList() {
    var q = ui.q.trim().toLowerCase(), list = S.models.filter(function (m) { return !q || m.hay.indexOf(q) >= 0; });
    if (!list.length) return '<div class="empty"><b>مفيش نتيجة</b>جرّبي اسم تاني أو كود الموديل أو الباركود.</div>';
    var more = list.length > 25; list = list.slice(0, 25);
    return list.map(function (m) {
      return '<section class="card pick" aria-label="' + esc(m.code) + '"><div class="pick-top"><span class="l-tile big">' + R.garment(m.cat) + '</span>' +
        '<div class="line-body"><div class="l-name" dir="auto">' + esc(m.name) + '</div><div class="l-meta">' + ltr(m.code) + '، ' + egp(m.price) + '</div></div></div>' +
        '<div class="size-grid">' + m.items.map(function (it) {
          var l = lineOf(it.b), none = it.q <= 0 && !l;
          return '<button data-act="s-add" data-b="' + esc(it.b) + '"' + (l ? ' class="in"' : none ? ' class="none"' : '') + (none && !isAdmin() ? ' aria-disabled="true"' : '') + '>' +
            '<b class="ltr">' + esc(it.s) + '</b><small>' + (l ? 'في السلة ' + num(l.q) : none ? 'غير متاح' : 'متاح ' + num(it.q)) + '</small></button>';
        }).join('') + '</div></section>';
    }).join('') + (more ? '<p class="count-line">أول ٢٥ موديل. اكتبي في البحث عشان تضيّقي النتيجة.</p>' : '');
  }
  function addStatus() { return ui.added ? '<div class="ok-strip" role="status">' + IX.check + '<span>' + ui.added + '</span></div>' : ''; }
  function addFoot() { var t = totals(); return '<div><small>في السلة</small><b>' + (t.pieces ? piecesAr(t.pieces) + '، ' + egp(t.gross) : 'لسه فاضية') + '</b></div><button class="btn big" data-act="nav" data-to="sale">تم</button>'; }
  function viewAdd() {
    return R.head({ back: true, title: 'إضافة صنف', right: { act: 'nav', to: 'scan', label: 'مسح باركود بالكاميرا', icon: IX.scan } }) +
      '<main class="view sale has-foot"><label class="search tall">' + IX.search + '<input id="s-q" type="search" enterkeyhint="search" autocomplete="off" aria-label="بحث باسم الموديل أو الكود أو الباركود" placeholder="اسم الموديل أو الكود أو الباركود" value="' + esc(ui.q) + '"></label>' +
      '<div id="s-status">' + addStatus() + '</div><div id="s-list" class="pick-list">' + addList() + '</div></main>' +
      '<div class="sale-foot row" id="s-foot">' + addFoot() + '</div>';
  }

  /* ---------- ٢.٣ الدفع ---------- */
  function payChips(net) {
    var a = [net], h = Math.ceil((net + 1) / 100) * 100, k = Math.ceil((net + 1) / 500) * 500;
    if (a.indexOf(h) < 0) a.push(h); if (a.indexOf(k) < 0) a.push(k);
    if (a.length < 3) a.push(Math.ceil((net + 1) / 1000) * 1000 === a[a.length - 1] ? a[a.length - 1] + 500 : Math.ceil((net + 1) / 1000) * 1000);
    return a.slice(0, 3);
  }
  function payCalc(t) {
    var recv = cart.recv == null ? t.net : cart.recv, change = recv - t.net;
    return '<section class="card calc"><label for="recv">المستلم من العميلة</label>' +
      '<div class="calc-in"><input id="recv" class="num" inputmode="numeric" maxlength="7" autocomplete="off" value="' + recv + '"><span>ج.م</span></div>' +
      '<div class="calc-chips">' + payChips(t.net).map(function (v, i) { return '<button data-act="s-recv" data-v="' + v + '"' + (v === recv ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' + (i === 0 ? 'المبلغ بالظبط' : num(v)) + '</button>'; }).join('') + '</div>' +
      '<div class="change' + (change < 0 ? ' short' : '') + '" id="s-change"><span>' + (change < 0 ? 'ناقص من المطلوب' : 'الباقي للعميلة') + '</span><b>' + egp(Math.abs(change)) + '</b></div></section>';
  }
  function viewPay() {
    var t = totals();
    if (!cart.lines.length) { setTimeout(function () { R.go('sale'); }, 0); return ''; }
    var pays = meta().pays.filter(function (p) { return p !== 'COD'; });
    if (pays.indexOf(cart.pay) < 0) cart.pay = pays[0];
    var who = cart.name || (cart.phone ? phoneAr(cart.phone) : '');
    return R.head({ back: true, title: 'الدفع' }) +
      '<main class="view sale has-foot">' +
      '<section class="card due"><span>المطلوب</span><div class="due-val"><b class="num">' + num(t.net) + '</b><i>ج.م</i></div><small>' + piecesAr(t.pieces) + '، ' + esc(cart.channel) + (who ? '، ' + esc(who) : '') + '</small></section>' +
      '<section class="pay-sec"><h2>طريقة الدفع</h2><div class="pay-grid" role="group" aria-label="طريقة الدفع">' + pays.map(function (p) {
        var on = p === cart.pay; return '<button data-act="s-payway" data-p="' + esc(p) + '" aria-pressed="' + on + '"' + (on ? ' class="on"' : '') + '>' + (PAY_IC[p] || IX.cash) + '<span>' + esc(p) + '</span>' + (on ? IX.check : '') + '</button>';
      }).join('') + '</div></section>' +
      (cart.pay === 'كاش' ? payCalc(t) : '') +
      '<section class="card sums"><div><span>الإجمالي قبل الخصم</span><span>' + egp(t.gross) + '</span></div>' +
      (t.discount ? '<div><span>خصم الفاتورة</span><span class="gold">' + egp(t.discount) + '</span></div>' : '') +
      '<div class="tot"><span>الصافي</span><span>' + egp(t.net) + '</span></div></section>' +
      (ui.payErr ? '<div class="strip bad" role="alert">' + IX.alert + '<div>' + esc(ui.payErr) + '</div></div>' : '') +
      '</main><div class="sale-foot"><button class="btn big wide" data-act="s-confirm"' + (ui.sending ? ' disabled' : '') + '>' + (ui.sending ? 'بنسجّل الفاتورة…' : 'تأكيد الفاتورة') + '</button></div>';
  }

  /* ---------- ٢.٤ تم البيع ---------- */
  function viewDone() {
    var e = entry(ui.lastKey);
    if (!e) { setTimeout(function () { R.go('sale'); }, 0); return ''; }
    var sent = e.state === 'sent', bad = e.state === 'failed', moved = !!e.movedAt;
    var step = function (ok, t) { return '<span class="' + (ok ? 'ok' : 'wait') + '">' + (ok ? IX.check : IX.clock) + t + '</span>'; };
    return '<main class="done"><span class="done-ic' + (sent ? '' : bad ? ' bad' : ' wait') + '">' + (sent ? IX.check : bad ? IX.alert : IX.clock) + '</span>' +
      '<h1>' + (sent ? 'تم البيع' : bad ? 'الفاتورة ما اتسجّلتش' : 'اتحفظت على الجهاز') + '</h1>' +
      (sent ? '<div class="done-no"><span>طلب رقم</span>' + ltr(e.orderNo || '') + '</div>'
        : '<p class="done-note">' + (bad ? esc(e.errText || '') : 'مفيش اتصال دلوقتي. الفاتورة هتتسجّل لوحدها لما النت يرجع، ومش هتتكرر.') + '</p>') +
      '<div class="due-val big"><b class="num">' + num(e.net) + '</b><i>ج.م</i></div>' +
      '<div class="done-chips"><span class="ok">مدفوعة</span><span>' + esc(e.op.pay) + '</span><span>' + esc(e.op.channel) + '</span></div>' +
      (e.change > 0 ? '<p class="done-change">الباقي للعميلة ' + egp(e.change) + '</p>' : '') +
      '<section class="card done-card"><h2>' + (sent ? 'اتسجّلت في المنظومة' : 'حالة التسجيل') + '</h2><div class="done-steps">' +
      step(sent, 'الفاتورة') + step(sent && moved, 'المبيعات') + step(sent && moved, 'المخزون') + step(sent && moved, 'القيد') + '</div>' +
      '<p>' + R.whenAr(e.at) + (e.seller ? '، البائعة ' + esc(e.seller) : '') + (sent && !moved ? '. المخزون والقيد بيتحدّثوا خلال دقايق.' : '') + (e.flagged ? ' اتسجّلت بتنبيه للمدير.' : '') + '</p></section></main>' +
      '<div class="done-foot"><div class="done-two"><button class="btn outline" data-act="s-soon">' + IX.printer + 'طباعة الإيصال</button><button class="btn outline" data-act="s-soon">' + IX.chat + 'رسالة واتساب</button></div>' +
      (bad ? '<button class="btn big wide" data-act="s-restore" data-key="' + e.key + '">رجّعيها للسلة</button>' : '<button class="btn big wide" data-act="s-new">فاتورة جديدة</button>') + '</div>';
  }

  R.views.sale = function (r) {
    if (r.sub === 'add') return viewAdd();
    if (r.sub === 'pay') return viewPay();
    if (r.sub === 'done') return viewDone();
    return viewCart();
  };

  /* ---------- الأفعال ---------- */
  var A = R.acts;
  function refreshCartOrWarn(msg) { if (msg) R.toast(msg); R.render(); }
  A['s-chan'] = function (b) {
    var c = b.getAttribute('data-c');
    if (c !== SHOWROOM) return R.toast('قنوات الشحن (' + c + ') هتتفعّل مع العربون ورسوم الشحن. دلوقتي بيع المعرض بس.');
    cart.channel = c; saveCart(); R.render();
  };
  A['s-cust-edit'] = function () { ui.editCust = true; R.render(); var n = $('#c-name'); if (n) n.focus(); };
  A['s-cust-cancel'] = function () { ui.editCust = false; R.render(); };
  A['s-cust-save'] = function () {
    var ph = normPhone($('#c-phone').value);
    if (ph === null) { R.toast('رقم الموبايل لازم يكون ١١ رقم ويبدأ بـ٠١.'); $('#c-phone').focus(); return; }
    cart.name = $('#c-name').value.replace(/\s+/g, ' ').trim().slice(0, 60); cart.phone = ph; ui.editCust = false; saveCart(); R.render();
  };
  A['s-inc'] = function (b) { var l = lineOf(b.getAttribute('data-b')); refreshCartOrWarn(l ? setQty(l.b, l.q + 1) : ''); };
  A['s-dec'] = function (b) { var l = lineOf(b.getAttribute('data-b')); if (l && l.q > 1) refreshCartOrWarn(setQty(l.b, l.q - 1)); };
  A['s-del'] = function (b) { setQty(b.getAttribute('data-b'), 0); if (!cart.lines.length) { cart.discount = 0; saveCart(); } R.render(); };
  A['s-clear'] = function (b) {
    if (b.getAttribute('data-sure') !== '1') { b.setAttribute('data-sure', '1'); b.textContent = 'متأكدة؟'; setTimeout(function () { if (b.isConnected) { b.removeAttribute('data-sure'); b.textContent = 'تفريغ'; } }, 3000); return; }
    cart = freshCart(); saveCart(); ui.editDisc = ui.editCust = false; R.render();
  };
  A['s-disc-edit'] = function () { ui.editDisc = true; R.render(); var d = $('#d-val'); if (d) { d.focus(); d.select(); } };
  A['s-disc-cancel'] = function () { ui.editDisc = false; R.render(); };
  A['s-disc-save'] = function () {
    var v = digits($('#d-val').value), t = totals();
    if (v > t.maxDisc) { R.toast(isAdmin() ? 'الخصم أكبر من قيمة الفاتورة.' : 'أقصى خصم ' + num(t.maxDisc) + ' ج.م. أكتر من كده للمدير.'); return; }
    cart.discount = v; ui.editDisc = false; saveCart(); R.render();
  };
  A['s-pay'] = function () { if (!cart.lines.length || totals().over) return; ui.payErr = ''; cart.recv = null; saveCart(); R.go('sale/pay'); };
  A['s-add'] = function (b) {
    var it = item(b.getAttribute('data-b')), msg = addOne(b.getAttribute('data-b'));
    if (msg) return R.toast(msg);
    ui.added = 'اتضاف للسلة: ' + ltr(it.b) + '، مقاس ' + ltr(it.s);
    $('#s-status').innerHTML = addStatus(); $('#s-list').innerHTML = addList(); $('#s-foot').innerHTML = addFoot();
  };
  /* زر «+» في نتيجة المسح */
  A.add = function () {
    var r = R.scan.result; if (!r || !r.item) return;
    var msg = addOne(r.item.b); if (msg) return R.toast(msg);
    R.toast('اتضاف للفاتورة: ' + r.item.n + ' · ' + r.item.s + ' (' + piecesAr(totals().pieces) + ' في السلة)');
    var c = document.querySelector('.h-count'), btn = document.querySelector('.head [data-to="sale"]');
    if (c) c.textContent = num(totals().pieces); else if (btn) btn.insertAdjacentHTML('beforeend', '<i class="h-count num">' + num(totals().pieces) + '</i>');
  };
  A['s-payway'] = function (b) { cart.pay = b.getAttribute('data-p'); cart.recv = null; saveCart(); R.render(); };
  A['s-recv'] = function (b) { cart.recv = Number(b.getAttribute('data-v')); saveCart(); R.render(); };
  A['s-soon'] = function () { R.toast('الإيصال ورسالة الواتساب هييجوا في مرحلة المستندات.'); };
  A['s-new'] = function () { ui.lastKey = ''; R.store('reno_last_sale', null); R.go('sale'); };
  A['s-flush'] = function () {
    if (R.LIVE && navigator.onLine === false) return R.toast('لسه مفيش اتصال بالنت.');
    if (R.LIVE && !R.tokenFresh()) return R.reconnect();
    R.toast('بنبعت الفواتير المحفوظة…'); flush().then(rerender);
  };
  A['s-drop'] = function (b) {
    if (b.getAttribute('data-sure') !== '1') { b.setAttribute('data-sure', '1'); b.textContent = 'متأكدة؟'; return; }
    var k = b.getAttribute('data-key'); outbox = outbox.filter(function (e) { return e.key !== k; }); saveOutbox(); R.reapply(); R.render();
  };
  A['s-restore'] = function (b) {
    var e = entry(b.getAttribute('data-key')); if (!e) return;
    cart = { channel: e.op.channel, name: e.op.name || '', phone: e.op.phone || '', discount: e.op.discount || 0, pay: e.op.pay, recv: null, lines: e.op.lines.map(function (l) { return { b: l.b, q: l.q }; }) };
    outbox = outbox.filter(function (x) { return x !== e; }); saveOutbox(); saveCart(); R.reapply(); ui.lastKey = ''; R.store('reno_last_sale', null);
    if (cur() === 'cart') R.render(); else R.go('sale');
  };
  A['s-confirm'] = function () {
    if (ui.sending) return;
    var t = totals();
    if (!cart.lines.length || t.over) return R.go('sale');
    if (!CAN_WRITE) return R.toast('التسجيل لسه ما اتفعّلش. هيشتغل بعد نشر سكريبت الكتابة.');
    var recv = cart.pay === 'كاش' ? (cart.recv == null ? t.net : cart.recv) : t.net;
    if (recv < t.net) return R.toast('المستلم أقل من المطلوب بـ' + num(t.net - recv) + ' ج.م.');
    var key = R.rnd().slice(0, 24);
    var e = { key: key, at: Date.now(), state: 'pending', net: t.net, change: recv - t.net, seller: (S.user && S.user.name) || '', tries: 0,
      op: { key: key, at: Date.now(), channel: cart.channel, pay: cart.pay, name: cart.name, phone: cart.phone, discount: t.discount,
        lines: cart.lines.map(function (l) { return { b: l.b, q: l.q, p: item(l.b).p }; }) } };
    outbox.push(e); saveOutbox();                     /* الحفظ قبل الإرسال: لو الصفحة اتقفلت، الفاتورة ما تضيعش */
    ui.sending = true; ui.payErr = ''; R.render();
    send(e).then(function (res) {
      ui.sending = false;
      if (res === 'rejected') {                         /* البيع ما اتسجّلش: السلة تفضل زي ما هي والسبب يظهر */
        ui.payErr = e.errText || 'السيرفر رفض الفاتورة.'; outbox = outbox.filter(function (x) { return x !== e; }); saveOutbox();
        R.render(); R.refresh(); return;
      }
      ui.lastKey = key; R.store('reno_last_sale', key);
      cart = freshCart(); saveCart(); ui.editDisc = ui.editCust = false; ui.q = ''; ui.added = '';
      R.reapply(); history.replaceState(null, '', '#sale'); R.go('sale/done');
      if (res === 'sent') setTimeout(checkMoved, 20000);
      else if (e.err === 'bad_token' || e.err === 'no_token' || (R.LIVE && navigator.onLine !== false && !R.tokenFresh())) R.reconnect();
    });
  };
  R.inputs.push(function (ev) {
    var id = ev.target.id;
    if (id === 's-q') { ui.q = ev.target.value; $('#s-list').innerHTML = addList(); return true; }
    if (id === 'recv') {
      var t = totals(), v = digits(ev.target.value); cart.recv = v; saveCart();
      var ch = v - t.net, box = $('#s-change');
      if (box) { box.className = 'change' + (ch < 0 ? ' short' : ''); box.innerHTML = '<span>' + (ch < 0 ? 'ناقص من المطلوب' : 'الباقي للعميلة') + '</span><b>' + egp(Math.abs(ch)) + '</b>'; }
      document.querySelectorAll('.calc-chips button').forEach(function (b) { var on = Number(b.getAttribute('data-v')) === v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      return true;
    }
    return false;
  });

  /* ---------- التشغيل ---------- */
  prune();
  setTimeout(function () { loadMeta(); flush(); checkMoved(); }, 1500);
  R.sale = { outbox: function () { return outbox; }, flush: flush };
});
