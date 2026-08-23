# 파이어베이스 판 — 타이어 공장도가격 - G

가비아(PHP + MySQL) 판을 파이어베이스로 옮긴 것. 서버가 없다.

| | |
|---|---|
| 프로젝트 | `tireprice-g` |
| 주소 | https://tireprice-g.web.app |
| 저장소 | Firestore (Spark 무료 요금제) |

## 어떻게 도나

```
손님 화면   meta/current 로 "버전"만 확인
            → 안 바뀌었으면 브라우저에 저장해 둔 것을 씀 (요청 1번)
            → 바뀌었으면 prices/* 를 받아 다시 저장 (요청 2번)

관리자      엑셀을 브라우저에서 SheetJS 로 읽고
            parser.js 가 규격·모델을 뜯어 Firestore 에 넣는다
            → 서버가 필요 없다
```

## Firestore 생김새

| 문서 | 내용 |
|---|---|
| `meta/current` | `version` · `brands[]` · `count` — 누구나 읽기 |
| `prices/{제조사}` | `json`(줄 배열을 문자열로) · `n` — 누구나 읽기 |
| `uploads/{시각}` | `brand` `filename` `n` `at` `backup` `restored` — 관리자만 |

`firestore.rules` 가 이 규칙을 지킨다. 쓰기는 로그인한 사람만.

## 파일

```
public/
  index.html          손님 화면
  admin.html          관리자 화면
  assets/
    app.js            손님 화면 동작
    admin.js          엑셀 올리기 · 되돌리기 · 비밀번호
    parser.js         웹/lib/parse.php 를 옮긴 것
    model-korean.js   웹/lib/모델한글.php 를 옮긴 것
    xlsx.min.js       SheetJS (엑셀 읽기)
    style.css         가비아 판과 같은 파일
```

## 고칠 때

한글 이름 표기를 바꾸려면 `assets/model-korean.js` 의 세 표만 고친다.
가격표 읽는 규칙을 바꾸려면 `assets/parser.js` 를 고친다.
가비아 판(`웹/lib/*.php`)과 규칙이 같아야 하므로 한쪽만 고치지 말 것.

## 규격별 페이지 (436장)

`/245-45-18` 처럼 규격마다 페이지가 있다. 사람들이 자기 규격으로 검색하기 때문에
잡을 수 있는 검색어가 홈 한 장일 때보다 수백 배 많아진다.

- 만드는 것 : `규격페이지.js` — Firestore 가격표를 읽어 `public/<규격>/index.html` 을 찍는다
- 색인 기준 : 품목 **2개 이상**만 사이트맵에 넣는다. 1개뿐인 83장은 `noindex`
  (얇은 페이지를 대량 색인시키면 사이트 전체가 감점당한다)
- 주소 모양 : **폴더식 + `firebase.json` 의 `trailingSlash:false`**
  ⚠ **`cleanUrls` 를 켜면 안 된다.** `.html` 주소가 전부 301 로 튕겨
  **네이버·구글 소유확인 파일(`naver….html`·`google….html`)의 인증이 풀린다.**
  임시 채널에 올려 실제로 시험해서 확인한 사항이다.
- 화면 : `assets/app.js` 의 `rowHtml` 을 그대로 옮겼다.
  ⚠ **app.js 의 카드 모양을 고치면 `규격페이지.js` 의 `카드()` 도 같이 고쳐야 한다.**

## 배포

**★ 가격표를 새로 올렸으면 규격 페이지부터 다시 만든다.** 안 하면 옛 가격이 남는다.

```
cd firebase
node 규격페이지.js          ← 가격표가 바뀌었을 때 (없어진 규격 폴더도 지운다)
node 버전찍기.js            ← assets 번호표 (1년 캐시라 없으면 반영이 안 된다)
firebase deploy --only hosting,firestore:rules --project tireprice-g
```
