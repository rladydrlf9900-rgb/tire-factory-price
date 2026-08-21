/* ============================================================
   타이어 공장도가격 - G  — 서비스 워커

   하는 일 두 가지
     1. 앱으로 설치되게 한다 (구글플레이에 올리려면 이 파일이 꼭 있어야 한다)
     2. 인터넷이 끊겨도 마지막에 본 화면이 열리게 한다

   캐시 규칙 — 전송량을 아끼되 새 내용은 바로 보이게
     · html   : 인터넷 먼저. 실패하면 저장해 둔 것으로 (그래야 화면이 바뀌면 바로 보인다)
     · assets : 저장해 둔 것 먼저. 주소에 ?v= 번호표가 붙어 있어 파일이 바뀌면 주소가 바뀐다
     · 파이어스토어 등 바깥 주소 : 손대지 않는다
   ============================================================ */
"use strict";

var 캐시이름 = "타이어공장도가격-v1";
var 기본화면 = "/";

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(캐시이름).then(function (c) { return c.add(기본화면); })
      .catch(function () { /* 첫 방문에 실패해도 앱은 정상 동작한다 */ })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (이름들) {
      return Promise.all(이름들.map(function (n) {
        return n === 캐시이름 ? null : caches.delete(n);   // 옛 캐시는 지운다
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;   // 가격표를 받아오는 파이어스토어는 그대로 둔다

  var html화면 = req.mode === "navigate" || url.pathname === "/" || /\.html$/.test(url.pathname);

  if (html화면) {
    e.respondWith(
      fetch(req).then(function (res) {
        var 사본 = res.clone();
        caches.open(캐시이름).then(function (c) { c.put(req, 사본); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (있음) {
          return 있음 || caches.match(기본화면);
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (있음) {
      if (있음) return 있음;
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === "basic") {
          var 사본 = res.clone();
          caches.open(캐시이름).then(function (c) { c.put(req, 사본); });
        }
        return res;
      });
    })
  );
});
