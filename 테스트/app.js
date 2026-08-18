/* ============================================================
   타이어공장도가격 — 테스트용 (인터넷/서버 없이 이 컴퓨터에서만 동작)
   자료는 브라우저 저장소에 남습니다. 창을 닫아도 그대로 있습니다.
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
  var PW = "1234";
  var PER = 30;

  /* 우리 시각으로 "2026-08-18 14:22" 만들기 */
  function nowStr() {
    var d = new Date();
    var p = function (n) { return n < 10 ? "0" + n : "" + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
           " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

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
     저장소 — 브라우저 안에 보관
     ============================================================ */
  var K_ROWS = "tfp_rows", K_UP = "tfp_uploads", K_BRANDS = "tfp_brands", K_FILES = "tfp_files", K_SEQ = "tfp_seq";
  var DEFAULT_BRANDS = ["한국", "금호", "넥센", "미쉐린", "콘티넨탈", "브리지스톤", "피렐리", "던롭", "굿이어", "요코하마"];
  var KEEP_HISTORY = 30;                 // 최근 올린 파일 기록을 몇 개까지 남길지

  /* files : 제조사 → 지금 적용 중인 업로드 번호 (파일보관함) */
  var DB = { rows: [], uploads: [], brands: DEFAULT_BRANDS.slice(), files: {}, seq: 1 };

  /* 저장할 때는 배열로 줄여서 넣는다 (10,000행 기준 1,445KB → 605KB) */
  var F = ["brand", "model", "product", "size", "spec", "season", "price", "updated"];
  function packRows(rows) {
    return rows.map(function (r) {
      return [r.brand, r.model, r.product, r.size, r.spec, r.season, r.price, r.updated];
    });
  }
  function unpackRows(arr) {
    if (!arr.length) return [];
    if (!Array.isArray(arr[0])) return arr;          // 예전 방식으로 저장된 것
    return arr.map(function (a) {
      var o = {};
      for (var i = 0; i < F.length; i++) o[F[i]] = a[i];
      return o;
    });
  }

  function loadDB() {
    try {
      var r = localStorage.getItem(K_ROWS);
      var u = localStorage.getItem(K_UP);
      var b = localStorage.getItem(K_BRANDS);
      var f = localStorage.getItem(K_FILES);
      var s = localStorage.getItem(K_SEQ);
      if (r) DB.rows = unpackRows(JSON.parse(r));
      if (u) DB.uploads = JSON.parse(u);
      if (b) DB.brands = JSON.parse(b);
      if (f) DB.files = JSON.parse(f);
      if (s) DB.seq = parseInt(s, 10) || 1;

      // 예전 방식으로 저장된 기록에 번호를 붙여준다
      DB.uploads.forEach(function (x) { if (!x.id) x.id = DB.seq++; });
    } catch (e) { /* 저장된 게 깨졌으면 그냥 빈 상태로 */ }
  }

  function uploadById(id) {
    for (var i = 0; i < DB.uploads.length; i++) if (DB.uploads[i].id === id) return DB.uploads[i];
    return null;
  }

  /* 저장 공간이 모자라면 보관함이 안 쓰는 원본부터 버린다 (기록 자체는 남는다) */
  function dropOldestBlob() {
    var keep = {};
    Object.keys(DB.files).forEach(function (b) { keep[DB.files[b]] = 1; });
    for (var i = DB.uploads.length - 1; i >= 0; i--) {
      if (DB.uploads[i].data && !keep[DB.uploads[i].id]) { DB.uploads[i].data = null; return true; }
    }
    return false;
  }

  function saveDB() {
    for (var tries = 0; tries < 40; tries++) {
      try {
        localStorage.setItem(K_ROWS, JSON.stringify(packRows(DB.rows)));
        localStorage.setItem(K_UP, JSON.stringify(DB.uploads));
        localStorage.setItem(K_BRANDS, JSON.stringify(DB.brands));
        localStorage.setItem(K_FILES, JSON.stringify(DB.files));
        localStorage.setItem(K_SEQ, String(DB.seq));
        return true;
      } catch (e) {
        if (!dropOldestBlob()) {
          toast("브라우저 저장 공간(약 5MB)이 꽉 찼습니다. 제조사를 줄이거나 실제 서버에서 쓰세요.");
          return false;
        }
      }
    }
    return false;
  }

  function fileToDataUrl(file) {
    return new Promise(function (res) {
      if (file.size > 3 * 1024 * 1024) return res(null);   // 3MB 넘으면 원본은 보관하지 않는다
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = function () { res(null); };
      fr.readAsDataURL(file);
    });
  }

  function saveBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  /** 지금 적용 중인 내용을 엑셀에서 열리는 CSV 로 만든다 */
  function rowsToCsv(rows) {
    var q = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
    var out = ["제조사,모델,제품명,규격,계절,공장도가"];
    rows.forEach(function (r) {
      out.push([r.brand, r.model, r.product, (r.size + " " + r.spec).trim(), r.season, r.price].map(q).join(","));
    });
    // 앞의 BOM 이 있어야 엑셀에서 한글이 안 깨진다
    return new Blob(["﻿" + out.join("\r\n")], { type: "text/csv;charset=utf-8" });
  }

  function downloadUpload(u) {
    if (!u) return;

    if (u.data) {
      // 올렸던 원본 파일 그대로
      var parts = String(u.data).split(",");
      var mime = (parts[0].match(/:(.*?);/) || [, "application/octet-stream"])[1];
      var bin = atob(parts[1] || "");
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      saveBlob(new Blob([arr], { type: mime }), u.file);
      return;
    }

    // 원본이 안 남아 있으면 지금 적용 중인 내용을 대신 내려준다
    var rows = DB.rows.filter(function (r) { return r.brand === u.brand; });
    if (!rows.length) { toast("내려받을 내용이 없습니다."); return; }
    saveBlob(rowsToCsv(rows), u.brand + "_현재가격표.csv");
    toast("원본 파일이 안 남아 있어 현재 적용 중인 내용을 CSV로 내려받습니다.");
  }

  /* ============================================================
     엑셀(.xlsx) / CSV 읽기 — 설치할 것 없이 브라우저 기능만 사용
     xlsx 는 zip 안에 XML 이 들어있는 구조다.
     ============================================================ */
  function u16(b, p) { return b[p] | (b[p + 1] << 8); }
  function u32(b, p) { return (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0; }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("이 브라우저는 엑셀 압축을 풀지 못합니다. 크롬이나 엣지로 열어주세요. (또는 CSV로 저장해서 올려주세요)");
    }
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    var buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  /** zip 안의 파일들을 꺼낸다 → { '경로': Uint8Array } */
  async function unzip(bytes) {
    // 뒤에서부터 중앙목록 위치를 찾는다
    var eocd = -1;
    for (var i = bytes.length - 22; i >= 0 && i > bytes.length - 66000; i--) {
      if (u32(bytes, i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("엑셀 파일 형식이 아닙니다.");

    var count = u16(bytes, eocd + 10);
    var cdPos = u32(bytes, eocd + 16);
    var out = {};

    for (var n = 0; n < count; n++) {
      if (u32(bytes, cdPos) !== 0x02014b50) break;
      var method  = u16(bytes, cdPos + 10);
      var compSz  = u32(bytes, cdPos + 20);
      var nameLen = u16(bytes, cdPos + 28);
      var extraLen= u16(bytes, cdPos + 30);
      var cmtLen  = u16(bytes, cdPos + 32);
      var lhPos   = u32(bytes, cdPos + 42);
      var name    = new TextDecoder("utf-8").decode(bytes.subarray(cdPos + 46, cdPos + 46 + nameLen));

      // 필요한 파일만 푼다
      if (name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(name) || name === "xl/workbook.xml") {
        var lhNameLen  = u16(bytes, lhPos + 26);
        var lhExtraLen = u16(bytes, lhPos + 28);
        var start = lhPos + 30 + lhNameLen + lhExtraLen;
        var raw = bytes.subarray(start, start + compSz);
        out[name] = method === 0 ? raw : await inflateRaw(raw);
      }
      cdPos += 46 + nameLen + extraLen + cmtLen;
    }
    return out;
  }

  function colIndex(ref) {
    var n = 0;
    for (var i = 0; i < ref.length; i++) {
      var c = ref.charCodeAt(i);
      if (c < 65 || c > 90) break;
      n = n * 26 + (c - 64);
    }
    return n - 1;
  }

  async function readXlsx(file) {
    var bytes = new Uint8Array(await file.arrayBuffer());
    var files = await unzip(bytes);
    var dec = new TextDecoder("utf-8");
    var parser = new DOMParser();

    var shared = [];
    if (files["xl/sharedStrings.xml"]) {
      var sdoc = parser.parseFromString(dec.decode(files["xl/sharedStrings.xml"]), "application/xml");
      var sis = sdoc.getElementsByTagName("si");
      for (var i = 0; i < sis.length; i++) {
        // rPh(발음 표기)는 빼고 t 만 모은다
        var ts = sis[i].getElementsByTagName("t");
        var txt = "";
        for (var j = 0; j < ts.length; j++) {
          if (ts[j].parentNode && ts[j].parentNode.nodeName === "rPh") continue;
          txt += ts[j].textContent;
        }
        shared.push(txt);
      }
    }

    var sheetName = Object.keys(files).filter(function (n) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(n); }).sort()[0];
    if (!sheetName) throw new Error("엑셀 안에서 시트를 찾지 못했습니다.");

    var doc = parser.parseFromString(dec.decode(files[sheetName]), "application/xml");
    var rowsEl = doc.getElementsByTagName("row");
    var rows = [];

    for (var r = 0; r < rowsEl.length; r++) {
      var cs = rowsEl[r].getElementsByTagName("c");
      var line = [], max = -1;
      for (var c = 0; c < cs.length; c++) {
        var cell = cs[c];
        var ref = cell.getAttribute("r") || "";
        var idx = ref ? colIndex(ref) : c;
        var t = cell.getAttribute("t");
        var val = "";
        if (t === "s") {
          var vEl = cell.getElementsByTagName("v")[0];
          val = vEl ? (shared[parseInt(vEl.textContent, 10)] || "") : "";
        } else if (t === "inlineStr") {
          val = cell.textContent;
        } else {
          var v2 = cell.getElementsByTagName("v")[0];
          val = v2 ? v2.textContent : "";
        }
        line[idx] = String(val).trim();
        if (idx > max) max = idx;
      }
      var full = [];
      for (var k = 0; k <= max; k++) full.push(line[k] === undefined ? "" : line[k]);
      rows.push(full);
    }
    return rows;
  }

  async function readCsv(file) {
    var buf = new Uint8Array(await file.arrayBuffer());
    var text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    } catch (e) {
      text = new TextDecoder("euc-kr").decode(buf);   // 한글 엑셀 CSV
    }
    text = text.replace(/^﻿/, "");

    var rows = [], row = [], cur = "", inQ = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ",") { row.push(cur.trim()); cur = ""; }
      else if (ch === "\n") { row.push(cur.trim()); rows.push(row); row = []; cur = ""; }
      else if (ch !== "\r") cur += ch;
    }
    if (cur !== "" || row.length) { row.push(cur.trim()); rows.push(row); }
    return rows;
  }

  function readTable(file) {
    var ext = (file.name.split(".").pop() || "").toLowerCase();
    if (ext === "csv" || ext === "txt") return readCsv(file);
    if (ext === "xlsx") return readXlsx(file);
    if (ext === "xls") return Promise.reject(new Error('구형 .xls 는 읽을 수 없습니다. 엑셀에서 "다른 이름으로 저장 → .xlsx" 로 바꿔서 올려주세요.'));
    return Promise.reject(new Error("xlsx 또는 csv 파일만 올릴 수 있습니다."));
  }

  /* ============================================================
     표에서 어느 칸이 무엇인지 알아내기
     ============================================================ */
  var ALIASES = [
    ["brand",   ["제조사", "브랜드", "메이커", "회사", "brand", "maker"]],
    ["model",   ["모델", "모델명", "패턴", "패턴명", "제품코드", "품번", "model", "pattern"]],
    ["product", ["제품명", "상품명", "품명", "제품", "product", "name"]],
    ["size",    ["규격", "사이즈", "타이어규격", "표준규격", "size"]],
    ["season",  ["계절", "시즌", "용도", "season"]],
    ["price",   ["공장도가", "공장도가격", "공장도", "매입가", "단가", "원가", "납품가", "가격", "price", "cost"]],
    ["extra",   ["하중지수", "속도기호", "부가기호", "기타"]]
  ];
  function normHead(s) {
    return String(s).replace(/\s+/g, "").replace(/[()\[\]_\-./]/g, "").toLowerCase();
  }

  function detectColumns(rows) {
    var limit = Math.min(rows.length, 15);
    for (var r = 0; r < limit; r++) {
      var cells = {};
      for (var i = 0; i < rows[r].length; i++) {
        var h = normHead(rows[r][i]);
        if (h) cells[i] = h;
      }
      var map = {}, used = {};

      // 1차 — 제목이 정확히 같은 것부터
      Object.keys(cells).forEach(function (i) {
        for (var a = 0; a < ALIASES.length; a++) {
          var key = ALIASES[a][0];
          if (map[key] !== undefined) continue;
          for (var w = 0; w < ALIASES[a][1].length; w++) {
            if (cells[i] === normHead(ALIASES[a][1][w])) { map[key] = +i; used[i] = 1; return; }
          }
        }
      });
      // 2차 — 제목에 그 말이 들어있는 것
      Object.keys(cells).forEach(function (i) {
        if (used[i]) return;
        for (var a = 0; a < ALIASES.length; a++) {
          var key = ALIASES[a][0];
          if (map[key] !== undefined) continue;
          for (var w = 0; w < ALIASES[a][1].length; w++) {
            if (cells[i].indexOf(normHead(ALIASES[a][1][w])) !== -1) { map[key] = +i; used[i] = 1; return; }
          }
        }
      });

      if (map.size !== undefined && map.price !== undefined) return { head: r, map: map };
    }
    return null;
  }

  /** "225/45R18 95Y XL" → { size:'225/45R18', spec:'95Y XL' } */
  function splitSize(raw) {
    var s = String(raw).trim().replace(/\s+/g, " ");
    if (!s) return null;
    var m = s.match(/(\d{2,3})\s*[/\-]\s*(\d{2,3})\s*(?:Z?R|[/\-])\s*(\d{2}(?:\.\d)?)/i);
    if (!m) return null;
    var w = +m[1], a = +m[2], inch = parseInt(m[3], 10);
    if (w < 100 || w > 400 || a < 20 || a > 95 || inch < 10 || inch > 30) return null;
    var rest = s.replace(m[0], "").trim().replace(/^[\s,·-]+|[\s,·-]+$/g, "");
    return { size: w + "/" + a + "R" + inch, spec: rest.slice(0, 40) };
  }

  function cleanPrice(raw) {
    var s = String(raw).replace(/[^\d.]/g, "");
    if (!s || s === ".") return null;
    var n = Math.round(parseFloat(s));
    return n > 0 ? n : null;
  }

  function cleanSeason(raw) {
    var s = String(raw).replace(/\s+/g, "");
    if (!s) return "";
    if (s.indexOf("사계") >= 0 || s.indexOf("올시즌") >= 0) return "사계절";
    if (s.indexOf("여름") >= 0 || s.indexOf("썸머") >= 0) return "여름";
    if (s.indexOf("겨울") >= 0 || s.indexOf("윈터") >= 0) return "겨울";
    if (s.toLowerCase().indexOf("suv") >= 0) return "SUV";
    return s.slice(0, 20);
  }

  function parseRows(rows, defaultBrand) {
    var found = detectColumns(rows);
    if (!found) throw new Error('제목 줄을 찾지 못했습니다. 표 맨 윗줄에 "규격", "공장도가" 같은 제목이 있어야 합니다.');

    var map = found.map, items = [], skipped = [], seen = {};
    var now = nowStr();

    for (var r = found.head + 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || !row.length) continue;
      var get = function (k) { return map[k] === undefined ? "" : String(row[map[k]] === undefined ? "" : row[map[k]]).trim(); };

      var sizeRaw = get("size"), priceRaw = get("price");
      if (!sizeRaw && !priceRaw) continue;

      var sz = splitSize(sizeRaw);
      if (!sz) { skipped.push({ line: r + 1, why: "규격을 알아볼 수 없음", value: sizeRaw.slice(0, 30) }); continue; }
      var price = cleanPrice(priceRaw);
      if (price === null) { skipped.push({ line: r + 1, why: "가격이 비었거나 숫자가 아님", value: priceRaw.slice(0, 30) }); continue; }

      var brand = get("brand") || defaultBrand;
      var spec = sz.spec || get("extra").slice(0, 40);
      var key = brand + "|" + get("model") + "|" + sz.size + "|" + spec;
      if (seen[key] !== undefined) { items[seen[key]].price = price; continue; }
      seen[key] = items.length;

      items.push({
        brand: brand.slice(0, 40),
        model: get("model").slice(0, 120),
        product: get("product").slice(0, 120),
        size: sz.size,
        spec: spec,
        season: cleanSeason(get("season")),
        price: price,
        updated: now
      });
    }
    if (!items.length) throw new Error("읽어들일 수 있는 줄이 하나도 없습니다. 규격과 가격 칸을 확인해 주세요.");
    return { items: items, skipped: skipped };
  }

  /* ============================================================
     조회 화면
     ============================================================ */
  var S = { q: "", brands: [], seasons: [], page: 1 };
  var DCMAP = {}, LAST = [];

  function clearDc() { DCMAP = {}; }
  function dcOf(i) { return DCMAP[i] === undefined ? 0 : DCMAP[i]; }
  function salePrice(p, dc) { return Math.round(p * (100 - dc) / 100); }

  function drawFilters() {
    var have = {};
    DB.rows.forEach(function (r) { have[r.brand] = 1; });
    var list = DB.brands.filter(function (b) { return have[b]; });
    Object.keys(have).forEach(function (b) { if (list.indexOf(b) === -1) list.push(b); });

    $("#brandlist").innerHTML = list.length
      ? list.map(function (b) {
          return '<label class="ck"><input type="checkbox" value="' + esc(b) + '"' +
                 (S.brands.indexOf(b) >= 0 ? " checked" : "") + ">" + esc(b) + "</label>";
        }).join("")
      : '<p style="margin:0;font-size:12.5px;color:var(--ink-3)">가격표를 올리면 여기에 나옵니다.</p>';

    var seasons = [];
    DB.rows.forEach(function (r) { if (r.season && seasons.indexOf(r.season) === -1) seasons.push(r.season); });
    var order = ["사계절", "여름", "겨울", "SUV"];
    seasons.sort(function (a, b) { return (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99); });

    $("#season-set").hidden = !seasons.length;
    $("#seasonlist").innerHTML = seasons.map(function (s) {
      return '<label class="ck"><input type="checkbox" value="' + esc(s) + '"' +
             (S.seasons.indexOf(s) >= 0 ? " checked" : "") + ">" + esc(s) + "</label>";
    }).join("");
  }

  function match(r) {
    if (S.brands.length && S.brands.indexOf(r.brand) === -1) return false;
    if (S.seasons.length && S.seasons.indexOf(r.season) === -1) return false;
    if (S.q) {
      var q = S.q.toLowerCase().replace(/[\s/]/g, "");
      var hay = (r.brand + r.model + r.product + r.size + r.spec).toLowerCase().replace(/[\s/]/g, "");
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  function load() {
    var empty = DB.rows.length === 0;
    $("#startbox").hidden = !empty;
    $("#tblwrap").hidden = empty;
    if (empty) { $("#chips").hidden = true; return; }

    var list = DB.rows.filter(match).sort(function (a, b) { return a.price - b.price; });
    var pages = Math.max(1, Math.ceil(list.length / PER));
    if (S.page > pages) S.page = pages;
    LAST = list.slice((S.page - 1) * PER, S.page * PER);

    if (!LAST.length) {
      var msg = '<div class="empty"><b>조건에 맞는 상품이 없습니다.</b>검색어나 제조사를 바꿔 보세요.</div>';
      $("#rows").innerHTML = '<tr><td colspan="8">' + msg + "</td></tr>";
      $("#mrows").innerHTML = msg;
    } else {
      $("#rows").innerHTML = LAST.map(function (r, i) {
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
      }).join("");

      $("#mrows").innerHTML = LAST.map(function (r, i) {
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
      }).join("");
    }

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
    var c = [];
    S.brands.forEach(function (b) { c.push(["brand:" + b, b]); });
    S.seasons.forEach(function (s) { c.push(["season:" + s, s]); });
    if (S.q) c.push(["q", '"' + S.q + '"']);
    var box = $("#chips");
    box.hidden = !c.length;
    box.innerHTML = c.map(function (x) {
      return '<button class="fchip" data-x="' + esc(x[0]) + '">' + esc(x[1]) + "</button>";
    }).join("") + (c.length > 1 ? '<button class="btn btn-quiet btn-sm" data-x="all">전체 해제</button>' : "");
  }

  function applyDc(inp) {
    var box = inp.closest("tr") || inp.closest(".mcard");
    if (!box) return;
    var i = +box.dataset.i, rec = LAST[i];
    if (!rec) return;
    var raw = String(inp.value).replace(/[^\d]/g, "");
    var v = raw === "" ? 0 : parseInt(raw, 10);
    if (v > 95) { v = 95; inp.value = 95; }
    DCMAP[i] = v;
    inp.classList.toggle("set", v > 0);
    var cell = $("[data-sale]", box);
    if (cell) cell.textContent = won(salePrice(rec.price, v));
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
    S.page = 1; clearDc(); load();
  });
  $("#seasonlist").addEventListener("change", function (e) {
    var v = e.target.value;
    if (e.target.checked) S.seasons.push(v);
    else S.seasons = S.seasons.filter(function (x) { return x !== v; });
    S.page = 1; clearDc(); load();
  });

  var qTimer;
  $("#q").addEventListener("input", function () {
    var v = this.value;
    clearTimeout(qTimer);
    qTimer = setTimeout(function () { S.q = v.trim(); S.page = 1; clearDc(); load(); }, 200);
  });

  $("#pager").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-p]");
    if (!b || b.disabled) return;
    S.page = +b.dataset.p; clearDc(); load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  $("#chips").addEventListener("click", function (e) {
    var b = e.target.closest("[data-x]");
    if (!b) return;
    var x = b.dataset.x;
    if (x === "all") { S.q = ""; S.brands = []; S.seasons = []; $("#q").value = ""; }
    else if (x === "q") { S.q = ""; $("#q").value = ""; }
    else if (x.indexOf("brand:") === 0) S.brands = S.brands.filter(function (v) { return v !== x.slice(6); });
    else if (x.indexOf("season:") === 0) S.seasons = S.seasons.filter(function (v) { return v !== x.slice(7); });
    S.page = 1; clearDc(); drawFilters(); load();
  });

  /* ============================================================
     관리자
     ============================================================ */
  var isAdmin = false;
  var veil = $("#lockveil"), pw = $("#lockpw"), err = $("#lockerr");

  function go(view) {
    $("#view-app").hidden = view !== "app";
    $("#view-admin").hidden = view !== "admin";
    $("#testbar").textContent = view === "admin"
      ? "테스트용 관리자 화면 · 엑셀을 올려서 바로 확인해 보세요"
      : "테스트용 화면입니다 · 자료는 이 컴퓨터 안에만 저장됩니다 · 관리자는 왼쪽 위 파란 마크 클릭 (비밀번호 1234)";
    window.scrollTo(0, 0);
  }

  function openLock() {
    if (isAdmin) { go("admin"); drawAdmin(); return; }
    veil.hidden = false; err.hidden = true; pw.value = ""; pw.focus();
  }
  function tryEnter() {
    if (pw.value === PW) { isAdmin = true; veil.hidden = true; go("admin"); drawAdmin(); }
    else { err.textContent = "비밀번호가 맞지 않습니다."; err.hidden = false; pw.value = ""; pw.focus(); }
  }
  $("#mk-admin").addEventListener("click", openLock);
  $("#btn-goadmin").addEventListener("click", openLock);
  $("#lockok").addEventListener("click", tryEnter);
  $("#lockno").addEventListener("click", function () { veil.hidden = true; });
  pw.addEventListener("keydown", function (e) { if (e.key === "Enter") tryEnter(); });
  veil.addEventListener("click", function (e) { if (e.target === veil) veil.hidden = true; });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { veil.hidden = true; $("#resveil").hidden = true; }
  });
  $("#btn-logout").addEventListener("click", function () { go("app"); clearDc(); drawFilters(); load(); });
  $("#resok").addEventListener("click", function () { $("#resveil").hidden = true; });
  $("#resveil").addEventListener("click", function (e) { if (e.target === $("#resveil")) $("#resveil").hidden = true; });

  function daysSince(when) {
    if (!when) return null;
    var t = new Date(when.replace(" ", "T")).getTime();
    if (isNaN(t)) return null;
    return Math.floor((Date.now() - t) / 86400000);
  }
  function statusPill(days) {
    if (days === null) return '<span class="pill none">아직 없음</span>';
    if (days <= 0) return '<span class="pill ok">오늘 갱신</span>';
    if (days <= 7) return '<span class="pill new">' + days + "일 전</span>";
    return '<span class="pill low">' + days + "일 전</span>";
  }

  function drawAdmin() {
    var countOf = {};
    DB.rows.forEach(function (r) { countOf[r.brand] = (countOf[r.brand] || 0) + 1; });

    /* ── 제조사 박스 ── */
    $("#bgrid").innerHTML = DB.brands.map(function (b, i) {
      var cur = uploadById(DB.files[b]);
      return '<div class="bcard" data-brand="' + esc(b) + '">' +
        '<button class="bc-del" data-del="' + esc(b) + '" title="' + esc(b) + ' 삭제" aria-label="' + esc(b) + ' 삭제">✕</button>' +
        '<div class="bc-h">' +
          '<input class="bc-no" type="number" min="1" max="' + DB.brands.length + '" value="' + (i + 1) +
            '" data-no="' + esc(b) + '" title="순서 번호" aria-label="' + esc(b) + ' 순서">' +
          "<b>" + esc(b) + "</b>" + statusPill(cur ? daysSince(cur.when) : null) +
        "</div>" +
        '<div class="bc-file">' + (cur ? esc(cur.file) : "올린 파일 없음") + "</div>" +
        '<div class="bc-when">' + (cur ? esc(cur.when) + " · " + won(countOf[b] || 0) + "건" : "—") + "</div>" +
        '<div class="bdrop"><b>파일 올리기</b><span>끌어다 놓거나 클릭</span></div>' +
      "</div>";
    }).join("") + '<div class="bcard bnew" id="bnew"><span>+</span> 제조사 추가</div>';

    /* ── 파일보관함 : 지금 적용 중인 파일 ── */
    var keepRows = DB.brands.map(function (b) {
      var cur = uploadById(DB.files[b]);
      if (!cur) {
        return "<tr>" +
          '<td style="font-weight:700">' + esc(b) + "</td>" +
          '<td class="fnone" colspan="4">아직 올린 파일 없음</td>' +
        "</tr>";
      }
      return "<tr>" +
        '<td style="font-weight:700">' + esc(b) + "</td>" +
        '<td class="fname">' + esc(cur.file) + "</td>" +
        '<td class="num" style="color:var(--ink-3)">' + esc(cur.when) + "</td>" +
        '<td class="t-r num">' + won(countOf[b] || 0) + "</td>" +
        '<td class="t-c"><button class="btn btn-out btn-sm" data-get="' + cur.id + '"' +
          (cur.data ? "" : ' title="원본이 없어 현재 내용을 CSV로 받습니다"') + ">받기</button></td>" +
      "</tr>";
    }).join("");
    $("#frows").innerHTML = DB.brands.length
      ? keepRows
      : '<tr><td colspan="5" style="text-align:center;color:var(--ink-3);padding:26px">제조사를 먼저 추가해 주세요.</td></tr>';

    /* ── 최근 올린 파일 : 기록 ── */
    $("#hrows").innerHTML = DB.uploads.length
      ? DB.uploads.map(function (u) {
          var isNow = DB.files[u.brand] === u.id;
          return "<tr>" +
            '<td class="num" style="color:var(--ink-3)">' + esc(u.when) + "</td>" +
            '<td style="font-weight:700">' + esc(u.brand) + "</td>" +
            "<td>" + esc(u.file) + (isNow ? ' <span class="pill ok">적용중</span>' : "") + "</td>" +
            '<td class="t-c" style="white-space:nowrap">' +
              '<button class="btn btn-out btn-sm" data-get="' + u.id + '">받기</button> ' +
              (u.restored
                ? '<span class="pill none">되돌림</span>'
                : '<button class="btn btn-out btn-sm" data-roll="' + u.id + '">되돌리기</button>') +
            "</td>" +
          "</tr>";
        }).join("")
      : '<tr><td colspan="4" style="text-align:center;color:var(--ink-3);padding:26px">아직 올린 파일이 없습니다.</td></tr>';
  }

  /** 올린 파일이 기존과 무엇이 다른지 센다 (모델+규격+하중지수 로 같은 품목인지 판단) */
  function compareRows(oldRows, newRows) {
    var key = function (r) { return r.model + "|" + r.size + "|" + r.spec; };
    var old = {};
    oldRows.forEach(function (r) { old[key(r)] = r.price; });

    var added = 0, changed = 0, same = 0, hit = {};
    newRows.forEach(function (r) {
      var k = key(r);
      if (old[k] === undefined) { added++; return; }
      hit[k] = 1;
      if (Number(old[k]) === Number(r.price)) same++;
      else changed++;
    });
    var gone = 0;
    Object.keys(old).forEach(function (k) { if (!hit[k]) gone++; });

    return { added: added, changed: changed, same: same, gone: gone };
  }

  /* 파일 선택창 */
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

  async function doUpload(brand, file) {
    var card = $('.bcard[data-brand="' + brand + '"]');
    var label = card ? $(".bdrop b", card) : null;
    if (label) label.textContent = "읽는 중…";

    try {
      var rows = await readTable(file);
      var res = parseRows(rows, brand);
      var data = await fileToDataUrl(file);

      // 되돌리기용으로 기존 것을 담아둔다
      var backup = DB.rows.filter(function (r) { return r.brand === brand; });
      var diff = compareRows(backup, res.items);
      DB.rows = DB.rows.filter(function (r) { return r.brand !== brand; }).concat(res.items);

      var rec = {
        id: DB.seq++,
        brand: brand,
        file: file.name,
        count: res.items.length,
        when: nowStr(),
        data: data,                       // 원본 파일 (다시 받기용)
        backup: backup,
        prevFile: DB.files[brand] || null, // 되돌릴 때 보관함도 같이 되돌린다
        restored: 0
      };
      DB.uploads.unshift(rec);
      DB.files[brand] = rec.id;

      // 기록은 최근 것만 남긴다 (보관함이 쓰는 것은 지우지 않는다)
      if (DB.uploads.length > KEEP_HISTORY) {
        var keep = {};
        Object.keys(DB.files).forEach(function (b) { keep[DB.files[b]] = 1; });
        DB.uploads = DB.uploads.filter(function (u, i) { return i < KEEP_HISTORY || keep[u.id]; });
      }
      if (DB.brands.indexOf(brand) === -1) DB.brands.push(brand);
      saveDB();

      var html = "<b>" + esc(brand) + "</b> 가격표를 <b>" + won(res.items.length) + "건</b> 저장했습니다.";

      // 어제 것과 무엇이 달라졌는지
      html += '<div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">' +
        '<span class="pill new">새 품목 ' + won(diff.added) + "</span>" +
        '<span class="pill up">가격 변경 ' + won(diff.changed) + "</span>" +
        '<span class="pill none">그대로 ' + won(diff.same) + "</span>" +
        (diff.gone ? '<span class="pill low">없어짐 ' + won(diff.gone) + "</span>" : "") +
        "</div>";
      if (diff.gone) {
        html += '<div style="margin-top:10px;padding:10px 12px;background:var(--warn-soft);border-radius:9px;font-size:12.5px;color:var(--warn);font-weight:700">' +
          "이 파일에 없는 " + won(diff.gone) + "건은 사이트에서 내려갑니다.<br>" +
          "품목 전체가 들어있는 파일이 맞는지 확인하세요. 잘못 올렸으면 <b>되돌리기</b>로 복구됩니다.</div>";
      }

      var sample = res.items[0];
      if (sample) {
        html += '<div style="margin-top:12px;padding:10px 12px;background:var(--panel-2);border:1px solid var(--line);border-radius:9px;font-size:12.5px">' +
          "<b>첫 줄 확인</b><br>" +
          "제조사 " + esc(sample.brand) + " · 모델 " + esc(sample.model || "(없음)") +
          " · 제품명 " + esc(sample.product || "(없음)") + "<br>" +
          "규격 " + esc(sample.size) + " " + esc(sample.spec) +
          " · 계절 " + esc(sample.season || "(없음)") +
          " · 공장도가 " + won(sample.price) + "원</div>";
      }
      if (res.skipped.length) {
        html += "<br><b style='color:var(--warn)'>넘어간 줄 " + res.skipped.length + "개</b><br>" +
          res.skipped.slice(0, 8).map(function (s) {
            return "· " + s.line + "번째 줄 — " + esc(s.why) + (s.value ? " (" + esc(s.value) + ")" : "");
          }).join("<br>");
        if (res.skipped.length > 8) html += "<br>· 외 " + (res.skipped.length - 8) + "줄";
      }
      showResult("업로드 완료", html);
    } catch (e) {
      showResult("올리지 못했습니다", '<b style="color:var(--price)">' + esc(e.message || e) + "</b>");
    }
    drawAdmin();
    drawFilters();
  }

  function addBrand() {
    var name = prompt("추가할 제조사 이름");
    if (!name) return;
    name = name.trim();
    if (!name) return;
    if (DB.brands.indexOf(name) !== -1) { toast("이미 있는 제조사입니다."); return; }
    DB.brands.push(name);
    saveDB(); drawAdmin();
    toast(name + " 을(를) 추가했습니다.");
  }

  function delBrand(name) {
    var n = DB.rows.filter(function (r) { return r.brand === name; }).length;
    var msg = n
      ? name + " 을(를) 지웁니다.\n등록된 " + won(n) + "건도 함께 지워집니다. 계속할까요?"
      : name + " 을(를) 지울까요?";
    if (!confirm(msg)) return;
    DB.brands = DB.brands.filter(function (b) { return b !== name; });
    DB.rows = DB.rows.filter(function (r) { return r.brand !== name; });
    delete DB.files[name];
    saveDB(); drawAdmin(); drawFilters();
    toast(name + " 을(를) 지웠습니다.");
  }

  $("#bgrid").addEventListener("click", function (e) {
    var del = e.target.closest("[data-del]");
    if (del) { e.stopPropagation(); delBrand(del.dataset.del); return; }

    if (e.target.closest("#bnew")) { addBrand(); return; }
    if (e.target.closest(".bc-no")) return;        // 순서 번호칸은 파일 선택창을 열지 않는다

    var card = e.target.closest(".bcard");
    if (!card || !card.dataset.brand) return;
    pickBrand = card.dataset.brand;
    picker.click();
  });
  /* ---------- 순서 번호로 자리 옮기기 ---------- */
  function moveBrandTo(name, pos) {
    var from = DB.brands.indexOf(name);
    if (from < 0) return;
    var to = Math.max(1, Math.min(DB.brands.length, pos)) - 1;   // 1번부터 시작
    if (to === from) { drawAdmin(); return; }

    DB.brands.splice(from, 1);
    DB.brands.splice(to, 0, name);
    saveDB(); drawAdmin(); drawFilters();
    toast(name + " → " + (to + 1) + "번");
  }

  $("#bgrid").addEventListener("change", function (e) {
    var inp = e.target.closest(".bc-no");
    if (!inp) return;
    var v = parseInt(String(inp.value).replace(/[^\d]/g, ""), 10);
    if (isNaN(v)) { drawAdmin(); return; }
    moveBrandTo(inp.dataset.no, v);
  });
  // Enter 를 누르면 바로 적용되게
  $("#bgrid").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.closest(".bc-no")) { e.preventDefault(); e.target.blur(); }
  });

  /* ---------- 파일을 끌어다 놓기 ---------- */
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

  /* 보관함·기록 양쪽에서 "받기"와 "되돌리기"를 받는다 */
  function tableClick(e) {
    var get = e.target.closest("[data-get]");
    if (get) { downloadUpload(uploadById(+get.dataset.get)); return; }

    var roll = e.target.closest("[data-roll]");
    if (!roll) return;
    var u = uploadById(+roll.dataset.roll);
    if (!u || u.restored) return;
    if (!confirm(u.brand + " 을(를) 이 업로드 전으로 되돌릴까요?")) return;

    DB.rows = DB.rows.filter(function (r) { return r.brand !== u.brand; }).concat(u.backup || []);
    if (DB.files[u.brand] === u.id) {
      if (u.prevFile) DB.files[u.brand] = u.prevFile;
      else delete DB.files[u.brand];
    }
    u.restored = 1;
    saveDB();
    drawAdmin(); drawFilters();
    toast(u.brand + " 가격표를 되돌렸습니다.");
  }
  $("#hrows").addEventListener("click", tableClick);
  $("#frows").addEventListener("click", tableClick);

  /* ---------- 예시 자료 ---------- */
  $("#btn-sample").addEventListener("click", function () {
    DB.rows = makeSample();
    DB.uploads = [];
    DB.files = {};
    saveDB();
    S.brands = []; S.seasons = []; S.q = ""; S.page = 1; clearDc();
    $("#q").value = "";
    drawFilters(); load();
    toast("예시 자료를 넣었습니다. 관리자에서 '전체 지우기'로 지울 수 있습니다.");
  });

  function makeSample() {
    var CAT = [
      ["한국", [["엔페라", ""], ["벤투스", "S1 에보3 K127"], ["벤투스", "프라임4 K135"], ["키너지", "GT H436"], ["다이나프로", "HP2 RA33"]], 1.00],
      ["금호", [["마제스티9", "솔루스 TA91"], ["엑스타", "PS71"], ["크루젠", "HP71"], ["솔루스", "TA51"]], 0.94],
      ["넥센", [["엔페라", "슈프림"], ["엔페라", "AU7"], ["로디안", "GTX"], ["엔블루", "4시즌"]], 0.89],
      ["미쉐린", [["파일럿 스포츠", "5"], ["프라이머시", "4 ST"], ["크로스클라이밋", "2"], ["라티튜드", "스포츠3"]], 1.46],
      ["콘티넨탈", [["UltraContact", "UC7"], ["PremiumContact", "6"], ["SportContact", "7"]], 1.34],
      ["브리지스톤", [["투란자", "T005A"], ["포텐자", "S007A"], ["알렌자", "001"]], 1.30],
      ["피렐리", [["P ZERO", "PZ4"], ["친투라토", "P7"], ["스콜피온", "베르데"]], 1.38],
      ["던롭", [["SP 스포츠맥스", "050+"], ["그란트렉", "PT3"]], 1.12],
      ["굿이어", [["이글 F1", "아시메트릭6"], ["어슈어런스", "듀라플러스"]], 1.18],
      ["요코하마", [["ADVAN Sport", "V107"], ["BluEarth-GT", "AE51"]], 1.15]
    ];
    var SZ = [
      ["185", "65", "15", "88H", "사계절"], ["195", "65", "15", "91H", "사계절"],
      ["205", "55", "16", "91V", "사계절"], ["215", "55", "17", "94V", "여름"],
      ["225", "45", "18", "95Y XL", "여름"], ["225", "60", "17", "99V", "SUV"],
      ["235", "45", "18", "98W XL", "여름"], ["235", "55", "18", "100V", "SUV"],
      ["245", "40", "19", "98Y XL", "여름"], ["245", "45", "18", "100Y XL", "여름"],
      ["255", "50", "19", "107W XL", "SUV"], ["265", "60", "18", "110V", "SUV"],
      ["275", "40", "20", "106Y XL", "여름"]
    ];
    var seed = 20260818;
    function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }

    var out = [], now = nowStr();
    CAT.forEach(function (mk) {
      mk[1].forEach(function (p) {
        SZ.forEach(function (s) {
          if (rnd() > 0.55) return;
          var base = (+s[2] - 13) * 11800 + (+s[0] - 180) * 210 + 46000;
          out.push({
            brand: mk[0], product: p[0], model: p[1] || p[0],
            size: s[0] + "/" + s[1] + "R" + s[2], spec: s[3], season: s[4],
            price: Math.round(base * mk[2] * (0.9 + rnd() * 0.24) / 500) * 500,
            updated: now
          });
        });
      });
    });
    return out;
  }

  /* ---------- 시작 ---------- */
  loadDB();
  drawFilters();
  load();
})();

