<?php
/* ============================================================
   업로드한 표에서 "어느 칸이 규격이고 어느 칸이 가격인지" 알아내고
   한 줄씩 정리해 주는 부분.
   컬럼 순서가 달라도, 제목만 비슷하면 알아서 찾아냅니다.
   ============================================================ */

require_once __DIR__ . '/모델한글.php';

/** 제목 칸에 들어올 법한 말들 */
const HEADER_ALIASES = [
    'brand'   => ['제조사', '브랜드', '메이커', '회사', 'brand', 'maker'],
    'model'   => ['모델', '모델명', '패턴', '패턴명', '제품코드', '품번', 'model', 'pattern'],
    'product' => ['제품명', '상품명', '품명', '제품', 'product', 'name'],
    'size'    => ['규격', '사이즈', '타이어규격', '표준규격', 'size', 'spec'],
    'season'  => ['계절', '시즌', '용도', 'season'],
    /* 공장도가가 먼저다. 소비자가는 뜻이 다른 값이지만, 그것밖에 없는 가격표도 있어 받아준다 */
    'price'   => ['공장도가', '공장도가격', '공장도', '매입가', '단가', '원가', '납품가', '가격',
                  '소비자가', '소비자가격', '권장소비자가', '판매가',
                  '부가세별도', 'listprice', 'list price', 'price', 'cost'],
    'extra'   => ['하중지수', '속도기호', '하중', '속도', 'li', 'si', '부가기호', '기타'],
    /* 공식 가격표는 XL·Ply·원산지가 각각 다른 칸에 있다. 합쳐서 규격 옆에 적어준다.
       8PR 과 10PR 은 값이 다른 별개 상품이라 반드시 화면에 보여야 한다 */
    'xl'      => ['xl'],
    'ply'     => ['ply', '플라이'],
    'origin'  => ['원산지', '제조국', '생산지'],
];

function norm_head(string $s): string {
    $s = preg_replace('/\s+/u', '', $s);
    $s = str_replace(['(', ')', '[', ']', '_', '-', '.', '/'], '', $s);
    return mb_strtolower($s, 'UTF-8');
}

/**
 * 제목 줄을 찾아 컬럼 위치를 알아낸다.
 * 반환: [행번호, ['size'=>2, 'price'=>5, ...]]  못 찾으면 [null, []]
 */
function detect_columns(array $rows): array {
    $limit = min(count($rows), 15);      // 앞 15줄 안에 제목이 있다고 본다
    for ($r = 0; $r < $limit; $r++) {
        $cells = [];
        foreach ($rows[$r] as $i => $cell) {
            $h = norm_head((string)$cell);
            if ($h !== '') $cells[$i] = $h;
        }
        if (!$cells) continue;

        $map  = [];
        $used = [];

        // 1차 — 제목이 정확히 일치하는 칸부터 잡는다 ("제품규격"이 제품명으로 잡히는 걸 막는다)
        foreach ($cells as $i => $h) {
            foreach (HEADER_ALIASES as $key => $words) {
                if (isset($map[$key])) continue;
                foreach ($words as $w) {
                    if ($h === norm_head($w)) { $map[$key] = $i; $used[$i] = true; break 2; }
                }
            }
        }
        // 2차 — 남은 칸을 제목에 그 말이 들어있는지로 잡는다
        foreach ($cells as $i => $h) {
            if (isset($used[$i])) continue;
            foreach (HEADER_ALIASES as $key => $words) {
                if (isset($map[$key])) continue;
                foreach ($words as $w) {
                    if (mb_strpos($h, norm_head($w)) !== false) { $map[$key] = $i; $used[$i] = true; break 2; }
                }
            }
        }

        // 규격과 가격을 둘 다 찾았으면 그 줄이 제목 줄이다
        if (isset($map['size']) && isset($map['price'])) {
            return [$r, $map];
        }
    }
    return [null, []];
}

/**
 * 규격 한 칸을 뜯어본다. 세 가지 표기를 받아준다.
 *   승용차용   225/45R18 95Y XL  → ['225/45R18',  '95Y XL', 225, 45,   18]
 *   화물·LT    195R15            → ['195R15',     '',       195, null, 15]
 *   오프로드   35X12.50R18       → ['35X12.50R18','',       null, null, 18]
 * 편평비가 없는 규격은 aspect 를 null 로 둔다 — 규격 페이지 주소를 만들 수 없다는 표시다.
 */
