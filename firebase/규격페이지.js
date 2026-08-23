/* ============================================================
   규격별 페이지 만들기

   왜 만드나
     홈 한 장으로는 「타이어공장도가격」 이라는 검색어 하나밖에 못 잡는다.
     사람들은 자기 규격(245/45R18 공장도가)으로 훨씬 많이 검색한다.
     규격마다 페이지를 두면 잡을 수 있는 검색어가 수백 개로 늘어난다.

   언제 돌리나
     ★ 가격표를 새로 올린 뒤에는 반드시 돌린다. 안 돌리면 옛 가격이 남는다.
       cd firebase && node 규격페이지.js && node 버전찍기.js && firebase deploy --only hosting

   주소 모양 — 폴더식이다 (public/245-45-18/index.html → /245-45-18)
     cleanUrls 를 쓰면 안 된다. 그것을 켜면 .html 주소가 전부 301 로 튕기는데
     네이버·구글 소유확인 파일이 .html 주소라 인증이 풀린다. 실제로 시험해서 확인했다.
     대신 firebase.json 의 trailingSlash:false 가 /245-45-18 을 슬래시 없이 열어 준다.

   얇은 페이지는 검색엔진에 안 내민다
     품목이 1개뿐인 규격은 내용이 없다시피 해서, 그런 걸 수십 장 색인시키면
     「빈 페이지를 찍어내는 사이트」로 감점당한다. 만들되 noindex 를 달고
     사이트맵에서 뺀다. 손님이 링크로 들어오면 정상으로 보인다.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");

const 여기 = __dirname;
const OUT = path.join(여기, "public");
const 대표 = "https://tireprice.web.app";
const 색인최소품목 = 2;                      // 이 수 미만이면 noindex

const won = (n) => Number(n).toLocaleString("ko-KR");
const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* 245/45R18 → 245-45-18 */
const 슬러그 = (s) => s.replace(/\//g, "-").replace(/R/i, "-").replace(/-+/g, "-");

/* ============================================================
   가격표 읽기 — 관리자 화면이 넣어 둔 Firestore 를 그대로 읽는다.
   로그인 없이 읽히는 자료라(firestore.rules) 열쇠가 필요 없다.
   ============================================================ */
async function 가격표() {
  const base =
    "https://firestore.googleapis.com/v1/projects/tireprice-g/databases/(default)/documents";

  const meta = await (await fetch(base + "/meta/current")).json();
  if (!meta.fields) throw new Error("meta/current 를 못 읽었다");
  const BRANDS = (meta.fields.brands.arrayValue.values || []).map((v) => v.stringValue);

  const j = await (await fetch(base + "/prices?pageSize=50")).json();
  if (j.nextPageToken) throw new Error("제조사가 50개를 넘었다 — 쪽 넘기기를 넣어야 한다");

  const rows = [];
  for (const d of j.documents || []) {
    const 이름 = d.name.split("/").pop();
    let a;
    try { a = JSON.parse(d.fields.json.stringValue); } catch (e) { continue; }
    for (const r of a)
      rows.push({ brand: 이름, model: r[0], product: r[1], size: r[2], spec: r[3], season: r[4], price: r[5] });
  }
  if (!rows.length) throw new Error("가격표가 비었다 — 덮어쓰지 않고 멈춘다");
  return { rows, BRANDS };
}

/* app.js 의 rowHtml 을 그대로 옮긴 것.
   다른 점 하나 — 정적 페이지라 계산의 근거가 카드 안에 있어야 해서 data-price 를 달았다.
   ⚠ app.js 의 카드 모양을 고치면 이쪽도 같이 고쳐야 한다. */
function 카드(r, i) {
  return '<div class="pcard" data-i="' + i + '" data-price="' + r.price + '">' +
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
      '<div class="col qty"><span class="dccell">' +
        '<input class="dcinp qtyinp num" type="number" min="0" max="999" value="" aria-label="수량">' +
        '<span class="pc">개</span></span></div>' +
      '<div class="col dcc"><span class="dccell">' +
        '<input class="dcinp num" type="number" min="0" max="95" value="" aria-label="DC율">' +
        '<span class="pc">%</span></span></div>' +
      '<div class="col sal"><span class="c-sale num" data-sale>' + won(r.price) + "</span>" +
        '<span class="unit" data-unit>&nbsp;</span>' +
        '<span class="lb" data-lb>할인가 (원)</span></div>' +
    "</div>" +
  "</div>";
}

/* assets 는 1년 캐시라 번호표가 없으면 고쳐도 반영이 안 된다.
   버전찍기.js 와 같은 규칙(크기-수정시각)으로 여기서도 붙인다 */
function 번호표(자산길) {
  const s = fs.statSync(path.join(OUT, 자산길.replace(/^\//, "")));
  return "?v=" + s.size + "-" + Math.floor(s.mtimeMs / 1000);
}
const CSS번호 = 번호표("/assets/style.css");

const 머리 = (제목, 설명, 주소, 색인) => `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${제목}</title>
<meta name="description" content="${설명}">${색인 ? "" : '\n<meta name="robots" content="noindex,follow">'}
<link rel="canonical" href="${대표}${주소}">
<meta property="og:url" content="${대표}${주소}">
<meta property="og:type" content="website">
<meta property="og:title" content="${제목}">
<meta property="og:description" content="${설명}">
<meta property="og:site_name" content="타이어 공장도가격 - G">
<link rel="icon" type="image/svg+xml" href="/assets/icon.svg">
<link rel="apple-touch-icon" href="/assets/icon-192.png">
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#2e7df6">
<link rel="stylesheet" href="/assets/style.css${CSS번호}">
<style>
  /* 규격 페이지에만 쓰는 것 — 기존 화면 규칙은 건드리지 않는다 */
  .sizelead{margin:2px 0 14px;color:var(--ink-2);font-size:14px;line-height:1.7}
  .sizelead b{color:var(--ink-1)}
  .nearby{margin:18px 0 4px;padding-top:16px;border-top:1px solid var(--line)}
  .nearby h2{margin:0 0 10px;font-size:14px;font-weight:800;color:var(--ink-2)}
  .nearby .bchips a{text-decoration:none}
  .inchgrp{margin:0 0 18px}
  .inchgrp h2{margin:0 0 8px;font-size:14px;font-weight:800;color:var(--ink-2)}
</style>
</head>
<body>

<div id="view-app">
  <header class="top">
    <div class="top-in">
      <div class="logo">
        <button class="mk" id="mk-admin" type="button" aria-label="관리자 화면 (두 번 클릭)" title="관리자 화면 — 두 번 클릭"><svg viewBox="0 0 192 192" aria-hidden="true" focusable="false"><rect width="192" height="192" rx="40" fill="currentColor"/><circle cx="96" cy="96" r="62" fill="none" stroke="#fff" stroke-width="21"/><rect x="96" y="87" width="36" height="19" fill="#fff"/></svg></button>
        <a class="txt" href="/">타이어 <b>공장도가격</b> <i>- G</i></a>
      </div>
    </div>
  </header>

  <div class="shell">`;

const 꼬리 = `  </div>

  <footer class="foot">
    <a href="/">규격 검색</a> · <a href="/sizes">전체 규격 목록</a> · <a href="/privacy.html">개인정보처리방침</a>
  </footer>
</div>

<script>
/* 할인율·수량 계산 — app.js 의 applyCalc 과 같은 규칙.
   정적 페이지라 값의 근거를 카드의 data-price 에서 읽는다 */
(function () {
  var won = function (n) { return Number(n).toLocaleString("ko-KR"); };
  var 목록 = document.getElementById("rows");
  if (목록) 목록.addEventListener("input", function (e) {
    var inp = e.target.closest(".dcinp"); if (!inp) return;
    var box = inp.closest(".pcard"); if (!box) return;
    var 수량칸 = inp.classList.contains("qtyinp");
    var raw = String(inp.value).replace(/[^\\d]/g, "");
    var v = raw === "" ? 0 : parseInt(raw, 10);
    var 끝 = 수량칸 ? 999 : 95;
    if (v > 끝) { v = 끝; inp.value = 끝; }
    inp.classList.toggle("set", v > 0);

    var dc = +(box.querySelector(".dcinp:not(.qtyinp)").value || 0);
    var qty = +(box.querySelector(".qtyinp").value || 0);
    box.classList.toggle("on", dc > 0 || qty > 0);

    var unit = Math.round((+box.dataset.price) * (100 - dc) / 100);
    box.querySelector("[data-sale]").textContent = won(qty > 0 ? unit * qty : unit);
    box.querySelector("[data-unit]").innerHTML = qty > 0 ? "단가 " + won(unit) + " 원" : "&nbsp;";
    box.querySelector("[data-lb]").textContent = qty > 0 ? qty + "개 합계 (원)" : "할인가 (원)";
  });

  var 칸 = document.getElementById("q");
  if (칸) {
    var go = function () {
      var q = 칸.value.trim();
      location.href = q ? "/?q=" + encodeURIComponent(q) : "/";
    };
    document.getElementById("qgo").addEventListener("click", go);
    칸.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
  }
  document.getElementById("mk-admin").addEventListener("dblclick", function () { location.href = "/admin.html"; });
})();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").catch(function () {}); });
}
</script>
</body>
</html>
`;

const 검색창 = (안내) => `
    <div class="gsearch">
      <input class="inp" id="q" type="search" placeholder="${안내}" autocomplete="off">
      <button class="qbtn" id="qgo" type="button" aria-label="검색" title="검색">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>
      </button>
    </div>
`;

/* ============================================================
   본작업
   ============================================================ */
(async () => {
  const { rows } = await 가격표();

  /* 규격별로 모은다 */
  const 규격맵 = new Map();
  for (const r of rows) {
    if (!r.size) continue;
    if (!규격맵.has(r.size)) 규격맵.set(r.size, []);
    규격맵.get(r.size).push(r);
  }
  const 규격들 = [...규격맵.keys()];

  /* 인치별로 묶어 둔다 — 이웃 링크와 목록 페이지가 쓴다 */
  const 인치of = (s) => (s.match(/R(\d+)/) || [])[1] || "0";
  const 인치맵 = new Map();
  for (const s of 규격들) {
    const i = 인치of(s);
    if (!인치맵.has(i)) 인치맵.set(i, []);
    인치맵.get(i).push(s);
  }
  for (const [, arr] of 인치맵) arr.sort((a, b) => 규격맵.get(b).length - 규격맵.get(a).length);

  /* ── 유령 페이지 치우기 —— 가격표에서 사라진 규격의 폴더를 지운다 ── */
  const 살릴폴더 = new Set(규격들.map(슬러그));
  살릴폴더.add("sizes");
  let 지운수 = 0;
  for (const 이름 of fs.readdirSync(OUT)) {
    const p = path.join(OUT, 이름);
    if (!fs.statSync(p).isDirectory()) continue;
    if (이름 === "assets" || 이름 === ".well-known") continue;
    if (살릴폴더.has(이름)) continue;
    fs.rmSync(p, { recursive: true, force: true });
    지운수++;
  }

  /* ── 규격 페이지 ── */
  let 색인장수 = 0, 숨긴장수 = 0;
  const 사이트맵줄 = [];

  for (const 규격 of 규격들) {
    const 목록 = 규격맵.get(규격).slice().sort((a, b) => a.price - b.price);
    const 색인 = 목록.length >= 색인최소품목;
    const 주소 = "/" + 슬러그(규격);
    const 최저 = 목록[0], 최고 = 목록[목록.length - 1];
    const 제조사수 = new Set(목록.map((r) => r.brand)).size;
    const 인치 = 인치of(규격);
    const 이웃 = (인치맵.get(인치) || []).filter((s) => s !== 규격).slice(0, 12);

    const 제목 = `${esc(규격)} 타이어 공장도가격 - G · 전 브랜드 할인율 무료 조회`;
    const 설명 = `${esc(규격)} 타이어 공장도가격 ${목록.length}개를 한 번에. 한국·금호·넥센·미쉐린 등 ${제조사수}개 브랜드 공장도가를 무료로 조회하고, 할인율을 넣으면 할인가가 바로 나옵니다.`;

    const 본문 = `
    <h1 class="hero-h">${esc(규격)} 타이어 <b>공장도가격</b></h1>
    <p class="sizelead">
      ${esc(규격)} 규격 타이어 <b>${목록.length}개</b>의 공장도가격입니다.
      ${제조사수}개 브랜드 · 최저 <b>${won(최저.price)}원</b>(${esc(최저.brand)} ${esc(최저.model)}) ~ 최고 <b>${won(최고.price)}원</b>.
      싼 것부터 보여드리며, <b>할인율(%)</b>을 넣으면 할인가가 바로 계산됩니다. 수량을 넣으면 합계로 바뀝니다.
    </p>
${검색창("다른 규격 검색) 2355519")}
    <div class="main">
      <div class="tblwrap">
        <div class="cards" id="rows">
${목록.map(카드).join("\n")}
        </div>
      </div>
${이웃.length ? `
      <div class="nearby">
        <h2>${인치}인치 다른 규격 공장도가격</h2>
        <div class="bchips">
${이웃.map((s) => `          <a class="bchip" href="/${슬러그(s)}">${esc(s)} <span style="opacity:.55">${규격맵.get(s).length}</span></a>`).join("\n")}
        </div>
      </div>` : ""}
    </div>
`;

    const 폴더 = path.join(OUT, 슬러그(규격));
    fs.mkdirSync(폴더, { recursive: true });
    fs.writeFileSync(path.join(폴더, "index.html"), 머리(제목, 설명, 주소, 색인) + 본문 + 꼬리);

    if (색인) { 색인장수++; 사이트맵줄.push(주소); } else 숨긴장수++;
  }

  /* ── 전체 규격 목록 페이지 —— 검색로봇이 여기서 전부 타고 들어간다 ── */
  const 인치차례 = [...인치맵.keys()].sort((a, b) => a - b);
  const 목록본문 = `
    <h1 class="hero-h">타이어 규격별 <b>공장도가격</b> 전체 목록</h1>
    <p class="sizelead">
      가격표에 들어 있는 <b>${규격들.length}개 규격</b>입니다. 규격을 누르면 그 사이즈의
      전 브랜드 공장도가격을 볼 수 있고, 할인율을 넣으면 할인가가 바로 나옵니다.
    </p>
${검색창("규격 검색) 2355519")}
    <div class="main">
${인치차례.map((i) => `      <div class="inchgrp">
        <h2>${i}인치 (${인치맵.get(i).length}개 규격)</h2>
        <div class="bchips">
${인치맵.get(i).map((s) => `          <a class="bchip" href="/${슬러그(s)}">${esc(s)} <span style="opacity:.55">${규격맵.get(s).length}</span></a>`).join("\n")}
        </div>
      </div>`).join("\n")}
    </div>
`;
  const 목록제목 = "타이어 규격별 공장도가격 전체 목록 - G";
  const 목록설명 = `타이어 ${규격들.length}개 규격의 공장도가격을 규격별로 모았습니다. 12인치부터 24인치까지 전 브랜드 공장도가 무료 조회.`;
  fs.mkdirSync(path.join(OUT, "sizes"), { recursive: true });
  fs.writeFileSync(path.join(OUT, "sizes", "index.html"),
    머리(목록제목, 목록설명, "/sizes", true) + 목록본문 + 꼬리);

  /* ── 사이트맵 ── */
  const 오늘 = new Date().toISOString().slice(0, 10);
  const xml = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <url>\n    <loc>${대표}/</loc>\n    <lastmod>${오늘}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    `  <url>\n    <loc>${대표}/sizes</loc>\n    <lastmod>${오늘}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.9</priority>\n  </url>`,
    ...사이트맵줄.sort().map((u) =>
      `  <url>\n    <loc>${대표}${u}</loc>\n    <lastmod>${오늘}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`),
    `  <url>\n    <loc>${대표}/privacy.html</loc>\n    <lastmod>${오늘}</lastmod>\n    <changefreq>yearly</changefreq>\n    <priority>0.1</priority>\n  </url>`,
    "</urlset>", ""].join("\n");
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), xml);

  console.log("규격 " + 규격들.length + "개 —— 색인 " + 색인장수 + "장 · noindex " + 숨긴장수 + "장" +
    (지운수 ? " · 없어진 규격 폴더 " + 지운수 + "개 지움" : ""));
  console.log("전체 목록 /sizes 1장, 사이트맵 " + (사이트맵줄.length + 3) + "줄");
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
