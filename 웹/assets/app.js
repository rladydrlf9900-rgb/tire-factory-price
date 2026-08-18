/* ============================================================
   타이어공장도가격 — 화면 동작
   가격표 전체를 파일 하나로 받아서 검색·필터는 브라우저에서 처리한다.
   서버는 파일 하나만 내주면 되므로 사람이 몰려도 버틴다.
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

  var PER = 30;

  var toastTimer;
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }
  function showResult(title, html) {
    $("#resttl").textContent = title;
    $("#resbody").innerHTML = html;
    $("#resveil").hidden = false;
  }

  /* ============================================================
     가격표 불러오기
     ============================================================ */
  var ALL = [];               // 전체 가격표
  var ready = false;
  var S = { q: "", brands: [], seasons: [], page: 1 };
  var DCMAP = {}, VIEW = [];
  var Q = null;               // 해석해 둔 검색어

  function clearDc() { DCMAP = {}; }
  function dcOf(i) { return DCMAP[i] === undefined ? 0 : DCMAP[i]; }
  function salePrice(p, dc) { return Math.round(p * (100 - dc) / 100); }

  (function applyPreset() {
    var p = window.__PRESET || {};
    if (p.q) { S.q = String(p.q); }
    if (p.brands && p.brands.length) S.brands = p.brands.slice();
    Q = parseQuery(S.q);
  })();

  function loadData() {
    fetch(window.__DATA_URL, { cache: "force-cache" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) {
        var f = d.f || ["brand", "model", "product", "size", "spec", "season", "price"];
        ALL = (d.d || []).map(function (a) {
          var o = {};
          for (var i = 0; i < f.length; i++) o[f[i]] = a[i];
          return o;
        });
        ready = true;
        render();
      })
      .catch(function () {
        // 파일을 못 받아도 서버가 미리 그려준 첫 화면은 그대로 남는다
        ready = false;
      });
  }

  /* 규격을 숫자만 남긴 형태로 — "175/65R14" → "1756514" */
  function sizeDigits(r) {
    if (r._sd === undefined) r._sd = String(r.size || "").replace(/\D/g, "");
    return r._sd;
  }

  /* 검색어 해석
     1756514 · 175/65R14 · 175 65 14 · 17565 · 175 · 14인치 · R14 를 모두 알아듣는다 */
  function parseQuery(q) {
    var s = String(q == null ? "" : q).trim().toLowerCase();
    if (!s) return null;

    var inch = s.match(/^r?(\d{2})(?:인치)?$/);
    if (inch) return { inch: inch[1] };

    // 숫자와 구분기호(/ - R Z)만 있으면 규격으로 본다
    if (/^[\d\s/\-rz]+$/.test(s)) {
      var digits = s.replace(/\D/g, "");
      if (digits.length >= 3) return { size: digits };
    }
    return { text: s.replace(/[\s/\-]/g, "") };
  }

  function match(r) {
    if (S.brands.length && S.brands.indexOf(r.brand) === -1) return false;
    if (S.seasons.length && S.seasons.indexOf(r.season) === -1) return false;
    if (!Q) return true;

    if (Q.inch) {
      return sizeDigits(r).slice(-2) === Q.inch;
    }
    if (Q.size) {
      // 앞에서부터 맞으면 통과 : 175 → 175/xx, 17565 → 175/65, 1756514 → 정확히
      return sizeDigits(r).indexOf(Q.size) === 0;
    }
    var hay = (r.brand + r.model + r.product + r.size + r.spec).toLowerCase().replace(/[\s/\-]/g, "");
    return hay.indexOf(Q.text) !== -1;
  }

  function rowHtml(r, i) {
    var dc = dcOf(i);
    return '<tr data-i="' + i + '">' +
      '<td class="c-brand">' + esc(r.brand) + "</td>" +
      '<td class="c-model">' + esc(r.model) + "</td>" +
      '<td class="c-name">' + esc(r.product) + "</td>" +
      '<td class="c-spec num">' + esc(r.size) + " <i>" + esc(r.spec) + "</i></td>" +
      '<td class="t-c" style="font-size:12.5px;color:var(--ink-2);font-weight:600">' + esc(r.season) + "</td>" +
      '<td class="t-r"><span class="c-fac num">' + won(r.price) + "</span><u>원</u></td>" +
      '<td class="t-c"><span class="dccell">' +
        '<input class="dcinp num' + (dc > 0 ? " set" : "") + '" type="number" min="0" max="95" value="' + (dc ? dc : "") + '" aria-label="DC율">' +
        '<span class="pc">%</span></span></td>' +
      '<td class="t-r"><span class="c-sale num" data-sale>' + won(salePrice(r.price, dc)) + '</span><span class="won">원</span></td>' +
    "</tr>";
  }

  function cardHtml(r, i) {
    var dc = dcOf(i);
    return '<div class="mcard" data-i="' + i + '">' +
      '<div class="r1"><b>' + esc(r.brand) + '</b><span style="font-size:11.5px;color:var(--ink-3);font-weight:700">' + esc(r.season) + "</span></div>" +
      "<h4>" + esc(r.product) + " " + esc(r.model) + "</h4>" +
      '<div class="sz num">' + esc(r.size) + " " + esc(r.spec) + "</div>" +
      '<div class="pr">' +
        '<div><span class="lb">공장도가</span><span class="c-fac num">' + won(r.price) + "원</span></div>" +
        '<div><span class="lb">DC율</span><span class="dccell">' +
          '<input class="dcinp num' + (dc > 0 ? " set" : "") + '" type="number" min="0" max="95" value="' + (dc ? dc : "") + '" aria-label="DC율">' +
          '<span class="pc">%</span></span></div>' +
        '<div style="margin-left:auto;text-align:right"><span class="lb">할인가</span>' +
          '<span class="c-sale num" data-sale>' + won(salePrice(r.price, dc)) + '</span><span class="won">원</span></div>' +
      "</div>" +
    "</div>";
  }

  function render() {
    if (!ready) return;

    var list = ALL.filter(match);
    var pages = Math.max(1, Math.ceil(list.length / PER));
    if (S.page > pages) S.page = pages;
    VIEW = list.slice((S.page - 1) * PER, S.page * PER);

    if (!VIEW.length) {
      var msg = '<div class="empty"><b>조건에 맞는 상품이 없습니다.</b>검색어나 제조사를 바꿔 보세요.</div>';
      $("#rows").innerHTML = '<tr><td colspan="8">' + msg + "</td></tr>";
      $("#mrows").innerHTML = msg;
    } else {
      $("#rows").innerHTML = VIEW.map(rowHtml).join("");
      $("#mrows").innerHTML = VIEW.map(cardHtml).join("");
    }

    var out = ['<button ' + (S.page === 1 ? "disabled" : "") + ' data-p="' + (S.page - 1) + '">‹</button>'];
    var to = Math.min(pages, Math.max(1, S.page - 2) + 4);
    var from = Math.max(1, to - 4);
    if (from > 1) out.push('<button data-p="1">1</button>', "<button disabled>…</button>");
    for (var i = from; i <= to; i++) out.push('<button class="' + (i === S.page ? "on" : "") + '" data-p="' + i + '">' + i + "</button>");
    if (to < pages) out.push("<button disabled>…</button>", '<button data-p="' + pages + '">' + pages + "</button>");
    out.push('<button ' + (S.page === pages ? "disabled" : "") + ' data-p="' + (S.page + 1) + '">›</button>');
    $("#pager").innerHTML = pages > 1 ? out.join("") : "";

    drawChips(list.length);
    updateFilterLabel();
  }

  function drawChips(total) {
    var c = [];
    S.brands.forEach(function (b) { c.push(["brand:" + b, b]); });
    S.seasons.forEach(function (s) { c.push(["season:" + s, s]); });
    if (S.q) c.push(["q", '"' + S.q + '"']);
    var box = $("#chips");
    box.hidden = !c.length;
    if (!c.length) return;
    box.innerHTML =
      '<span class="cnt-badge num">' + won(total) + "건</span>" +
      c.map(function (x) {
        return '<button class="fchip" data-x="' + esc(x[0]) + '">' + esc(x[1]) + "</button>";
      }).join("") +
      (c.length > 1 ? '<button class="btn btn-quiet btn-sm" data-x="all">전체 해제</button>' : "");
  }

  function applyDc(inp) {
    var box = inp.closest("tr") || inp.closest(".mcard");
    if (!box) return;
    var i = +box.dataset.i, rec = VIEW[i];
    var raw = String(inp.value).replace(/[^\d]/g, "");
    var v = raw === "" ? 0 : parseInt(raw, 10);
    if (v > 95) { v = 95; inp.value = 95; }
    DCMAP[i] = v;
    inp.classList.toggle("set", v > 0);

    var cell = $("[data-sale]", box);
    if (!cell) return;
    if (rec) {
      cell.textContent = won(salePrice(rec.price, v));
    } else {
      // 자료가 아직 안 왔으면 화면에 찍힌 공장도가로 계산한다
      var facEl = $(".c-fac", box);
      var fac = facEl ? parseInt(facEl.textContent.replace(/[^\d]/g, ""), 10) : 0;
      if (fac) cell.textContent = won(salePrice(fac, v));
    }
  }
  ["#rows", "#mrows"].forEach(function (sel) {
    $(sel).addEventListener("input", function (e) {
      var inp = e.target.closest(".dcinp");
      if (inp) applyDc(inp);
    });
  });

  $("#brandlist").addEventListener("change", function (e) {
    var v = e.target.value;
    if (e.target.checked) S.brands.push(v);
    else S.brands = S.brands.filter(function (x) { return x !== v; });
    S.page = 1; clearDc(); render();
  });
  if ($("#seasonlist")) {
    $("#seasonlist").addEventListener("change", function (e) {
      var v = e.target.value;
      if (e.target.checked) S.seasons.push(v);
      else S.seasons = S.seasons.filter(function (x) { return x !== v; });
      S.page = 1; clearDc(); render();
    });
  }

  /* 휴대폰에서 필터 접었다 펴기 (PC 에서는 버튼이 보이지 않아 동작하지 않는다) */
  (function filterToggle() {
    var btn = $("#filterbtn"), rail = $("#rail");
    if (!btn || !rail) return;
    btn.addEventListener("click", function () {
      var open = rail.classList.toggle("open");
      btn.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
  })();

  /* 고른 개수를 버튼에 보여준다 */
  function updateFilterLabel() {
    var el = $("#filterbtn-label");
    if (!el) return;
    var n = S.brands.length + S.seasons.length;
    el.innerHTML = n ? "제조사 · 계절 골라보기 <b>" + n + "개 선택</b>" : "제조사 · 계절 골라보기";
  }

  var qTimer;
  $("#q").addEventListener("input", function () {
    var v = this.value;
    clearTimeout(qTimer);
    qTimer = setTimeout(function () { S.q = v.trim(); Q = parseQuery(S.q); S.page = 1; clearDc(); render(); }, 180);
  });

  $("#pager").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-p]");
    if (!b || b.disabled) return;
    S.page = +b.dataset.p; clearDc(); render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  $("#chips").addEventListener("click", function (e) {
    var b = e.target.closest("[data-x]");
    if (!b) return;
    var x = b.dataset.x;
    if (x === "all") {
      S.q = ""; Q = null; S.brands = []; S.seasons = [];
      $("#q").value = "";
      $$("#brandlist input, #seasonlist input").forEach(function (i) { i.checked = false; });
    } else if (x === "q") {
      S.q = ""; Q = null; $("#q").value = "";
    } else if (x.indexOf("brand:") === 0) {
      var bn = x.slice(6);
      S.brands = S.brands.filter(function (v) { return v !== bn; });
      $$("#brandlist input").forEach(function (i) { if (i.value === bn) i.checked = false; });
    } else if (x.indexOf("season:") === 0) {
      var sn = x.slice(7);
      S.seasons = S.seasons.filter(function (v) { return v !== sn; });
      $$("#seasonlist input").forEach(function (i) { if (i.value === sn) i.checked = false; });
    }
    S.page = 1; clearDc(); render();
  });

  /* ============================================================
     관리자
     ============================================================ */
  var API = "/api/admin.php";
  var veil = $("#lockveil"), pw = $("#lockpw"), err = $("#lockerr");

  function post(fields) {
    var body = new FormData();
    Object.keys(fields).forEach(function (k) { body.append(k, fields[k]); });
    return fetch(API, { method: "POST", body: body }).then(function (r) { return r.json(); });
  }

  function go(view) {
    $("#view-app").hidden = view !== "app";
    $("#view-admin").hidden = view !== "admin";
    window.scrollTo(0, 0);
  }

  function openLock() {
    fetch(API + "?action=check")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.admin) { go("admin"); loadAdmin(); return; }
        veil.hidden = false; err.hidden = true; pw.value = ""; pw.focus();
      })
      .catch(function () { veil.hidden = false; pw.focus(); });
  }

  function tryEnter() {
    post({ action: "login", password: pw.value })
      .then(function (d) {
        if (d.ok) { veil.hidden = true; go("admin"); loadAdmin(); }
        else { err.textContent = d.error || "비밀번호가 맞지 않습니다."; err.hidden = false; pw.value = ""; pw.focus(); }
      })
      .catch(function () { err.textContent = "서버에 연결하지 못했습니다."; err.hidden = false; });
  }

  var mk = $("#mk-admin");
  if (mk) {
    mk.addEventListener("click", function (e) { e.preventDefault(); openLock(); });
  }
  $("#lockok").addEventListener("click", tryEnter);
  $("#lockno").addEventListener("click", function () { veil.hidden = true; });
  pw.addEventListener("keydown", function (e) { if (e.key === "Enter") tryEnter(); });
  veil.addEventListener("click", function (e) { if (e.target === veil) veil.hidden = true; });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { veil.hidden = true; $("#resveil").hidden = true; }
  });
  $("#resok").addEventListener("click", function () { $("#resveil").hidden = true; });
  $("#resveil").addEventListener("click", function (e) { if (e.target === $("#resveil")) $("#resveil").hidden = true; });

  $("#btn-logout").addEventListener("click", function () {
    post({ action: "logout" }).finally(function () { location.reload(); });
  });

  $("#btn-pw").addEventListener("click", function () {
    var np = prompt("새 비밀번호를 입력하세요 (4자 이상)");
    if (!np) return;
    post({ action: "password", "new": np }).then(function (d) {
      toast(d.ok ? "비밀번호를 바꿨습니다." : (d.error || "바꾸지 못했습니다."));
    });
  });

  function statusPill(days) {
    if (days === null || days === undefined) return '<span class="pill none">아직 없음</span>';
    if (days <= 0) return '<span class="pill ok">오늘 갱신</span>';
    if (days <= 7) return '<span class="pill new">' + days + "일 전</span>";
    return '<span class="pill low">' + days + "일 전</span>";
  }

  var ADMIN = { brands: [], history: [] };

  function loadAdmin() {
    fetch(API + "?action=status")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { go("app"); return; }
        ADMIN = d;
        drawAdmin();
      })
      .catch(function () { toast("관리자 정보를 불러오지 못했습니다."); });
  }

  function drawAdmin() {
    var list = ADMIN.brands || [];

    $("#bgrid").innerHTML = list.map(function (x, i) {
      return '<div class="bcard" data-brand="' + esc(x.brand) + '">' +
        '<button class="bc-del" data-del="' + esc(x.brand) + '" title="' + esc(x.brand) + ' 삭제">✕</button>' +
        '<div class="bc-h">' +
          '<input class="bc-no" type="number" min="1" max="' + list.length + '" value="' + (i + 1) + '" data-no="' + esc(x.brand) + '" aria-label="순서">' +
          "<b>" + esc(x.brand) + "</b>" + statusPill(x.days) +
        "</div>" +
        '<div class="bc-file">' + (x.filename ? esc(x.filename) : "올린 파일 없음") + "</div>" +
        '<div class="bc-when">' + (x.when ? esc(x.when) + " · " + won(x.rows) + "건" : "—") + "</div>" +
        '<div class="bdrop"><b>파일 올리기</b><span>끌어다 놓거나 클릭</span></div>' +
      "</div>";
    }).join("") + '<div class="bcard bnew" id="bnew"><span>+</span> 제조사 추가</div>';

    // 파일보관함 — 지금 적용 중인 파일
    var lastId = {};
    (ADMIN.history || []).forEach(function (h) {
      if (!Number(h.restored) && lastId[h.brand] === undefined) lastId[h.brand] = h.id;
    });

    $("#frows").innerHTML = list.length ? list.map(function (x) {
      if (!x.filename) {
        return "<tr><td style='font-weight:700'>" + esc(x.brand) + "</td><td class='fnone' colspan='4'>아직 올린 파일 없음</td></tr>";
      }
      var id = lastId[x.brand];
      return "<tr>" +
        "<td style='font-weight:700'>" + esc(x.brand) + "</td>" +
        '<td class="fname">' + esc(x.filename) + "</td>" +
        '<td class="num" style="color:var(--ink-3)">' + esc(x.when) + "</td>" +
        '<td class="t-r num">' + won(x.rows) + "</td>" +
        '<td class="t-c">' + (id ? '<a class="btn btn-out btn-sm" href="' + API + '?action=download&id=' + id + '">받기</a>' : "—") + "</td>" +
      "</tr>";
    }).join("") : '<tr><td colspan="5" style="text-align:center;color:var(--ink-3);padding:26px">제조사를 먼저 추가해 주세요.</td></tr>';

    // 최근 올린 파일
    $("#hrows").innerHTML = (ADMIN.history || []).length
      ? ADMIN.history.map(function (h) {
          var isNow = lastId[h.brand] === h.id;
          return "<tr>" +
            '<td class="num" style="color:var(--ink-3)">' + esc(h.uploaded_at) + "</td>" +
            '<td style="font-weight:700">' + esc(h.brand) + "</td>" +
            "<td>" + esc(h.filename) + (isNow ? ' <span class="pill ok">적용중</span>' : "") + "</td>" +
            '<td class="t-c" style="white-space:nowrap">' +
              '<a class="btn btn-out btn-sm" href="' + API + "?action=download&id=" + h.id + '">받기</a> ' +
              (Number(h.restored)
                ? '<span class="pill none">되돌림</span>'
                : '<button class="btn btn-out btn-sm" data-roll="' + h.id + '">되돌리기</button>') +
            "</td>" +
          "</tr>";
        }).join("")
      : '<tr><td colspan="4" style="text-align:center;color:var(--ink-3);padding:26px">아직 올린 파일이 없습니다.</td></tr>';
  }

  /* ---------- 순서 번호 ---------- */
  $("#bgrid").addEventListener("change", function (e) {
    var inp = e.target.closest(".bc-no");
    if (!inp) return;
    var v = parseInt(String(inp.value).replace(/[^\d]/g, ""), 10);
    if (isNaN(v)) { drawAdmin(); return; }

    var names = ADMIN.brands.map(function (x) { return x.brand; });
    var from = names.indexOf(inp.dataset.no);
    var to = Math.max(1, Math.min(names.length, v)) - 1;
    if (from < 0 || from === to) { drawAdmin(); return; }

    var moved = ADMIN.brands.splice(from, 1)[0];
    ADMIN.brands.splice(to, 0, moved);
    drawAdmin();

    post({ action: "brand_order", names: JSON.stringify(ADMIN.brands.map(function (x) { return x.brand; })) })
      .then(function (d) { toast(d.ok ? moved.brand + " → " + (to + 1) + "번" : "순서를 저장하지 못했습니다."); });
  });
  $("#bgrid").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.closest(".bc-no")) { e.preventDefault(); e.target.blur(); }
  });

  /* ---------- 파일 올리기 ---------- */
  var picker = document.createElement("input");
  picker.type = "file";
  picker.accept = ".xlsx,.csv";
  picker.style.display = "none";
  document.body.appendChild(picker);
  var pickBrand = null;

  picker.addEventListener("change", function () {
    if (picker.files && picker.files[0] && pickBrand) doUpload(pickBrand, picker.files[0]);
    picker.value = "";
  });

  var CHUNK = 1024 * 1024;    // 1MB 씩

  function randKey() {
    var s = "";
    for (var i = 0; i < 4; i++) s += Math.floor(Math.random() * 1e9).toString(36);
    return s.replace(/[^a-z0-9]/g, "").slice(0, 32);
  }

  /** 큰 파일은 1MB 씩 잘라 보낸다 — 호스팅 업로드 제한을 넘기지 않는다 */
  async function sendChunks(file, onProgress) {
    var key = randKey();
    var parts = Math.ceil(file.size / CHUNK);
    for (var i = 0; i < parts; i++) {
      var body = new FormData();
      body.append("action", "chunk");
      body.append("key", key);
      body.append("index", i);
      body.append("blob", file.slice(i * CHUNK, (i + 1) * CHUNK), "part");
      var res = await fetch(API, { method: "POST", body: body }).then(function (r) { return r.json(); });
      if (!res.ok) throw new Error(res.error || "조각을 올리지 못했습니다.");
      if (onProgress) onProgress(Math.round(((i + 1) / parts) * 100));
    }
    return key;
  }

  async function doUpload(brand, file) {
    var card = $('.bcard[data-brand="' + brand + '"]');
    var label = card ? $(".bdrop b", card) : null;
    if (label) label.textContent = "올리는 중…";

    try {
      var body = new FormData();
      body.append("action", "upload");
      body.append("brand", brand);

      if (file.size > CHUNK) {
        var key = await sendChunks(file, function (pct) {
          if (label) label.textContent = "올리는 중… " + pct + "%";
        });
        body.append("key", key);
        body.append("filename", file.name);
      } else {
        body.append("file", file);
      }

      if (label) label.textContent = "저장하는 중…";
      var d = await fetch(API, { method: "POST", body: body }).then(function (r) { return r.json(); });

      if (!d.ok) {
        showResult("올리지 못했습니다", '<b style="color:var(--price)">' + esc(d.error) + "</b>");
        loadAdmin();
        return;
      }

      var html = "<b>" + esc(d.brand) + "</b> 가격표를 <b>" + won(d.saved) + "건</b> 저장했습니다.";
      if (d.diff) {
        html += '<div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">' +
          '<span class="pill new">새 품목 ' + won(d.diff.added) + "</span>" +
          '<span class="pill up">가격 변경 ' + won(d.diff.changed) + "</span>" +
          '<span class="pill none">그대로 ' + won(d.diff.same) + "</span>" +
          (d.diff.gone ? '<span class="pill low">없어짐 ' + won(d.diff.gone) + "</span>" : "") +
          "</div>";
        if (d.diff.gone) {
          html += '<div style="margin-top:10px;padding:10px 12px;background:var(--warn-soft);border-radius:9px;font-size:12.5px;color:var(--warn);font-weight:700">' +
            "이 파일에 없는 " + won(d.diff.gone) + "건은 사이트에서 내려갑니다.<br>" +
            "품목 전체가 들어있는 파일이 맞는지 확인하세요. 잘못 올렸으면 <b>되돌리기</b>로 복구됩니다.</div>";
        }
      }
      if (d.skipped && d.skipped.length) {
        html += "<br><b style='color:var(--warn)'>넘어간 줄 " + d.skipped.length + "개</b><br>" +
          d.skipped.slice(0, 8).map(function (s) {
            return "· " + s.line + "번째 줄 — " + esc(s.why) + (s.value ? " (" + esc(s.value) + ")" : "");
          }).join("<br>");
        if (d.skipped.length > 8) html += "<br>· 외 " + (d.skipped.length - 8) + "줄";
      }
      showResult("업로드 완료", html);
      loadAdmin();
    } catch (e) {
      showResult("올리지 못했습니다", '<b style="color:var(--price)">' + esc(e.message || e) + "</b>");
      loadAdmin();
    }
  }

  $("#bgrid").addEventListener("click", function (e) {
    var del = e.target.closest("[data-del]");
    if (del) {
      e.stopPropagation();
      var name = del.dataset.del;
      if (!confirm(name + " 을(를) 지웁니다. 등록된 가격도 함께 지워집니다. 계속할까요?")) return;
      post({ action: "brand_del", name: name }).then(function (d) {
        if (d.ok) { toast(name + " 을(를) 지웠습니다."); loadAdmin(); }
      });
      return;
    }
    if (e.target.closest("#bnew")) {
      var n = prompt("추가할 제조사 이름");
      if (!n || !n.trim()) return;
      post({ action: "brand_add", name: n.trim() }).then(function (d) {
        if (d.ok) { toast(n.trim() + " 을(를) 추가했습니다."); loadAdmin(); }
        else toast(d.error);
      });
      return;
    }
    if (e.target.closest(".bc-no")) return;

    var card = e.target.closest(".bcard");
    if (!card || !card.dataset.brand) return;
    pickBrand = card.dataset.brand;
    picker.click();
  });

  ["dragenter", "dragover"].forEach(function (ev) {
    $("#bgrid").addEventListener(ev, function (e) {
      var card = e.target.closest(".bcard");
      if (!card || !card.dataset.brand) return;
      e.preventDefault();
      card.classList.add("over");
    });
  });
  $("#bgrid").addEventListener("dragleave", function (e) {
    var card = e.target.closest(".bcard");
    if (card) card.classList.remove("over");
  });
  $("#bgrid").addEventListener("drop", function (e) {
    var card = e.target.closest(".bcard");
    if (!card || !card.dataset.brand) return;
    e.preventDefault();
    card.classList.remove("over");
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) doUpload(card.dataset.brand, f);
  });

  $("#hrows").addEventListener("click", function (e) {
    var b = e.target.closest("[data-roll]");
    if (!b) return;
    if (!confirm("이 업로드 전으로 되돌릴까요?")) return;
    post({ action: "rollback", id: b.dataset.roll }).then(function (d) {
      toast(d.ok ? d.brand + " 가격표를 되돌렸습니다." : (d.error || "되돌리지 못했습니다."));
      loadAdmin();
    });
  });

  /* ---------- 시작 ---------- */
  loadData();
})();