function split_size(string $raw): ?array {
    $s = trim(preg_replace('/\s+/u', ' ', $raw));
    if ($s === '') return null;

    /* 1. 승용차용 — 225/45R18, 225/45ZR18, 225-45-18, 225/45/18 */
    if (preg_match('/(\d{2,3})\s*[\/\-]\s*(\d{2,3})\s*(?:Z?RF?|[\/\-])\s*(\d{2}(?:\.\d)?)/i', $s, $m)) {
        $w = (int)$m[1];
        $a = (int)$m[2];
        $i = (int)$m[3];
        if ($w >= 100 && $w <= 400 && $a >= 20 && $a <= 95 && $i >= 10 && $i <= 30) {
            $rest = trim(trim(str_replace($m[0], '', $s)), " \t,·-");
            return [$w . '/' . $a . 'R' . $i, mb_substr($rest, 0, 40), $w, $a, $i];
        }
    }

    /* 2. 오프로드(인치 표기) — 35X12.50R18, 33x12.5R20, 28X8.50R15
          파일에 따라 엑스가 아니라 곱셈기호(×)로 적혀 오기도 한다. 모두 X 로 맞춘다 */
    if (preg_match('/(\d{2}(?:\.\d+)?)\s*[Xx×]\s*(\d{1,2}(?:\.\d+)?)\s*R\s*(\d{2})/iu', $s, $m)) {
        $i = (int)$m[3];
        if ($i >= 10 && $i <= 30) {
            $rest = trim(trim(str_replace($m[0], '', $s)), " \t,·-");
            return [$m[1] . 'X' . $m[2] . 'R' . $i, mb_substr($rest, 0, 40), null, null, $i];
        }
    }

    /* 3. 화물·LT(편평비 없음) — 195R15, 155R13, 500R12, 650R16
          "5.00R12" 처럼 소수점으로 적은 것도 같은 규격이므로 500R12 로 맞춰 준다 */
    $s3 = preg_replace('/^(\d)\.(\d{2})\s*R/i', '$1$2R', $s);
    if (preg_match('/^(\d{3})\s*R\s*\/?\s*(\d{2})(?![\d.])/i', $s3, $m)) {
        $s = $s3;
        $w = (int)$m[1];
        $i = (int)$m[2];
        if ($i >= 10 && $i <= 30) {
            $rest = trim(trim(str_replace($m[0], '', $s)), " \t,·-");
            return [$w . 'R' . $i, mb_substr($rest, 0, 40), $w, null, $i];
        }
    }

    return null;
}

/** "168,000원" / "₩168000" / "168000.0" → 168000 */
function clean_price(string $raw): ?int {
    $s = preg_replace('/[^\d.]/u', '', $raw);
    if ($s === '' || $s === '.') return null;
    $n = (int)round((float)$s);
    return $n > 0 ? $n : null;
}

function clean_season(string $raw): string {
    $s = preg_replace('/\s+/u', '', $raw);
    if ($s === '') return '';
    if (mb_strpos($s, '사계') !== false || mb_strpos($s, '올시즌') !== false) return '사계절';
    if (mb_strpos($s, '여름') !== false || mb_strpos($s, '썸머') !== false)   return '여름';
    if (mb_strpos($s, '겨울') !== false || mb_strpos($s, '윈터') !== false)   return '겨울';
    if (mb_strpos($s, 'suv')  !== false || mb_strpos($s, 'SUV') !== false)    return 'SUV';
    return mb_substr($s, 0, 20);
}

/**
 * 표 전체를 상품 목록으로 정리한다.
 * $defaultBrand — 파일에 제조사 칸이 없을 때 쓸 제조사 (업로드한 박스의 제조사)
 * 반환: ['items' => [...], 'skipped' => [ ['line'=>3, 'why'=>'규격을 못 읽음'], ... ]]
 */
