/* ============================================================
   가격표 파서 — 웹/lib/parse.php 와 웹/lib/모델한글.php 를 그대로 옮긴 것.
   PHP 서버가 하던 일을 브라우저에서 한다. 규칙은 하나도 바꾸지 않았다.

   쓰는 법
     const [items, skipped] = 표읽기(rows, '한국');
     rows 는 엑셀을 줄·칸 이차원 배열로 읽은 것 (SheetJS 가 만들어 준다)
   ============================================================ */
(function (전역) {
  "use strict";

  /* ── 제목 칸에 들어올 법한 말들 ────────────────────────── */
  var 제목_별칭 = {
    brand:   ["제조사", "브랜드", "메이커", "회사", "brand", "maker"],
    model:   ["모델", "모델명", "패턴", "패턴명", "제품코드", "품번", "model", "pattern"],
    product: ["제품명", "상품명", "품명", "제품", "product", "name"],
    size:    ["규격", "사이즈", "타이어규격", "표준규격", "size", "spec"],
    season:  ["계절", "시즌", "용도", "season"],
    /* 공장도가가 먼저다. 소비자가는 뜻이 다른 값이지만, 그것밖에 없는 가격표도 있어 받아준다 */
    price:   ["공장도가", "공장도가격", "공장도", "매입가", "단가", "원가", "납품가", "가격",
              "소비자가", "소비자가격", "권장소비자가", "판매가", "부가세별도", "listprice", "list price", "price", "cost"],
    extra:   ["하중지수", "속도기호", "하중", "속도", "li", "si", "부가기호", "기타"],
    /* 공식 가격표는 XL·Ply·원산지가 각각 다른 칸에 있다. 합쳐서 규격 옆에 적어준다.
       8PR 과 10PR 은 값이 다른 별개 상품이라 반드시 화면에 보여야 한다 */
    xl:      ["xl"],
    ply:     ["ply", "플라이"],
    origin:  ["원산지", "제조국", "생산지"]
  };
  var 제목_차례 = ["brand", "model", "product", "size", "season", "price", "extra", "xl", "ply", "origin"];

  function 제목다듬기(s) {
    s = String(s == null ? "" : s).replace(/\s+/g, "");
    s = s.replace(/[()\[\]_\-./]/g, "");
    return s.toLowerCase();
  }

  /* 제목 줄을 찾아 칸 위치를 알아낸다. 못 찾으면 [null, {}] */
  function 제목줄찾기(rows) {
    var 끝 = Math.min(rows.length, 15);        // 앞 15줄 안에 제목이 있다고 본다
    for (var r = 0; r < 끝; r++) {
      var 줄 = rows[r] || [];
      var 칸 = {};
      for (var i = 0; i < 줄.length; i++) {
        var h = 제목다듬기(줄[i]);
        if (h !== "") 칸[i] = h;
      }
      if (!Object.keys(칸).length) continue;

      var 자리 = {}, 쓴것 = {};

      /* 1차 — 제목이 정확히 일치하는 칸부터 ("제품규격"이 제품명으로 잡히는 걸 막는다) */
      Object.keys(칸).forEach(function (i) {
        if (쓴것[i]) return;
        for (var k = 0; k < 제목_차례.length; k++) {
          var key = 제목_차례[k];
          if (자리[key] !== undefined) continue;
          var 말들 = 제목_별칭[key];
          for (var w = 0; w < 말들.length; w++) {
            if (칸[i] === 제목다듬기(말들[w])) { 자리[key] = +i; 쓴것[i] = true; return; }
          }
        }
      });
      /* 2차 — 남은 칸을 "그 말이 들어있는지"로 잡는다 */
      Object.keys(칸).forEach(function (i) {
        if (쓴것[i]) return;
        for (var k = 0; k < 제목_차례.length; k++) {
          var key = 제목_차례[k];
          if (자리[key] !== undefined) continue;
          var 말들 = 제목_별칭[key];
          for (var w = 0; w < 말들.length; w++) {
            if (칸[i].indexOf(제목다듬기(말들[w])) !== -1) { 자리[key] = +i; 쓴것[i] = true; return; }
          }
        }
      });

      /* 규격과 가격을 둘 다 찾았으면 그 줄이 제목 줄이다 */
      if (자리.size !== undefined && 자리.price !== undefined) return [r, 자리];
    }
    return [null, {}];
  }

  /**
   * 규격 한 칸을 뜯어본다. 세 가지 표기를 받아준다.
   *   승용차용   225/45R18 95Y XL  → ['225/45R18',  '95Y XL', 225, 45,   18]
   *   화물·LT    195R15            → ['195R15',     '',       195, null, 15]
   *   오프로드   35X12.50R18       → ['35X12.50R18','',       null, null, 18]
   * 편평비가 없는 규격은 aspect 를 null 로 둔다 — 규격 페이지 주소를 만들 수 없다는 표시다.
   */
  function 규격뜯기(raw) {
    var s = String(raw == null ? "" : raw).replace(/\s+/g, " ").trim();
    if (s === "") return null;
    var m;

    /* 1. 승용차용 — 225/45R18, 225/45ZR18, 245/50RF19(런플랫), 225-45-18, 225/45/18 */
    m = s.match(/(\d{2,3})\s*[/\-]\s*(\d{2,3})\s*(?:Z?RF?|[/\-])\s*(\d{2}(?:\.\d)?)/i);
    if (m) {
      var w = +m[1], a = +m[2], i1 = +m[3];
      if (w >= 100 && w <= 400 && a >= 20 && a <= 95 && i1 >= 10 && i1 <= 30) {
        return [w + "/" + a + "R" + i1, 나머지(s, m[0]), w, a, i1];
      }
    }

    /* 2. 오프로드(인치 표기) — 35X12.50R18, 33x12.5R20, 28X8.50R15
          파일에 따라 엑스가 아니라 곱셈기호(×)로 적혀 오기도 한다. 모두 X 로 맞춘다 */
    m = s.match(/(\d{2}(?:\.\d+)?)\s*[Xx×]\s*(\d{1,2}(?:\.\d+)?)\s*R\s*(\d{2})/i);
    if (m) {
      var i2 = +m[3];
      if (i2 >= 10 && i2 <= 30) {
        return [m[1] + "X" + m[2] + "R" + i2, 나머지(s, m[0]), null, null, i2];
      }
    }

    /* 3. 화물·LT(편평비 없음) — 195R15, 155R13, 500R12, 650R16, 145R/13
          "5.00R12" 처럼 소수점으로 적은 것도 같은 규격이므로 500R12 로 맞춰 준다 */
    var s3 = s.replace(/^(\d)\.(\d{2})\s*R/i, "$1$2R");
    m = s3.match(/^(\d{3})\s*R\s*\/?\s*(\d{2})(?![\d.])/i);
    if (m) {
      var w3 = +m[1], i3 = +m[2];
      if (i3 >= 10 && i3 <= 30) return [w3 + "R" + i3, 나머지(s3, m[0]), w3, null, i3];
    }

    return null;
  }

  function 나머지(s, 뺄것) {
    var r = s.replace(뺄것, "").trim();
    return r.replace(/^[\s,·\-]+|[\s,·\-]+$/g, "").slice(0, 40);
  }

  /** 이 규격으로 규격 페이지 주소(/225-45-18)를 만들 수 있는가 */
  function 규격주소있음(size) { return /^\d{3}\/\d{2}R\d{2}$/.test(size); }
  function 규격주소(size)     { return size.replace(/[/R]/g, "-"); }

  /** "168,000원" / "₩168000" / "168000.0" → 168000 */
  function 가격다듬기(raw) {
    var s = String(raw == null ? "" : raw).replace(/[^\d.]/g, "");
    if (s === "" || s === ".") return null;
    var n = Math.round(parseFloat(s));
    return n > 0 ? n : null;
  }

  function 계절다듬기(raw) {
    var s = String(raw == null ? "" : raw).replace(/\s+/g, "");
    if (s === "") return "";
    if (s.indexOf("사계") !== -1 || s.indexOf("올시즌") !== -1) return "사계절";
    if (s.indexOf("여름") !== -1 || s.indexOf("썸머") !== -1)   return "여름";
    if (s.indexOf("겨울") !== -1 || s.indexOf("윈터") !== -1)   return "겨울";
    if (s.toLowerCase().indexOf("suv") !== -1)                  return "SUV";
    return s.slice(0, 20);
  }

  /**
   * 표 전체를 상품 목록으로 정리한다.
   * 기준제조사 — 올린 박스의 제조사. 파일에 뭐라고 적혀 있든 이 이름으로 넣는다.
   * 반환: [items, skipped]
   */
  function 표읽기(rows, 기준제조사) {
    var 찾음 = 제목줄찾기(rows);
    var 제목줄 = 찾음[0], 자리 = 찾음[1];
    if (제목줄 === null) {
      throw new Error('제목 줄을 찾지 못했습니다. 표 맨 윗줄에 "규격", "공장도가" 같은 제목이 있어야 합니다.');
    }

    var items = [], skipped = [], 본것 = {};
    var 이제 = 지금시각();

    for (var r = 제목줄 + 1; r < rows.length; r++) {
      var 줄 = rows[r];
      if (!줄) continue;

      var 값 = function (key) {
        return 자리[key] === undefined ? "" : String(줄[자리[key]] == null ? "" : 줄[자리[key]]).trim();
      };

      var 규격원본 = 값("size"), 가격원본 = 값("price");
      if (규격원본 === "" && 가격원본 === "") continue;      // 완전히 빈 줄

      var 규격 = 규격뜯기(규격원본);
      if (!규격) {
        skipped.push({ line: r + 1, why: "규격을 알아볼 수 없음", value: 규격원본.slice(0, 30) });
        continue;
      }
      var 가격 = 가격다듬기(가격원본);
      if (가격 === null) {
        skipped.push({ line: r + 1, why: "가격이 비어 있거나 숫자가 아님", value: 가격원본.slice(0, 30) });
        continue;
      }

      var 제조사 = 기준제조사 || 값("brand") || "";

      var 스펙 = 규격[1];
      if (스펙 === "") 스펙 = 값("extra").slice(0, 40);

      /* XL · Ply · 원산지가 따로 있는 파일이면 규격 옆 한 줄로 합친다 */
      var 덧 = [];
      if (값("xl") !== "") 덧.push(값("xl"));
      var ply = 값("ply").replace(/\D/g, "");
      if (ply !== "") 덧.push(ply + "PR");
      if (값("origin") !== "") 덧.push(값("origin"));
      if (덧.length) 스펙 = (스펙 + " " + 덧.join(" ")).trim().slice(0, 40);

      /* 모델 칸 끝에 하중지수·속도기호가 붙어 있으면 떼어 규격 옆으로 옮긴다.
         "[IH01] iON evo AS 102Y XL 4PR KR"  → 모델 "[IH01] iON evo AS" · 옆 "102Y XL 4PR KR"
         "[Z001] Ventus evo Z (107Y) XL 4PR" → 괄호로 감싼 것도 같이 뗀다
         속도기호는 글자 하나다. "10PR" 같은 보강 표시는 뒤에 글자가 더 붙어 걸리지 않는다. */
      var 모델 = 값("model");
      var mm = 모델.match(/\s\(?(\d{2,3}(?:\/\d{2,3})?\(?[A-Z]\)?)\)?(?![A-Za-z0-9])/);
      if (mm) {
        var 자름 = mm.index;
        var 꼬리 = 모델.slice(자름).trim().slice(0, 40);
        if (스펙 === "") 스펙 = 꼬리;
        모델 = 모델.slice(0, 자름).replace(/\s+$/, "");
      }

      /* 제품명 — 파일에 제품명 칸이 없으면 모델의 한글 표기를 붙인다 */
      var 제품 = 값("product");

      /* 공식 가격표처럼 "패턴코드(IH01)" 와 "상품명(iON evo AS)" 이 따로 있는 파일은
         "[IH01] iON evo AS" 한 덩어리로 합친다 — 다른 가격표와 모양을 맞춘다 */
      if (제품 !== "" && /^[A-Z]{1,4}\d{1,4}[A-Z]?$/.test(모델)) {
        모델 = "[" + 모델 + "] " + 제품;
        제품 = "";
      }
      if (제품 === "") 제품 = 전역.모델한글(모델);

      var 열쇠 = 제조사 + "|" + 모델 + "|" + 규격[0] + "|" + 스펙;
      if (본것[열쇠] !== undefined) {          // 같은 줄이 두 번 있으면 뒤엣것으로
        items[본것[열쇠]].price = 가격;
        continue;
      }
      본것[열쇠] = items.length;

      items.push({
        brand:   제조사.slice(0, 40),
        model:   모델.slice(0, 120),
        product: 제품.slice(0, 120),
        size:    규격[0],
        spec:    스펙,
        season:  계절다듬기(값("season")),
        price:   가격,
        width:   규격[2],
        aspect:  규격[3],
        inch:    규격[4],
        updated_at: 이제
      });
    }

    if (!items.length) {
      throw new Error("읽을 수 있는 줄이 하나도 없습니다. 규격과 가격 칸을 확인해 주세요.");
    }
    return [items, skipped];
  }

  function 지금시각() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " +
           p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  전역.표읽기       = 표읽기;
  전역.규격뜯기     = 규격뜯기;
  전역.가격다듬기   = 가격다듬기;
  전역.계절다듬기   = 계절다듬기;
  전역.규격주소있음 = 규격주소있음;
  전역.규격주소     = 규격주소;
  전역.제목줄찾기   = 제목줄찾기;

})(typeof window !== "undefined" ? window : globalThis);
