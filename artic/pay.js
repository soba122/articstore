(function () {
  var MOY_JS = 'https://cdn.moyasar.com/mpf/2.3.0/moyasar.js';
  var MOY_CSS = 'https://cdn.moyasar.com/mpf/2.3.0/moyasar.css';
  var ST = {
    pending_payment: ['بانتظار الدفع', ''], verifying: ['جاري التحقق من الدفع', ''],
    paid: ['تم الدفع', 'ok'], delivering: ['جاري تسليم الطلب', 'ok'], delivered: ['تم التسليم', 'ok'],
    failed: ['فشل الدفع', 'bad'], canceled: ['تم إلغاء الطلب', 'bad']
  };

  var css = document.createElement('style');
  css.textContent = '.st{font-size:12px;border-radius:99px;padding:3px 10px;background:#1d3560;white-space:nowrap}' +
    '.st.ok{background:#14532d;color:#86efac}.st.bad{background:#5b1a1a;color:#fca5a5}' +
    '.pw{background:#fff;border-radius:12px;padding:10px;color:#111}';
  document.head.appendChild(css);

  var _go = go;
  go = function (v) {
    if (v === 'account' && state.next) { v = state.next; state.next = null; }
    if (v === 'orders') state.orders = undefined;
    _go(v);
  };

  V.checkout = function () {
    if (!Object.keys(state.cart).length) return V.cart();
    var t = totals();
    if (!state.user) return '<h2>إتمام الطلب</h2><div class="box"><p style="color:var(--mu);line-height:1.9;margin-top:0">سجّل الدخول أو أنشئ حساباً لإتمام الشراء، حتى نربط طلبك بحسابك ونتابع تسليمه.</p>' +
      '<button class="btn w" onclick="state.next=\'checkout\';go(\'login\')">تسجيل الدخول</button>' +
      '<button class="btn alt w" onclick="state.next=\'checkout\';go(\'register\')">إنشاء حساب</button></div>';
    return '<h2>إتمام الطلب</h2><div class="box"><label>اسم اللاعب في ماينكرافت</label>' +
      '<input class="f" id="u" value="' + esc(state.form.u || state.user.username) + '" maxlength="16"><div class="err" id="eu"></div>' +
      '<p style="color:var(--mu);font-size:12px;margin:0">تُسلَّم الرتبة على هذا الاسم بعد تأكيد الدفع.</p></div>' +
      '<div class="box"><h3>ملخص الطلب</h3>' + Object.keys(state.cart).map(function (id) {
        return '<div class="row"><span>' + find(id).n + ' × ' + state.cart[id] + '</span><span>' + sar(find(id).p * state.cart[id]) + '</span></div>';
      }).join('') + '<div class="row tot"><span>الإجمالي</span><span>' + sar(t.tot) + '</span></div></div>' +
      '<button class="btn w" onclick="toPay()">المتابعة للدفع</button>';
  };

  toPay = function () {
    var u = $('#u').value.trim();
    $('#eu').textContent = '';
    if (!/^[A-Za-z0-9_]{3,16}$/.test(u)) { $('#eu').textContent = 'اسم اللاعب من 3 إلى 16 حرفاً إنجليزياً أو أرقاماً أو _'; return; }
    state.form.u = u;
    go('payment');
  };

  V.payment = function () {
    if (!Object.keys(state.cart).length) return V.cart();
    if (!state.user) return V.checkout();
    var t = totals();
    return '<h2>الدفع</h2><div class="box"><div class="row"><span>اللاعب</span><span dir="ltr">' + esc(state.form.u || state.user.username) + '</span></div>' +
      Object.keys(state.cart).map(function (id) {
        return '<div class="row"><span>' + find(id).n + ' × ' + state.cart[id] + '</span><span>' + sar(find(id).p * state.cart[id]) + '</span></div>';
      }).join('') +
      '<div class="row tot"><span>الإجمالي</span><span>' + sar(t.tot) + '</span></div>' +
      '<p style="color:var(--mu);font-size:12px;margin:0">المبلغ النهائي يُحسب في الخادم قبل الدفع.</p></div>' +
      '<div class="box"><h3>بطاقة الدفع</h3><p style="color:var(--mu);font-size:13px;margin-top:0">مدى · فيزا · ماستركارد. بيانات البطاقة تُدخل في نموذج Moyasar الآمن ولا تصل لخادمنا.</p>' +
      '<div class="pw"><div id="mysr" class="mysr-form"></div></div><div class="err" id="vm"></div></div>' +
      '<button class="btn alt w" onclick="go(\'checkout\')">رجوع</button>';
  };

  V.result = function () {
    var r = state.res || {}, o = r.order;
    if (r.st === 'loading') return '<div class="empty">' + svg('coin') + '<p>جاري التحقق من الدفع…</p></div>';
    if (r.st === 'error') return '<h2>نتيجة الدفع</h2><div class="box"><p>' + esc(r.msg || 'تعذر التحقق من الدفع') + '</p>' +
      '<button class="btn w" onclick="retryRes()">إعادة التحقق</button><button class="btn alt w" onclick="go(\'orders\')">طلباتي</button></div>';
    var s = o.status;
    if (s === 'paid' || s === 'delivering' || s === 'delivered')
      return '<h2>تم الدفع بنجاح</h2><div class="box"><div class="row"><span>رقم الطلب</span><b dir="ltr">' + esc(o.id) + '</b></div>' +
        '<div class="row"><span>المبلغ</span><b>' + sar(o.amount / 100) + '</b></div>' +
        '<p style="color:var(--mu);line-height:1.9">سيتم تسليم طلبك على اللاعب <b dir="ltr">' + esc(o.username) + '</b>، وتتابع حالته من صفحة طلباتي.</p></div>' +
        '<button class="btn w" onclick="go(\'orders\')">طلباتي</button><button class="btn alt w" onclick="go(\'home\')">الرئيسية</button>';
    if (s === 'failed') return '<h2>فشل الدفع</h2><div class="box"><p>لم تتم عملية الدفع ولم يُخصم أي مبلغ. جرّب بطاقة أخرى.</p><button class="btn w" onclick="go(\'payment\')">إعادة المحاولة</button></div>';
    return '<h2>جاري التحقق من الدفع</h2><div class="box"><p style="line-height:1.9">لم يصلنا تأكيد الدفع بعد. إذا خُصم المبلغ فسيظهر طلبك مدفوعاً خلال دقائق.</p>' +
      '<button class="btn w" onclick="retryRes()">تحديث الحالة</button><button class="btn alt w" onclick="go(\'orders\')">طلباتي</button></div>';
  };
  window.retryRes = function () { state.res = { o: state.res.o, p: state.res.p, st: 'loading', busy: false }; render(); };

  V.orders = function () {
    if (!state.user) return V.login();
    if (state.orders === undefined || state.orders === null) return '<div class="empty">' + svg('list') + '<p>جاري تحميل طلباتك…</p></div>';
    if (!state.orders.length) return '<h2>طلباتي</h2><div class="empty">' + svg('list') + '<p>ما عندك طلبات حتى الآن.</p><button class="btn" onclick="go(\'shop\')">تصفح الرتب</button></div>';
    return '<h2>طلباتي</h2>' + state.orders.map(function (o) {
      var s = ST[o.status] || [o.status, ''];
      return '<div class="box"><div class="row"><b dir="ltr">' + esc(o.id) + '</b><span class="st ' + s[1] + '">' + s[0] + '</span></div>' +
        '<div class="row"><span>التاريخ</span><span>' + new Date(o.createdAt).toLocaleDateString('ar-SA') + '</span></div>' +
        o.items.map(function (i) { return '<div class="row"><span>' + esc(i.name) + ' × ' + i.qty + '</span><span>' + sar(i.unit * i.qty / 100) + '</span></div>'; }).join('') +
        '<div class="row"><span>اللاعب</span><span dir="ltr">' + esc(o.username) + '</span></div>' +
        '<div class="row tot"><span>الإجمالي</span><span>' + sar(o.amount / 100) + '</span></div></div>';
    }).join('');
  };

  function loadMoy() {
    return new Promise(function (ok, bad) {
      if (window.Moyasar) return ok();
      if (!document.getElementById('moycss')) {
        var l = document.createElement('link'); l.id = 'moycss'; l.rel = 'stylesheet'; l.href = MOY_CSS; document.head.appendChild(l);
      }
      var s = document.createElement('script'); s.src = MOY_JS; s.onload = ok; s.onerror = bad; document.head.appendChild(s);
    });
  }

  async function initPay() {
    var el = $('#mysr');
    if (!el || el.dataset.on) return;
    el.dataset.on = '1';
    var pk;
    try { var r = await fetch('/.netlify/functions/pay-config'); var j = await r.json(); if (!r.ok) throw 0; pk = j.pk; }
    catch (e) { vm('خدمة الدفع غير مهيأة بعد'); return; }
    try { await loadMoy(); } catch (e) { vm('تعذر تحميل نموذج الدفع، حاول لاحقاً'); return; }
    var t = totals();
    Moyasar.init({
      element: '#mysr', amount: Math.round(t.tot * 100), currency: 'SAR', description: 'ArticMc',
      publishable_api_key: pk, callback_url: location.origin + '/', methods: ['creditcard'],
      supported_networks: ['mada', 'visa', 'mastercard'], language: 'ar', fixed_width: false, use_payment_intent: true,
      on_initiating: async function () {
        vm('جاري تجهيز الطلب…');
        var items = {};
        for (var k in state.cart) items[k] = state.cart[k];
        var r2 = await post('create-order', { username: state.form.u || state.user.username, items: items });
        if (!r2.ok) { vm(r2.msg || 'تعذر إنشاء الطلب'); return false; }
        state.orderId = r2.j.orderId; vm('');
        return {
          description: 'Order ' + r2.j.orderId,
          callback_url: location.origin + '/?order=' + r2.j.orderId,
          payment_intent: { id: r2.j.intent_id, client_secret: r2.j.client_secret }
        };
      },
      on_completed: async function (p) { try { localStorage.setItem('amc_last', JSON.stringify({ o: state.orderId, p: p.id })); } catch (e) {} },
      on_failure: async function (e) { vm(typeof e === 'string' ? e : 'تعذر إتمام الدفع'); }
    });
  }

  async function checkResult() {
    var r = state.res;
    if (!r || r.st !== 'loading' || r.busy) return;
    r.busy = true;
    var x = await post('verify-payment', { orderId: r.o, paymentId: r.p });
    if (x.ok) {
      state.res = { o: r.o, p: r.p, order: x.j.order, st: 'done', busy: false };
      var s = x.j.order.status;
      if (s === 'paid' || s === 'delivering' || s === 'delivered') { state.cart = {}; save(); }
    } else state.res = { o: r.o, p: r.p, st: 'error', msg: x.msg, busy: false };
    render();
  }

  async function loadOrders() {
    state.orders = null;
    try { var r = await fetch('/.netlify/functions/get-order'); var j = await r.json(); state.orders = r.ok ? j.orders : []; }
    catch (e) { state.orders = []; }
    render();
  }

  var _render = render;
  render = function (b) {
    _render(b);
    if (state.v === 'payment' && state.user && Object.keys(state.cart).length) initPay();
    if (state.v === 'orders' && state.user && state.orders === undefined) loadOrders();
    if (state.v === 'result') checkResult();
  };

  var qp = new URLSearchParams(location.search), last = null;
  try { last = JSON.parse(localStorage.getItem('amc_last') || 'null'); } catch (e) {}
  var ro = qp.get('order') || (last && last.o), rp = qp.get('id') || (last && last.p);
  if (qp.get('id') && ro && rp) {
    state.v = 'result';
    state.res = { o: ro, p: rp, st: 'loading' };
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
  }
  render();
})();