function parse_rows(array $rows, string $defaultBrand, bool $forceBrand = false): array {
    [$headRow, $map] = detect_columns($rows);
    if ($headRow === null) {
        throw new RuntimeException('제목 줄을 찾지 못했습니다. 표 맨 윗줄에 "규격", "공장도가" 같은 제목이 있어야 합니다.');
    }

    $items = [];
    $skipped = [];
    $seen = [];
    $now = date('Y-m-d H:i:s');

    for ($r = $headRow + 1; $r < count($rows); $r++) {
        $row = $rows[$r];
        if (!$row) continue;

        $get = function (string $key) use ($row, $map): string {
            return isset($map[$key]) ? trim((string)($row[$map[$key]] ?? '')) : '';
        };

        $sizeRaw = $get('size');
        $priceRaw = $get('price');
        if ($sizeRaw === '' && $priceRaw === '') continue;      // 완전히 빈 줄

        $size = split_size($sizeRaw);
        if (!$size) {
            $skipped[] = ['line' => $r + 1, 'why' => '규격을 알아볼 수 없음', 'value' => mb_substr($sizeRaw, 0, 30)];
            continue;
        }
        $price = clean_price($priceRaw);
        if ($price === null) {
            $skipped[] = ['line' => $r + 1, 'why' => '가격이 비어 있거나 숫자가 아님', 'value' => mb_substr($priceRaw, 0, 30)];
            continue;
        }

        $brand = $forceBrand ? $defaultBrand : $get('brand');
        if ($brand === '') $brand = $defaultBrand;

        $spec = $size[1];
        if ($spec === '') $spec = mb_substr($get('extra'), 0, 40);

        /* XL · Ply · 원산지가 따로 있는 파일이면 규격 옆 한 줄로 합친다 */
        $덧 = [];
        if ($get('xl') !== '') $덧[] = $get('xl');
        $ply = preg_replace('/\D/', '', $get('ply'));
        if ($ply !== '') $덧[] = $ply . 'PR';
        if ($get('origin') !== '') $덧[] = $get('origin');
        if ($덧) $spec = mb_substr(trim($spec . ' ' . implode(' ', $덧)), 0, 40);

        /* 모델 칸 끝에 하중지수·속도기호가 붙어 있으면 떼어 규격 옆으로 옮긴다.
           "[IH01] iON evo AS 102Y XL 4PR KR"  → 모델 "[IH01] iON evo AS" · 옆 "102Y XL 4PR KR"
           "[Z001] Ventus evo Z (107Y) XL 4PR" → 괄호로 감싼 것도 같이 뗀다
           속도기호는 글자 하나다. "10PR" 같은 보강 표시는 뒤에 글자가 더 붙어 걸리지 않는다. */
        $model = $get('model');
        if (preg_match('/\s\(?(\d{2,3}(?:\/\d{2,3})?\(?[A-Z]\)?)\)?(?![A-Za-z0-9])/', $model, $mm, PREG_OFFSET_CAPTURE)) {
            $at   = $mm[0][1];
            $꼬리 = mb_substr(trim(substr($model, $at)), 0, 40);
            /* 규격 칸에서 이미 하중지수를 얻었으면 그것을 쓰고, 모델은 어쨌든 짧게 자른다 */
            if ($spec === '') $spec = $꼬리;
            $model = rtrim(substr($model, 0, $at));
        }

        /* 제품명 — 파일에 제품명 칸이 없으면 모델의 한글 표기를 붙인다 */
        $product = $get('product');

        /* 공식 가격표처럼 "패턴코드(IH01)" 와 "상품명(iON evo AS)" 이 따로 있는 파일은
           "[IH01] iON evo AS" 한 덩어리로 합친다 — 다른 가격표와 모양을 맞춘다 */
        if ($product !== '' && preg_match('/^[A-Z]{1,4}\d{1,4}[A-Z]?$/u', $model)) {
            $model   = '[' . $model . '] ' . $product;
            $product = '';
        }

        if ($product === '') $product = model_korean($model);

        $key = $brand . '|' . $model . '|' . $size[0] . '|' . $spec;
        if (isset($seen[$key])) {                                // 같은 줄이 두 번 있으면 뒤엣것으로
            $items[$seen[$key]]['price'] = $price;
            continue;
        }
        $seen[$key] = count($items);

        $items[] = [
            'brand'   => mb_substr($brand, 0, 40),
            'model'   => mb_substr($model, 0, 120),
            'product' => mb_substr($product, 0, 120),
            'size'    => $size[0],
            'spec'    => $spec,
            'season'  => clean_season($get('season')),
            'price'   => $price,
            'width'   => $size[2],
            'aspect'  => $size[3],
            'inch'    => $size[4],
            'updated_at' => $now,
        ];
    }

    if (!$items) {
        throw new RuntimeException('읽어들일 수 있는 줄이 하나도 없습니다. 규격과 가격 칸을 확인해 주세요.');
    }
    return ['items' => $items, 'skipped' => $skipped, 'columns' => array_keys($map)];
}
