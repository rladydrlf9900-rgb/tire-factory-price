<?php
/* ============================================================
   업로드한 표에서 "어느 칸이 규격이고 어느 칸이 가격인지" 알아내고
   한 줄씩 정리해 주는 부분.
   컬럼 순서가 달라도, 제목만 비슷하면 알아서 찾아냅니다.
   ============================================================ */

/** 제목 칸에 들어올 법한 말들 */
const HEADER_ALIASES = [
    'brand'   => ['제조사', '브랜드', '메이커', '회사', 'brand', 'maker'],
    'model'   => ['모델', '모델명', '패턴', '패턴명', '제품코드', '품번', 'model', 'pattern'],
    'product' => ['제품명', '상품명', '품명', '제품', 'product', 'name'],
    'size'    => ['규격', '사이즈', '타이어규격', '표준규격', 'size', 'spec'],
    'season'  => ['계절', '시즌', '용도', 'season'],
    'price'   => ['공장도가', '공장도가격', '공장도', '매입가', '단가', '원가', '납품가', '가격', 'price', 'cost'],
    'extra'   => ['하중지수', '속도기호', 'li', 'si', '부가기호', '기타'],
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

/** "225/45R18 95Y XL" → ['225/45R18', '95Y XL', 225, 45, 18] */
function split_size(string $raw): ?array {
    $s = trim(preg_replace('/\s+/u', ' ', $raw));
    if ($s === '') return null;

    // 225/45R18, 225/45ZR18, 225-45-18, 225/45/18 을 모두 받아준다
    if (!preg_match('/(\d{2,3})\s*[\/\-]\s*(\d{2,3})\s*(?:Z?R|[\/\-])\s*(\d{2}(?:\.\d)?)/i', $s, $m)) {
        return null;
    }
    $w = (int)$m[1];
    $a = (int)$m[2];
    $i = (int)$m[3];
    if ($w < 100 || $w > 400 || $a < 20 || $a > 95 || $i < 10 || $i > 30) return null;

    $size = $w . '/' . $a . 'R' . $i;
    // 규격 뒤에 남은 글자를 하중지수·속도기호로 본다
    $rest = trim(str_replace($m[0], '', $s));
    $rest = trim($rest, " \t,·-");
    return [$size, mb_substr($rest, 0, 40), $w, $a, $i];
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
function parse_rows(array $rows, string $defaultBrand): array {
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

        $brand = $get('brand');
        if ($brand === '') $brand = $defaultBrand;

        $spec = $size[1];
        if ($spec === '') $spec = mb_substr($get('extra'), 0, 40);

        $key = $brand . '|' . $get('model') . '|' . $size[0] . '|' . $spec;
        if (isset($seen[$key])) {                                // 같은 줄이 두 번 있으면 뒤엣것으로
            $items[$seen[$key]]['price'] = $price;
            continue;
        }
        $seen[$key] = count($items);

        $items[] = [
            'brand'   => mb_substr($brand, 0, 40),
            'model'   => mb_substr($get('model'), 0, 120),
            'product' => mb_substr($get('product'), 0, 120),
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
