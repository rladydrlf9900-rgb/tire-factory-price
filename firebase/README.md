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

## 배포

```
cd firebase
firebase deploy --only hosting,firestore:rules --project tireprice-g
```
