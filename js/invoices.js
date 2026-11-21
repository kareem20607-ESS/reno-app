/* الفواتير (لوحة ٥) وتفاصيل الفاتورة (لوحة ٦): قراءة بس من دفتر «المبيعات».
   حالة الدفع بتتحسب: ملغاة ← من غير دفع · COD ← «قيد التحصيل» لحد ما تحويل شركة الشحن يتطابق · غير كده ← «مدفوعة».
   البائعة بتستلم فواتيرها بس (الفلترة في السيرفر). */
(window.RENO_EXT = window.RENO_EXT || []).push(function (R) {
  'use strict';
  var S = R.S, esc = R.esc, num = R.num, ar = R.ar;
  var $ = function (s) { return document.querySelector(s); };
  var ic = function (d, extra) { return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + d + '</svg>'; };
  var IX = {
    back: ic('<path d="M9 6l6 6-6 6"/>'), search: ic('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>'), plus: ic('<path d="M12 5v14M5 12h14"/>'),
    bank: ic('<path d="M4 9l8-5 8 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18"/>'), lock: ic('<path d="M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3"/>'),
    user: ic('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>'), phone: ic('<path d="M6 4h3l2 5-2 1a11 11 0 0 0 5 5l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 2-2z"/>'),
    chat: ic('<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>'), cash: ic('<path d="M3 7h18v10H3z"/><circle cx="12" cy="12" r="2.5"/>'),
    pdf: ic('<path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5"/>'), x: ic('<path d="M6 6l12 12M18 6L6 18"/>'), check: ic('<path d="M5 12.5l4.5 4.5L19 7.5"/>', ' style="stroke-width:3"'), clear: ic('<path d="M6 6l12 12M18 6L6 18"/>')
  };
  var CANCEL = 'ملغي', RETURNED = 'مرتجع', DONE = 'مسلم', COD = 'COD', SHOWROOM = 'معرض', ONLINE = 'أونلاين';
  var MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  var DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  var FILTERS = [['all', 'الكل'], ['collecting', 'قيد التحصيل'], ['unpaid', 'غير مدفوعة'], ['held', 'معلّقة']];
  var ui = { f: 'all', q: '', search: false, y: 0, back: false };

  /* ---------- قراءة الصف ---------- */
  function shipFee(notes) { var m = /شحن على العميلة\s*(\d+)/.exec(String(notes || '')); return m ? Number(m[1]) : 0; }
  function order(r) {
    var o = { no: String(r[0] || ''), inv: String(r[1] || ''), day: String(r[2] || ''), channel: String(r[3] || ''), phone: String(r[4] || ''), name: String(r[5] || ''),
      pay: String(r[6] || ''), gross: Number(r[7]) || 0, disc: Number(r[8]) || 0, net: Number(r[9]) || 0, status: String(r[10] || ''), seller: String(r[11] || ''), notes: String(r[12] || ''), lines: r[13] || [] };
    o.ship = shipFee(o.notes); o.due = o.net + o.ship;
    o.cancelled = o.status === CANCEL; o.returned = o.status === RETURNED;
    o.payState = o.cancelled ? 'cancelled' : o.returned ? 'returned' : o.pay === COD ? 'collecting' : 'paid';
    o.shop = o.no.charAt(0) === '#';
    o.id = o.inv || o.no;
    return o;
  }
  function all() { return ((S.data && S.data.orders) || []).map(order); }
  function find(id) { var list = all(); for (var i = 0; i < list.length; i++) if (list[i].inv === id || list[i].no === id) return list[i]; return null; }
  function ymd(d) { var p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function dateOf(day) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null; }
  function dayTitle(day) {
    var d = dateOf(day); if (!d) return 'من غير تاريخ';
    var now = new Date(), dm = ar(d.getDate()) + ' ' + MONTHS[d.getMonth()];
    if (day === ymd(now)) return 'اليوم، ' + dm;
    if (day === ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return 'أمس، ' + dm;
    return DAYS[d.getDay()] + '، ' + dm + (d.getFullYear() !== now.getFullYear() ? ' ' + ar(d.getFullYear()) : '');
  }
  function dateLong(day) { var d = dateOf(day); return d ? ar(d.getDate()) + ' ' + MONTHS[d.getMonth()] + ' ' + ar(d.getFullYear()) : ''; }
  function dateShort(day) { var d = dateOf(day); return d ? ar(d.getDate()) + ' ' + MONTHS[d.getMonth()] : ''; }
  /* رقم الفاتورة بأرقام عربية؛ الرقم اللي فيه حروف لاتيني (رقم طلب المتجر أو ORD) بيفضل زي ما هو */
  function ltr(s) { s = String(s); return '<span class="ltr-n" dir="ltr">' + esc(/[A-Za-z]/.test(s) ? s : ar(s)) + '</span>'; }
  function egp(n) { return '<span class="num">' + num(n) + '</span> ج.م'; }
  function pieces(n) { return n === 1 ? 'قطعة واحدة' : n === 2 ? 'قطعتين' : n <= 10 ? num(n) + ' قطع' : num(n) + ' قطعة'; }
  function stageName(st) { return st === 'محجوز' ? 'تجهيز' : st === DONE ? 'مسلّم' : st || 'جديد'; }
  function payBadge(o) {
    if (o.payState === 'cancelled') return '<span class="tag2 red">ملغاة</span>';
    if (o.payState === 'returned') return '<span class="tag2 red">مرتجع</span>';
    if (o.payState === 'collecting') return '<span class="tag2 gold">قيد التحصيل</span>';
    return '<span class="tag2 green">مدفوعة</span>';
  }
  function stageBadge(o) {
    if (o.cancelled || o.returned) return '';
    return '<span class="tag2 ' + (o.status === DONE ? 'gray' : 'blue') + '">' + esc(stageName(o.status)) + '</span>';
  }
  function who(o) {
    if (o.shop) return 'طلب المتجر ' + ltr(o.no) + '، ' + esc(o.channel);
    return esc(o.name || 'عميلة من غير اسم') + '، ' + esc(o.channel);
  }

  /* ---------- السلة والفواتير اللي لسه على الجهاز ---------- */
  function held() {
    var out = [], c = R.load('reno_cart');
    if (c && c.lines && c.lines.length) {
      var total = 0, n = 0;
      c.lines.forEach(function (l) { var it = S.byBarcode[String(l.b).toUpperCase()]; if (it) { total += l.q * it.p; n += l.q; } });
      if (n) out.push({ kind: 'cart', title: 'سلة معلّقة', total: Math.max(0, total - (Number(c.discount) || 0)), sub: (c.name ? c.name + '، ' : '') + pieces(n), chip: 'استكمال', to: 'sale' });
    }
    ((R.sale && R.sale.outbox()) || []).forEach(function (e) {
      if (e.state !== 'pending') return;
      out.push({ kind: 'queued', title: 'فاتورة على الجهاز', total: e.net, sub: 'مستنية النت عشان تتسجّل، ' + R.whenAr(e.at), chip: 'في الطابور', to: 'sale' });
    });
    return out;
  }

  /* ---------- القائمة ---------- */
  function match(o, q) {
    if (!q) return true;
    var hay = (o.inv + ' ' + o.no + ' ' + o.name + ' ' + o.phone + ' ' + o.channel).toLowerCase();
    var plain = q.toLowerCase().replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
    return plain.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  function card(o) {
    return '<button class="inv-card' + (o.cancelled || o.returned ? ' off' : '') + '" data-act="i-open" data-id="' + esc(o.id) + '">' +
      '<span class="inv-top"><b>' + (o.inv ? ltr(o.inv) : ltr(o.no)) + '</b><b class="inv-amt">' + egp(o.due) + '</b></span>' +
      '<span class="inv-sub"><span class="inv-who">' + who(o) + '</span><span class="inv-tags">' + payBadge(o) + stageBadge(o) + '</span></span></button>';
  }
  function heldCard(h) {
    return '<button class="inv-card dashed" data-act="nav" data-to="' + h.to + '"><span class="inv-top"><b>' + esc(h.title) + '</b><b class="inv-amt">' + egp(h.total) + '</b></span>' +
      '<span class="inv-sub"><span class="inv-who">' + esc(h.sub) + '</span><span class="inv-tags"><span class="tag2 gray">' + esc(h.chip) + '</span></span></span></button>';
  }
  function listHtml() {
    var list = all().reverse(), q = ui.q.trim(), f = ui.f;
    var rows = list.filter(function (o) {
      if (f === 'collecting' && o.payState !== 'collecting') return false;
      if (f === 'unpaid' || f === 'held') return false;                 /* «غير مدفوعة» محتاجة جدول الدفعات، و«معلّقة» بتيجي من الجهاز */
      return match(o, q);
    });
    var hs = (f === 'all' || f === 'held') && !q ? held() : [];
    var html = '', today = ymd(new Date()), last = null;
    if (hs.length) { html += '<h2 class="inv-day">' + dayTitle(today) + '</h2>' + hs.map(heldCard).join(''); last = today; }
    rows.forEach(function (o) {
      if (o.day !== last) { html += '<h2 class="inv-day">' + dayTitle(o.day) + '</h2>'; last = o.day; }
      html += card(o);
    });
    if (!html) {
      if (!S.data || !S.data.orders) return '<p class="empty"><b>الفواتير لسه ما وصلتش</b>حدّثي البيانات من زر التحديث، ولو فضلت كده كلّمي المدير.</p>';
      if (q) return '<p class="empty"><b>مفيش فاتورة بالبحث ده</b>جرّبي رقم الفاتورة أو اسم العميلة أو الموبايل.</p>';
      if (f === 'unpaid') return '<p class="empty"><b>مفيش فواتير غير مدفوعة</b>الفواتير اللي عليها باقي ومش دفع عند الاستلام هتظهر هنا مع تحصيل الدفعات.</p>';
      if (f === 'held') return '<p class="empty"><b>مفيش فواتير معلّقة</b>السلة اللي لسه مفتوحة على الجهاز بتظهر هنا.</p>';
      if (f === 'collecting') return '<p class="empty"><b>مفيش فواتير قيد التحصيل</b></p>';
      return '<p class="empty"><b>لسه مفيش فواتير</b>أول فاتورة هتظهر هنا بعد تسجيلها.</p>';
    }
    var info = (S.data && S.data.ordersInfo) || {};
    if (!q && f === 'all' && info.total > info.sent) html += '<p class="inv-more">ظاهر آخر ' + num(info.days) + ' يوم (' + num(info.sent) + ' من ' + num(info.total) + ' فاتورة).</p>';
    return html;
  }
  function viewList() {
    if (ui.back) { var y = ui.y; ui.back = false; setTimeout(function () { window.scrollTo(0, y); }, 0); }
    var list = all(), today = ymd(new Date()), sales = 0, count = 0;
    list.forEach(function (o) { if (o.day === today && !o.cancelled && !o.returned) { sales += o.net; count++; } });
    var info = (S.data && S.data.ordersInfo) || {};
    var kpi = function (label, val, cls) { return '<div class="card inv-kpi"><span>' + label + '</span><b' + (cls ? ' class="' + cls + '"' : '') + '>' + val + '</b></div>'; };
    return '<header class="head"><div class="head-row"><button class="hbtn" data-act="back" aria-label="رجوع">' + IX.back + '</button><h1>الفواتير</h1>' +
      '<button class="hbtn" data-act="i-search" aria-label="بحث في الفواتير" aria-pressed="' + ui.search + '">' + IX.search + '</button>' +
      '<button class="hbtn" data-act="nav" data-to="sale" aria-label="فاتورة جديدة">' + IX.plus + '</button></div><div class="netbar" role="status" hidden></div></header>' +
      '<main class="view inv">' +
      (ui.search ? '<label class="search tall">' + IX.search + '<input id="i-q" type="search" inputmode="search" autocomplete="off" placeholder="رقم الفاتورة، اسم العميلة، أو الموبايل" value="' + esc(ui.q) + '" aria-label="بحث في الفواتير"><button type="button" class="clear" data-act="i-clear" aria-label="مسح البحث">' + IX.clear + '</button></label>' : '') +
      '<div class="inv-kpis">' + kpi('مبيعات اليوم', '<span class="num">' + num(sales) + '</span> <small>ج.م</small>') + kpi('فواتير اليوم', '<span class="num">' + num(count) + '</span>') +
      kpi('قيد التحصيل', '<span class="num">' + num(info.collecting || 0) + '</span> <small>ج.م</small>', 'gold') + '</div>' +
      '<div class="inv-two"><button data-act="i-soon" data-what="match">' + IX.bank + 'مطابقة تحويل</button><button data-act="i-soon" data-what="close">' + IX.lock + 'إقفال اليومية</button></div>' +
      '<div class="inv-filters" role="group" aria-label="تصفية الفواتير">' + FILTERS.map(function (f) { return '<button data-act="i-filter" data-f="' + f[0] + '" aria-pressed="' + (ui.f === f[0]) + '"' + (ui.f === f[0] ? ' class="on"' : '') + '>' + f[1] + '</button>'; }).join('') + '</div>' +
      '<div id="i-list" class="inv-list">' + listHtml() + '</div></main>' + R.nav('');
  }

  /* ---------- التفاصيل ---------- */
  function phoneShow(p) { var d = p.replace(/\D/g, ''); return d.length === 11 ? d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7) : p; }
  function phoneIntl(p) { var d = p.replace(/\D/g, ''); if (/^01\d{9}$/.test(d)) return '2' + d; if (/^20\d{10}$/.test(d)) return d; return ''; }
  function stages(o) {
    if (o.cancelled || o.returned || o.channel === SHOWROOM) return '';
    var names = ['اتأكدت', 'تجهيز', 'مشحون', 'مسلّم'], at = { 'جديد': 0, 'محجوز': 1, 'مشحون': 2 }[o.status];
    var done = o.status === DONE, cur = done ? 4 : (at === undefined ? 0 : at);
    var fill = done ? 75 : cur * 25;
    return '<section class="card inv-steps" aria-label="مراحل التنفيذ"><span class="track" aria-hidden="true"></span><span class="track on" aria-hidden="true" style="width:' + fill + '%"></span><ol>' +
      names.map(function (n, i) {
        var st = i < cur ? 'done' : i === cur ? 'cur' : 'todo';
        return '<li class="' + st + '"' + (st === 'cur' ? ' aria-current="step"' : '') + '><span class="dot">' + (st === 'done' ? IX.check : st === 'cur' ? '<i></i>' : '') + '</span><b>' + n + '</b>' +
          '<small>' + (i === 0 ? dateShort(o.day) : st === 'done' ? 'تم' : st === 'cur' ? 'دلوقتي' : 'لسه') + '</small></li>';
      }).join('') + '</ol></section>';
  }
  function statusLine(o) {
    if (o.cancelled) return /اتلغى بعد الشحن/.test(o.notes) ? 'الفاتورة اتلغت بعد الشحن، ومفيش مبلغ مطلوب.' : 'الفاتورة ملغاة، ومفيش مبلغ مطلوب.';
    if (o.returned) return 'الفاتورة مرتجعة.';
    if (o.payState === 'paid') return 'مدفوعة بالكامل، ' + esc(o.pay || 'كاش') + '.';
    if (o.status === DONE) return 'العميلة دفعت عند الاستلام، ومستنيين تحويل شركة الشحن.';
    return 'لسه ما اتدفعش حاجة، والمطلوب كله عند الاستلام.';
  }
  function payments(o) {
    var row = function (t, s, amt, cls) { return '<div class="inv-payrow"><div><b>' + t + '</b><span>' + s + '</span></div><b class="' + cls + '">' + egp(amt) + '</b></div>'; };
    var body;
    if (o.cancelled || o.returned) body = '<p class="inv-none">مفيش دفعات على الفاتورة دي.</p>';
    else if (o.payState === 'paid') body = row('تحصيل، ' + esc(o.pay || 'كاش'), 'وقت البيع، ' + dateShort(o.day), o.due, 'green');
    else if (o.status === DONE) body = row('اتحصّل عند الاستلام', 'مستني تحويل شركة الشحن', o.due, 'gold');
    else body = row('الباقي عند الاستلام', 'هيتحصّل وقت التسليم', o.due, 'gold');
    return '<section class="card inv-box"><h2>الدفعات</h2>' + body + '</section>';
  }
  function viewOne(id) {
    var o = find(id);
    if (!o) {
      return R.head({ title: 'فاتورة', back: true }) + '<main class="view inv"><p class="empty"><b>الفاتورة دي مش في القائمة</b>ممكن تكون أقدم من المدة المعروضة، أو مش من فواتيرك.</p>' +
        '<button class="btn wide" data-act="nav" data-to="inv">كل الفواتير</button></main>';
    }
    var n = 0; o.lines.forEach(function (l) { n += Number(l[2]) || 0; });
    var wa = phoneIntl(o.phone), extra = o.notes.replace(/شحن على العميلة\s*\d+/, '').replace(/^[\s·،]+|[\s·،]+$/g, '');
    var lines = o.lines.map(function (l) {
      var it = S.byBarcode[String(l[0]).toUpperCase()], total = l[2] * l[3] - l[4];
      return '<div class="inv-line"><div><b dir="auto">' + esc(l[1] || (it && it.n) || l[0]) + '</b><span>' + (it && it.s ? 'مقاس ' + esc(it.s) + '، ' : '') + '<span class="num">' + num(l[2]) + ' × ' + num(l[3]) + '</span>' + (l[4] ? '، خصم <span class="num">' + num(l[4]) + '</span>' : '') + '</span></div><b>' + egp(total) + '</b></div>';
    }).join('');
    var sum = function (k, v, cls) { return '<div><span>' + k + '</span><span' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</span></div>'; };
    return '<header class="head"><div class="head-row"><button class="hbtn" data-act="back" aria-label="رجوع للفواتير">' + IX.back + '</button><h1>فاتورة ' + ltr(o.inv || o.no) + '</h1></div><div class="netbar" role="status" hidden></div></header>' +
      '<main class="view inv one">' +
      '<section class="card inv-status"><div class="inv-tags">' + stageBadge(o) + payBadge(o) + '</div>' +
      '<div class="inv-due' + (o.cancelled || o.returned ? ' off' : '') + '"><b class="num">' + num(o.due) + '</b><i>ج.م</i><span>' + (o.cancelled || o.returned ? 'قيمة الفاتورة' : 'المطلوب من العميلة') + '</span></div>' +
      '<p class="inv-say">' + statusLine(o) + '</p>' +
      '<p class="inv-meta">' + [dateLong(o.day), esc(o.channel), o.shop ? 'من المتجر' : (o.seller ? 'البائعة ' + esc(o.seller) : '')].filter(Boolean).join('، ') + '</p>' +
      (o.shop && o.inv ? '<p class="inv-meta">رقم الطلب في المتجر ' + ltr(o.no) + '</p>' : '') + '</section>' +
      stages(o) +
      '<section class="card inv-cust"><span class="inv-av">' + IX.user + '</span><div><b>' + esc(o.name || 'عميلة من غير اسم') + '</b>' + (o.phone ? '<span class="ltr-n" dir="ltr">' + esc(ar(phoneShow(o.phone))) + '</span>' : '<span>من غير موبايل</span>') + '</div>' +
      (o.phone ? '<a class="inv-ibtn" href="tel:' + esc(o.phone.replace(/[^\d+]/g, '')) + '" aria-label="اتصال بالعميلة">' + IX.phone + '</a>' : '') +
      (wa ? '<a class="inv-ibtn" href="https://wa.me/' + wa + '" target="_blank" rel="noopener" aria-label="فتح واتساب العميلة">' + IX.chat + '</a>' : '') + '</section>' +
      '<section class="card inv-box"><h2>الأصناف، ' + pieces(n) + '</h2>' + (lines || '<p class="inv-none">سطور الفاتورة لسه ما وصلتش.</p>') + '</section>' +
      '<section class="card inv-sums">' + sum('الإجمالي قبل الخصم', egp(o.gross)) + (o.disc ? sum('الخصم', egp(o.disc), 'gold') : '') + sum('الصافي', egp(o.net)) + (o.ship ? sum('رسوم الشحن', egp(o.ship)) : '') +
      '<div class="tot"><span>' + (o.cancelled || o.returned ? 'قيمة الفاتورة' : 'المطلوب') + '</span><span>' + egp(o.due) + '</span></div></section>' +
      payments(o) +
      (extra ? '<section class="card inv-box"><h2>ملاحظات</h2><p class="inv-note">' + esc(extra) + '</p></section>' : '') +
      '<div class="inv-acts"><button data-act="i-soon" data-what="collect">' + IX.cash + 'تحصيل دفعة</button><button data-act="i-soon" data-what="pdf">' + IX.pdf + 'فاتورة PDF</button>' +
      '<button data-act="i-soon" data-what="msgs">' + IX.chat + 'رسائل واتساب</button><button class="red" data-act="i-soon" data-what="' + (o.shop ? 'cancel-shop' : 'cancel') + '">' + IX.x + 'إلغاء الفاتورة</button></div></main>';
  }

  R.views.inv = function (r) { return r.sub ? viewOne(decodeURIComponent(r.sub)) : viewList(); };

  /* ---------- الأفعال ---------- */
  var A = R.acts, SOON = {
    match: 'مطابقة تحويل شركة الشحن هي الشاشة الجاية. لحد ما تتعمل، فواتير الدفع عند الاستلام بتفضل «قيد التحصيل».',
    close: 'إقفال اليومية هييجي مع جدول الدفعات.',
    collect: 'تحصيل الدفعات والعربون هييجي مع جدول الدفعات.',
    pdf: 'فاتورة PDF هتيجي في مرحلة المستندات.',
    msgs: 'رسائل الواتساب الجاهزة هتيجي في مرحلة المستندات. زر الواتساب جنب اسم العميلة بيفتح محادثتها.',
    cancel: 'إلغاء الفاتورة من التطبيق هييجي في مرحلة الإلغاء والمرتجع.',
    'cancel-shop': 'طلب المتجر بيتلغي من شوبيفاي، وحالته بتتحدّث هنا لوحدها.'
  };
  A['i-open'] = function (b) { ui.y = window.scrollY || 0; ui.back = true; R.go('inv/' + encodeURIComponent(b.getAttribute('data-id'))); };
  A['i-filter'] = function (b) { ui.f = b.getAttribute('data-f'); R.render(); };
  A['i-search'] = function () { ui.search = !ui.search; if (!ui.search) ui.q = ''; R.render(); var q = $('#i-q'); if (q) q.focus(); };
  A['i-clear'] = function () { ui.q = ''; var q = $('#i-q'); if (q) { q.value = ''; q.focus(); } var l = $('#i-list'); if (l) l.innerHTML = listHtml(); };
  A['i-soon'] = function (b) { R.toast(SOON[b.getAttribute('data-what')] || 'الخطوة دي في مرحلتها.'); };
  R.inputs.push(function (ev) {
    if (ev.target.id !== 'i-q') return false;
    ui.q = ev.target.value; var l = $('#i-list'); if (l) l.innerHTML = listHtml();
    return true;
  });
  R.inv = { all: all, find: find };
});
