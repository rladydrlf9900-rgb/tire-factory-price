/* ============================================================
   모델 이름의 한글 표기 — 웹/lib/모델한글.php 를 그대로 옮긴 것.

   표기 원칙 — 한글 공식 표기보다 영어 발음에 가깝게 적는다.
   (Vantra = Van 이므로 반트라·벤트라가 아니라 밴트라)

   한 모델씩 표를 만들지 않고 "낱말 사전"으로 조합한다.
   그래야 새 모델이 나와도 손대지 않고 한글 이름이 붙는다.
   바꾸고 싶은 표기가 있으면 아래 세 표만 고치면 된다.
   ============================================================ */
(function (전역) {
  "use strict";

  /** 여러 낱말이 붙어 한 이름이 되는 것들 — 낱말 사전보다 먼저 바꾼다 (긴 것부터) */
  var 이름_묶음 = {
    "maxi-vantage": "맥시밴티지",
    "mileage plus": "마일리지 플러스",
    "winter radial": "윈터 레이디얼",
    "i*cept": "아이셉트",
    "i*pike": "아이파이크",
    "s fit": "에스핏",
    "g fit": "지핏",
    "x fit": "엑스핏",
    "air s": "에어 S",
    "win spike3": "윈 스파이크3",
    "ice-zag": "아이스재그",
    "i.q series1": "아이큐 시리즈1",
    "road venture": "로드 벤처",
    "super mile": "슈퍼 마일",
    "marshal tire": "마샬 타이어",
    "sp sport": "SP 스포츠",
    "blue response": "블루 리스폰스",
    "all season": "올시즌",
    "open country": "오픈컨트리",
    "w. at adventure": "랭글러 AT 어드벤처",
    "w. at adv": "랭글러 AT 어드벤처",
    "wrl territory": "랭글러 테리토리",
    "c. marathon": "카고 마라톤",
    "cargomax": "카고맥스",
    "a. finesse": "어슈어런스 피네스",
    "v. 4seasons": "벡터 4시즌",
    "eag f1": "이글 F1",
    "e. f1": "이글 F1",
    "e.f1": "이글 F1",
    "e. prf": "이글 퍼포먼스",
    "e.prf": "이글 퍼포먼스",
    "e. rs-a": "이글 RS-A",
    "e. ls2": "이글 LS2",
    "e. touring": "이글 투어링",
    "e.touring": "이글 투어링",
    "a. maxguard": "어슈어런스 맥스가드",
    "a.maxguard": "어슈어런스 맥스가드",
    "effigrip": "에피션트그립",
    "efg": "에피션트그립"
  };

  /** 줄임 코드로만 적힌 모델 — 통째로 맞을 때만 바꾼다 (피렐리 가격표가 이렇게 온다) */
  var 이름_코드 = {
    "p-zero": "피제로",
    "pzero": "피제로",
    "pzero5": "피제로 5",
    "pzeror": "피제로 R",
    "pzeroe": "피제로 E",
    "pcorsa": "피제로 코르사",
    "corsaa": "피제로 코르사",
    "wpzero": "윈터 피제로",
    "wpzer2": "윈터 피제로 2",
    "rosso": "로쏘",
    "scorpn": "스콜피온",
    "s-verd": "스콜피온 베르데",
    "s-veas": "스콜피온 베르데 올시즌",
    "sveasf": "스콜피온 베르데 올시즌",
    "s-zero": "스콜피온 제로",
    "szroas": "스콜피온 제로 올시즌",
    "s-wnt": "스콜피온 윈터",
    "s-wnt2": "스콜피온 윈터 2",
    "s-wnt3": "스콜피온 윈터 3",
    "s-atr": "스콜피온 ATR",
    "s-a/t+": "스콜피온 A/T 플러스",
    "s-str": "스콜피온 STR",
    "wszer3": "윈터 소토제로 3",
    "w210s2": "윈터 소토제로 210 시리즈2",
    "w240s2": "윈터 소토제로 240 시리즈2",
    "w270s2": "윈터 소토제로 270 시리즈2",
    "sc-ms": "스콜피온 MS",
    "sc-sf3": "스콜피온 올시즌 SF3",
    "s-as+3": "스콜피온 올시즌 플러스3",
    "szas+3": "스콜피온 제로 올시즌 플러스",
    "szras+": "스콜피온 제로 올시즌 플러스",
    "svas+2": "스콜피온 베르데 올시즌 플러스2",
    "pzras": "피제로 올시즌",
    "pzras+": "피제로 올시즌 플러스",
    "pzas+3": "피제로 올시즌 플러스 3",
    "p7cint": "신투라토 P7",
    "p7-cnt": "신투라토 P7",
    "p1cint": "신투라토 P1",
    "cnp9as": "신투라토 P9",
    "cntsf3": "신투라토 올시즌 SF3",
    "p7as": "신투라토 P7 올시즌",
    "p7as+": "신투라토 P7 올시즌 플러스",
    "p7as+2": "신투라토 P7 올시즌 플러스2",
    "p7as+3": "신투라토 P7 올시즌 플러스3",
    "p7blue": "신투라토 P7 블루",
    "iceza": "아이스 제로",
    "pwrgy": "파워지",
    "neroas": "네로 올시즌",
    "vx3": "아트레즈 컴포트",
    "sva1": "아트레조",
    "zsr": "아트레조",
    "zsr2": "아트레조2",
    "t005": "투란자",
    "t005a": "투란자",
    "t005ad": "투란자",
    "t005l": "투란자",
    "re005": "포텐자 아드레날린",
    "ep300": "에코피아",
    "kc53": "포트란",
    "kc55": "포트란"
  };

  /** 낱말 사전 — 왼쪽이 파일에 적힌 말, 오른쪽이 한글 표기 */
  var 이름_낱말 = {
    "ventus": "벤투스",
    "kinergy": "키너지",
    "dynapro": "다이나프로",
    "optimo": "옵티모",
    "vantra": "밴트라",
    "ion": "아이온",
    "winter": "윈터",
    "radial": "레이디얼",
    "smart": "스마트",
    "weatherflex": "웨더플렉스",
    "xtreme": "익스트림",
    "transit": "트랜짓",
    "drive": "드라이브",
    "evo": "에보",
    "evo2": "에보2",
    "evo3": "에보3",
    "evo4": "에보4",
    "eco": "에코",
    "eco2": "에코2",
    "prime": "프라임",
    "prime3": "프라임3",
    "prime4": "프라임4",
    "prime5": "프라임5",
    "flexclimate": "플렉스클라이맷",
    "noble": "노블",
    "noble2": "노블2",
    "plus": "플러스",
    "plus3": "플러스3",
    "nfera": "엔페라",
    "nblue": "엔블루",
    "npriz": "엔프리즈",
    "roadian": "로디안",
    "winguard": "윈가드",
    "supreme": "슈프림",
    "primus": "프리머스",
    "sport": "스포츠",
    "4season": "포시즌",
    "snowg": "스노우G",
    "milecap": "마일캡",
    "ecsta": "엑스타",
    "solus": "솔루스",
    "crugen": "크루젠",
    "majesty": "마제스티",
    "craft": "크래프트",
    "advance": "어드밴스",
    "premium": "프리미엄",
    "supermile": "슈퍼마일",
    "ennov": "에노브",
    "marshal": "마샬",
    "pilot": "파일럿",
    "primacy": "프라이머시",
    "crossclimate": "크로스클라이맷",
    "latitude": "라티튜드",
    "agilis": "아질리스",
    "energy": "에너지",
    "saver": "세이버",
    "super": "슈퍼",
    "potenza": "포텐자",
    "turanza": "투란자",
    "alenza": "알렌자",
    "ecopia": "에코피아",
    "dueler": "듀얼러",
    "blizzak": "블리자크",
    "destination": "데스티네이션",
    "weathergrip": "웨더그립",
    "advan": "어드반",
    "bluearth": "블루어스",
    "geolandar": "지오랜다",
    "avid": "애비드",
    "ascend": "어센드",
    "apex": "에이펙스",
    "ultracontact": "울트라콘택트",
    "ecocontact": "에코콘택트",
    "premiumcontact": "프리미엄콘택트",
    "crosscontact": "크로스콘택트",
    "extremecontact": "익스트림콘택트",
    "comfortcontact": "컴포트콘택트",
    "maxcontact": "맥스콘택트",
    "procontact": "프로콘택트",
    "allseasoncontact": "올시즌콘택트",
    "wintercontact": "윈터콘택트",
    "sportcontact": "스포츠콘택트",
    "vancontact": "밴콘택트",
    "truecontact": "트루콘택트",
    "maxx": "맥스",
    "grandtrek": "그란트렉",
    "enasave": "에나세이브",
    "veuro": "뷰로",
    "touring": "투어링",
    "response": "리스폰스",
    "blue": "블루",
    "eagle": "이글",
    "assurance": "어슈어런스",
    "vector": "벡터",
    "4seasons": "4시즌",
    "maxguard": "맥스가드",
    "efficientgrip": "에피션트그립",
    "excellence": "엑설런스",
    "perf": "퍼포먼스",
    "territory": "테리토리",
    "marathon": "마라톤",
    "finesse": "피네스",
    "proxes": "프록세스",
    "comfort": "컴포트",
    "celsius": "셀시우스",
    "quatrac": "콰트락",
    "ultrac": "울트락",
    "pinza": "핀자",
    "hypertrac": "하이퍼트락",
    "comtrac2": "콤트락2"
  };

  /* 사전의 말이 정규식 기호를 품고 있어도(P-ZERO, S-A/T+, i*cept) 글자 그대로 찾게 한다 */
  function 기호막기(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * 모델 이름의 한글 표기를 만든다.
   * 아는 낱말이 하나도 없으면 빈 글자를 준다 — 억지로 붙이지 않는다.
   */
  function 모델한글(model) {
    /* 앞에 붙은 모델코드 "[K435] " 는 떼어낸다 */
    var s = String(model == null ? "" : model).replace(/^\[[^\]]*\]\s*/, "").trim();
    /* 괄호 안 설명은 한글 이름에 넣지 않는다 */
    s = s.replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (s === "") return "";

    /* 줄임 코드 하나로만 된 모델은 표에서 통째로 찾는다 */
    var 코드 = s.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(이름_코드, 코드)) return 이름_코드[코드];

    var 바뀜 = false;

    /* 1. 묶음 이름 먼저 */
    Object.keys(이름_묶음).forEach(function (en) {
      var re = new RegExp(기호막기(en), "gi");
      if (re.test(s)) {
        s = s.replace(new RegExp(기호막기(en), "gi"), 이름_묶음[en]);
        바뀜 = true;
      }
    });

    /* 2. 낱말 하나씩 */
    var 낱말들 = s.split(/\s+/);
    for (var i = 0; i < 낱말들.length; i++) {
      var w = 낱말들[i];
      /* N'FERA · N"FERA · N’FERA 처럼 따옴표 자리가 파일마다 다르다 — 떼고 찾는다 */
      var key = w.replace(/['"’”`]/g, "").toLowerCase();

      if (Object.prototype.hasOwnProperty.call(이름_낱말, key)) {
        낱말들[i] = 이름_낱말[key];
        바뀜 = true;
      } else if (Object.prototype.hasOwnProperty.call(이름_코드, key)) {
        /* "KC53 6PR" 처럼 코드 뒤에 다른 말이 붙은 경우 — 코드만 바꾸고 뒤는 그대로 둔다 */
        낱말들[i] = 이름_코드[key];
        바뀜 = true;
      } else if (key.indexOf("-") !== -1) {
        /* "BluEarth-4S" 처럼 붙임표로 이어진 것은 앞부분만 바꾸고 뒤는 그대로 둔다 */
        var 머리 = key.slice(0, key.indexOf("-"));
        if (Object.prototype.hasOwnProperty.call(이름_낱말, 머리)) {
          낱말들[i] = 이름_낱말[머리] + w.slice(머리.length);
          바뀜 = true;
        }
      }
    }

    if (!바뀜) return "";
    return 낱말들.join(" ").replace(/\s+/g, " ").trim();
  }

  전역.모델한글 = 모델한글;

})(typeof window !== "undefined" ? window : globalThis);
