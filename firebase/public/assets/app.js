/* ============================================================
   타이어 공장도가격 - G  — 손님 화면
   가격표는 Firestore 에서 한 번 받아 브라우저에 저장해 둔다.
   그다음부터는 "버전"만 확인하고, 안 바뀌었으면 저장해 둔 것을 쓴다.
   ============================================================ */
(function () {
  "use strict";

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var won = function (n) { return Number(n).toLocaleString("ko-KR"); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  var PER = 100;                 // 한 번에 보여주는 줄 수
  var 저장열쇠 = "가격표";        // 브라우저에 저장해 둘 때 쓰는 이름

  var toastTimer;
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  var ALL = [], BRANDS = [], ready = false;
  var S = { q: "", brands: [], page: 1 };
  var DCMAP = {}, VIEW = [];
  var Q = null;

  function clearDc() { DCMAP = {}; }
  function dcOf(i) { return DCMAP[i] === undefined ? 0 : DCMAP[i]; }
  function salePrice(p, dc) { return Math.round(p * (100 - dc) / 100); }

  /* ============================================================
     가격표 불러오기
     ============================================================ */
  function 짧은값(f) {                       // Firestore 가 주는 값 껍데기를 벗긴다
    if (!f) return null;
    if (f.stringValue !== undefined)  return f.stringValue;
    if (f.integerValue !== undefined) return +f.integerValue;
    if (f.doubleValue !== undefined)  return +f.doubleValue;
    if (f.arrayValue !== undefined)   return (f.arrayValue.values || []).map(짧은값);
    return null;
  }

  function 가져오기(길) {
    return fetch(FS + 길).then(function (r) {
      if (!r.ok) throw new Error("불러오지 못했습니다 (" + r.status + ")");
      return r.json();
    });
  }

  function 저장된것() {
    try { return JSON.parse(localStorage.getItem(저장열쇠) || "null"); } catch (e) { return null; }
  }
  function 저장하기(값) {
    try { localStorage.setItem(저장열쇠, JSON.stringify(값)); } catch (e) { /* 자리가 없으면 그냥 넘어간다 */ }
  }

  function 자료불러오기() {
    /* 1. 버전만 먼저 확인한다 — 아주 작은 요청이다 */
    가져오기("/meta/current").then(function (doc) {
      var f = doc.fields || {};
      var 버전 = 짧은값(f.version) || "";
      BRANDS = 짧은값(f.brands) || [];

      var 저장 = 저장된것();
      if (저장 && 저장.version === 버전 && 저장.rows && 저장.rows.length) {
        ALL = 저장.rows;
        BRANDS = 저장.brands || BRANDS;
        시작();
        return;
      }

      /* 2. 바뀌었으면 제조사별로 받아온다 */
      return 가져오기("/prices").then(function (res) {
        var rows = [];
        (res.documents || []).forEach(function (d) {
          var 이름 = d.name.split("/").pop();
          var json = 짧은값((d.fields || {}).json);
          if (!json) return;
          try {
            JSON.parse(json).forEach(function (a) {
              rows.push({ brand: 이름, model: a[0], product: a[1], size: a[2], spec: a[3], season: a[4], price: a[5] });
            });
          } catch (e) { /* 한 제조사가 깨져도 나머지는 보여준다 */ }
        });
        ALL = rows;
        저장하기({ version: 버전, brands: BRANDS, rows: rows });
        시작();
      });
    }).catch(function () {
      $("#rows").innerHTML = '<div class="empty"><b>가격표를 불러오지 못했습니다.</b>잠시 뒤에 다시 열어 주세요.</div>';
    });
  }

  function 시작() {
    ready = true;
    제조사단추그리기();
    BRAND_RANK = {};
    BRANDS.forEach(function (b, i) { BRAND_RANK[b] = i; });
    render();
  }

  function 제조사단추그리기() {
    var 있는것 = {};
    ALL.forEach(function (r) { 있는것[r.brand] = true; });
    $("#brandlist").innerHTML = BRANDS.filter(function (b) { return 있는것[b]; })
      .map(function (b) { return '<button class="bchip" type="button" data-b="' + esc(b) + '">' + esc(b) + "</button>"; })
      .join("");
  }

  /* ============================================================
     검색
     ============================================================ */
  function sizeDigits(r) {
    if (r._sd === undefined) r._sd = String(r.size || "").replace(/\D/g, "");
    return r._sd;
  }

  function parseQuery(q) {
    var s = String(q == null ? "" : q).trim().toLowerCase();
    if (!s) return null;
    var inch = s.match(/^r?(\d{2})(?:인치)?$/);
    if (inch) return { inch: inch[1] };
    if (/^[\d\s/\-rz]+$/.test(s)) {
      var digits = s.replace(/\D/g, "");
      if (digits.length >= 3) return { size: digits };
    }
    return { text: s.replace(/[\s/\-]/g, "") };
  }

  function match(r) {
    if (S.brands.length && S.brands.indexOf(r.brand) === -1) return false;
    if (!Q) return true;
    if (Q.inch) return sizeDigits(r).slice(-2) === Q.inch;
    if (Q.size) {
      // 규격은 다 쳐야 나온다 : 15512 → 155R12, 2254518 → 225/45R18
      return sizeDigits(r) === Q.size;
    }
    var hay = (r.brand + r.model + r.product + r.size + r.spec).toLowerCase().replace(/[\s/\-]/g, "");
    return hay.indexOf(Q.text) !== -1;
  }

  /* ============================================================
     그리기
     ============================================================ */
  function rowHtml(r, i) {
    var dc = dcOf(i);
    return '<div class="pcard" data-i="' + i + '">' +
      '<div class="pname">' +
        '<div class="pline">' +
          '<span class="bb" data-b="' + esc(r.brand) + '">' + esc(r.brand) + "</span>" +
          '<span class="mo">' + esc(r.model) + "</span>" +
          '<span class="pr">' + (r.product ? "/ " + esc(r.product) : "") + "</span>" +
        "</div>" +
        '<div class="bot num"><b>' + esc(r.size) + "</b> <i>" + esc(r.spec) + "</i></div>" +
      "</div>" +
      '<div class="nums">' +
        '<div class="col fac"><span class="c-fac num">' + won(r.price) + "</span>" +
          '<span class="lb">공장도가 (원)</span></div>' +
        '<div class="col dcc"><span class="dccell">' +
          '<input class="dcinp num' + (dc > 0 ? " set" : "") + '" type="number" min="0" max="95" value="' + (dc ? dc : "") + '" aria-label="DC율">' +
          '<span class="pc">%</span></span></div>' +
        '<div class="col sal"><span class="c-sale num" data-sale>' + won(salePrice(r.price, dc)) + "</span>" +
          '<span class="lb">할인가 (원)</span></div>' +
      "</div>" +
    "</div>";
  }

  var BRAND_RANK = {};
  function brandRank(b) { var v = BRAND_RANK[b]; return v === undefined ? 9999 : v; }

  function render() {
    if (!ready) return;
    var list = ALL.filter(match);

    /* 제조사를 안 고른 동안은 제조사 차례대로 (같은 제조사 안에서는 싼 것부터).
       검색도 안 했으면 첫 화면이므로 100개까지만 */
    if (!S.brands.length) {
      list = list.slice().sort(function (a, b) {
        return brandRank(a.brand) - brandRank(b.brand) || a.price - b.price;
      });
      if (!S.q) list = list.slice(0, PER);
    }

    var pages = Math.max(1, Math.ceil(list.length / PER));
    if (S.page > pages) S.page = pages;
    VIEW = list.slice((S.page - 1) * PER, S.page * PER);

    $("#rows").innerHTML = VIEW.length
      ? VIEW.map(rowHtml).join("")
      : '<div class="empty"><b>조건에 맞는 상품이 없습니다.</b>검색어나 제조사를 바꿔 보세요.</div>';

    var out = ['<button ' + (S.page === 1 ? "disabled" : "") + ' data-p="' + (S.page - 1) + '">‹</button>'];
    var to = Math.min(pages, Math.max(1, S.page - 2) + 4);
    var from = Math.max(1, to - 4);
    if (from > 1) out.push('<button data-p="1">1</button>', "<button disabled>…</button>");
    for (var i = from; i <= to; i++) out.push('<button class="' + (i === S.page ? "on" : "") + '" data-p="' + i + '">' + i + "</button>");
    if (to < pages) out.push("<button disabled>…</button>", '<button data-p="' + pages + '">' + pages + "</button>");
    out.push('<button ' + (S.page === pages ? "disabled" : "") + ' data-p="' + (S.page + 1) + '">›</button>');
    $("#pager").innerHTML = pages > 1 ? out.join("") : "";

    drawChips();
  }

  function drawChips() {
    var 켜짐 = S.q || S.brands.length;
    var box = $("#chips");
    box.hidden = !켜짐;
    if (!켜짐) return;
    box.innerHTML = S.q ? '<button class="fchip" data-x="q">' + esc('"' + S.q + '"') + "</button>" : "";
  }

  /* ============================================================
     DC율
     ============================================================ */
  function applyDc(inp) {
    var box = inp.closest(".pcard");
    if (!box) return;
    var i = +box.dataset.i, rec = VIEW[i];
    var raw = String(inp.value).replace(/[^\d]/g, "");
    var v = raw === "" ? 0 : parseInt(raw, 10);
    if (v > 95) { v = 95; inp.value = 95; }
    DCMAP[i] = v;
    inp.classList.toggle("set", v > 0);
    box.classList.toggle("on", v > 0);
    var cell = $("[data-sale]", box);
    if (cell && rec) cell.textContent = won(salePrice(rec.price, v));
  }
  $("#rows").addEventListener("input", function (e) {
    var inp = e.target.closest(".dcinp");
    if (inp) applyDc(inp);
  });

  /* 제조사 단추 — 누르면 켜지고 다시 누르면 꺼진다 */
  $("#brandlist").addEventListener("click", function (e) {
    var b = e.target.closest(".bchip");
    if (!b) return;
    var v = b.dataset.b, i = S.brands.indexOf(v);
    if (i === -1) S.brands.push(v); else S.brands.splice(i, 1);
    b.classList.toggle("on", S.brands.indexOf(v) !== -1);
    S.page = 1; clearDc(); render();
  });

  $("#pager").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-p]");
    if (!b || b.disabled) return;
    S.page = +b.dataset.p; clearDc(); render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* ============================================================
     검색창 — Enter 나 돋보기를 눌렀을 때만 찾는다
     ============================================================ */
  function runSearch() {
    S.q = $("#q").value.trim();
    Q = parseQuery(S.q);
    S.page = 1; clearDc(); render();
  }
  $("#q").addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
    e.preventDefault(); runSearch();
  });
  $("#qgo").addEventListener("click", runSearch);
  $("#q").addEventListener("search", function () { if (!this.value) 처음화면으로(); });
  $("#q").addEventListener("input",  function () { if (!this.value) 처음화면으로(); });

  $("#chips").addEventListener("click", function (e) {
    if (!e.target.closest('[data-x="q"]')) return;
    $("#q").value = ""; 처음화면으로();
  });

  /* ============================================================
     5분 동안 아무도 안 만지면 처음 화면으로 (매장에 걸어두는 화면)
     ============================================================ */
  var 되돌리는시간 = 5 * 60 * 1000, 대기시계;

  function 처음화면으로() {
    if (!S.q && !S.brands.length) return;
    S.q = ""; Q = null; S.brands = [];
    $("#q").value = "";
    $$("#brandlist .bchip").forEach(function (b) { b.classList.remove("on"); });
    S.page = 1; clearDc(); render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function 시계다시() {
    clearTimeout(대기시계);
    대기시계 = setTimeout(처음화면으로, 되돌리는시간);
  }
  ["click", "keydown", "input", "scroll", "touchstart", "wheel"].forEach(function (ev) {
    window.addEventListener(ev, 시계다시, { passive: true });
  });
  시계다시();

  /* 관리자 문 — 두 번 눌러야 열린다 */
  var mk = $("#mk-admin");
  if (mk) {
    mk.addEventListener("click", function (e) { e.preventDefault(); });
    mk.addEventListener("dblclick", function (e) { e.preventDefault(); location.href = "/admin.html"; });
  }

  자료불러오기();
})();
