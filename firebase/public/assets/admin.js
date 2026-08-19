/* ============================================================
   관리자 화면 — 엑셀 가격표를 브라우저에서 읽어 Firestore 에 넣는다.
   서버가 없어도 되는 이유: 엑셀 읽기(SheetJS)와 파서가 모두 브라우저에서 돈다.
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

  var 관리자메일 = "admin@tireprice-g.web.app";   // 비밀번호만 물어보려고 정해 둔 이름
  var 기록보관 = 30;                              // 올린 기록을 몇 개까지 남길지

  var 토큰 = null;                                // 로그인하면 받는 열쇠
  var ADMIN = { brands: [], history: [], counts: {} };

  var toastTimer;
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  /* ── Firestore 주고받기 ────────────────────────────────── */
  function 값싸기(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === "boolean") return { booleanValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(값싸기) } };
    return { stringValue: String(v) };
  }
  function 값풀기(f) {
    if (!f) return null;
    if (f.stringValue !== undefined)  return f.stringValue;
    if (f.integerValue !== undefined) return +f.integerValue;
    if (f.doubleValue !== undefined)  return +f.doubleValue;
    if (f.booleanValue !== undefined) return f.booleanValue;
    if (f.arrayValue !== undefined)   return (f.arrayValue.values || []).map(값풀기);
    return null;
  }
  function 문서싸기(o) {
    var fields = {};
    Object.keys(o).forEach(function (k) { fields[k] = 값싸기(o[k]); });
    return { fields: fields };
  }
  function 문서풀기(d) {
    var o = {};
    Object.keys(d.fields || {}).forEach(function (k) { o[k] = 값풀기(d.fields[k]); });
    o._id = d.name.split("/").pop();
    return o;
  }

  function 머리() {
    var h = { "Content-Type": "application/json" };
    if (토큰) h.Authorization = "Bearer " + 토큰;
    return h;
  }
  function 읽기(길) {
    return fetch(FS + 길, { headers: 머리() }).then(function (r) {
      if (!r.ok) throw new Error("읽지 못했습니다 (" + r.status + ")");
      return r.json();
    });
  }
  function 쓰기(길, o) {
    return fetch(FS + 길, { method: "PATCH", headers: 머리(), body: JSON.stringify(문서싸기(o)) })
      .then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error("저장하지 못했습니다 (" + r.status + ") " + t.slice(0, 120)); });
        return r.json();
      });
  }
  function 지우기(길) {
    return fetch(FS + 길, { method: "DELETE", headers: 머리() }).then(function (r) {
      if (!r.ok) throw new Error("지우지 못했습니다 (" + r.status + ")");
    });
  }

  /* ── 로그인 ────────────────────────────────────────────── */
  function 로그인(비번) {
    return fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + FB.apiKey, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: 관리자메일, password: 비번, returnSecureToken: true })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); });
  }

  function 들어가기() {
    var 비번 = $("#lockpw").value;
    if (!비번) return;
    $("#lockok").disabled = true;
    로그인(비번).then(function (res) {
      $("#lockok").disabled = false;
      if (!res.ok) {
        var 뜻 = (res.j.error && res.j.error.message) || "";
        $("#lockerr").textContent =
          뜻.indexOf("INVALID") === 0 || 뜻.indexOf("EMAIL_NOT_FOUND") === 0 ? "비밀번호가 맞지 않습니다."
          : 뜻.indexOf("CONFIGURATION_NOT_FOUND") === 0 ? "관리자 계정이 아직 만들어지지 않았습니다."
          : 뜻.indexOf("TOO_MANY") === 0 ? "여러 번 틀렸습니다. 잠시 뒤에 다시 해주세요."
          : "들어가지 못했습니다.";
        $("#lockerr").hidden = false;
        $("#lockpw").value = ""; $("#lockpw").focus();
        return;
      }
      토큰 = res.j.idToken;
      sessionStorage.setItem("관리자열쇠", 토큰);
      $("#lockveil").hidden = true;
      $("#view-admin").hidden = false;
      불러오기();
    });
  }

  $("#lockok").addEventListener("click", 들어가기);
  $("#lockpw").addEventListener("keydown", function (e) { if (e.key === "Enter") 들어가기(); });
  $("#lockno").addEventListener("click", function () { location.href = "/"; });
  $("#btn-home").addEventListener("click", function () { location.href = "/"; });
  $("#btn-logout").addEventListener("click", function () {
    sessionStorage.removeItem("관리자열쇠"); location.href = "/";
  });

  /* 이미 로그인해 둔 열쇠가 있으면 그대로 들어간다 */
  (function () {
    var t = sessionStorage.getItem("관리자열쇠");
    if (!t) { $("#lockpw").focus(); return; }
    토큰 = t;
    읽기("/meta/current").then(function () {
      $("#lockveil").hidden = true; $("#view-admin").hidden = false; 불러오기();
    }).catch(function () { 토큰 = null; sessionStorage.removeItem("관리자열쇠"); $("#lockpw").focus(); });
  })();

  /* ── 자료 불러오기 ─────────────────────────────────────── */
  function 불러오기() {
    return Promise.all([
      읽기("/meta/current").catch(function () { return { fields: {} }; }),
      읽기("/prices").catch(function () { return {}; }),
      읽기("/uploads?pageSize=300").catch(function () { return {}; })
    ]).then(function (r) {
      var meta = 문서풀기(r[0]);
      ADMIN.brands = meta.brands || [];
      ADMIN.counts = {};
      (r[1].documents || []).forEach(function (d) {
        ADMIN.counts[d.name.split("/").pop()] = 값풀기((d.fields || {}).n) || 0;
      });
      ADMIN.history = (r[2].documents || []).map(문서풀기)
        .sort(function (a, b) { return a._id < b._id ? 1 : -1; });
      그리기();
    });
  }

  function 지금() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " +
           p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  /* ── 화면 그리기 ───────────────────────────────────────── */
  function 최근(brand) {
    for (var i = 0; i < ADMIN.history.length; i++) {
      if (ADMIN.history[i].brand === brand && !ADMIN.history[i].restored) return ADMIN.history[i];
    }
    return null;
  }

  function 그리기() {
    $("#bgrid").innerHTML = ADMIN.brands.map(function (b, i) {
      var h = 최근(b), n = ADMIN.counts[b] || 0;
      return '<div class="bcard" data-brand="' + esc(b) + '">' +
        '<button class="bc-del" data-del="' + esc(b) + '" title="' + esc(b) + ' 삭제">✕</button>' +
        '<div class="bc-h">' +
          '<input class="bc-no" type="number" min="1" max="' + ADMIN.brands.length + '" value="' + (i + 1) + '" data-no="' + esc(b) + '" aria-label="순서">' +
          "<b>" + esc(b) + "</b>" +
          (n ? '<span class="pill ok">' + won(n) + "건</span>" : '<span class="pill none">아직 없음</span>') +
        "</div>" +
        '<div class="bc-file">' + (h ? esc(h.filename) : "올린 파일 없음") + "</div>" +
        '<div class="bc-when">' + (h ? esc(h.at) : "—") + "</div>" +
        '<div class="bdrop"><b>파일 올리기</b><span>끌어다 놓거나 클릭</span></div>' +
      "</div>";
    }).join("") + '<div class="bcard bnew" id="bnew"><span>+</span> 제조사 추가</div>';

    $("#frows").innerHTML = ADMIN.brands.length ? ADMIN.brands.map(function (b) {
      var h = 최근(b);
      if (!h) return "<tr><td style='font-weight:700'>" + esc(b) + "</td><td class='fnone' colspan='3'>아직 올린 파일 없음</td></tr>";
      return "<tr><td style='font-weight:700'>" + esc(b) + "</td>" +
        '<td class="fname">' + esc(h.filename) + "</td>" +
        '<td class="num" style="color:var(--ink-3)">' + esc(h.at) + "</td>" +
        '<td class="t-r num">' + won(h.n) + "</td></tr>";
    }).join("") : '<tr><td colspan="4" style="text-align:center;color:var(--ink-3);padding:26px">제조사를 먼저 추가해 주세요.</td></tr>';

    $("#hrows").innerHTML = ADMIN.history.length ? ADMIN.history.map(function (h) {
      var 지금것 = 최근(h.brand) && 최근(h.brand)._id === h._id;
      return "<tr>" +
        '<td class="num" style="color:var(--ink-3)">' + esc(h.at) + "</td>" +
        '<td style="font-weight:700">' + esc(h.brand) + "</td>" +
        "<td>" + esc(h.filename) + (지금것 ? ' <span class="pill ok">적용중</span>' : "") + "</td>" +
        '<td class="t-c" style="white-space:nowrap">' +
          (h.restored ? '<span class="pill none">되돌림</span>'
                      : '<button class="btn btn-out btn-sm" data-roll="' + esc(h._id) + '">되돌리기</button>') +
          ' <button class="btn btn-del btn-sm" data-updel="' + esc(h._id) + '">지우기</button>' +
        "</td></tr>";
    }).join("") : '<tr><td colspan="4" style="text-align:center;color:var(--ink-3);padding:26px">아직 올린 파일이 없습니다.</td></tr>';
  }

  /* ── 가격표 올리기 ─────────────────────────────────────── */
  var picker = document.createElement("input");
  picker.type = "file"; picker.accept = ".xlsx,.xls,.csv"; picker.style.display = "none";
  document.body.appendChild(picker);
  var 고른제조사 = null;

  picker.addEventListener("change", function () {
    if (picker.files && picker.files[0] && 고른제조사) 올리기(고른제조사, picker.files[0]);
    picker.value = "";
  });

  function 엑셀읽기(file) {
    return new Promise(function (풀기, 깨기) {
      var fr = new FileReader();
      fr.onerror = function () { 깨기(new Error("파일을 읽지 못했습니다.")); };
      fr.onload = function () {
        try {
          var wb = XLSX.read(new Uint8Array(fr.result), { type: "array" });
          var sh = wb.Sheets[wb.SheetNames[0]];
          풀기(XLSX.utils.sheet_to_json(sh, { header: 1, raw: false, defval: "" }));
        } catch (e) { 깨기(new Error("엑셀 파일이 아니거나 열 수 없습니다.")); }
      };
      fr.readAsArrayBuffer(file);
    });
  }

  function 올리기(brand, file) {
    var card = $('.bcard[data-brand="' + brand + '"]');
    var 딱지 = card ? $(".bdrop b", card) : null;
    if (딱지) 딱지.textContent = "읽는 중…";

    엑셀읽기(file).then(function (rows) {
      var 결과 = 표읽기(rows, brand);          // parser.js — PHP 파서와 같은 규칙
      var items = 결과[0], skipped = 결과[1];

      if (딱지) 딱지.textContent = "저장 중…";

      /* 손님 화면이 받아갈 형태로 줄인다 : [모델, 제품명, 규격, 스펙, 계절, 가격] */
      var 짧게 = items.map(function (x) { return [x.model, x.product, x.size, x.spec, x.season, x.price]; });

      /* 되돌리기용으로 지금 것을 먼저 챙겨 둔다 */
      return 읽기("/prices/" + encodeURIComponent(brand)).catch(function () { return { fields: {} }; })
        .then(function (옛) {
          var 옛json = 값풀기((옛.fields || {}).json) || "";
          var id = new Date().toISOString().replace(/[:.]/g, "-");
          var 이제 = 지금();

          return 쓰기("/prices/" + encodeURIComponent(brand), { json: JSON.stringify(짧게), n: items.length })
            .then(function () {
              return 쓰기("/uploads/" + id, {
                brand: brand, filename: file.name, n: items.length,
                at: 이제, backup: 옛json, restored: false
              });
            })
            .then(버전올리기)
            .then(기록정리)
            .then(불러오기)
            .then(function () {
              if (딱지) 딱지.textContent = "파일 올리기";
              var 말 = brand + " " + won(items.length) + "건을 올렸습니다.";
              if (skipped.length) 말 += " (" + skipped.length + "줄은 건너뛰었습니다)";
              toast(말);
            });
        });
    }).catch(function (e) {
      if (딱지) 딱지.textContent = "파일 올리기";
      toast(e.message || "올리지 못했습니다.");
    });
  }

  /* 손님 화면이 "바뀐 걸" 알아채도록 버전을 새로 적는다 */
  function 버전올리기() {
    return 읽기("/prices").then(function (res) {
      var 합 = 0, 있는것 = {};
      (res.documents || []).forEach(function (d) {
        var b = d.name.split("/").pop();
        있는것[b] = true;
        합 += 값풀기((d.fields || {}).n) || 0;
      });
      var 차례 = ADMIN.brands.filter(function (b) { return true; });
      return 쓰기("/meta/current", {
        version: new Date().toISOString(),
        brands: 차례,
        count: 합
      });
    });
  }

  /* 30개 넘는 기록은 오래된 것부터 지운다 */
  function 기록정리() {
    return 읽기("/uploads?pageSize=300").then(function (res) {
      var 목록 = (res.documents || []).map(문서풀기).sort(function (a, b) { return a._id < b._id ? 1 : -1; });
      var 지울것 = 목록.slice(기록보관);
      return Promise.all(지울것.map(function (h) { return 지우기("/uploads/" + h._id).catch(function () {}); }));
    });
  }

  /* ── 박스 누르기 ───────────────────────────────────────── */
  $("#bgrid").addEventListener("click", function (e) {
    var 지움 = e.target.closest("[data-del]");
    if (지움) {
      var 이름 = 지움.dataset.del;
      if (!confirm(이름 + " 제조사를 지울까요?\n올려둔 " + 이름 + " 가격표도 함께 지워집니다.")) return;
      지우기("/prices/" + encodeURIComponent(이름)).catch(function () {})
        .then(function () {
          ADMIN.brands = ADMIN.brands.filter(function (b) { return b !== 이름; });
          return 쓰기("/meta/current", { version: new Date().toISOString(), brands: ADMIN.brands, count: 0 });
        })
        .then(버전올리기).then(불러오기)
        .then(function () { toast(이름 + " 을(를) 지웠습니다."); });
      return;
    }

    if (e.target.closest("#bnew")) {
      var 새이름 = (prompt("추가할 제조사 이름을 적어 주세요.") || "").trim();
      if (!새이름) return;
      if (ADMIN.brands.indexOf(새이름) !== -1) { toast("이미 있는 제조사입니다."); return; }
      ADMIN.brands.push(새이름);
      쓰기("/meta/current", { version: new Date().toISOString(), brands: ADMIN.brands, count: 0 })
        .then(버전올리기).then(불러오기)
        .then(function () { toast(새이름 + " 을(를) 추가했습니다."); });
      return;
    }

    var 칸 = e.target.closest(".bcard[data-brand]");
    if (칸 && !e.target.closest(".bc-no")) { 고른제조사 = 칸.dataset.brand; picker.click(); }
  });

  /* 순서 바꾸기 */
  $("#bgrid").addEventListener("change", function (e) {
    var inp = e.target.closest(".bc-no");
    if (!inp) return;
    var v = parseInt(String(inp.value).replace(/[^\d]/g, ""), 10);
    if (isNaN(v)) { 그리기(); return; }
    var 이름 = inp.dataset.no;
    var 지금자리 = ADMIN.brands.indexOf(이름);
    var 갈자리 = Math.max(1, Math.min(ADMIN.brands.length, v)) - 1;
    if (지금자리 < 0 || 지금자리 === 갈자리) { 그리기(); return; }
    ADMIN.brands.splice(갈자리, 0, ADMIN.brands.splice(지금자리, 1)[0]);
    쓰기("/meta/current", { version: new Date().toISOString(), brands: ADMIN.brands, count: 0 })
      .then(버전올리기).then(불러오기);
  });

  /* 끌어다 놓기 */
  ["dragenter", "dragover"].forEach(function (ev) {
    $("#bgrid").addEventListener(ev, function (e) {
      var 칸 = e.target.closest(".bcard[data-brand]");
      if (!칸) return;
      e.preventDefault(); 칸.classList.add("over");
    });
  });
  $("#bgrid").addEventListener("dragleave", function (e) {
    var 칸 = e.target.closest(".bcard[data-brand]");
    if (칸) 칸.classList.remove("over");
  });
  $("#bgrid").addEventListener("drop", function (e) {
    var 칸 = e.target.closest(".bcard[data-brand]");
    if (!칸) return;
    e.preventDefault(); 칸.classList.remove("over");
    var f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) 올리기(칸.dataset.brand, f);
  });

  /* ── 되돌리기 · 기록 지우기 ────────────────────────────── */
  $("#hrows").addEventListener("click", function (e) {
    var 되돌 = e.target.closest("[data-roll]");
    if (되돌) {
      var id = 되돌.dataset.roll;
      var h = ADMIN.history.filter(function (x) { return x._id === id; })[0];
      if (!h) return;
      if (!h.backup) { toast("되돌릴 자료가 남아 있지 않습니다."); return; }
      if (!confirm("이 업로드 전으로 되돌릴까요?")) return;
      var 옛 = [];
      try { 옛 = JSON.parse(h.backup); } catch (err) { toast("백업을 읽지 못했습니다."); return; }
      쓰기("/prices/" + encodeURIComponent(h.brand), { json: h.backup, n: 옛.length })
        .then(function () { return 쓰기("/uploads/" + id, { brand: h.brand, filename: h.filename, n: h.n, at: h.at, backup: h.backup, restored: true }); })
        .then(버전올리기).then(불러오기)
        .then(function () { toast(h.brand + " 가격표를 되돌렸습니다."); });
      return;
    }

    var 지움 = e.target.closest("[data-updel]");
    if (!지움) return;
    if (!confirm("이 기록을 지울까요?\n지우면 이 시점으로 되돌릴 수 없습니다.\n(사이트에 올라간 가격은 그대로 남습니다)")) return;
    지우기("/uploads/" + 지움.dataset.updel).then(불러오기)
      .then(function () { toast("기록을 지웠습니다."); });
  });

  /* ── 비밀번호 변경 ─────────────────────────────────────── */
  $("#btn-pw").addEventListener("click", function () {
    var 새것 = (prompt("새 비밀번호를 적어 주세요. (6자 이상)") || "").trim();
    if (!새것) return;
    if (새것.length < 6) { toast("6자 이상으로 정해 주세요."); return; }
    fetch("https://identitytoolkit.googleapis.com/v1/accounts:update?key=" + FB.apiKey, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: 토큰, password: 새것, returnSecureToken: true })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) { toast("바꾸지 못했습니다. 다시 로그인한 뒤 해보세요."); return; }
        토큰 = res.j.idToken;
        sessionStorage.setItem("관리자열쇠", 토큰);
        toast("비밀번호를 바꿨습니다.");
      });
  });

})();
