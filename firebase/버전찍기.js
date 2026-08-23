/* ============================================================
   assets 파일마다 번호표(?v=크기-수정시각)를 붙인다.

   왜 필요한가 —
     assets 는 1년 캐시로 걸어 두었다(전송량을 아끼려고).
     그래서 파일을 고쳐도 이미 방문한 손님 브라우저는 예전 것을 계속 쓴다.
     html 은 캐시하지 않으므로, html 안의 주소에 번호표를 바꿔 달면
     그때만 새로 받아 간다. 안 바뀐 파일은 그대로 캐시를 쓴다.

   쓰는 법 —  cd firebase && node 버전찍기.js   (배포 전에 한 번)
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");

const 공개 = path.join(__dirname, "public");

/* public 안의 html 을 전부 찾는다 (assets 는 뺀다).
   규격페이지.js 가 만드는 436장(245-45-18/index.html …)도 여기 들어와야 한다 —
   빠지면 그 페이지들만 옛 css 를 물고 있게 된다 */
function html전부(dir, 앞 = "") {
  const 나온것 = [];
  for (const 이름 of fs.readdirSync(dir)) {
    if (이름 === "assets" || 이름.startsWith(".")) continue;
    const 길 = path.join(dir, 이름);
    if (fs.statSync(길).isDirectory()) 나온것.push(...html전부(길, 앞 + 이름 + "/"));
    else if (이름.endsWith(".html")) 나온것.push(앞 + 이름);
  }
  return 나온것;
}
const 대상 = html전부(공개);

function 번호표(자산길) {
  const 파일 = path.join(공개, 자산길.replace(/^\//, ""));
  const s = fs.statSync(파일);
  return s.size + "-" + Math.floor(s.mtimeMs / 1000);
}

let 바뀐수 = 0;
for (const 이름 of 대상) {
  const 길 = path.join(공개, 이름);
  const 전 = fs.readFileSync(길, "utf8");

  /* href="/assets/….css"  또는  src="/assets/….js"  — 기존 ?v= 는 떼고 새로 붙인다 */
  const 후 = 전.replace(/(["'])(\/assets\/[^"'?]+\.(?:css|js))(?:\?[^"']*)?\1/g,
    (_, q, 자산) => q + 자산 + "?v=" + 번호표(자산) + q);

  if (후 !== 전) {
    fs.writeFileSync(길, 후); 바뀐수++;
    if (바뀐수 <= 10) console.log("찍음  " + 이름);
    else if (바뀐수 === 11) console.log("찍음  … (나머지는 줄여서 안 적는다)");
  }
}
console.log("html " + 대상.length + "장 중 " + 바뀐수 + "장에 번호표를 새로 찍었습니다.");
