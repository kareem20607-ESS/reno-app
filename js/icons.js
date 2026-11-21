/* أيقونات الواجهة: خطوط رفيعة بنفس روح ملف الهوية. */
(function () {
  var S = function (body, extra) {
    return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ' + (extra || '') + '>' + body + '</svg>';
  };
  window.IC = {
    menu: S('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    search: S('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>'),
    back: S('<path d="m15 5-7 7 7 7"/>', 'stroke-width="2.4"'),
    next: S('<path d="m9 5 7 7-7 7"/>', 'stroke-width="2.4"'),
    filter: S('<path d="M4 6h16M7 12h10M10 18h4"/>'),
    home: S('<path d="M3.5 11.5 12 4l8.5 7.5"/><path d="M6 10.5V20h12v-9.5"/>'),
    grid: S('<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>'),
    plusCircle: S('<circle cx="12" cy="12" r="8.5"/><path d="M12 8.5v7M8.5 12h7"/>'),
    plus: S('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.6"'),
    sync: S('<path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.3L20 15.5"/><path d="M20 20v-4.5h-4.5"/>'),
    list: S('<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4.5" cy="7" r="1.1"/><circle cx="4.5" cy="12" r="1.1"/><circle cx="4.5" cy="17" r="1.1"/>'),
    cart: S('<path d="M3 4h2.5l2.2 10.5h10.6L20.5 7H7"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>'),
    box: S('<path d="M12 3.5 20 8v8l-8 4.5L4 16V8z"/><path d="M4 8l8 4.5L20 8M12 12.5v8"/>'),
    truck: S('<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7.5" cy="18" r="1.7"/><circle cx="17.5" cy="18" r="1.7"/>'),
    scissors: S('<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8 8.5 20 18M8 15.5 20 6"/>'),
    chart: S('<path d="M4 4v16h16"/><rect x="7.5" y="12" width="3" height="5"/><rect x="12" y="9" width="3" height="8"/><rect x="16.5" y="6" width="3" height="11"/>'),
    check: S('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 'stroke-width="2.4"'),
    barcode: S('<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M8 9v6M11 9v6M14 9v6M17 9v6"/>'),
    edit: S('<path d="M14.5 5.5 18.5 9.5 9 19H5v-4z"/>'),
    torch: S('<path d="M8 3h8v4l-2 3v10h-4V10L8 7z"/><path d="M12 13v2"/>'),
    logout: S('<path d="M10 4H5v16h5"/><path d="M14 8l4 4-4 4M18 12H9"/>'),
    phone: S('<rect x="7" y="3" width="10" height="18" rx="2.2"/><path d="M11 18h2"/>'),
    close: S('<path d="M6 6l12 12M18 6 6 18"/>'),
    alert: S('<path d="M12 4 3 19.5h18z"/><path d="M12 10v4.5M12 17.2v.3"/>'),
    shield: S('<path d="M12 3.5 19 6v6c0 4-3 7-7 8.5C8 19 5 16 5 12V6z"/>')
  };
  var G = function (path) {
    return '<svg class="garment" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="' + path + '"/></svg>';
  };
  window.GARMENT = {
    top: G('M11 4 5 9l3 4 2-1.5V28h12V11.5l2 1.5 3-4-6-5-3 2.2a2.6 2.6 0 0 1-4 0z'),
    dress: G('M12 4h8l1 7 5 17H6l5-17z'),
    pants: G('M9 4h14l2 24h-7l-2-15-2 15H7z'),
    hanger: G('M16 10a3 3 0 1 1 3-3M16 10v3l12 9H4l12-9')
  };
})();
